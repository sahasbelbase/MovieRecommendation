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

