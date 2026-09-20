import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.services.theater_manager import theater_manager

@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c

def test_theater_service_creation_and_playback():
    session = theater_manager.get_or_create_session(
        room_code="TEST1",
        host_id="user_host",
        host_name="Host User",
        movie={"id": 550, "title": "Fight Club"},
        video_source={"type": "youtube", "src": "qtRKdVBl-GQ", "title": "Fight Club Trailer"}
    )
    assert session["room_code"] == "TEST1"
    assert session["host_id"] == "user_host"
    assert session["playback"]["is_playing"] is False
    assert session["playback"]["current_time"] == 0.0

    state = theater_manager.get_current_state("TEST1")
    assert state is not None
    assert state["movie"]["title"] == "Fight Club"

def test_theater_rest_endpoints(client):
    # First create a room so we have a valid room code
    create_res = client.post("/api/rooms/create", json={
        "host_name": "Alice",
        "host_id": "alice_123"
    })
    assert create_res.status_code == 200
    code = create_res.json()["room"]["code"]

    # Start theater
    start_res = client.post(f"/api/rooms/{code}/theater/start", json={
        "host_id": "alice_123",
        "host_name": "Alice",
        "movie": {"id": 155, "title": "The Dark Knight"},
        "video_source": {"type": "youtube", "src": "EXeTwQWrcwY", "title": "The Dark Knight Trailer"}
    })
    assert start_res.status_code == 200
    th_data = start_res.json()["theater"]
    assert th_data["room_code"] == code
    assert th_data["host_name"] == "Alice"
    assert th_data["movie"]["title"] == "The Dark Knight"

    # Get theater state
    state_res = client.get(f"/api/rooms/{code}/theater/state")
    assert state_res.status_code == 200
    assert state_res.json()["theater"]["room_code"] == code

def test_theater_websocket_sync(client):
    code = "SYNC"
    # Setup theater
    theater_manager.get_or_create_session(
        room_code=code,
        host_id="host_1",
        host_name="Host 1",
        movie={"id": 1, "title": "Matrix"},
        video_source={"type": "youtube", "src": "vKQi3bBA1y8", "title": "Matrix"}
    )

    with client.websocket_connect(f"/api/rooms/{code}/theater/ws?user_id=host_1&user_name=Host 1") as ws_host:
        init_host = ws_host.receive_json()
        assert init_host["type"] == "INITIAL_SYNC"
        assert init_host["state"]["room_code"] == code

        # Connect a second peer (Bob)
        with client.websocket_connect(f"/api/rooms/{code}/theater/ws?user_id=bob_2&user_name=Bob") as ws_bob:
            # Host receives notification that Bob joined
            joined_evt = ws_host.receive_json()
            assert joined_evt["type"] == "PARTICIPANT_JOINED"
            assert joined_evt["participant"]["name"] == "Bob"

            # Bob receives initial sync
            init_bob = ws_bob.receive_json()
            assert init_bob["type"] == "INITIAL_SYNC"

            # Host plays video at 15.5s
            ws_host.send_json({
                "type": "PLAY",
                "current_time": 15.5
            })

            # Bob receives the PLAY event
            play_bob = ws_bob.receive_json()
            assert play_bob["type"] == "PLAY"
            assert play_bob["current_time"] == 15.5

            # Bob sends a reaction cannon emoji ❤️
            ws_bob.send_json({
                "type": "REACTION",
                "emoji": "❤️"
            })

            # Host receives reaction
            react_host = ws_host.receive_json()
            assert react_host["type"] == "REACTION"
            assert react_host["emoji"] == "❤️"
            assert react_host["user_name"] == "Bob"

            # Bob sends a chat message
            ws_bob.send_json({
                "type": "CHAT",
                "text": "Best movie ever!"
            })

            # Host receives chat message
            chat_host = ws_host.receive_json()
            assert chat_host["type"] == "CHAT"
            assert chat_host["text"] == "Best movie ever!"
            assert chat_host["sender_name"] == "Bob"
