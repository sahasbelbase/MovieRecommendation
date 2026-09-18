# 🎬 Movie Recommendation Engine

An intelligent, production-grade media discovery and recommendation platform supporting **Movies, TV Series, Japanese Anime, and Korean Dramas (K-Dramas)**.

Powered by a **FastAPI** backend with vector similarity & franchise anti-clustering, and a **React 18 + Vite** cinema-calibrated interface with interactive **Swipe Mode**, verified Rotten Tomatoes 🍅 & IMDb ⭐ ratings, and a direct-launch **"Where to Stream & Watch Now"** hub covering multiple countries including **Nepal (🇳🇵)**.

---

## ✨ Key Features

* **Multi-Format Media Discovery**: Full support for Movies, TV Shows, Anime, and K-Dramas with distinct badges, seasons/episodes count, runtime, and directors/creators.
* **🔥 Swipe Mode (FYP Calibration)**:
  * Interactive card deck with mouse/trackpad drag-and-swipe.
  * Clickable floating Left (<kbd>←</kbd> Skip) and Right (<kbd>→</kbd> Watched) arrow buttons.
  * Full keyboard navigation:
    * <kbd>→</kbd> Right Arrow: Mark as Watched
    * <kbd>←</kbd> Left Arrow: Skip / Haven't Watched
    * <kbd>↓</kbd> / <kbd>↑</kbd> Down/Up Arrow: Cycle genres in real-time (*"All"*, *"Anime"*, *"Action"*, *"Drama"*, *"Sci-Fi"*, *"Comedy"*, *"Thriller"*, *"K-Drama"*)
    * <kbd>Esc</kbd>: Close modal
  * Auto-triggers on first-time login for seamless onboarding.
* **🛡️ Internal Unwatched / Skipped Tracking**:
  * Skipped titles are tracked internally (`mark_unwatched` in Firestore / local storage) without cluttering the user's visible watched library.
  * Permanently eliminates repeating cards from Swipe Mode and recommendations.
