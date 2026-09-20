import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider
} from 'firebase/auth';
import { auth, googleProvider } from '../firebase/config';
import api from '../api/client';
import {
  getOrCreateLibraryId,
  setStoredLibraryId,
  saveLibraryToCloud,
  loadLibraryFromCloud
} from '../services/cloudLibrary';
import {
  saveToGoogleDrive,
  loadFromGoogleDrive,
  setStoredDriveToken,
  getStoredDriveToken
} from '../services/googleDrive';

const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [libraryId, setLibraryId] = useState(() => getOrCreateLibraryId());
  const [isCloudSynced, setIsCloudSynced] = useState(false);

  // Instant local read for zero-latency UI on page refresh/hard refresh
  const [watchedMovies, setWatchedMovies] = useState(() => {
    try {
      const cached = localStorage.getItem('cinematch_cached_watched') || localStorage.getItem('cinematch_guest_watched');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [watchedIds, setWatchedIds] = useState(() => {
    try {
      const cached = localStorage.getItem('cinematch_cached_watched') || localStorage.getItem('cinematch_guest_watched');
      const list = cached ? JSON.parse(cached) : [];
      return new Set(list.map(m => m.id));
    } catch {
      return new Set();
    }
  });

  const [watchlistMovies, setWatchlistMovies] = useState(() => {
    try {
      const cached = localStorage.getItem('cinematch_cached_watchlist') || localStorage.getItem('cinematch_guest_watchlist');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [watchlistIds, setWatchlistIds] = useState(() => {
    try {
      const cached = localStorage.getItem('cinematch_cached_watchlist') || localStorage.getItem('cinematch_guest_watchlist');
      const list = cached ? JSON.parse(cached) : [];
      return new Set(list.map(m => m.id));
    } catch {
      return new Set();
    }
  });

  const [unwatchedMovies, setUnwatchedMovies] = useState(() => {
    try {
      const cached = localStorage.getItem('cinematch_cached_unwatched') || localStorage.getItem('cinematch_guest_unwatched');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [unwatchedIds, setUnwatchedIds] = useState(() => {
    try {
      const cached = localStorage.getItem('cinematch_cached_unwatched') || localStorage.getItem('cinematch_guest_unwatched');
      const list = cached ? JSON.parse(cached) : [];
      return new Set(list.map(m => m.id));
    } catch {
      return new Set();
    }
  });

  const [notInterestedMovies, setNotInterestedMovies] = useState(() => {
    try {
      const cached = localStorage.getItem('cinematch_cached_not_interested') || localStorage.getItem('cinematch_guest_not_interested');
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });

  const [notInterestedIds, setNotInterestedIds] = useState(() => {
    try {
      const cached = localStorage.getItem('cinematch_cached_not_interested') || localStorage.getItem('cinematch_guest_not_interested');
      const list = cached ? JSON.parse(cached) : [];
      return new Set(list.map(m => m.id));
    } catch {
      return new Set();
    }
  });

  // Load guest watched, unwatched, watchlist, and not-interested from localStorage & Firestore on mount
  useEffect(() => {
    const initStorageAndCloud = async () => {
      // 1. Instant local read for zero-latency UI
      let localWatched = [];
      let localWatchlist = [];
      let localUnwatched = [];
      let localNotInterested = [];
      try {
        const savedWatched = localStorage.getItem('cinematch_cached_watched') || localStorage.getItem('cinematch_guest_watched');
        if (savedWatched) {
          localWatched = JSON.parse(savedWatched);
          setWatchedMovies(localWatched);
          setWatchedIds(new Set(localWatched.map(m => m.id)));
        }
        const savedUnwatched = localStorage.getItem('cinematch_cached_unwatched') || localStorage.getItem('cinematch_guest_unwatched');
        if (savedUnwatched) {
          localUnwatched = JSON.parse(savedUnwatched);
          setUnwatchedMovies(localUnwatched);
          setUnwatchedIds(new Set(localUnwatched.map(m => m.id)));
        }
        const savedWatchlist = localStorage.getItem('cinematch_cached_watchlist') || localStorage.getItem('cinematch_guest_watchlist');
        if (savedWatchlist) {
          localWatchlist = JSON.parse(savedWatchlist);
          setWatchlistMovies(localWatchlist);
          setWatchlistIds(new Set(localWatchlist.map(m => m.id)));
        }
        const savedNotInterested = localStorage.getItem('cinematch_cached_not_interested') || localStorage.getItem('cinematch_guest_not_interested');
        if (savedNotInterested) {
          localNotInterested = JSON.parse(savedNotInterested);
          setNotInterestedMovies(localNotInterested);
          setNotInterestedIds(new Set(localNotInterested.map(m => m.id)));
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
          const cloudNotInterested = cloudData.not_interested || [];

          // Merge: use cloud data if it has entries or merge unique items
          if (cloudWatched.length > 0 || cloudWatchlist.length > 0 || cloudNotInterested.length > 0) {
            setWatchedMovies(cloudWatched);
            setWatchedIds(new Set(cloudWatched.map(m => m.id)));
            setWatchlistMovies(cloudWatchlist);
            setWatchlistIds(new Set(cloudWatchlist.map(m => m.id)));
            setUnwatchedMovies(cloudUnwatched);
            setUnwatchedIds(new Set(cloudUnwatched.map(m => m.id)));
            setNotInterestedMovies(cloudNotInterested);
            setNotInterestedIds(new Set(cloudNotInterested.map(m => m.id)));
            setIsCloudSynced(true);
          } else if (localWatched.length > 0 || localWatchlist.length > 0 || localNotInterested.length > 0) {
            // First time cloud sync: persist local data to Firestore
            await saveLibraryToCloud(activeId, {
              watched: localWatched,
              watchlist: localWatchlist,
              unwatched: localUnwatched,
              notInterested: localNotInterested
            });
            setIsCloudSynced(true);
          }
        } else if (localWatched.length > 0 || localWatchlist.length > 0 || localNotInterested.length > 0) {
          // No cloud record yet: upload local state
          await saveLibraryToCloud(activeId, {
            watched: localWatched,
            watchlist: localWatchlist,
            unwatched: localUnwatched,
            notInterested: localNotInterested
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
  const syncGuestWatchedToAccount = async (firebaseUid, customDriveToken = null) => {
    try {
      const activeLibId = firebaseUid || user?.uid || getOrCreateLibraryId();
      const driveToken = customDriveToken || getStoredDriveToken();

      // 1. Authoritative backend API fetch (FastAPI database has the user's saved items!)
      let apiWatched = [];
      let apiWatchlist = [];
      let apiUnwatched = [];
      let apiNotInterested = [];
      try {
        const [wRes, wlRes, uwRes, niRes] = await Promise.all([
          api.get('/users/watched').catch(() => ({ data: [] })),
          api.get('/users/watchlist').catch(() => ({ data: [] })),
          api.get('/users/unwatched').catch(() => ({ data: [] })),
          api.get('/users/not-interested').catch(() => ({ data: [] }))
        ]);
        apiWatched = Array.isArray(wRes.data) ? wRes.data : [];
        apiWatchlist = Array.isArray(wlRes.data) ? wlRes.data : [];
        apiUnwatched = Array.isArray(uwRes.data) ? uwRes.data : [];
        apiNotInterested = Array.isArray(niRes.data) ? niRes.data : [];
      } catch (err) {
        console.warn("Backend library fetch notice:", err);
      }

      // 2. Personal Google Drive (if authorized and enabled)
      let driveData = null;
      if (driveToken) {
        try {
          driveData = await loadFromGoogleDrive(driveToken);
        } catch (e) {
          console.warn("Drive sync load notice:", e);
        }
      }

      // 3. Cloud Firestore
      const cloudData = await loadLibraryFromCloud(activeLibId);

      // 4. Local storage caches
      let localCachedWatched = [];
      let localCachedWatchlist = [];
      let localCachedUnwatched = [];
      let localCachedNotInterested = [];
      try {
        const sW = localStorage.getItem('cinematch_cached_watched') || localStorage.getItem('cinematch_guest_watched');
        if (sW) localCachedWatched = JSON.parse(sW);
        const sWl = localStorage.getItem('cinematch_cached_watchlist') || localStorage.getItem('cinematch_guest_watchlist');
        if (sWl) localCachedWatchlist = JSON.parse(sWl);
        const sUw = localStorage.getItem('cinematch_cached_unwatched') || localStorage.getItem('cinematch_guest_unwatched');
        if (sUw) localCachedUnwatched = JSON.parse(sUw);
        const sNi = localStorage.getItem('cinematch_cached_not_interested') || localStorage.getItem('cinematch_guest_not_interested');
        if (sNi) localCachedNotInterested = JSON.parse(sNi);
      } catch (e) {}

      // Combine unique watched across ALL sources: Backend API + Drive + Firestore + Local
      const watchedMap = new Map();
      apiWatched.forEach(m => watchedMap.set(m.id, m));
      (driveData?.watched || []).forEach(m => watchedMap.set(m.id, m));
      (cloudData?.watched || []).forEach(m => watchedMap.set(m.id, m));
      localCachedWatched.forEach(m => watchedMap.set(m.id, m));

      // Combine unique watchlist
      const watchlistMap = new Map();
      apiWatchlist.forEach(m => watchlistMap.set(m.id, m));
      (driveData?.watchlist || []).forEach(m => watchlistMap.set(m.id, m));
      (cloudData?.watchlist || []).forEach(m => watchlistMap.set(m.id, m));
      localCachedWatchlist.forEach(m => watchlistMap.set(m.id, m));

      // Combine unique unwatched
      const unwatchedMap = new Map();
      apiUnwatched.forEach(m => unwatchedMap.set(m.id, m));
      (driveData?.unwatched || []).forEach(m => unwatchedMap.set(m.id, m));
      (cloudData?.unwatched || []).forEach(m => unwatchedMap.set(m.id, m));
      localCachedUnwatched.forEach(m => unwatchedMap.set(m.id, m));

      // Combine unique not-interested
      const notInterestedMap = new Map();
      apiNotInterested.forEach(m => notInterestedMap.set(m.id, m));
      (driveData?.not_interested || []).forEach(m => notInterestedMap.set(m.id, m));
      (cloudData?.not_interested || []).forEach(m => notInterestedMap.set(m.id, m));
      localCachedNotInterested.forEach(m => notInterestedMap.set(m.id, m));

      const mergedWatched = Array.from(watchedMap.values());
      const mergedWatchlist = Array.from(watchlistMap.values());
      const mergedUnwatched = Array.from(unwatchedMap.values());
      const mergedNotInterested = Array.from(notInterestedMap.values());

      setWatchedMovies(mergedWatched);
      setWatchedIds(new Set(mergedWatched.map(m => m.id)));
      setWatchlistMovies(mergedWatchlist);
      setWatchlistIds(new Set(mergedWatchlist.map(m => m.id)));
      setUnwatchedMovies(mergedUnwatched);
      setUnwatchedIds(new Set(mergedUnwatched.map(m => m.id)));
      setNotInterestedMovies(mergedNotInterested);
      setNotInterestedIds(new Set(mergedNotInterested.map(m => m.id)));
      setIsCloudSynced(true);

      // Save to local cache so next refresh is instantaneous
      try {
        localStorage.setItem('cinematch_cached_watched', JSON.stringify(mergedWatched));
        localStorage.setItem('cinematch_cached_watchlist', JSON.stringify(mergedWatchlist));
        localStorage.setItem('cinematch_cached_unwatched', JSON.stringify(mergedUnwatched));
        localStorage.setItem('cinematch_cached_not_interested', JSON.stringify(mergedNotInterested));
      } catch (e) {}

      // Forward any local items that aren't yet on the backend server
      const backendWatchedIds = new Set(apiWatched.map(m => m.id));
      for (const item of mergedWatched) {
        if (!backendWatchedIds.has(item.id)) {
          api.post('/users/watched', { movie: item, rating: item.rating || 8.0, review: item.review }).catch(() => {});
        }
      }

      const backendWatchlistIds = new Set(apiWatchlist.map(m => m.id));
      for (const item of mergedWatchlist) {
        if (!backendWatchlistIds.has(item.id)) {
          api.post('/users/watchlist', { movie: item }).catch(() => {});
        }
      }

      const backendNotInterestedIds = new Set(apiNotInterested.map(m => m.id));
      for (const item of mergedNotInterested) {
        if (!backendNotInterestedIds.has(item.id)) {
          api.post('/users/not-interested', { movie: item }).catch(() => {});
        }
      }

      // Save merged state to Firestore and Drive (only if there are items to prevent accidental wiping)
      if (mergedWatched.length > 0 || mergedWatchlist.length > 0 || mergedUnwatched.length > 0 || mergedNotInterested.length > 0) {
        await saveLibraryToCloud(activeLibId, {
          watched: mergedWatched,
          watchlist: mergedWatchlist,
          unwatched: mergedUnwatched,
          notInterested: mergedNotInterested
        });

        if (driveToken) {
          saveToGoogleDrive(driveToken, {
            watched: mergedWatched,
            watchlist: mergedWatchlist,
            unwatched: mergedUnwatched,
            not_interested: mergedNotInterested
          }).catch(() => {});
        }
      }
    } catch (err) {
      console.error("Failed to sync titles to account:", err);
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
        const mockTestUser = typeof window !== 'undefined' && window.__MOCK_TEST_USER__;
        if (mockTestUser) {
          setUser(mockTestUser);
        } else {
          localStorage.removeItem('cinematch_token');
          setUser(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    if (typeof window !== 'undefined' && window.__MOCK_TEST_USER__) {
      const mockUser = window.__MOCK_TEST_USER__;
      localStorage.setItem('cinematch_token', `mock_token_${mockUser.uid}`);
      setUser(mockUser);
      return mockUser;
    }

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
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (credential?.accessToken) {
      setStoredDriveToken(credential.accessToken);
    }
    // Synchronize library in the background without blocking the modal or sign-in completion
    syncGuestWatchedToAccount(result.user.uid, credential?.accessToken).catch(e => {
      console.warn("Background sync notice:", e);
    });
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
    localStorage.removeItem('cinematch_cached_watched');
    localStorage.removeItem('cinematch_cached_watchlist');
    localStorage.removeItem('cinematch_cached_unwatched');
    localStorage.removeItem('cinematch_cached_not_interested');
    localStorage.removeItem('cinematch_guest_watched');
    localStorage.removeItem('cinematch_guest_unwatched');
    localStorage.removeItem('cinematch_guest_watchlist');
    localStorage.removeItem('cinematch_guest_not_interested');
    setStoredDriveToken(null);
    setUser(null);
    const randomCode = Math.random().toString(36).substring(2, 8).toUpperCase();
    const freshGuestId = `USER-${randomCode}`;
    setLibraryId(freshGuestId);
    setStoredLibraryId(freshGuestId);
    setWatchedMovies([]);
    setWatchedIds(new Set());
    setUnwatchedMovies([]);
    setUnwatchedIds(new Set());
    setWatchlistMovies([]);
    setWatchlistIds(new Set());
    setNotInterestedMovies([]);
    setNotInterestedIds(new Set());
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
      const loadedNotInterested = cloudData.not_interested || [];

      setWatchedMovies(loadedWatched);
      setWatchedIds(new Set(loadedWatched.map(m => m.id)));
      setWatchlistMovies(loadedWatchlist);
      setWatchlistIds(new Set(loadedWatchlist.map(m => m.id)));
      setUnwatchedMovies(loadedUnwatched);
      setUnwatchedIds(new Set(loadedUnwatched.map(m => m.id)));
      setNotInterestedMovies(loadedNotInterested);
      setNotInterestedIds(new Set(loadedNotInterested.map(m => m.id)));

      const finalId = cloudData.id || cleanId;
      setLibraryId(finalId);
      setStoredLibraryId(finalId);
      localStorage.setItem('cinematch_cached_watched', JSON.stringify(loadedWatched));
      localStorage.setItem('cinematch_cached_watchlist', JSON.stringify(loadedWatchlist));
      localStorage.setItem('cinematch_cached_unwatched', JSON.stringify(loadedUnwatched));
      localStorage.setItem('cinematch_cached_not_interested', JSON.stringify(loadedNotInterested));
      localStorage.setItem('cinematch_guest_watched', JSON.stringify(loadedWatched));
      localStorage.setItem('cinematch_guest_watchlist', JSON.stringify(loadedWatchlist));
      localStorage.setItem('cinematch_guest_unwatched', JSON.stringify(loadedUnwatched));
      localStorage.setItem('cinematch_guest_not_interested', JSON.stringify(loadedNotInterested));
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

  // Seamlessly persist to Local Cache, Google Cloud Firestore, and User's Google Drive
  const persistLibrary = (libId, { watched, watchlist, unwatched, notInterested = [] }) => {
    // 1. Instant local persistence for zero-latency across refresh
    try {
      localStorage.setItem('cinematch_cached_watched', JSON.stringify(watched));
      localStorage.setItem('cinematch_cached_watchlist', JSON.stringify(watchlist));
      localStorage.setItem('cinematch_cached_unwatched', JSON.stringify(unwatched));
      localStorage.setItem('cinematch_cached_not_interested', JSON.stringify(notInterested));
      localStorage.setItem('cinematch_guest_watched', JSON.stringify(watched));
      localStorage.setItem('cinematch_guest_watchlist', JSON.stringify(watchlist));
      localStorage.setItem('cinematch_guest_unwatched', JSON.stringify(unwatched));
      localStorage.setItem('cinematch_guest_not_interested', JSON.stringify(notInterested));
    } catch (e) {}

    // 2. Google Cloud Firestore
    saveLibraryToCloud(libId, { watched, watchlist, unwatched, notInterested });

    // 3. Personal Google Drive (if authorized and enabled)
    const driveToken = getStoredDriveToken();
    if (driveToken) {
      saveToGoogleDrive(driveToken, { watched, watchlist, unwatched, not_interested: notInterested }).catch(e => {
        console.warn("Notice saving to Google Drive:", e);
      });
    }
  };

  // Toggle Watched status with optimistic UI updates & Firestore cloud persistence
  const toggleWatched = async (movie, rating = null, review = null) => {
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

      // Save to Cloud Firestore & Google Drive
      persistLibrary(activeLibId, {
        watched: nextMovies,
        watchlist: watchlistMovies,
        unwatched: unwatchedMovies,
        notInterested: notInterestedMovies
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
        rating: rating,
        review: review
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

      // Auto-remove from Not Interested if present
      let nextNiMovies = notInterestedMovies;
      if (notInterestedIds.has(movieId)) {
        const nextNiIds = new Set(notInterestedIds);
        nextNiIds.delete(movieId);
        setNotInterestedIds(nextNiIds);
        nextNiMovies = notInterestedMovies.filter(m => m.id !== movieId);
        setNotInterestedMovies(nextNiMovies);
      }

      // Save to Cloud Firestore & Google Drive
      persistLibrary(activeLibId, {
        watched: nextMovies,
        watchlist: nextWlMovies,
        unwatched: unwatchedMovies,
        notInterested: nextNiMovies
      });

      if (user) {
        try {
          await api.post('/users/watched', { movie: record, rating, review });
        } catch (e) {
          console.error("Failed to mark watched on server:", e);
        }
      } else {
        localStorage.setItem('cinematch_guest_watched', JSON.stringify(nextMovies));
      }
      return true;
    }
  };

  // Save or update Rating and Review for a movie
  const saveReview = async (movie, rating = null, review = null) => {
    if (!movie?.id) return null;
    const movieId = movie.id;
    const activeLibId = libraryId || getOrCreateLibraryId(user);
    const existing = watchedMovies.find(m => m.id === movieId);
    const record = {
      ...(existing || movie),
      id: movieId,
      title: movie.title || existing?.title || "Untitled",
      poster_url: movie.poster_url || existing?.poster_url,
      year: movie.year || existing?.year,
      vote_average: movie.vote_average || existing?.vote_average,
      genres: movie.genres || existing?.genres,
      media_type: movie.media_type || existing?.media_type || "movie",
      watched_at: existing?.watched_at || (Date.now() / 1000),
      rating: rating !== undefined ? rating : (existing?.rating || null),
      review: review !== undefined ? review : (existing?.review || null),
    };

    const nextIds = new Set(watchedIds);
    nextIds.add(movieId);
    setWatchedIds(nextIds);
    const nextMovies = [record, ...watchedMovies.filter(m => m.id !== movieId)];
    setWatchedMovies(nextMovies);

    // Auto-remove from Watchlist if present
    let nextWlMovies = watchlistMovies;
    if (watchlistIds.has(movieId)) {
      const nextWlIds = new Set(watchlistIds);
      nextWlIds.delete(movieId);
      setWatchlistIds(nextWlIds);
      nextWlMovies = watchlistMovies.filter(m => m.id !== movieId);
      setWatchlistMovies(nextWlMovies);
    }

    // Auto-remove from Not Interested if present
    let nextNiMovies = notInterestedMovies;
    if (notInterestedIds.has(movieId)) {
      const nextNiIds = new Set(notInterestedIds);
      nextNiIds.delete(movieId);
      setNotInterestedIds(nextNiIds);
      nextNiMovies = notInterestedMovies.filter(m => m.id !== movieId);
      setNotInterestedMovies(nextNiMovies);
    }

    persistLibrary(activeLibId, {
      watched: nextMovies,
      watchlist: nextWlMovies,
      unwatched: unwatchedMovies,
      notInterested: nextNiMovies
    });

    if (user) {
      try {
        await api.post('/users/watched', { movie: record, rating: record.rating, review: record.review });
      } catch (e) {
        console.error("Failed to save review on server:", e);
      }
    }
    return record;
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

      // Save to Cloud Firestore & Google Drive
      persistLibrary(activeLibId, {
        watched: watchedMovies,
        watchlist: nextMovies,
        unwatched: unwatchedMovies,
        notInterested: notInterestedMovies
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

      // Save to Cloud Firestore & Google Drive
      persistLibrary(activeLibId, {
        watched: watchedMovies,
        watchlist: nextMovies,
        unwatched: unwatchedMovies,
        notInterested: notInterestedMovies
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

  // Toggle "Not Interested" - hides the movie everywhere and records preference
  const toggleNotInterested = async (movie) => {
    if (!movie?.id) return false;
    const movieId = movie.id;
    const isNI = notInterestedIds.has(movieId);
    const activeLibId = libraryId || getOrCreateLibraryId(user);

    if (isNI) {
      // Remove from not interested (Undo)
      const nextIds = new Set(notInterestedIds);
      nextIds.delete(movieId);
      setNotInterestedIds(nextIds);
      const nextMovies = notInterestedMovies.filter(m => m.id !== movieId);
      setNotInterestedMovies(nextMovies);

      persistLibrary(activeLibId, {
        watched: watchedMovies,
        watchlist: watchlistMovies,
        unwatched: unwatchedMovies,
        notInterested: nextMovies
      });

      if (user) {
        try {
          await api.delete(`/users/not-interested/${movieId}`);
        } catch (e) {
          console.error("Failed to unmark not-interested on server:", e);
        }
      }
      return false;
    } else {
      // Mark as not interested
      const record = {
        id: movieId,
        title: movie.title || "Untitled",
        poster_url: movie.poster_url,
        backdrop_url: movie.backdrop_url,
        year: movie.year,
        vote_average: movie.vote_average,
        genres: movie.genres,
        media_type: movie.media_type || "movie",
        marked_at: Date.now() / 1000
      };

      const nextIds = new Set(notInterestedIds);
      nextIds.add(movieId);
      setNotInterestedIds(nextIds);
      const nextMovies = [record, ...notInterestedMovies.filter(m => m.id !== movieId)];
      setNotInterestedMovies(nextMovies);

      // Auto-remove from watchlist if present
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

      persistLibrary(activeLibId, {
        watched: watchedMovies,
        watchlist: nextWlMovies,
        unwatched: unwatchedMovies,
        notInterested: nextMovies
      });

      if (user) {
        try {
          await api.post('/users/not-interested', { movie: record });
        } catch (e) {
          console.error("Failed to mark not-interested on server:", e);
        }
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

    // Save to Cloud Firestore & Google Drive
    persistLibrary(activeLibId, {
      watched: watchedMovies,
      watchlist: watchlistMovies,
      unwatched: nextList,
      notInterested: notInterestedMovies
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
      notInterestedIds,
      notInterestedMovies,
      toggleWatched,
      toggleWatchlist,
      toggleNotInterested,
      saveReview,
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
            const notInterestedRes = await api.get('/users/not-interested');
            setNotInterestedMovies(notInterestedRes.data);
            setNotInterestedIds(new Set(notInterestedRes.data.map(m => m.id)));
          } catch (e) {}
        }
      }
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
