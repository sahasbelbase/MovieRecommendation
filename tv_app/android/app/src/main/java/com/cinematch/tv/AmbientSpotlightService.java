package com.cinematch.tv;

import android.content.Intent;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.service.dreams.DreamService;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.KeyEvent;
import android.view.View;
import android.widget.FrameLayout;
import android.widget.TextView;

public class AmbientSpotlightService extends DreamService {

    private Handler handler;
    private Runnable slideRunnable;
    private TextView titleView;
    private TextView subtitleView;
    private int currentIndex = 0;

    private static final String[] MOCK_TITLES = {
        "One Piece (Anime)",
        "Resident Evil (2026)",
        "Reacher Season 3",
        "Demon Slayer: Hashira Training Arc",
        "Spider-Man: Brand New Day"
    };

    private static final String[] MOCK_SUBTITLES = {
        "🍅 98% • IMDb 8.9 ★ • Press SELECT to Watch Now",
        "🍅 77% • IMDb 7.4 ★ • Press SELECT to Stream in HD",
        "🍅 92% • IMDb 8.5 ★ • Press SELECT to Resume S3 E1",
        "🍅 96% • IMDb 8.8 ★ • Sub & Dub Available",
        "🍅 89% • IMDb 8.1 ★ • Top Trending Release"
    };

    @Override
    public void onAttachedToWindow() {
        super.onAttachedToWindow();

        setInteractive(true);
        setFullscreen(true);

        FrameLayout layout = new FrameLayout(this);
        layout.setBackgroundColor(Color.parseColor("#09090b"));

        titleView = new TextView(this);
        titleView.setTextColor(Color.WHITE);
        titleView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 36);
        titleView.setTypeface(null, android.graphics.Typeface.BOLD);

        subtitleView = new TextView(this);
        subtitleView.setTextColor(Color.parseColor("#a1a1aa"));
        subtitleView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);

        FrameLayout.LayoutParams titleParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
        );
        titleParams.gravity = Gravity.BOTTOM | Gravity.START;
        titleParams.leftMargin = 80;
        titleParams.bottomMargin = 140;

        FrameLayout.LayoutParams subParams = new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT
        );
        subParams.gravity = Gravity.BOTTOM | Gravity.START;
        subParams.leftMargin = 80;
        subParams.bottomMargin = 90;

        layout.addView(titleView, titleParams);
        layout.addView(subtitleView, subParams);

        setContentView(layout);

        updateSlide();

        handler = new Handler(Looper.getMainLooper());
        slideRunnable = new Runnable() {
            @Override
            public void run() {
                currentIndex = (currentIndex + 1) % MOCK_TITLES.length;
                updateSlide();
                handler.postDelayed(this, 8000);
            }
        };
        handler.postDelayed(slideRunnable, 8000);
    }

    private void updateSlide() {
        if (titleView != null) {
            titleView.setText(MOCK_TITLES[currentIndex]);
        }
        if (subtitleView != null) {
            subtitleView.setText(MOCK_SUBTITLES[currentIndex]);
        }
    }

    @Override
    public boolean dispatchKeyEvent(KeyEvent event) {
        if (event.getAction() == KeyEvent.ACTION_DOWN) {
            int code = event.getKeyCode();
            if (code == KeyEvent.KEYCODE_DPAD_CENTER || code == KeyEvent.KEYCODE_ENTER || code == KeyEvent.KEYCODE_BUTTON_A) {
                // Launch main app
                Intent intent = new Intent(this, MainActivity.class);
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                startActivity(intent);
                finish();
                return true;
            }
        }
        return super.dispatchKeyEvent(event);
    }

    @Override
    public void onDetachedFromWindow() {
        super.onDetachedFromWindow();
        if (handler != null && slideRunnable != null) {
            handler.removeCallbacks(slideRunnable);
        }
    }
}
