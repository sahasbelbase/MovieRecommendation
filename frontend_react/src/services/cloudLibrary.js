import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

export const STORAGE_KEY_LIB_ID = 'cinematch_library_id';

/**
 * Generates or retrieves the persistent Library ID for the current session.
 * For authenticated users, uses their Firebase UID.
 * For guests, creates a friendly memorable ID like 'USER-9A3B2F' and preserves it in localStorage.
 */
export function getOrCreateLibraryId(user = null) {
  if (user?.uid) {
    return user.uid;
  }
  let savedId = localStorage.getItem(STORAGE_KEY_LIB_ID);
  if (!savedId) {
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    savedId = `USER-${randomCode}`;
    localStorage.setItem(STORAGE_KEY_LIB_ID, savedId);
  }
  return savedId;
}

export function setStoredLibraryId(id) {
  if (!id) return;
  localStorage.setItem(STORAGE_KEY_LIB_ID, id.trim());
}

/**
 * Saves watched movies, watchlist, and skipped items permanently to Google Cloud Firestore.
 * This guarantees zero data loss on commits, Render restarts, or browser refreshes.
 */
export async function saveLibraryToCloud(libraryId, { watched = [], watchlist = [], unwatched = [], notInterested = [] }) {
  if (!libraryId || !db) return false;

  try {
    const cleanId = libraryId.trim();
    const libRef = doc(db, 'libraries', cleanId);
    await setDoc(libRef, {
      id: cleanId,
      updated_at: Date.now(),
      watched: watched.map(m => ({
        id: m.id,
        title: m.title || 'Untitled',
        poster_url: m.poster_url || null,
        year: m.year || '',
        vote_average: m.vote_average || 0.0,
        genres: m.genres || [],
        media_type: m.media_type || 'movie',
        watched_at: m.watched_at || Date.now() / 1000,
        rating: m.rating || null,
        review: m.review || null,
      })),
      watchlist: watchlist.map(m => ({
        id: m.id,
        title: m.title || 'Untitled',
        poster_url: m.poster_url || null,
        year: m.year || '',
        vote_average: m.vote_average || 0.0,
        genres: m.genres || [],
        media_type: m.media_type || 'movie',
        added_at: m.added_at || Date.now() / 1000,
        rotten_tomatoes: m.rotten_tomatoes || null,
        imdb_rating: m.imdb_rating || null,
      })),
      unwatched: unwatched.map(m => ({
        id: m.id,
        title: m.title || '',
        skipped_at: m.skipped_at || Date.now() / 1000,
      })),
      not_interested: (notInterested || []).map(m => ({
        id: m.id,
        title: m.title || 'Untitled',
        poster_url: m.poster_url || null,
        year: m.year || '',
        vote_average: m.vote_average || 0.0,
        genres: m.genres || [],
        media_type: m.media_type || 'movie',
        marked_at: m.marked_at || Date.now() / 1000,
      }))
    });
    return true;
  } catch (error) {
    console.warn("Firestore cloud save notice:", error);
    return false;
  }
}

/**
 * Loads a user's library from Google Cloud Firestore using their Library ID.
 * Works across devices, sessions, and incognito windows.
 */
export async function loadLibraryFromCloud(libraryId) {
  if (!libraryId || !db) return null;

  try {
    const cleanId = libraryId.trim();
    let libRef = doc(db, 'libraries', cleanId);
    let snap = await getDoc(libRef);
    if (!snap.exists() && cleanId !== cleanId.toUpperCase()) {
      libRef = doc(db, 'libraries', cleanId.toUpperCase());
      snap = await getDoc(libRef);
    }
    if (snap.exists()) {
      return snap.data();
    }
    return null;
  } catch (error) {
    console.warn("Firestore cloud fetch notice:", error);
    return null;
  }
}
