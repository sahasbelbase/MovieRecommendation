import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';

let lastTouchedTimestamp = 0;
const THROTTLE_MS = 2 * 60 * 1000; // 2 minutes

/**
 * Formats a JavaScript Date into a clear, readable string for the Firebase table:
 * e.g. "Sep 24, 2026, 11:55:00 PM UTC"
 */
export function formatActivityDate(date = new Date()) {
  try {
    const d = date instanceof Date ? date : new Date(date);
    const datePart = d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC'
    });
    const timePart = d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZone: 'UTC'
    });
    return `${datePart}, ${timePart} UTC`;
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Synchronizes user authentication metadata and activity to the Firebase Firestore `users` table.
 * Contains: identifier, provider, created, signed_in, user_id, last_used_date, and is_vip.
 *
 * If an admin removes the user from the Firebase table or sets is_vip: false,
 * VIP access is automatically revoked in the client.
 */
export async function syncUserProfileAndActivity(firebaseUser, { isVipLocal = false } = {}) {
  if (!firebaseUser?.uid || !db) {
    return { isVip: Boolean(isVipLocal), isBlocked: false, doc: null };
  }

  try {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const snap = await getDoc(userRef);
    const existing = snap.exists() ? snap.data() : null;

    const now = new Date();
    const formattedDate = formatActivityDate(now);
    const isoDate = now.toISOString();

    const providerId = firebaseUser.providerData?.[0]?.providerId || 'password';
    const email = firebaseUser.email || '';
    const identifier = email || firebaseUser.phoneNumber || firebaseUser.displayName || firebaseUser.uid;

    const isBlocked = Boolean(existing?.vip_blocked === true || existing?.vip_revoked === true || existing?.status === 'blocked');

    let isVip = Boolean(isVipLocal);
    if (isBlocked) {
      isVip = false;
    } else if (existing?.is_vip === true) {
      isVip = true;
    } else if (existing && typeof existing.is_vip === 'boolean') {
      isVip = Boolean(isVipLocal || existing.is_vip);
    } else {
      isVip = Boolean(isVipLocal);
    }

    const payload = {
      user_id: firebaseUser.uid,
      identifier: identifier,
      provider: providerId,
      created: firebaseUser.metadata?.creationTime || existing?.created || formattedDate,
      signed_in: firebaseUser.metadata?.lastSignInTime || existing?.signed_in || formattedDate,
      last_used_date: formattedDate,
      last_used_at: isoDate,
      last_used_timestamp: now.getTime(),
      display_name: firebaseUser.displayName || email.split('@')[0] || 'User',
      photo_url: firebaseUser.photoURL || '',
      is_vip: isVip,
    };

    await setDoc(userRef, payload, { merge: true });
    lastTouchedTimestamp = now.getTime();

    return { isVip, isBlocked, doc: payload };
  } catch (error) {
    console.warn("Firestore syncUserProfileAndActivity error:", error);
    return { isVip: Boolean(isVipLocal), isBlocked: false, doc: null };
  }
}

/**
 * Updates `last_used_date` in the Firebase table whenever the user actively uses the app.
 * Throttled to prevent unnecessary database writes.
 */
export async function touchUserLastUsed(uid, force = false) {
  if (!uid || !db) return;

  const now = Date.now();
  if (!force && now - lastTouchedTimestamp < THROTTLE_MS) {
    return;
  }

  try {
    const userRef = doc(db, 'users', uid);
    const dateObj = new Date();
    const formattedDate = formatActivityDate(dateObj);
    await setDoc(userRef, {
      last_used_date: formattedDate,
      last_used_at: dateObj.toISOString(),
      last_used_timestamp: now,
    }, { merge: true });
    lastTouchedTimestamp = now;
  } catch (error) {
    console.debug("Firestore touchUserLastUsed notice:", error);
  }
}

/**
 * Directly updates VIP status in Firestore for the given user ID.
 */
export async function setUserVipInCloud(uid, isVip) {
  if (!uid || !db) return false;

  try {
    const userRef = doc(db, 'users', uid);
    const dateObj = new Date();
    const formattedDate = formatActivityDate(dateObj);
    const updateData = {
      is_vip: Boolean(isVip),
      last_used_date: formattedDate,
      last_used_at: dateObj.toISOString(),
      last_used_timestamp: dateObj.getTime(),
      vip_updated_at: dateObj.toISOString()
    };
    if (isVip) {
      updateData.vip_blocked = false;
      updateData.vip_revoked = false;
    }
    await setDoc(userRef, updateData, { merge: true });
    lastTouchedTimestamp = dateObj.getTime();
    return true;
  } catch (error) {
    console.warn("Firestore setUserVipInCloud error:", error);
    return false;
  }
}

/**
 * Checks whether the user is authorized for VIP access in the Firebase table.
 * Returns { exists, isVip, isBlocked }.
 * A user is ONLY blocked if the admin explicitly set vip_blocked or vip_revoked to true.
 */
export async function checkUserVipInCloud(uid) {
  if (!uid || !db) return { exists: false, isVip: false, isBlocked: false };

  try {
    const userRef = doc(db, 'users', uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      return { exists: false, isVip: false, isBlocked: false };
    }
    const data = snap.data();
    const isBlocked = Boolean(data.vip_blocked === true || data.vip_revoked === true || data.status === 'blocked');
    return {
      exists: true,
      isVip: data.is_vip === true && !isBlocked,
      isBlocked: isBlocked,
    };
  } catch (error) {
    console.warn("Firestore checkUserVipInCloud error:", error);
    return { exists: false, isVip: false, isBlocked: false };
  }
}
