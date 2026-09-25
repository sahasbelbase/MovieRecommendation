import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

const STORAGE_KEY = 'cinematch_continue_watching';
const EVENT_NAME = 'cinematch_continue_watching_updated';

/**
 * Retrieves the full list of in-progress titles from localStorage,
 * sorted by most recently watched first.
 */
export function getContinueWatchingList() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    if (!Array.isArray(list)) return [];
    return list.sort((a, b) => (b.last_watched_at || 0) - (a.last_watched_at || 0));
  } catch (err) {
    console.warn('Error reading continue watching data:', err);
    return [];
  }
}

/**
 * Retrieves progress for a specific movie or series by ID.
 */
export function getItemProgress(movieId) {
  if (!movieId) return null;
  const list = getContinueWatchingList();
  const targetId = Number(movieId) || String(movieId);
  return list.find((item) => String(item.id) === String(targetId)) || null;
}

/**
 * Saves or updates continue-watching progress for a title.
 * Automatically updates localStorage and notifies UI components.
 */
export async function saveContinueWatchingProgress({
  movie,
  season = 1,
  episode = 1,
  episodeName = '',
  progressPercent = 10,
  timestamp = 0,
  duration = 0,
  server = 'Auto',
  user = null
}) {
  if (!movie || !movie.id) return null;

  try {
    const list = getContinueWatchingList();
    const movieId = movie.id;
    const cleanMediaType = movie.media_type || (movie.is_movie || movie.stream_type === 'movie' ? 'movie' : 'movie');

    const record = {
      id: movieId,
      title: movie.title || movie.name || 'Untitled',
      poster_url: movie.poster_url || movie.poster_path || null,
      media_type: movie.media_type || cleanMediaType,
      season: Number(season) || 1,
      episode: Number(episode) || 1,
      episode_name: episodeName || `Episode ${episode}`,
      progress_percent: Math.min(100, Math.max(5, Number(progressPercent) || 15)),
      timestamp: Number(timestamp) || 0,
      duration: Number(duration) || 0,
      server: server || 'Auto',
      last_watched_at: Date.now(),
      year: movie.year || (movie.release_date ? movie.release_date.substring(0, 4) : ''),
      genres: movie.genres || [],
      vote_average: movie.vote_average || 0.0,
      imdb_rating: movie.imdb_rating || null,
    };

    // Filter out previous entry for this title and prepend updated record
    const updatedList = [record, ...list.filter((item) => String(item.id) !== String(movieId))].slice(0, 24);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: record }));
    }

    // Cloud sync for authenticated users
    if (user?.uid && db) {
      try {
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, { continue_watching: updatedList }, { merge: true });
      } catch (cloudErr) {
        console.debug('Cloud sync notice for continue watching:', cloudErr);
      }
    }

    return record;
  } catch (err) {
    console.warn('Failed saving continue watching progress:', err);
    return null;
  }
}

/**
 * Removes an item from continue watching (e.g. user finished or clicked dismiss).
 */
export async function removeContinueWatchingProgress(movieId, user = null) {
  if (!movieId) return;
  try {
    const list = getContinueWatchingList();
    const updatedList = list.filter((item) => String(item.id) !== String(movieId));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { id: movieId, removed: true } }));
    }

    if (user?.uid && db) {
      try {
        const userRef = doc(db, 'users', user.uid);
        await setDoc(userRef, { continue_watching: updatedList }, { merge: true });
      } catch (cloudErr) {
        console.debug('Cloud sync notice for continue watching removal:', cloudErr);
      }
    }
  } catch (err) {
    console.warn('Failed removing continue watching item:', err);
  }
}

/**
 * Hook or helper to subscribe to continue watching changes.
 */
export function subscribeContinueWatching(callback) {
  if (typeof window === 'undefined') return () => {};
  const handler = () => callback(getContinueWatchingList());
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}
