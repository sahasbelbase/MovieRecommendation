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

  // Load guest watched list from localStorage on mount
  useEffect(() => {
    if (!user) {
      try {
        const saved = localStorage.getItem('cinematch_guest_watched');
        if (saved) {
          const parsed = JSON.parse(saved);
          setWatchedMovies(parsed);
          setWatchedIds(new Set(parsed.map(m => m.id)));
        }
      } catch (e) {
        console.error("Failed to load local watched list:", e);
      }
    }
  }, [user]);

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
        // Fetch user's watched list from backend
        try {
          const res = await api.get('/users/watched');
          setWatchedMovies(res.data);
          setWatchedIds(new Set(res.data.map(m => m.id)));
        } catch (err) {
          console.warn("Could not fetch remote watched list:", err);
        }
      } else {
        localStorage.removeItem('cinematch_token');
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    if (!auth || !googleProvider) {
      // Demo login fallback
      const demoUser = {
        uid: "demo_user_123",
        email: "demo@cinematch.app",
        displayName: "Demo Cinephile",
        photoURL: null
      };
      localStorage.setItem('cinematch_token', 'demo_token_xyz');
      setUser(demoUser);
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
      toggleWatched,
      refreshWatchedList: async () => {
        if (user) {
          const res = await api.get('/users/watched');
          setWatchedMovies(res.data);
          setWatchedIds(new Set(res.data.map(m => m.id)));
        }
      }
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