* **🦸 Franchise Anti-Clustering & Alternate Hero Recommender**:
  * Prevents echo-chambers (e.g. watching 8 Batman movies won't fill your top recommendations with only Batman).
  * The top section (**"FYP: Top Alternates For You"**) suppresses the saturated franchise and surfaces high-rated **alternate heroes and blockbusters** (*Iron Man, Superman, Spider-Man, Logan, The Avengers, John Wick, Mad Max: Fury Road, Watchmen*).
  * A dedicated lore row (**"Because You Watched Batman: Extended Lore & Universe"**) is placed lower in the feed for completionists.
* **🎯 Strict K-Drama & Adaptive Anime Rows**:
  * Strict guard ensures that *"Because You Watched K-Drama"* only appears if the user has actually watched K-Dramas.
  * Anime rows adapt dynamically: Action fans get *"High-Octane Anime & Animation"*, while romance/drama fans get *"Story-Rich & Emotional Anime"*.
* **📺 "Where to Stream & Watch Now" Hub**:
  * Direct launch buttons for Netflix, Amazon Prime Video, Disney+, Crunchyroll, Apple TV, Google Play, YouTube, Tubi, and Pluto TV.
  * Dynamic country selector supporting **🇳🇵 Nepal**, 🇺🇸 US, 🇬🇧 UK, 🇨🇦 Canada, 🇦🇺 Australia, 🇯🇵 Japan, 🇰🇷 South Korea, 🇮🇳 India, 🇩🇪 Germany, and 🇫🇷 France.
* **🍅 Rotten Tomatoes & IMDb Scores**:
  * Verified Tomatometer percentage and IMDb ratings displayed on every card and detail modal.
  * Curated **Rotten Tomatoes & IMDb Elite** row (85%+ Fresh masterpieces).
* **🌓 Dual-Tier Experience & Auto-Sync**:
  * **Guest Mode**: Clean discovery with local temporary watch & skip tracking in `localStorage`.
  * **Google SSO**: 1-Click login via Firebase Auth.
  * **Automatic Synchronization**: Guest watched and skipped history automatically syncs and merges into the remote account on login.
* **📁 Data Portability**:
  * Export watch history to JSON or Letterboxd/IMDb CSV format.
  * Import watch records from JSON or CSV.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS, Lucide React, Axios, Firebase Client SDK |
| **Backend** | FastAPI, Python 3.11, Uvicorn, Scikit-Learn (TF-IDF), NumPy, Pandas, Pydantic v2, HTTPX |
| **Authentication** | Firebase Auth (Google SSO), Firebase Admin SDK |
| **Persistence** | Cloud Firestore (Production), Local JSON Dev Store (Offline Fallback), Browser LocalStorage |
| **External APIs** | The Movie Database (TMDB v3), OMDb API (Rotten Tomatoes & IMDb) |
| **Testing** | Pytest, FastAPI TestClient, AnyIO (9/9 automated tests passing) |

---

## 🚀 Quick Start

### 1. Prerequisites
* **Python 3.11+** installed
* **Node.js 18+** and **npm** installed

### 2. Clone the Repository
```bash
git clone https://github.com/sahasbelbase/MovieRecommendation.git
cd MovieRecommendation
```

### 3. Backend Setup
```bash
# 1. Create and activate Python virtual environment
python3 -m venv .venv
source .venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Start FastAPI server
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload
```
* Interactive API Documentation: [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)
* Health Check: [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health)

### 4. Frontend Setup
In a new terminal window:
```bash
cd frontend_react

# 1. Install dependencies
npm install

# 2. Start Vite development server
npm run dev
```
* Frontend Application: [http://localhost:5173](http://localhost:5173)

---

## 🧪 Running Automated Tests

Run the complete test suite verifying vector similarity, watched/skipped exclusion, franchise anti-clustering, and K-Drama guards:

```bash
PYTHONPATH=. .venv/bin/pytest backend/tests/ -v
```

**9/9 tests pass:**
* `test_health_check` ✅
* `test_vector_store_similarity` ✅
* `test_watched_movie_exclusion` ✅
* `test_guest_recommendations_feed` ✅
* `test_user_watched_and_export` ✅
* `test_watch_providers_and_direct_links` ✅
* `test_unwatched_tracking_and_exclusion` ✅
* `test_franchise_anti_clustering_and_alternates` ✅
* `test_kdrama_recommendation_strict_guard` ✅

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|---|---|
| <kbd>/</kbd> | Focus global multi-search input |
| <kbd>→</kbd> | In Swipe Mode: Mark current title as **Watched** |
| <kbd>←</kbd> | In Swipe Mode: **Skip** current title (tracked internally as unwatched) |
| <kbd>↓</kbd> | In Swipe Mode: Switch to **Next Genre** |
| <kbd>↑</kbd> | In Swipe Mode: Switch to **Previous Genre** |
| <kbd>Esc</kbd> | Close any open modal / drawer |

---

## 📂 Project Structure

```
MovieRecommendation/
├── architecture.md                 # Full end-to-end system architecture & data flows
├── STYLE_GUIDE.md                  # Human-centric cinema dark design system
├── requirements.txt                # Python dependencies
├── dataset.csv                     # In-memory TF-IDF movie catalog (10,000 titles)
├── backend/
│   ├── app/
│   │   ├── main.py                 # FastAPI application, lifespan, CORS
│   │   ├── core/
│   │   │   ├── config.py           # Configuration & API credentials
│   │   │   └── auth.py             # Dual-mode Firebase token validation
│   │   ├── services/
│   │   │   ├── tmdb.py             # TMDB live metadata & streaming providers
│   │   │   ├── vector_store.py     # TF-IDF vector store & diversity re-ranking
│   │   │   ├── user_data.py        # Watched & unwatched persistence (Firestore/dev)
│   │   │   └── recommender.py      # Franchise anti-clustering & FYP engine
│   │   └── routers/
│   │       ├── movies.py           # Discovery & streaming endpoints
│   │       ├── recommendations.py  # Public & tailored feeds, swipe recording
│   │       └── users.py            # Watched/unwatched management & export
│   └── tests/
│       └── test_backend.py         # Automated Pytest suite (9 tests)
└── frontend_react/
    ├── src/
    │   ├── App.jsx                 # Layout, format filters, Swipe Mode banner
    │   ├── firebase/config.js      # Firebase SDK initialization
    │   ├── context/AuthContext.jsx # Auth state, guest storage & auto-sync
    │   ├── api/client.js           # Axios client with auto Bearer tokens
    │   └── components/
    │       ├── Navbar.jsx          # Search bar (/), format tabs, Swipe Mode button
    │       ├── MovieCard.jsx       # Posters, format tags, RT 🍅 & IMDb ⭐ badges
    │       ├── MovieModal.jsx      # Where to Stream hub, trailer, cast
    │       ├── SwipeDeckModal.jsx  # Swipe Mode deck with arrows & genre cycling
    │       ├── AuthModal.jsx       # 1-Click Google SSO modal
    │       └── WatchedDrawer.jsx   # Watched list, ratings, JSON/CSV export
    └── package.json
```

---

## 🌐 End-to-End Architecture

For deep-dive diagrams, data models, recommendation formulas, and sequence flows, refer to [`architecture.md`](file:///Users/sahas/Documents/Projects/MovieRecommendation/architecture.md).

---

## 👨‍💻 Creator & Links

* **Creator**: Sahas Belbase
* **GitHub**: [github.com/sahasbelbase](https://github.com/sahasbelbase)
* **LinkedIn**: [linkedin.com/in/sahasbelbase/](https://www.linkedin.com/in/sahasbelbase/)
