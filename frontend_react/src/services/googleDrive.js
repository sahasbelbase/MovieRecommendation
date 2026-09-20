/**
 * Google Drive API Service
 * Securely saves and loads the user's movie library (watched list + watchlist)
 * directly in their personal Google Drive Application Data storage.
 */

const FILE_NAME = 'cinematch_movie_library.json';
const TOKEN_KEY = 'cinematch_gdrive_token';

export function setStoredDriveToken(token) {
  if (token) {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(TOKEN_KEY, token);
  } else {
    sessionStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(TOKEN_KEY);
  }
}

export function getStoredDriveToken() {
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY);
}

/**
 * Searches for an existing library file in the user's Google Drive AppData folder.
 */
async function findLibraryFile(token) {
  try {
    const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${FILE_NAME}' and trashed=false&fields=files(id,name,modifiedTime)`;
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) {
      // If appDataFolder isn't accessible, try standard files space
      const fallbackUrl = `https://www.googleapis.com/drive/v3/files?q=name='${FILE_NAME}' and trashed=false&fields=files(id,name,modifiedTime)`;
      const fallbackRes = await fetch(fallbackUrl, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!fallbackRes.ok) return null;
      const fbData = await fallbackRes.json();
      return fbData.files && fbData.files.length > 0 ? fbData.files[0] : null;
    }

    const data = await res.json();
    if (data.files && data.files.length > 0) {
      return data.files[0];
    }
    return null;
  } catch (err) {
    console.warn("Notice checking Google Drive library file:", err);
    return null;
  }
}

/**
 * Loads movie library directly from user's Google Drive.
 * Returns { watched: [...], watchlist: [...], unwatched: [...] } or null.
 */
export async function loadFromGoogleDrive(token) {
  if (!token) return null;

  try {
    const file = await findLibraryFile(token);
    if (!file || !file.id) return null;

    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!res.ok) return null;
    const content = await res.json();
    return content;
  } catch (err) {
    console.warn("Notice loading data from Google Drive:", err);
    return null;
  }
}

/**
 * Saves movie library directly to the user's Google Drive.
 */
export async function saveToGoogleDrive(token, { watched = [], watchlist = [], unwatched = [] }) {
  if (!token) return false;

  const payload = {
    app: "MovieRecommendation",
    version: "1.0",
    updated_at: Date.now(),
    watched,
    watchlist,
    unwatched
  };

  try {
    const existingFile = await findLibraryFile(token);

    if (existingFile && existingFile.id) {
      // Update existing file content via media upload
      const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFile.id}?uploadType=media`;
      const res = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      return res.ok;
    } else {
      // Create new file in Google Drive AppData folder using multipart upload
      const boundary = '-------cinematch_boundary_' + Date.now();
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelim = `\r\n--${boundary}--`;

      const metadata = {
        name: FILE_NAME,
        parents: ['appDataFolder'],
        mimeType: 'application/json',
        description: 'Personal Cinema Library Watchlist and History'
      };

      const multipartBody =
        delimiter +
        'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
        JSON.stringify(metadata) +
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        JSON.stringify(payload) +
        closeDelim;

      const createUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
      const res = await fetch(createUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: multipartBody
      });

      if (!res.ok) {
        // Fallback: create in standard drive folder if appDataFolder is restricted
        const stdMetadata = {
          name: FILE_NAME,
          mimeType: 'application/json',
          description: 'Personal Cinema Library Watchlist and History'
        };
        const stdBody =
          delimiter +
          'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
          JSON.stringify(stdMetadata) +
          delimiter +
          'Content-Type: application/json\r\n\r\n' +
          JSON.stringify(payload) +
          closeDelim;

        const stdRes = await fetch(createUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
          },
          body: stdBody
        });
        return stdRes.ok;
      }

      return true;
    }
  } catch (err) {
    console.warn("Notice saving data to Google Drive:", err);
    return false;
  }
}
