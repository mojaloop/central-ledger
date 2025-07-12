import spacy

# Attempt to load the German spaCy model
# This assumes the model was downloaded during setup.
try:
    nlp_de = spacy.load("de_core_news_lg")
except OSError:
    print("NLP_MODULE: German spaCy model 'de_core_news_lg' not found. Keyword extraction will be limited.")
    nlp_de = None

def extract_keywords(text: str, lang: str = "de") -> list[str]:
    """
    Extracts keywords from the given text.
    Currently supports German.
    Uses simple POS tagging for nouns and proper nouns as keywords.
    """
    keywords = []
    if lang == "de" and nlp_de:
        doc = nlp_de(text)
        # Extract lemmas of nouns and proper nouns
        keywords = list(set([token.lemma_.lower() for token in doc if token.pos_ in ["NOUN", "PROPN"] and len(token.lemma_) > 2]))
        print(f"NLP_MODULE: Extracted keywords (de): {keywords} from '{text}'")
    elif lang == "en":
        # Placeholder: If we had an English model, we'd use it here.
        # For now, a very simple split for English text if no German model.
        keywords = list(set([word.lower() for word in text.split() if len(word) > 3]))
        print(f"NLP_MODULE: Extracted keywords (en, basic split): {keywords} from '{text}'")
    else:
        print(f"NLP_MODULE: Keyword extraction for language '{lang}' not fully supported or model not loaded.")
        # Basic split as a fallback
        keywords = list(set([word.lower() for word in text.split() if len(word) > 3]))

    return keywords[:10] # Return top 10 keywords to keep it manageable
