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

  // Load guest watched and unwatched lists from localStorage on mount
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
      } catch (e) {
        console.error("Failed to load local watched/unwatched list:", e);
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
        localStorage.setItem('cinematch_guest_watched', JSON.stringify(unified));
      } else {
        setWatchedMovies(remoteItems);
        setWatchedIds(new Set(remoteItems.map(m => m.id)));
        localStorage.setItem('cinematch_guest_watched', JSON.stringify(remoteItems));
      }

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
        localStorage.setItem('cinematch_guest_unwatched', JSON.stringify(remoteUnwatched));
      } catch (err) {
        console.warn("Could not fetch remote unwatched:", err);
      }
    } catch (err) {
      console.warn("Could not sync watched/unwatched list:", err);
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
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    const effectiveKey = auth?.app?.options?.apiKey || import.meta.env.VITE_FIREBASE_API_KEY || "";
    const hasRealFirebaseKey = Boolean(effectiveKey && !effectiveKey.includes("AIzaSyDemo"));
    if (!auth || !googleProvider || !hasRealFirebaseKey) {
      // Testing fallback: lets the user test the tailored mode immediately
      const demoUser = {
        uid: "demo_user_123",
        email: "sahas@movieengine.app",
        displayName: "Sahas Belbase",
        photoURL: null
      };
      localStorage.setItem('cinematch_token', 'demo_token_xyz');
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
      await firebaseSignOut(auth);
    }
    localStorage.removeItem('cinematch_token');
    setUser(null);
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
      }
      localStorage.setItem('cinematch_guest_watched', JSON.stringify(nextMovies));
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

      if (user) {
        try {
          await api.post('/users/watched', { movie: record, rating });
        } catch (e) {
          console.error("Failed to mark watched on server:", e);
        }
      }
      localStorage.setItem('cinematch_guest_watched', JSON.stringify(nextMovies));
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
    localStorage.setItem('cinematch_guest_unwatched', JSON.stringify(nextList));

    if (user) {
      try {
        await api.post('/recommendations/swipe', {
          item: movie,
          watched: false
        });
      } catch (e) {
        console.error("Failed to record unwatched swipe on server:", e);
      }
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
      toggleWatched,
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
          } catch (e) {}
        }
      }
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
