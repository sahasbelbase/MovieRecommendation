import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase/config';
import api from '../api/client';
import {
  getOrCreateLibraryId,
  setStoredLibraryId,
  saveLibraryToCloud,
  loadLibraryFromCloud
} from '../services/cloudLibrary';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [libraryId, setLibraryId] = useState(() => getOrCreateLibraryId());
  const [isCloudSynced, setIsCloudSynced] = useState(false);
  const [watchedIds, setWatchedIds] = useState(new Set());
  const [watchedMovies, setWatchedMovies] = useState([]);
  const [unwatchedIds, setUnwatchedIds] = useState(new Set());
  const [unwatchedMovies, setUnwatchedMovies] = useState([]);
  const [watchlistIds, setWatchlistIds] = useState(new Set());
  const [watchlistMovies, setWatchlistMovies] = useState([]);

  // Load guest watched, unwatched, and watchlist from localStorage & Firestore on mount
  useEffect(() => {
    const initStorageAndCloud = async () => {
      // 1. Instant local read for zero-latency UI
      let localWatched = [];
      let localWatchlist = [];
      let localUnwatched = [];
      try {
        const savedWatched = localStorage.getItem('cinematch_guest_watched');
        if (savedWatched) {
          localWatched = JSON.parse(savedWatched);
          setWatchedMovies(localWatched);
          setWatchedIds(new Set(localWatched.map(m => m.id)));
        }
        const savedUnwatched = localStorage.getItem('cinematch_guest_unwatched');
        if (savedUnwatched) {
          localUnwatched = JSON.parse(savedUnwatched);
          setUnwatchedMovies(localUnwatched);
          setUnwatchedIds(new Set(localUnwatched.map(m => m.id)));
        }
        const savedWatchlist = localStorage.getItem('cinematch_guest_watchlist');
        if (savedWatchlist) {
          localWatchlist = JSON.parse(savedWatchlist);
          setWatchlistMovies(localWatchlist);
          setWatchlistIds(new Set(localWatchlist.map(m => m.id)));
        }
      } catch (e) {
        console.error("Failed to load local data:", e);
      }

      // 2. Fetch authoritative cloud backup from Firestore
      const activeId = getOrCreateLibraryId();
      setLibraryId(activeId);
      try {
        const cloudData = await loadLibraryFromCloud(activeId);
        if (cloudData) {
          const cloudWatched = cloudData.watched || [];
          const cloudWatchlist = cloudData.watchlist || [];
          const cloudUnwatched = cloudData.unwatched || [];

          // Merge: use cloud data if it has entries or merge unique items
          if (cloudWatched.length > 0 || cloudWatchlist.length > 0) {
            setWatchedMovies(cloudWatched);
            setWatchedIds(new Set(cloudWatched.map(m => m.id)));
            setWatchlistMovies(cloudWatchlist);
            setWatchlistIds(new Set(cloudWatchlist.map(m => m.id)));
            setUnwatchedMovies(cloudUnwatched);
            setUnwatchedIds(new Set(cloudUnwatched.map(m => m.id)));
            setIsCloudSynced(true);
          } else if (localWatched.length > 0 || localWatchlist.length > 0) {
            // First time cloud sync: persist local data to Firestore
            await saveLibraryToCloud(activeId, {
              watched: localWatched,
              watchlist: localWatchlist,
              unwatched: localUnwatched
            });
            setIsCloudSynced(true);
          }
        } else if (localWatched.length > 0 || localWatchlist.length > 0) {
          // No cloud record yet: upload local state
          await saveLibraryToCloud(activeId, {
            watched: localWatched,
            watchlist: localWatchlist,
            unwatched: localUnwatched
          });
          setIsCloudSynced(true);
        }
      } catch (err) {
        console.warn("Cloud Firestore initial sync notice:", err);
      }
    };

    if (!user) {
      initStorageAndCloud();
    }
  }, [user]);

  // Synchronize local guest watched and unwatched titles with user's remote account upon sign in
  const syncGuestWatchedToAccount = async (firebaseUid) => {
    try {
      const activeLibId = firebaseUid || user?.uid || getOrCreateLibraryId();

      // Check Firestore cloud data for this user first
      const cloudData = await loadLibraryFromCloud(activeLibId);
      const cloudWatched = cloudData?.watched || [];
      const cloudWatchlist = cloudData?.watchlist || [];
      const cloudUnwatched = cloudData?.unwatched || [];

      // Also read any guest items
      const savedGuest = localStorage.getItem('cinematch_guest_watched');
      const guestItems = savedGuest ? JSON.parse(savedGuest) : [];

      const savedGuestWatchlist = localStorage.getItem('cinematch_guest_watchlist');
      const guestWlItems = savedGuestWatchlist ? JSON.parse(savedGuestWatchlist) : [];

      const savedGuestUnwatched = localStorage.getItem('cinematch_guest_unwatched');
      const guestUnwatchedItems = savedGuestUnwatched ? JSON.parse(savedGuestUnwatched) : [];

      // Combine unique watched
      const watchedMap = new Map();
      cloudWatched.forEach(m => watchedMap.set(m.id, m));
      guestItems.forEach(m => watchedMap.set(m.id, m));

      // Combine unique watchlist
      const watchlistMap = new Map();
      cloudWatchlist.forEach(m => watchlistMap.set(m.id, m));
      guestWlItems.forEach(m => watchlistMap.set(m.id, m));

      // Combine unique unwatched
      const unwatchedMap = new Map();
      cloudUnwatched.forEach(m => unwatchedMap.set(m.id, m));
      guestUnwatchedItems.forEach(m => unwatchedMap.set(m.id, m));

      const mergedWatched = Array.from(watchedMap.values());
      const mergedWatchlist = Array.from(watchlistMap.values());
      const mergedUnwatched = Array.from(unwatchedMap.values());

      setWatchedMovies(mergedWatched);
      setWatchedIds(new Set(mergedWatched.map(m => m.id)));
      setWatchlistMovies(mergedWatchlist);
      setWatchlistIds(new Set(mergedWatchlist.map(m => m.id)));
      setUnwatchedMovies(mergedUnwatched);
      setUnwatchedIds(new Set(mergedUnwatched.map(m => m.id)));
      setIsCloudSynced(true);

      // Save merged library permanently to Cloud Firestore
      await saveLibraryToCloud(activeLibId, {
        watched: mergedWatched,
        watchlist: mergedWatchlist,
        unwatched: mergedUnwatched
      });

      // Also forward any guest items to backend API if reachable
      try {
        for (const item of guestItems) {
          api.post('/users/watched', { movie: item, rating: item.rating || 8.0 }).catch(() => {});
        }
        for (const item of guestWlItems) {
          api.post('/users/watchlist', { movie: item }).catch(() => {});
        }
      } catch (e) {}

      localStorage.removeItem('cinematch_guest_watched');
      localStorage.removeItem('cinematch_guest_watchlist');
      localStorage.removeItem('cinematch_guest_unwatched');
    } catch (err) {
      console.error("Failed to sync guest titles to account:", err);
    }
  };

  // Listen to Firebase Auth state
  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const token = await firebaseUser.getIdToken();
        localStorage.setItem('cinematch_token', token);
        const activeUid = firebaseUser.uid;
        setLibraryId(activeUid);
        setStoredLibraryId(activeUid);
        setUser({
          uid: activeUid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || "Movie Lover",
          photoURL: firebaseUser.photoURL
        });
        await syncGuestWatchedToAccount(activeUid);
      } else {
        localStorage.removeItem('cinematch_token');
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    const effectiveKey = auth?.app?.options?.apiKey || import.meta.env.VITE_FIREBASE_API_KEY || "";
    const hasRealFirebaseKey = Boolean(effectiveKey && !effectiveKey.includes("AIzaSyDemo"));
    if (!auth || !googleProvider || !hasRealFirebaseKey) {
      // Testing fallback with unique random ID so sessions never collide
      const randomSuffix = Math.random().toString(36).substring(2, 10);
      const demoUser = {
        uid: `demo_user_${randomSuffix}`,
        email: `guest_${randomSuffix}@movieengine.app`,
        displayName: "Guest User",
        photoURL: null
      };
      localStorage.setItem('cinematch_token', `demo_token_${randomSuffix}`);
      setUser(demoUser);
      await syncGuestWatchedToAccount();
      return demoUser;
    }
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  };

  const loginWithEmail = async (email, password) => {
    if (!auth) {
      const demoUser = {
        uid: "demo_user_email",
        email,
        displayName: email.split('@')[0],
        photoURL: null
      };
      localStorage.setItem('cinematch_token', 'demo_token_email');
      setUser(demoUser);
      return demoUser;
    }
    const result = await signInWithEmailAndPassword(auth, email, password);
    return result.user;
  };

  const registerWithEmail = async (email, password) => {
    if (!auth) {
      return loginWithEmail(email, password);
    }
    const result = await createUserWithEmailAndPassword(auth, email, password);
    return result.user;
  };

  const logout = async () => {
    if (auth) {
      try {
        await firebaseSignOut(auth);
      } catch (e) {
        console.error("Sign-out error:", e);
      }
    }
    localStorage.removeItem('cinematch_token');
    // Note: Cloud Firestore library data is preserved forever!
    setUser(null);
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const freshGuestId = `USER-${randomCode}`;
    setLibraryId(freshGuestId);
    setStoredLibraryId(freshGuestId);
    localStorage.removeItem('cinematch_guest_watched');
    localStorage.removeItem('cinematch_guest_unwatched');
    localStorage.removeItem('cinematch_guest_watchlist');
    setWatchedMovies([]);
    setWatchedIds(new Set());
    setUnwatchedMovies([]);
    setUnwatchedIds(new Set());
    setWatchlistMovies([]);
    setWatchlistIds(new Set());
  };

  // Restore Library by ID (works across incognito, devices, sessions)
  const restoreLibraryById = async (targetId) => {
    if (!targetId || !targetId.trim()) {
      return { success: false, error: 'Please enter a valid Library ID' };
    }
    const cleanId = targetId.trim();
    try {
      const cloudData = await loadLibraryFromCloud(cleanId);
      if (!cloudData) {
        return {
          success: false,
          error: `No cloud library found for "${cleanId}". Please check the ID and try again.`
        };
      }
      const loadedWatched = cloudData.watched || [];
      const loadedWatchlist = cloudData.watchlist || [];
      const loadedUnwatched = cloudData.unwatched || [];

      setWatchedMovies(loadedWatched);
      setWatchedIds(new Set(loadedWatched.map(m => m.id)));
      setWatchlistMovies(loadedWatchlist);
      setWatchlistIds(new Set(loadedWatchlist.map(m => m.id)));
      setUnwatchedMovies(loadedUnwatched);
      setUnwatchedIds(new Set(loadedUnwatched.map(m => m.id)));

      const finalId = cloudData.id || cleanId;
      setLibraryId(finalId);
      setStoredLibraryId(finalId);
      localStorage.setItem('cinematch_guest_watched', JSON.stringify(loadedWatched));
      localStorage.setItem('cinematch_guest_watchlist', JSON.stringify(loadedWatchlist));
      setIsCloudSynced(true);

      return {
        success: true,
        countWatched: loadedWatched.length,
        countWatchlist: loadedWatchlist.length,
        libraryId: finalId
      };
    } catch (err) {
      console.error("Restore error:", err);
      return { success: false, error: err.message || 'Failed to restore library' };
    }
  };

  // Toggle Watched status with optimistic UI updates & Firestore cloud persistence
  const toggleWatched = async (movie, rating = null) => {
    const movieId = movie.id;
    const isWatched = watchedIds.has(movieId);
    const activeLibId = libraryId || getOrCreateLibraryId(user);

    if (isWatched) {
      // Remove from watched
      const nextIds = new Set(watchedIds);
      nextIds.delete(movieId);
      setWatchedIds(nextIds);
      const nextMovies = watchedMovies.filter(m => m.id !== movieId);
      setWatchedMovies(nextMovies);

      // Save to Cloud Firestore
      saveLibraryToCloud(activeLibId, {
        watched: nextMovies,
        watchlist: watchlistMovies,
        unwatched: unwatchedMovies
      });

      if (user) {
        try {
          await api.delete(`/users/watched/${movieId}`);
        } catch (e) {
          console.error("Failed to unmark watched on server:", e);
        }
      } else {
        localStorage.setItem('cinematch_guest_watched', JSON.stringify(nextMovies));
      }
      return false;
    } else {
      // Mark as watched
      const record = {
        id: movie.id,
        title: movie.title,
        poster_url: movie.poster_url,
        year: movie.year,
        vote_average: movie.vote_average,
        genres: movie.genres,
        watched_at: Date.now() / 1000,
        rating: rating
      };

      const nextIds = new Set(watchedIds);
      nextIds.add(movieId);
      setWatchedIds(nextIds);
      const nextMovies = [record, ...watchedMovies];
      setWatchedMovies(nextMovies);

      // Auto-remove from Watchlist if present (since user has now watched it)
      let nextWlMovies = watchlistMovies;
      if (watchlistIds.has(movieId)) {
        const nextWlIds = new Set(watchlistIds);
        nextWlIds.delete(movieId);
        setWatchlistIds(nextWlIds);
        nextWlMovies = watchlistMovies.filter(m => m.id !== movieId);
        setWatchlistMovies(nextWlMovies);
        if (!user) {
          localStorage.setItem('cinematch_guest_watchlist', JSON.stringify(nextWlMovies));
        }
      }

      // Save to Cloud Firestore
      saveLibraryToCloud(activeLibId, {
        watched: nextMovies,
        watchlist: nextWlMovies,
        unwatched: unwatchedMovies
      });

      if (user) {
        try {
          await api.post('/users/watched', { movie: record, rating });
        } catch (e) {
          console.error("Failed to mark watched on server:", e);
        }
      } else {
        localStorage.setItem('cinematch_guest_watched', JSON.stringify(nextMovies));
      }
      return true;
    }
  };

  // Toggle Watchlist ("Want to Watch" / "Watch Later")
  const toggleWatchlist = async (movie) => {
    if (!movie?.id) return false;
    const movieId = movie.id;
    const inWatchlist = watchlistIds.has(movieId);
    const activeLibId = libraryId || getOrCreateLibraryId(user);

    if (inWatchlist) {
      // Remove from watchlist
      const nextIds = new Set(watchlistIds);
      nextIds.delete(movieId);
      setWatchlistIds(nextIds);
      const nextMovies = watchlistMovies.filter(m => m.id !== movieId);
      setWatchlistMovies(nextMovies);

      // Save to Cloud Firestore
      saveLibraryToCloud(activeLibId, {
        watched: watchedMovies,
        watchlist: nextMovies,
        unwatched: unwatchedMovies
      });

      if (user) {
        try {
          await api.delete(`/users/watchlist/${movieId}`);
        } catch (e) {
          console.error("Failed to remove from watchlist on server:", e);
        }
      } else {
        localStorage.setItem('cinematch_guest_watchlist', JSON.stringify(nextMovies));
      }
      return false;
    } else {
      // Add to watchlist
      const record = {
        id: movie.id,
        title: movie.title || "Untitled",
        poster_url: movie.poster_url,
        backdrop_url: movie.backdrop_url,
        year: movie.year,
        vote_average: movie.vote_average,
        genres: movie.genres,
        media_type: movie.media_type || "movie",
        added_at: Date.now() / 1000,
        rotten_tomatoes: movie.rotten_tomatoes,
        imdb_rating: movie.imdb_rating
      };

      const nextIds = new Set(watchlistIds);
      nextIds.add(movieId);
      setWatchlistIds(nextIds);
      const nextMovies = [record, ...watchlistMovies.filter(m => m.id !== movieId)];
      setWatchlistMovies(nextMovies);

      // Save to Cloud Firestore
      saveLibraryToCloud(activeLibId, {
        watched: watchedMovies,
        watchlist: nextMovies,
        unwatched: unwatchedMovies
      });

      if (user) {
        try {
          await api.post('/users/watchlist', { movie: record });
        } catch (e) {
          console.error("Failed to add to watchlist on server:", e);
        }
      } else {
        localStorage.setItem('cinematch_guest_watchlist', JSON.stringify(nextMovies));
      }
      return true;
    }
  };

  // Mark movie as unwatched / skipped internally
  const markUnwatched = async (movie) => {
    if (!movie?.id) return;
    const movieId = movie.id;
    const activeLibId = libraryId || getOrCreateLibraryId(user);
    const record = {
      id: movieId,
      title: movie.title,
      poster_url: movie.poster_url,
      year: movie.year,
      vote_average: movie.vote_average,
      genres: movie.genres,
      skipped_at: Date.now() / 1000
    };

    const nextIds = new Set(unwatchedIds);
    nextIds.add(movieId);
    setUnwatchedIds(nextIds);
    const nextList = [record, ...unwatchedMovies.filter(m => m.id !== movieId)];
    setUnwatchedMovies(nextList);

    // Save to Cloud Firestore
    saveLibraryToCloud(activeLibId, {
      watched: watchedMovies,
      watchlist: watchlistMovies,
      unwatched: nextList
    });

    if (user) {
      try {
        await api.post('/recommendations/swipe', {
          item: movie,
          watched: false
        });
      } catch (e) {
        console.error("Failed to record unwatched swipe on server:", e);
      }
    } else {
      localStorage.setItem('cinematch_guest_unwatched', JSON.stringify(nextList));
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      libraryId,
      isCloudSynced,
      loginWithGoogle,
      loginWithEmail,
      registerWithEmail,
      logout,
      restoreLibraryById,
      watchedIds,
      watchedMovies,
      unwatchedIds,
      unwatchedMovies,
      watchlistIds,
      watchlistMovies,
      toggleWatched,
      toggleWatchlist,
      markUnwatched,
      refreshWatchedList: async () => {
        if (user) {
          const res = await api.get('/users/watched');
          setWatchedMovies(res.data);
          setWatchedIds(new Set(res.data.map(m => m.id)));
          try {
            const unwatchedRes = await api.get('/users/unwatched');
            setUnwatchedMovies(unwatchedRes.data);
            setUnwatchedIds(new Set(unwatchedRes.data.map(m => m.id)));
            const watchlistRes = await api.get('/users/watchlist');
            setWatchlistMovies(watchlistRes.data);
            setWatchlistIds(new Set(watchlistRes.data.map(m => m.id)));
          } catch (e) {}
        }
      }
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
