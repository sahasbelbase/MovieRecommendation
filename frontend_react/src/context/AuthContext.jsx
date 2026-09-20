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

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [watchedIds, setWatchedIds] = useState(new Set());
  const [watchedMovies, setWatchedMovies] = useState([]);
  const [unwatchedIds, setUnwatchedIds] = useState(new Set());
  const [unwatchedMovies, setUnwatchedMovies] = useState([]);
  const [watchlistIds, setWatchlistIds] = useState(new Set());
  const [watchlistMovies, setWatchlistMovies] = useState([]);

  // Load guest watched, unwatched, and watchlist from localStorage on mount
  useEffect(() => {
    if (!user) {
      try {
        const savedWatched = localStorage.getItem('cinematch_guest_watched');
        if (savedWatched) {
          const parsed = JSON.parse(savedWatched);
          setWatchedMovies(parsed);
          setWatchedIds(new Set(parsed.map(m => m.id)));
        }
        const savedUnwatched = localStorage.getItem('cinematch_guest_unwatched');
        if (savedUnwatched) {
          const parsedUnwatched = JSON.parse(savedUnwatched);
          setUnwatchedMovies(parsedUnwatched);
          setUnwatchedIds(new Set(parsedUnwatched.map(m => m.id)));
        }
        const savedWatchlist = localStorage.getItem('cinematch_guest_watchlist');
        if (savedWatchlist) {
          const parsedWatchlist = JSON.parse(savedWatchlist);
          setWatchlistMovies(parsedWatchlist);
          setWatchlistIds(new Set(parsedWatchlist.map(m => m.id)));
        }
      } catch (e) {
        console.error("Failed to load local data:", e);
      }
    }
  }, [user]);

  // Synchronize local guest watched and unwatched titles with user's remote account upon sign in
  const syncGuestWatchedToAccount = async () => {
    try {
      // 1. Sync Watched
      const savedGuest = localStorage.getItem('cinematch_guest_watched');
      const guestItems = savedGuest ? JSON.parse(savedGuest) : [];

      const res = await api.get('/users/watched');
      const remoteItems = res.data || [];
      const remoteIds = new Set(remoteItems.map(m => m.id));

      const missingFromRemote = guestItems.filter(m => !remoteIds.has(m.id));

      if (missingFromRemote.length > 0) {
        for (const item of missingFromRemote) {
          try {
            await api.post('/users/watched', { movie: item, rating: item.rating || 8.0 });
          } catch (e) {
            console.error("Failed to sync guest title to account:", item.title, e);
          }
        }
        const updatedRes = await api.get('/users/watched');
        const unified = updatedRes.data || [...remoteItems, ...missingFromRemote];
        setWatchedMovies(unified);
        setWatchedIds(new Set(unified.map(m => m.id)));
      } else {
        setWatchedMovies(remoteItems);
        setWatchedIds(new Set(remoteItems.map(m => m.id)));
      }
      // Once synced, wipe guest cache so it doesn't leak to other accounts or sessions
      localStorage.removeItem('cinematch_guest_watched');

      // 2. Sync Unwatched / Skipped
      const savedGuestUnwatched = localStorage.getItem('cinematch_guest_unwatched');
      const guestUnwatchedItems = savedGuestUnwatched ? JSON.parse(savedGuestUnwatched) : [];

      if (guestUnwatchedItems.length > 0) {
        for (const item of guestUnwatchedItems) {
          try {
            await api.post('/users/unwatched', { movie: item });
          } catch (e) {
            console.error("Failed to sync guest unwatched title:", item.title, e);
          }
        }
      }
      try {
        const unwatchedRes = await api.get('/users/unwatched');
        const remoteUnwatched = unwatchedRes.data || [];
        setUnwatchedMovies(remoteUnwatched);
        setUnwatchedIds(new Set(remoteUnwatched.map(m => m.id)));
      } catch (err) {
        console.warn("Could not fetch remote unwatched:", err);
      }
      // Wipe guest unwatched cache
      localStorage.removeItem('cinematch_guest_unwatched');

      // 3. Sync Watchlist ("Want to Watch")
      const savedGuestWatchlist = localStorage.getItem('cinematch_guest_watchlist');
      const guestWatchlistItems = savedGuestWatchlist ? JSON.parse(savedGuestWatchlist) : [];

      if (guestWatchlistItems.length > 0) {
        for (const item of guestWatchlistItems) {
          try {
            await api.post('/users/watchlist', { movie: item });
          } catch (e) {
            console.error("Failed to sync guest watchlist item:", item.title, e);
          }
        }
      }
      try {
        const watchlistRes = await api.get('/users/watchlist');
        const remoteWatchlist = watchlistRes.data || [];
        setWatchlistMovies(remoteWatchlist);
        setWatchlistIds(new Set(remoteWatchlist.map(m => m.id)));
      } catch (err) {
        console.warn("Could not fetch remote watchlist:", err);
      }
      localStorage.removeItem('cinematch_guest_watchlist');
    } catch (err) {
      console.error("Failed to sync guest watched titles:", err);
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
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email,
          displayName: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || "Movie Lover",
          photoURL: firebaseUser.photoURL
        });
        await syncGuestWatchedToAccount();
      } else {
        localStorage.removeItem('cinematch_token');
        setUser(null);
        setWatchedMovies([]);
        setWatchedIds(new Set());
        setUnwatchedMovies([]);
        setUnwatchedIds(new Set());
        setWatchlistMovies([]);
        setWatchlistIds(new Set());
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
    localStorage.removeItem('cinematch_guest_watched');
    localStorage.removeItem('cinematch_guest_unwatched');
    localStorage.removeItem('cinematch_guest_watchlist');
    setUser(null);
    setWatchedMovies([]);
    setWatchedIds(new Set());
    setUnwatchedMovies([]);
    setUnwatchedIds(new Set());
    setWatchlistMovies([]);
    setWatchlistIds(new Set());
  };

  // Toggle Watched status with optimistic UI updates
  const toggleWatched = async (movie, rating = null) => {
    const movieId = movie.id;
    const isWatched = watchedIds.has(movieId);

    if (isWatched) {
      // Remove from watched
      const nextIds = new Set(watchedIds);
      nextIds.delete(movieId);
      setWatchedIds(nextIds);
      const nextMovies = watchedMovies.filter(m => m.id !== movieId);
      setWatchedMovies(nextMovies);

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

      // Auto-remove from Watchlist if present (since the user has now watched it)
      if (watchlistIds.has(movieId)) {
        const nextWlIds = new Set(watchlistIds);
        nextWlIds.delete(movieId);
        setWatchlistIds(nextWlIds);
        const nextWlMovies = watchlistMovies.filter(m => m.id !== movieId);
        setWatchlistMovies(nextWlMovies);
        if (!user) {
          localStorage.setItem('cinematch_guest_watchlist', JSON.stringify(nextWlMovies));
        }
      }

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

    if (inWatchlist) {
      // Remove from watchlist
      const nextIds = new Set(watchlistIds);
      nextIds.delete(movieId);
      setWatchlistIds(nextIds);
      const nextMovies = watchlistMovies.filter(m => m.id !== movieId);
      setWatchlistMovies(nextMovies);

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
      loginWithGoogle,
      loginWithEmail,
      registerWithEmail,
      logout,
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
