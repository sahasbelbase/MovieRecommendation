import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.vector_store import vector_store

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["vector_ready"] is True
    assert data["catalog_size"] > 0

def test_vector_store_similarity():
    # Test movie ID 278 (The Shawshank Redemption)
    recs = vector_store.search_similar(278, limit=5)
    assert len(recs) == 5
    # The queried movie itself must not be in results
    assert all(r["id"] != 278 for r in recs)

def test_watched_movie_exclusion():
    # If we mark ID 238 (The Godfather) as watched, it should NEVER appear in similar recommendations
    initial_recs = vector_store.search_similar(240, limit=10) # Godfather II
    initial_ids = [r["id"] for r in initial_recs]
    assert 238 in initial_ids # Godfather should normally be similar to Godfather II

    # Exclude 238
    filtered_recs = vector_store.search_similar(240, excluded_ids=[238], limit=10)
    filtered_ids = [r["id"] for r in filtered_recs]
    assert 238 not in filtered_ids, "Watched movie must be strictly excluded from recommendations!"

def test_guest_recommendations_feed(client):
    response = client.get("/api/recommendations/feed")
    assert response.status_code == 200
    data = response.json()
    assert "sections" in data
    assert len(data["sections"]) > 0

def test_user_watched_and_export(client):
    # Test adding movie to watched list with auth header
    headers = {"Authorization": "Bearer test_token_12345"}
    movie_payload = {
        "movie": {
            "id": 278,
            "title": "The Shawshank Redemption",
            "year": "1994",
            "vote_average": 8.7
        },
        "rating": 9.5
    }
    res = client.post("/api/users/watched", json=movie_payload, headers=headers)
    assert res.status_code == 200

    # Verify movie appears in watched list
    get_res = client.get("/api/users/watched", headers=headers)
    assert get_res.status_code == 200
    watched_items = get_res.json()
    assert any(m["id"] == 278 for m in watched_items)

    # Test export as JSON
    export_res = client.get("/api/users/export?format=json", headers=headers)
    assert export_res.status_code == 200
    assert "The Shawshank Redemption" in export_res.text

    # Unmark watched
    del_res = client.delete("/api/users/watched/278", headers=headers)
    assert del_res.status_code == 200

def test_watch_providers_and_direct_links(client):
    # Test getting watch providers for Fight Club (ID 550)
    res = client.get("/api/movies/550/providers?media_type=movie&country=US&title=Fight%20Club")
    assert res.status_code == 200
    data = res.json()
    assert data["country"] == "US"
    assert "quick_search_links" in data
    assert any(q["name"] == "Netflix" for q in data["quick_search_links"])
    assert any("netflix.com/search" in q["direct_url"] for q in data["quick_search_links"])

def test_unwatched_tracking_and_exclusion(client):
    headers = {"Authorization": "Bearer test_token_unwatched_999"}
    # Swipe left (unwatched/skipped) on Inception (ID 27205)
    swipe_payload = {
        "item": {
            "id": 27205,
            "title": "Inception",
            "year": "2010"
        },
        "watched": False
    }
    swipe_res = client.post("/api/recommendations/swipe", json=swipe_payload, headers=headers)
    assert swipe_res.status_code == 200
    assert swipe_res.json()["action"] == "skipped"

    # Verify movie appears in unwatched list
    unwatched_res = client.get("/api/users/unwatched", headers=headers)
    assert unwatched_res.status_code == 200
    unwatched_items = unwatched_res.json()
    assert any(m["id"] == 27205 for m in unwatched_items)

    # Verify that Inception is excluded from swipe deck
    deck_res = client.get("/api/recommendations/swipe-deck?limit=15", headers=headers)
    assert deck_res.status_code == 200
    deck_items = deck_res.json()
    assert all(m["id"] != 27205 for m in deck_items), "Skipped/unwatched movie must be excluded from swipe deck!"

