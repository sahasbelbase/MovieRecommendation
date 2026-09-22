package com.cinematch.tv;

import android.content.ContentResolver;
import android.content.ContentUris;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.media.tv.TvContract;
import android.net.Uri;
import android.util.Log;

import androidx.annotation.NonNull;
import androidx.work.Worker;
import androidx.work.WorkerParameters;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

public class TrendingChannelWorker extends Worker {

    private static final String TAG = "TrendingChannelWorker";
    private static final String CHANNEL_KEY = "cinematch_trending_channel_id";
    private static final String API_URL = "https://movierecommendation-t8yr.onrender.com/api/movies/trending?media_type=all";

    public TrendingChannelWorker(@NonNull Context context, @NonNull WorkerParameters workerParams) {
        super(context, workerParams);
    }

    @NonNull
    @Override
    public Result doWork() {
        Log.d(TAG, "Starting Android TV Trending Channel Update...");
        try {
            long channelId = getOrCreateChannel(getApplicationContext());
            if (channelId <= 0) {
                Log.e(TAG, "Failed to obtain or create CineMatch TV Channel.");
                return Result.failure();
            }

            // Clear old preview programs for this channel
            getApplicationContext().getContentResolver().delete(
                    TvContract.PreviewPrograms.CONTENT_URI,
                    TvContract.PreviewPrograms.COLUMN_CHANNEL_ID + "=?",
                    new String[]{String.valueOf(channelId)}
            );

            // Fetch trending items from API
            JSONArray items = fetchTrendingFromApi();
            if (items == null || items.length() == 0) {
                Log.w(TAG, "No trending items returned from API.");
                return Result.success();
            }

            int count = 0;
            for (int i = 0; i < items.length() && count < 10; i++) {
                JSONObject obj = items.optJSONObject(i);
                if (obj == null) continue;

                int movieId = obj.optInt("id", obj.optInt("item_id", obj.optInt("tmdb_id", 0)));
                String title = obj.optString("title", obj.optString("name", "Trending Title"));
                String poster = obj.optString("poster_url", obj.optString("backdrop_url", ""));
                String overview = obj.optString("overview", "Stream now on CineMatch TV.");
                String mediaType = obj.optString("media_type", "movie");

                if (movieId <= 0) continue;

                ContentValues programValues = new ContentValues();
                programValues.put(TvContract.PreviewPrograms.COLUMN_CHANNEL_ID, channelId);
                programValues.put(TvContract.PreviewPrograms.COLUMN_TITLE, title);
                programValues.put(TvContract.PreviewPrograms.COLUMN_SHORT_DESCRIPTION, overview);
                if (!poster.isEmpty()) {
                    programValues.put(TvContract.PreviewPrograms.COLUMN_POSTER_ART_URI, poster);
                }
                programValues.put(TvContract.PreviewPrograms.COLUMN_TYPE,
                        "tv".equalsIgnoreCase(mediaType) || "anime".equalsIgnoreCase(mediaType)
                                ? TvContract.PreviewPrograms.TYPE_TV_SERIES
                                : TvContract.PreviewPrograms.TYPE_MOVIE);
                programValues.put(TvContract.PreviewPrograms.COLUMN_INTENT_URI, "cinematch://movie/" + movieId);
                programValues.put(TvContract.PreviewPrograms.COLUMN_POSTER_ART_ASPECT_RATIO,
                        TvContract.PreviewPrograms.ASPECT_RATIO_2_3);

                getApplicationContext().getContentResolver().insert(
                        TvContract.PreviewPrograms.CONTENT_URI,
                        programValues
                );
                count++;
            }

            Log.d(TAG, "Published " + count + " trending programs to Android TV Home Screen Widget.");
            return Result.success();

        } catch (Exception e) {
            Log.e(TAG, "Error updating Android TV Trending Channel:", e);
            return Result.retry();
        }
    }

    private long getOrCreateChannel(Context context) {
        ContentResolver resolver = context.getContentResolver();

        // Query existing channels
        try (Cursor cursor = resolver.query(
                TvContract.Channels.CONTENT_URI,
                new String[]{TvContract.Channels._ID, TvContract.Channels.COLUMN_DISPLAY_NAME},
                TvContract.Channels.COLUMN_DISPLAY_NAME + "=?",
                new String[]{"CineMatch Trending"},
                null
        )) {
            if (cursor != null && cursor.moveToFirst()) {
                return cursor.getLong(0);
            }
        } catch (Exception e) {
            Log.w(TAG, "Query channel cursor failed:", e);
        }

        // Create new channel
        ContentValues values = new ContentValues();
        values.put(TvContract.Channels.COLUMN_TYPE, TvContract.Channels.TYPE_PREVIEW);
        values.put(TvContract.Channels.COLUMN_DISPLAY_NAME, "CineMatch Trending");
        values.put(TvContract.Channels.COLUMN_DESCRIPTION, "Top Movies, TV Series & Anime");
        values.put(TvContract.Channels.COLUMN_APP_LINK_INTENT_URI, "cinematch://trending");

        Uri uri = resolver.insert(TvContract.Channels.CONTENT_URI, values);
        if (uri != null) {
            return ContentUris.parseId(uri);
        }
        return -1;
    }

    private JSONArray fetchTrendingFromApi() {
        HttpURLConnection conn = null;
        try {
            URL url = new URL(API_URL);
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("GET");
            conn.setConnectTimeout(8000);
            conn.setReadTimeout(8000);

            if (conn.getResponseCode() == 200) {
                BufferedReader reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                StringBuilder sb = new StringBuilder();
                String line;
                while ((line = reader.readLine()) != null) {
                    sb.append(line);
                }
                reader.close();
                return new JSONArray(sb.toString());
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed fetching trending from remote API:", e);
        } finally {
            if (conn != null) conn.disconnect();
        }
        return null;
    }
}
