import json
import os
import sqlite3
from typing import Optional, Any, Dict

# Define a cache directory
CACHE_DIR = ".cache"
os.makedirs(CACHE_DIR, exist_ok=True)

# SQLite database for more structured caching
DB_FILE = os.path.join(CACHE_DIR, "legal_cache.db")

def init_db():
    """Initialize the SQLite database and create tables if they don't exist."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    # Cache for scraped web pages or API responses
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS web_cache (
            key TEXT PRIMARY KEY,
            value TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    # Cache for retrieved law texts
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS law_cache (
            law_book TEXT, -- e.g., 'BGB', 'StGB'
            paragraph TEXT, -- e.g., '263', '823'
            content TEXT,
            url TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (law_book, paragraph)
        )
    """)
    conn.commit()
    conn.close()

# Initialize DB on module load
init_db()

def set_cache(key: str, value: Any, cache_type: str = "web") -> None:
    """Set a value in the cache."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    if cache_type == "web":
        cursor.execute(
            "INSERT OR REPLACE INTO web_cache (key, value) VALUES (?, ?)",
            (key, json.dumps(value)) # Store JSON strings for flexibility
        )
    # Add other cache types if needed
    conn.commit()
    conn.close()
    print(f"CACHE_MODULE: Set cache for key='{key}' in '{cache_type}'")

def get_cache(key: str, cache_type: str = "web") -> Optional[Any]:
    """Get a value from the cache. Returns None if not found or error."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    try:
        if cache_type == "web":
            cursor.execute("SELECT value FROM web_cache WHERE key = ?", (key,))
            result = cursor.fetchone()
            if result:
                print(f"CACHE_MODULE: Cache hit for key='{key}' in '{cache_type}'")
                return json.loads(result[0]) # Deserialize JSON
        # Add other cache types if needed
    except json.JSONDecodeError as e:
        print(f"CACHE_MODULE: Error decoding JSON from cache for key='{key}': {e}")
        return None
    finally:
        conn.close()

    print(f"CACHE_MODULE: Cache miss for key='{key}' in '{cache_type}'")
    return None

def set_law_cache(law_book: str, paragraph: str, content: str, url: str) -> None:
    """Set a specific law text in the cache."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT OR REPLACE INTO law_cache (law_book, paragraph, content, url) VALUES (?, ?, ?, ?)",
        (law_book.upper(), paragraph, content, url)
    )
    conn.commit()
    conn.close()
    print(f"CACHE_MODULE: Set law cache for {law_book} §{paragraph}")

def get_law_cache(law_book: str, paragraph: str) -> Optional[Dict[str, str]]:
    """Get a specific law text from the cache."""
    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT content, url, timestamp FROM law_cache WHERE law_book = ? AND paragraph = ?",
        (law_book.upper(), paragraph)
    )
    result = cursor.fetchone()
    conn.close()
    if result:
        print(f"CACHE_MODULE: Law cache hit for {law_book} §{paragraph}")
        return {"content": result[0], "url": result[1], "timestamp": result[2]}
    print(f"CACHE_MODULE: Law cache miss for {law_book} §{paragraph}")
    return None

# Simple file-based cache for very basic needs (alternative or complementary)
def set_simple_file_cache(cache_key: str, data: str):
    """Writes data to a simple file cache."""
    file_path = os.path.join(CACHE_DIR, f"{cache_key.replace('/', '_')}.cache")
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(data)
        print(f"CACHE_MODULE: Set simple file cache for key='{cache_key}'")
    except IOError as e:
        print(f"CACHE_MODULE: Error writing to simple file cache for key='{cache_key}': {e}")

def get_simple_file_cache(cache_key: str) -> Optional[str]:
    """Reads data from a simple file cache."""
    file_path = os.path.join(CACHE_DIR, f"{cache_key.replace('/', '_')}.cache")
    try:
        if os.path.exists(file_path):
            with open(file_path, 'r', encoding='utf-8') as f:
                print(f"CACHE_MODULE: Simple file cache hit for key='{cache_key}'")
                return f.read()
    except IOError as e:
        print(f"CACHE_MODULE: Error reading from simple file cache for key='{cache_key}': {e}")
    print(f"CACHE_MODULE: Simple file cache miss for key='{cache_key}'")
    return None

if __name__ == "__main__":
    # Example usage (for testing the caching module directly)
    init_db()

    # Web cache example
    set_cache("test_key", {"data": "some web data"})
    retrieved_data = get_cache("test_key")
    print(f"Retrieved from web_cache: {retrieved_data}")

    set_cache("test_key_nonexistent", {"data": "some other data"}) # to ensure it's not hit
    retrieved_data_miss = get_cache("non_existent_key")
    print(f"Retrieved from web_cache (miss): {retrieved_data_miss}")

    # Law cache example
    set_law_cache("BGB", "823", "Content of BGB 823...", "http://gesetze-im-internet.de/bgb/__823.html")
    retrieved_law = get_law_cache("BGB", "823")
    print(f"Retrieved from law_cache: {retrieved_law}")

    retrieved_law_miss = get_law_cache("StGB", "263")
    print(f"Retrieved from law_cache (miss): {retrieved_law_miss}")

    # Simple file cache example
    set_simple_file_cache("my_test_page", "This is the content of my test page.")
    file_content = get_simple_file_cache("my_test_page")
    print(f"Retrieved from simple file cache: {file_content}")

    file_content_miss = get_simple_file_cache("my_nonexistent_page")
    print(f"Retrieved from simple file cache (miss): {file_content_miss}")
