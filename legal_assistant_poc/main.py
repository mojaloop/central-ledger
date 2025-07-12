import os
from fastapi import FastAPI, APIRouter
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import List, Optional, Dict
import re

# Import modules from the package
from . import translation
from . import nlp
from . import retrieval
# Caching is used by retrieval module internally, no direct calls from main needed for now.

# Determine the absolute path to the static directory
# This assumes main.py is in legal_assistant_poc directory
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")


app = FastAPI(
    title="German Legal Assistant PoC",
    description="Proof of Concept for an AI Paralegal for German Law.",
    version="0.1.0",
)

# Mount static files first, so it doesn't override other routes if not specific enough
# However, for a single page app, we often serve index.html on root
# and let other API routes be separate.
app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# API Router for API specific endpoints
api_router = APIRouter(prefix="/api")


# Pydantic models for request and response bodies
class QueryRequest(BaseModel):
    query_text: str
    source_language: str = "de"  # Default to German, can be "en"

class LawResult(BaseModel):
    law_book: Optional[str] = None
    paragraph: Optional[str] = None
    content: Optional[str] = None
    url: Optional[str] = None
    source: Optional[str] = None # "cache" or "web"
    relevance_note: Optional[str] = None

class QueryResponse(BaseModel):
    original_query: str
    detected_language: str
    processed_query: str  # This will hold the query translated to German if needed
    keywords: List[str]
    retrieved_laws: List[LawResult] = []
    message: str

# Regex to detect direct law references like "BGB 823" or "§ 263 StGB"
LAW_REFERENCE_PATTERN = re.compile(
    r"(?:§\s*)?(\d+[a-zA-Z]?(?:\s*Abs\s*\d+)?(?:\s*Nr\s*\d+)?)\s*([a-zA-Z]{2,10})",  # Paragraph and Law (e.g., 823 BGB)
    re.IGNORECASE
)
LAW_REFERENCE_PATTERN_REVERSE = re.compile(
    r"([a-zA-Z]{2,10})\s*(?:§\s*)?(\d+[a-zA-Z]?(?:\s*Abs\s*\d+)?(?:\s*Nr\s*\d+)?)", # Law and Paragraph (e.g., BGB 823)
    re.IGNORECASE
)


@api_router.post("/query", response_model=QueryResponse, tags=["Legal Queries"])
async def handle_query(request: QueryRequest):
    """
    Handles a user's legal query.
    - Detects language (rudimentary).
    - Translates to German if input is English (placeholder for now).
    - Extracts keywords.
    - Attempts to find direct law references.
    - Retrieves law text.
    - Translates results to English if original query was English (placeholder).
    """
    original_query = request.query_text
    source_lang_input = request.source_language.lower()

    # --- 1. Language Handling (Detection & Translation to German for processing) ---
    detected_lang = source_lang_input
    processing_query = original_query

    if detected_lang == "en":
        processing_query = translation.translate_to_german(original_query)
    elif detected_lang != "de":
        # Return a proper QueryResponse object for errors too, so frontend can parse it
        return QueryResponse(
            original_query=original_query,
            detected_language=detected_lang,
            processed_query=processing_query,
            keywords=[],
            retrieved_laws=[],
            message=f"Error: Unsupported source language '{request.source_language}'. PoC supports 'de' or 'en'."
        )

    # --- 2. Keyword Extraction ---
    extracted_keywords = nlp.extract_keywords(processing_query, lang="de")

    # --- 3. Information Retrieval ---
    retrieved_laws_results: List[LawResult] = []
    message = "Query processed."

    direct_law_match_tuple = None
    law_ref_match_direct = LAW_REFERENCE_PATTERN.search(original_query)
    if law_ref_match_direct:
        para_num, law_book_short = law_ref_match_direct.groups()
        direct_law_match_tuple = (law_book_short.upper(), para_num)
    else:
        law_ref_match_reverse = LAW_REFERENCE_PATTERN_REVERSE.search(original_query)
        if law_ref_match_reverse:
            law_book_short, para_num = law_ref_match_reverse.groups()
            direct_law_match_tuple = (law_book_short.upper(), para_num)

    if direct_law_match_tuple:
        law_book_short, para_num_raw = direct_law_match_tuple
        para_num = re.sub(r"[^\w]", "", para_num_raw) # Clean paragraph number

        message += f" Found direct law reference: {law_book_short} §{para_num}."
        law_info = retrieval.fetch_law_paragraph_text(law_book_short, para_num)
        if law_info:
            retrieved_laws_results.append(LawResult(
                law_book=law_book_short,
                paragraph=para_num,
                content=law_info["content"],
                url=law_info["url"],
                source=law_info.get("source", "web")
            ))
        else:
            message += f" Could not retrieve text for {law_book_short} §{para_num}."

    elif extracted_keywords:
        tentative_law_book = "BGB"
        if any(k in ["straf", "diebstahl", "betrug", "körperverletzung", "stgb"] for k in extracted_keywords): # Added "stgb"
            tentative_law_book = "StGB"
        elif any(k in ["sgb", "jobcenter", "arbeitslosengeld", "bürgergeld", "alg1", "alg2"] for k in extracted_keywords):
            # Basic routing for SGB, could be more specific (SGB II, SGB III) later
            tentative_law_book = "SGB II" # Default to SGB II for Jobcenter/Bürgergeld
            if "alg1" in extracted_keywords or "arbeitslosengeld i" in extracted_keywords : # Check for ALG I
                 tentative_law_book = "SGB III"

        message += f" Attempting keyword-based search in {tentative_law_book} with keywords: {extracted_keywords}."
        keyword_search_results = retrieval.search_laws_by_keyword(tentative_law_book, extracted_keywords)
        for res in keyword_search_results:
            if res.get("paragraph") != "N/A":
                 retrieved_laws_results.append(LawResult(**res))
            else:
                message += f" {res.get('content_preview', '')}" # Ensure content_preview exists

    if not retrieved_laws_results and not direct_law_match_tuple: # Adjusted condition
        message += " No specific law paragraphs retrieved based on query."

    # --- 4. Translation of Results (if original query was English) ---
    if detected_lang == "en" and retrieved_laws_results:
        for law_res in retrieved_laws_results:
            if law_res.content:
                law_res.content = translation.translate_to_english(law_res.content)
        message += " Retrieved content translated to English (simulation)."

    return QueryResponse(
        original_query=original_query,
        detected_language=detected_lang,
        processed_query=processing_query,
        keywords=extracted_keywords,
        retrieved_laws=retrieved_laws_results,
        message=message
    )

# Include the API router
app.include_router(api_router)

@app.get("/", response_class=FileResponse, tags=["Frontend"])
async def read_index():
    """Serves the main HTML page."""
    index_path = os.path.join(STATIC_DIR, "index.html")
    if not os.path.exists(index_path):
        return {"error": "index.html not found"} # Should not happen if file is there
    return FileResponse(index_path)


# To run this app (from the project root, one level above 'legal_assistant_poc'):
# python -m uvicorn legal_assistant_poc.main:app --reload
# Then open your browser to http://127.0.0.1:8000
# API queries go to http://127.0.0.1:8000/api/query
# Example POST to /api/query:
# {"query_text": "Was steht in BGB 823?", "source_language": "de"}
# {"query_text": "What is § 263 StGB about?", "source_language": "en"}
# {"query_text": "Information about Mietvertrag", "source_language": "de"}
# {"query_text": "jobcenter leistungen", "source_language": "de"}
