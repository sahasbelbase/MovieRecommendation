# 🎬 Movie Recommendation Engine

An intelligent, production-grade media discovery and recommendation platform supporting **Movies, TV Series, Japanese Anime, and Korean Dramas (K-Dramas)**.

🌐 **Live Production Application**: [movierecommendation.pages.dev](https://movierecommendation.pages.dev/)

Powered by a **FastAPI** backend with vector similarity & franchise anti-clustering, and a **React 18 + Vite** cinema-calibrated interface featuring interactive **Swipe Mode**, dedicated **Watchlist Shelf**, **Actor Filmography Search**, verified **Rotten Tomatoes 🍅 & IMDb ⭐ ratings**, personal **Google Drive Cloud Storage**, and a direct-launch **"Where to Stream & Watch Now"** hub covering multiple countries including **Nepal (🇳🇵)**.

---

## ✨ Key Features

* **🏆 All-Time Top 250 Hall of Fame (Movies, TV Series, Anime)**:
  * Curated **Top 250 Movies of All Time**, **Top 250 TV Series of All Time**, and **Top 250 Anime of All Time**.
  * Dynamic rank badges with Gold 🥇, Silver 🥈, and Bronze 🥉 podium distinctions.
  * **Personal Completion Tracker**: Live progress bar calculating how many titles of the 250 you've completed (e.g. *"You've watched 18 of 250 titles (7.2%)"*).
  * Filter by text search or watch status (*All*, *Unwatched Only*, *Watched Only*).
* **⭐ In-App Rate & Review Hub + Direct IMDb & Letterboxd Portals**:
  * **Interactive 1 to 10 Star Rating**: Directly rate titles with live score hover and one-tap save.
  * **Personal Notes & Reviews**: Add your personal viewing thoughts, memorable quotes, and commentary stored directly in your library and synced to Google Drive.
  * **1-Click External Review Portals**: Direct deep-links to write and publish your reviews on **Letterboxd** and **IMDb Reviews** with the exact movie already loaded.
* **🚫 "Not Interested" Feature (Strict Feed Exclusion)**:
  * Discreet action button on movie cards and detail modals to mark titles you are not interested in.
  * **Clean UI Guarantee**: No cluttering buttons in the top navigation bar.
  * **Strict Multi-Layer Filtering**: Titles marked Not Interested are immediately excluded from recommendation feeds, category grids, and Swipe Mode decks.
  * Preserved permanently across FastAPI backend, Firestore, Google Drive, and local cache.
* **Sub-Navigation Watchlist Shelf ("Want to Watch" / "Watch Later")**:
  * Persistent shelf docked directly below navigation with smooth scrolling.
  * Quick one-click toggle from any card or movie detail modal.
  * **Auto-Move to Watched**: Marking a queued title as watched automatically removes it from the Watchlist.
  * **Strict Feed Exclusion**: Titles in your Watchlist or Watched list are automatically excluded from recommendation feeds and Swipe decks so you are never recommended what you've already saved.
* **🎭 Universal Actor & Director Filmography Search**:
  * Universal typeahead search matches movies, TV shows, anime, actors, and directors.
  * Clicking an actor displays their headshot, biography, and interactive filmography drawer showing all movies and TV shows they appeared in with release years and ratings.
  * One-click from the actor's credits launches the complete streaming and detail modal.
* **🔒 Private Google Drive Library Storage & Transparent OAuth Consent**:
  * **100% User Data Ownership**: Your personal movie library (Watched list, Watchlist, and Not Interested preferences) is saved directly into your personal Google Drive (`cinematch_movie_library.json` inside private AppData storage).
  * **Seamless Google Consent**: Google OAuth prompts for app storage permissions directly during standard 1-click Google sign-in.
  * **Zero Developer Jargon**: Completely eliminates raw database UIDs, manual copy-paste sync codes, or technical clutter for a clean, consumer-grade experience (like Netflix or Spotify).
  * **Dual-Layer Resilience**: Backed by Google Cloud Firestore and local storage caches so your library recovers instantaneously across new tabs, devices, or incognito sessions.
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
  * Skipped titles are tracked internally without cluttering the user's visible library.
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
* **📁 Data Portability**:
  * Export watch history to JSON or Letterboxd/IMDb CSV format.
  * Import watch records from JSON or CSV.

---

## 🛠️ Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, Tailwind CSS, Lucide React, Axios, Firebase Client SDK |
| **Backend** | FastAPI, Python 3.11, Uvicorn, Scikit-Learn (TF-IDF), NumPy, Pandas, Pydantic v2, HTTPX |
| **Authentication** | Firebase Auth (Google SSO), OAuth2 Drive Scopes (`drive.appdata`, `drive.file`) |
| **Cloud Storage** | Google Drive v3 REST API (User AppData), Cloud Firestore (Cloud Sync), LocalStorage |
| **Hosting & CDN** | Cloudflare Pages (Frontend SPA), Render (FastAPI Backend) |
| **External APIs** | The Movie Database (TMDB v3), OMDb API (Rotten Tomatoes & IMDb), Google Drive API |
| **Testing** | Pytest, FastAPI TestClient, AnyIO (12/12 automated tests passing) |

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

Run the complete test suite verifying vector similarity, watched/skipped exclusion, watchlist auto-move, actor filmography, franchise anti-clustering, and K-Drama guards:

```bash
PYTHONPATH=. .venv/bin/pytest backend/tests/ -v
```

**12/12 test suites pass:**
* `test_health_check` ✅
* `test_vector_store_similarity` ✅
* `test_watched_movie_exclusion` ✅
* `test_guest_recommendations_feed` ✅
* `test_user_watched_and_export` ✅
* `test_watch_providers_and_direct_links` ✅
* `test_unwatched_tracking_and_exclusion` ✅
* `test_franchise_anti_clustering_and_alternates` ✅
* `test_kdrama_recommendation_strict_guard` ✅
* `test_user_watchlist_and_auto_move_to_watched` ✅
* `test_actor_search_and_filmography` ✅
* `test_watchlist_exclusion_from_feed_and_recommendations` ✅

---

## ⌨️ Keyboard Shortcuts

| Key | Action |
|---|---|
| <kbd>/</kbd> | Focus global multi-search input (search movies, series, anime, actors) |
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
│   │   │   ├── tmdb.py             # TMDB metadata, actor credits & streaming providers
│   │   │   ├── vector_store.py     # TF-IDF vector store & diversity re-ranking
│   │   │   ├── user_data.py        # Watched, unwatched & watchlist persistence
│   │   │   └── recommender.py      # Franchise anti-clustering, FYP & watchlist filters
│   │   └── routers/
│   │       ├── movies.py           # Discovery, streaming & actor filmography endpoints
│   │       ├── recommendations.py  # Public & tailored feeds, swipe recording
│   │       └── users.py            # Watched, watchlist, unwatched management & export
│   └── tests/
│       └── test_backend.py         # Automated Pytest suite (12 tests)
└── frontend_react/
    ├── src/
    │   ├── App.jsx                 # Layout, format filters, Watchlist shelf integration
    │   ├── firebase/config.js      # Firebase SDK & Google Drive OAuth scopes
    │   ├── context/AuthContext.jsx # Auth state, Drive sync & dual-layer persistence
    │   ├── api/client.js           # Axios client with auto Bearer tokens
    │   ├── services/
    │   │   ├── googleDrive.js      # Google Drive REST API integration (AppData folder)
    │   │   └── cloudLibrary.js     # Cloud Firestore real-time library synchronization
    │   └── components/
    │       ├── Navbar.jsx          # Multi-search (/), format tabs, actor filmography
    │       ├── WatchlistShelf.jsx  # Docked sub-navigation Watchlist shelf with scroll
    │       ├── MovieCard.jsx       # Posters, format tags, RT 🍅, IMDb ⭐ & watchlist button
    │       ├── MovieModal.jsx      # Where to Stream hub, trailer, cast & watchlist toggle
    │       ├── SwipeDeckModal.jsx  # Swipe Mode deck with arrows & genre cycling
    │       ├── AuthModal.jsx       # Google SSO modal with clear Drive storage consent
    │       └── WatchedDrawer.jsx   # Watched & Watchlist drawer with sync status footer
    └── package.json
```

---

## 🌐 End-to-End Architecture

For comprehensive system diagrams, Google Drive OAuth synchronization workflows, recommendation centroid formulations, and sequence flows, refer to [`architecture.md`](./architecture.md).

---

## 👨‍💻 Creator & Links

* **Creator**: Sahas Belbase
* **GitHub**: [github.com/sahasbelbase](https://github.com/sahasbelbase)
* **LinkedIn**: [linkedin.com/in/sahasbelbase/](https://www.linkedin.com/in/sahasbelbase/)