def test_franchise_anti_clustering_and_alternates(client):
    headers = {"Authorization": "Bearer test_token_batman_fan_1"}
    # Simulate marking multiple Batman movies as watched
    batman_titles = [
        {"id": 272, "title": "Batman Begins", "year": "2005"},
        {"id": 155, "title": "The Dark Knight", "year": "2008"},
        {"id": 49026, "title": "The Dark Knight Rises", "year": "2012"},
        {"id": 268, "title": "Batman", "year": "1989"},
    ]
    for b in batman_titles:
        client.post("/api/users/watched", json={"movie": b, "rating": 9.0}, headers=headers)

    # Fetch personalized recommendations
    feed_res = client.get("/api/recommendations/feed", headers=headers)
    assert feed_res.status_code == 200
    feed_data = feed_res.json()
    sections = feed_data["sections"]

    # Top section must be alternates, not an echo-chamber of Batman
    top_section = sections[0]
    assert "Alternates" in top_section["title"] or "FYP" in top_section["title"]

    top_titles = [m["title"] for m in top_section["movies"]]
    # Must contain alternate heroes (e.g. Iron Man, Superman, Spider-Man, Logan, etc.)
    has_alternate = any(
        any(hero in t for hero in ["Iron Man", "Superman", "Spider-Man", "Logan", "Avengers", "John Wick", "Mad Max"])
        for t in top_titles
    )
    assert has_alternate, f"Top section must recommend alternate heroes! Got: {top_titles}"

    # Verify dedicated franchise universe row exists lower down
    universe_sections = [s for s in sections if "Extended Lore & Universe" in s["title"]]
    assert len(universe_sections) > 0, "Expected a dedicated lower universe section for Batman lore"

def test_kdrama_recommendation_strict_guard(client):
    """
    Guarantees that a user who has NOT watched any K-drama is NEVER shown
    'Because you loved K-drama' or served a K-drama row.
    """
    headers = {"Authorization": "Bearer test_token_no_kdrama_strict"}
    # Watch only Western films / non-K-drama titles (some with romance tags)
    watched_titles = [
        {"id": 155, "title": "The Dark Knight", "genres": ["Action", "Crime"], "media_type": "movie"},
        {"id": 152601, "title": "Her", "genres": ["Romance", "Drama", "Science Fiction"], "media_type": "movie"},
        {"id": 597, "title": "Titanic", "genres": ["Drama", "Romance"], "media_type": "movie"},
    ]
    for m in watched_titles:
        client.post("/api/users/watched", json={"movie": m, "rating": 8.5}, headers=headers)

    feed_res = client.get("/api/recommendations/feed", headers=headers)
    assert feed_res.status_code == 200
    sections = feed_res.json()["sections"]
    section_titles = [s["title"].lower() for s in sections]

    # Must NOT have any K-drama section
    assert not any("k-drama" in t or "kdrama" in t for t in section_titles), (
        f"K-Drama section must not be shown to non-K-Drama viewers! Found: {section_titles}"
    )

def test_user_watchlist_and_auto_move_to_watched(client):
    headers = {"Authorization": "Bearer test_token_watchlist_fan"}
    movie_item = {
        "id": 157336,
        "title": "Interstellar",
        "year": "2014",
        "vote_average": 8.6,
        "genres": ["Adventure", "Drama", "Science Fiction"],
        "media_type": "movie"
    }

    # 1. Add Interstellar to watchlist
    add_res = client.post("/api/users/watchlist", json={"movie": movie_item}, headers=headers)
    assert add_res.status_code == 200
    assert add_res.json()["status"] == "success"

    # 2. Verify it is present in watchlist
    get_res = client.get("/api/users/watchlist", headers=headers)
    assert get_res.status_code == 200
    watchlist_items = get_res.json()
    assert any(m["id"] == 157336 for m in watchlist_items)

    # 3. Mark Interstellar as watched
    watched_res = client.post("/api/users/watched", json={"movie": movie_item, "rating": 9.5}, headers=headers)
    assert watched_res.status_code == 200

    # 4. Verify it was automatically removed from watchlist when watched!
    get_res2 = client.get("/api/users/watchlist", headers=headers)
    assert get_res2.status_code == 200
    watchlist_items2 = get_res2.json()
    assert all(m["id"] != 157336 for m in watchlist_items2), "Movie must be automatically removed from watchlist when watched!"

    # 5. Verify it is in watched list
    watched_list_res = client.get("/api/users/watched", headers=headers)
    assert watched_list_res.status_code == 200
    assert any(m["id"] == 157336 for m in watched_list_res.json())



