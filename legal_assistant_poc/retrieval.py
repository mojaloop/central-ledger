import requests
from bs4 import BeautifulSoup
import re
from typing import Optional, Dict, List
from .caching import get_law_cache, set_law_cache, get_cache, set_cache

# Base URL for Gesetze im Internet
GESETZE_IM_INTERNET_BASE_URL = "https://www.gesetze-im-internet.de"

def get_headers():
    """Returns standard headers for web requests."""
    return {
        'User-Agent': 'GermanLegalAssistantPoC/0.1 (https://github.com/your-repo-if-public)'
    }

def fetch_law_paragraph_text(law_book: str, paragraph: str) -> Optional[Dict[str, str]]:
    """
    Fetches the text of a specific law paragraph from gesetze-im-internet.de.
    Example: law_book="BGB", paragraph="823"
    Returns a dictionary with 'content' and 'url' or None if not found/error.
    """
    law_book_lower = law_book.lower()
    # Construct URL (common pattern, might need adjustments for some laws)
    # e.g., https://www.gesetze-im-internet.de/bgb/__823.html
    # e.g., https://www.gesetze-im-internet.de/stgb/__263.html
    # Some laws might have different structures or no direct paragraph links.

    # Check cache first
    cached_law = get_law_cache(law_book, paragraph)
    if cached_law:
        return {"content": cached_law["content"], "url": cached_law["url"], "source": "cache"}

    url = f"{GESETZE_IM_INTERNET_BASE_URL}/{law_book_lower}/__{paragraph}.html"
    print(f"RETRIEVAL_MODULE: Attempting to fetch URL: {url}")

    try:
        response = requests.get(url, headers=get_headers(), timeout=10)
        response.raise_for_status() # Raise HTTPError for bad responses (4XX or 5XX)

        soup = BeautifulSoup(response.content, 'html.parser')

        # Find the main content div. This selector is common for gesetze-im-internet.
        # It might need adjustment if the site structure changes or for different law views.
        # Common structure: <div class="jnhtml"> <div class="jurAbsatz"> paragraph text </div> ... </div>
        # Or sometimes content is within <div id="paddingLR12"> or similar.

        content_div = soup.find("div", class_="jnhtml")
        if not content_div:
            # Fallback for some pages that might not use jnhtml class for the main content block
            content_div = soup.find("div", id="paddingLR12")
            if not content_div:
                print(f"RETRIEVAL_MODULE: Could not find main content div (class 'jnhtml' or id 'paddingLR12') at {url}")
                return None

        # Extract text from all relevant tags within content_div
        # We want to get all paragraphs, headings, etc.
        # We'll join the text of relevant elements.

        paragraphs_text = []
        # Iterate over common elements that might contain parts of the law text
        # Often, the actual law text is in <div class="jurAbsatz">
        absatz_elements = content_div.find_all("div", class_="jurAbsatz")
        if absatz_elements:
            for abs_element in absatz_elements:
                paragraphs_text.append(abs_element.get_text(separator=" ", strip=True))
        else:
            # If no jurAbsatz, try to get all text from the content_div, but clean it
            # This is a more general fallback.
            raw_text = content_div.get_text(separator="\n", strip=True)
            # Remove excessive newlines and clean up
            cleaned_text = re.sub(r'\n\s*\n', '\n', raw_text).strip()
            paragraphs_text.append(cleaned_text)


        if not paragraphs_text:
            print(f"RETRIEVAL_MODULE: No paragraph text found within content_div at {url}")
            return None

        full_content = "\n\n".join(paragraphs_text)

        # Cache the result
        set_law_cache(law_book, paragraph, full_content, url)

        return {"content": full_content, "url": url, "source": "web"}

    except requests.exceptions.RequestException as e:
        print(f"RETRIEVAL_MODULE: Request error fetching {url}: {e}")
    except Exception as e:
        print(f"RETRIEVAL_MODULE: Error parsing content from {url}: {e}")

    return None

def search_laws_by_keyword(law_book: str, keywords: List[str]) -> List[Dict[str, str]]:
    """
    Placeholder for searching within a law book (e.g., BGB, StGB) for keywords.
    This is a complex feature for a PoC if done by scraping.
    gesetze-im-internet.de has its own search, but integrating that is non-trivial.

    For PoC: This might simulate finding relevant paragraphs if we had pre-downloaded laws.
    Alternatively, it could try to use dejure.org's search if feasible or OpenLegalData if it supports keyword search.

    For now, this will be a very basic placeholder.
    """
    print(f"RETRIEVAL_MODULE: Placeholder for keyword search in '{law_book}' for keywords: {keywords}")
    results = []

    # Example: If keywords include 'miete' and law_book is 'BGB',
    # we might manually suggest some known relevant paragraphs.
    if law_book.upper() == "BGB":
        if "miete" in keywords or "vermieter" in keywords or "mieterhöhung" in keywords:
            # Simulate finding some paragraphs related to tenancy law
            # In a real system, these would be dynamically found
            sample_paras = ["535", "556", "558"]
            for para in sample_paras:
                # Try to fetch the actual text for these simulated finds
                para_info = fetch_law_paragraph_text(law_book, para)
                if para_info:
                    results.append({
                        "law_book": law_book,
                        "paragraph": para,
                        "content_preview": para_info["content"][:200] + "...", # Preview
                        "url": para_info["url"],
                        "relevance_note": f"Potentially relevant to keywords: {keywords}"
                    })

    if not results:
        return [{"law_book": law_book, "paragraph": "N/A", "content_preview": f"No direct keyword match simulation for {keywords} in {law_book} PoC.", "url": "", "relevance_note": "Placeholder"}]

    return results


if __name__ == "__main__":
    # Test fetching a specific paragraph
    print("Testing fetch_law_paragraph_text...")
    bgb_823 = fetch_law_paragraph_text("BGB", "823")
    if bgb_823:
        print(f"\n--- BGB §823 from {bgb_823['source']} ---")
        print(f"URL: {bgb_823['url']}")
        print(f"Content snippet: {bgb_823['content'][:500]}...")
    else:
        print("Could not fetch BGB §823.")

    stgb_263 = fetch_law_paragraph_text("StGB", "263")
    if stgb_263:
        print(f"\n--- StGB §263 from {stgb_263['source']} ---")
        print(f"URL: {stgb_263['url']}")
        print(f"Content snippet: {stgb_263['content'][:500]}...")
    else:
        print("Could not fetch StGB §263.")

    # Test fetching again to check cache
    print("\nTesting fetch_law_paragraph_text (cache check)...")
    bgb_823_cached = fetch_law_paragraph_text("BGB", "823")
    if bgb_823_cached:
        print(f"\n--- BGB §823 from {bgb_823_cached['source']} ---")
        print(f"Content snippet: {bgb_823_cached['content'][:100]}...")

    # Test placeholder keyword search
    print("\nTesting search_laws_by_keyword...")
    keyword_results = search_laws_by_keyword("BGB", ["miete", "vertrag"])
    for res in keyword_results:
        print(f"\nFound in {res['law_book']} §{res['paragraph']}:")
        print(f"  URL: {res['url']}")
        print(f"  Preview: {res['content_preview']}")
        print(f"  Note: {res['relevance_note']}")

    keyword_results_stgb = search_laws_by_keyword("StGB", ["diebstahl"])
    for res in keyword_results_stgb:
        print(f"\nFound in {res['law_book']} §{res['paragraph']}:")
        print(f"  URL: {res['url']}")
        print(f"  Preview: {res['content_preview']}")
        print(f"  Note: {res['relevance_note']}")
