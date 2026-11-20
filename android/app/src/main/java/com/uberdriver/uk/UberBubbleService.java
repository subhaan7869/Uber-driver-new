package com.uberdriver.uk;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Color;
import android.graphics.PixelFormat;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.media.AudioManager;
import android.media.RingtoneManager;
import android.media.ToneGenerator;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.Settings;
import android.util.DisplayMetrics;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.WindowManager;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;

public class UberBubbleService extends Service {

    public static final String ACTION_START_ONLINE = "com.uberdriver.uk.ACTION_START_ONLINE";
    public static final String ACTION_STOP_ONLINE = "com.uberdriver.uk.ACTION_STOP_ONLINE";
    public static final String ACTION_APP_FOREGROUND = "com.uberdriver.uk.ACTION_APP_FOREGROUND";
    public static final String ACTION_SHOW_OFFER = "com.uberdriver.uk.ACTION_SHOW_OFFER";
    public static final String ACTION_CLEAR_OFFER = "com.uberdriver.uk.ACTION_CLEAR_OFFER";
    public static final String ACTION_SCHEDULE_OFFER = "com.uberdriver.uk.ACTION_SCHEDULE_OFFER";
    public static final String ACTION_CANCEL_SCHEDULED = "com.uberdriver.uk.ACTION_CANCEL_SCHEDULED";
    public static final String ACTION_PREVIEW_BUBBLE = "com.uberdriver.uk.ACTION_PREVIEW_BUBBLE";

    public static final String EXTRA_IN_FOREGROUND = "in_foreground";
    public static final String EXTRA_CITY = "city";
    public static final String EXTRA_DRIVER_NAME = "driver_name";
    public static final String EXTRA_OFFER_ID = "offer_id";
    public static final String EXTRA_OFFER_JSON = "offer_json";
    public static final String EXTRA_FARE_TEXT = "fare_text";
    public static final String EXTRA_OFFER_TITLE = "offer_title";
    public static final String EXTRA_OFFER_SUBTITLE = "offer_subtitle";
    public static final String EXTRA_EXPIRES_SEC = "expires_sec";
    public static final String EXTRA_DELAY_MS = "delay_ms";

    private static final String CHANNEL_ONLINE_ID = "uber_driver_online_v1";
    private static final String CHANNEL_OFFERS_ID = "uber_driver_offers_v1";
    private static final int ONLINE_NOTIF_ID = 7101;
    private static final int OFFER_NOTIF_ID = 7102;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private WindowManager windowManager;
    private WindowManager.LayoutParams bubbleParams;
    private View bubbleRootView;
    private FrameLayout dotCircleView;
    private TextView dotMonogramView;
    private TextView fareBadgeView;

    private boolean isOnline = false;
    private boolean appInForeground = true;
    private boolean previewMode = false;
    private String currentCity = "London";

    private String activeOfferId = null;
    private String activeOfferJson = null;
    private String activeFareText = null;
    private int activeOfferSecLeft = 0;

    private Runnable offerCountdownRunnable;
    private Runnable scheduledOfferRunnable;
    private Runnable previewStopRunnable;

    @Override
    public void onCreate() {
        super.onCreate();
        isServiceRunning = true;
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        createNotificationChannels();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            if (isOnline) {
                startOnlineForeground();
            }
            return START_STICKY;
        }

        String action = intent.getAction();
        if (action == null) {
            return START_STICKY;
        }

        switch (action) {
            case ACTION_START_ONLINE: {
                isOnline = true;
                String city = intent.getStringExtra(EXTRA_CITY);
                if (city != null && !city.isEmpty()) {
                    currentCity = city;
                }
                startOnlineForeground();
                updateBubbleVisibility();
                break;
            }
            case ACTION_STOP_ONLINE: {
                isOnline = false;
                previewMode = false;
                cancelScheduledOffer();
                clearOfferState();
                removeBubbleView();
                stopForegroundCompat();
                stopSelf();
                break;
            }
            case ACTION_APP_FOREGROUND: {
                appInForeground = intent.getBooleanExtra(EXTRA_IN_FOREGROUND, true);
                if (appInForeground) {
                    cancelScheduledOffer();
                }
                updateBubbleVisibility();
                break;
            }
            case ACTION_SHOW_OFFER: {
                String offerId = intent.getStringExtra(EXTRA_OFFER_ID);
                String offerJson = intent.getStringExtra(EXTRA_OFFER_JSON);
                String fareText = intent.getStringExtra(EXTRA_FARE_TEXT);
                String title = intent.getStringExtra(EXTRA_OFFER_TITLE);
                String subtitle = intent.getStringExtra(EXTRA_OFFER_SUBTITLE);
                int expiresSec = intent.getIntExtra(EXTRA_EXPIRES_SEC, 15);
                triggerOfferDisplay(offerId, offerJson, fareText, title, subtitle, expiresSec, !appInForeground);
                break;
            }
            case ACTION_CLEAR_OFFER: {
                clearOfferState();
                renderBubbleVisualState();
                cancelOfferNotification();
                break;
            }
            case ACTION_SCHEDULE_OFFER: {
                long delayMs = intent.getLongExtra(EXTRA_DELAY_MS, 9000L);
                String offerId = intent.getStringExtra(EXTRA_OFFER_ID);
                String offerJson = intent.getStringExtra(EXTRA_OFFER_JSON);
                String fareText = intent.getStringExtra(EXTRA_FARE_TEXT);
                String title = intent.getStringExtra(EXTRA_OFFER_TITLE);
                String subtitle = intent.getStringExtra(EXTRA_OFFER_SUBTITLE);
                int expiresSec = intent.getIntExtra(EXTRA_EXPIRES_SEC, 15);
                scheduleNativeOffer(delayMs, offerId, offerJson, fareText, title, subtitle, expiresSec);
                break;
            }
            case ACTION_CANCEL_SCHEDULED: {
                cancelScheduledOffer();
                break;
            }
            case ACTION_PREVIEW_BUBBLE: {
                previewMode = true;
                startOnlineForeground();
                showBubbleView();
                if (previewStopRunnable != null) {
                    mainHandler.removeCallbacks(previewStopRunnable);
                }
                previewStopRunnable = () -> {
                    previewMode = false;
                    if (!isOnline) {
                        removeBubbleView();
                        stopForegroundCompat();
                        stopSelf();
                    } else {
                        updateBubbleVisibility();
                    }
                };
                mainHandler.postDelayed(previewStopRunnable, 8000L);
                break;
            }
        }

        return START_STICKY;
    }

    private void startOnlineForeground() {
        Notification notification = buildOnlineNotification();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            int fgsType = ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE;
            try {
                startForeground(
                    ONLINE_NOTIF_ID,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION | ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
                );
                return;
            } catch (SecurityException ignored) {
                startForeground(ONLINE_NOTIF_ID, notification, fgsType);
                return;
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            try {
                startForeground(ONLINE_NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION);
                return;
            } catch (SecurityException ignored) {
                // Fall back cleanly if location permission not yet granted
            }
        }
        startForeground(ONLINE_NOTIF_ID, notification);
    }

    private void stopForegroundCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
            stopForeground(STOP_FOREGROUND_REMOVE);
        } else {
            stopForeground(true);
        }
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;

        NotificationChannel onlineChannel = new NotificationChannel(
            CHANNEL_ONLINE_ID,
            "Uber Driver Online Status",
            NotificationManager.IMPORTANCE_LOW
        );
        onlineChannel.setDescription("Keeps Uber Driver floating dot & background trip detection active while online");
        onlineChannel.setShowBadge(false);
        nm.createNotificationChannel(onlineChannel);

        NotificationChannel offersChannel = new NotificationChannel(
            CHANNEL_OFFERS_ID,
            "Uber Trip Requests",
            NotificationManager.IMPORTANCE_HIGH
        );
        offersChannel.setDescription("Urgent incoming ride alerts while minimized or navigating in another app");
        offersChannel.enableVibration(true);
        nm.createNotificationChannel(offersChannel);
    }

    private Notification buildOnlineNotification() {
        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        PendingIntent contentPending = PendingIntent.getActivity(
            this,
            101,
            openIntent,
            pendingIntentFlags()
        );

        String subtitle = previewMode && !isOnline
            ? "Floating dot preview active — drag anywhere on screen"
            : "Finding trips near " + currentCity + " · Floating dot ready";

        return new NotificationCompat.Builder(this, CHANNEL_ONLINE_ID)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setContentTitle("Uber Driver · You're online")
            .setContentText(subtitle)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setContentIntent(contentPending)
            .build();
    }

    private void postOfferNotification(String offerId, String offerJson, String title, String subtitle) {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;

        Intent openIntent = new Intent(this, MainActivity.class);
        openIntent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT);
        if (offerId != null) openIntent.putExtra("uber_open_offer_id", offerId);
        if (offerJson != null) openIntent.putExtra("uber_offer_json", offerJson);

        PendingIntent contentPending = PendingIntent.getActivity(
            this,
            102,
            openIntent,
            pendingIntentFlags()
        );

        Notification notif = new NotificationCompat.Builder(this, CHANNEL_OFFERS_ID)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setContentTitle(title != null ? title : "New Uber Trip Request")
            .setContentText(subtitle != null ? subtitle : "Tap to open Uber Driver and accept")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setAutoCancel(true)
            .setContentIntent(contentPending)
            .build();

        nm.notify(OFFER_NOTIF_ID, notif);
    }

    private void cancelOfferNotification() {
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(OFFER_NOTIF_ID);
        }
    }

    private void scheduleNativeOffer(
        long delayMs,
        String offerId,
        String offerJson,
        String fareText,
        String title,
        String subtitle,
        int expiresSec
    ) {
        cancelScheduledOffer();
        scheduledOfferRunnable = () -> {
            if (!isOnline || appInForeground) return;
            triggerOfferDisplay(offerId, offerJson, fareText, title, subtitle, expiresSec, true);
        };
        mainHandler.postDelayed(scheduledOfferRunnable, Math.max(1500L, delayMs));
    }

    private void cancelScheduledOffer() {
        if (scheduledOfferRunnable != null) {
            mainHandler.removeCallbacks(scheduledOfferRunnable);
            scheduledOfferRunnable = null;
        }
    }

    private void triggerOfferDisplay(
        String offerId,
        String offerJson,
        String fareText,
        String title,
        String subtitle,
        int expiresSec,
        boolean notifySystem
    ) {
        activeOfferId = offerId;
        activeOfferJson = offerJson;
        activeFareText = (fareText != null && !fareText.isEmpty()) ? fareText : "Trip";
        activeOfferSecLeft = Math.max(5, expiresSec);

        if (!appInForeground || previewMode) {
            showBubbleView();
        }
        renderBubbleVisualState();

        if (notifySystem) {
            playOfferAlertSoundAndVibrate();
            postOfferNotification(offerId, offerJson, title, subtitle);
        }

        if (offerCountdownRunnable != null) {
            mainHandler.removeCallbacks(offerCountdownRunnable);
        }
        offerCountdownRunnable = new Runnable() {
            @Override
            public void run() {
                if (activeOfferId == null) return;
                activeOfferSecLeft -= 1;
                if (activeOfferSecLeft <= 0) {
                    clearOfferState();
                    renderBubbleVisualState();
                    cancelOfferNotification();
                } else {
                    renderBubbleVisualState();
                    mainHandler.postDelayed(this, 1000L);
                }
            }
        };
        mainHandler.postDelayed(offerCountdownRunnable, 1000L);
    }

    private void clearOfferState() {
        activeOfferId = null;
        activeOfferJson = null;
        activeFareText = null;
        activeOfferSecLeft = 0;
        if (offerCountdownRunnable != null) {
            mainHandler.removeCallbacks(offerCountdownRunnable);
            offerCountdownRunnable = null;
        }
    }

    private void playOfferAlertSoundAndVibrate() {
        try {
            Vibrator vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null && vibrator.hasVibrator()) {
                long[] pattern = new long[] { 0, 180, 90, 220 };
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createWaveform(pattern, -1));
                } else {
                    vibrator.vibrate(pattern, -1);
                }
            }
        } catch (Exception ignored) {}

        try {
            Uri alertUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            if (alertUri != null) {
                android.media.Ringtone r = RingtoneManager.getRingtone(getApplicationContext(), alertUri);
                if (r != null) {
                    r.play();
                    return;
                }
            }
            ToneGenerator tg = new ToneGenerator(AudioManager.STREAM_NOTIFICATION, 85);
            tg.startTone(ToneGenerator.TONE_PROP_BEEP2, 320);
        } catch (Exception ignored) {}
    }

    private void updateBubbleVisibility() {
        if ((isOnline && !appInForeground) || previewMode) {
            showBubbleView();
        } else {
            removeBubbleView();
        }
    }

    private boolean canDrawOverlaysCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return Settings.canDrawOverlays(this);
        }
        return true;
    }

    private void showBubbleView() {
        if (bubbleRootView != null || windowManager == null) {
            renderBubbleVisualState();
            return;
        }
        if (!canDrawOverlaysCompat()) {
            return;
        }

        createBubbleView();
        int windowType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;

        bubbleParams = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            windowType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN,
            PixelFormat.TRANSLUCENT
        );
        bubbleParams.gravity = Gravity.TOP | Gravity.START;
        bubbleParams.x = dpToPx(16);
        bubbleParams.y = dpToPx(220);

        try {
            windowManager.addView(bubbleRootView, bubbleParams);
            renderBubbleVisualState();
        } catch (Exception ignored) {
            bubbleRootView = null;
        }
    }

    private void removeBubbleView() {
        if (bubbleRootView != null && windowManager != null) {
            try {
                windowManager.removeView(bubbleRootView);
            } catch (Exception ignored) {}
        }
        bubbleRootView = null;
        dotCircleView = null;
        dotMonogramView = null;
        fareBadgeView = null;
    }

    private void createBubbleView() {
        LinearLayout container = new LinearLayout(this);
        container.setOrientation(LinearLayout.HORIZONTAL);
        container.setGravity(Gravity.CENTER_VERTICAL);

        int circleSize = dpToPx(60);
        dotCircleView = new FrameLayout(this);
        LinearLayout.LayoutParams circleLp = new LinearLayout.LayoutParams(circleSize, circleSize);
        dotCircleView.setLayoutParams(circleLp);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            dotCircleView.setElevation(dpToPx(8));
        }

        dotMonogramView = new TextView(this);
        dotMonogramView.setText("Uber");
        dotMonogramView.setTextColor(Color.WHITE);
        dotMonogramView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 14);
        dotMonogramView.setTypeface(Typeface.DEFAULT_BOLD);
        dotMonogramView.setGravity(Gravity.CENTER);
        dotCircleView.addView(
            dotMonogramView,
            new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
        );

        fareBadgeView = new TextView(this);
        fareBadgeView.setTextColor(Color.WHITE);
        fareBadgeView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        fareBadgeView.setTypeface(Typeface.DEFAULT_BOLD);
        fareBadgeView.setPadding(dpToPx(10), dpToPx(6), dpToPx(10), dpToPx(6));
        LinearLayout.LayoutParams badgeLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        badgeLp.setMarginStart(dpToPx(6));
        fareBadgeView.setLayoutParams(badgeLp);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            fareBadgeView.setElevation(dpToPx(6));
        }

        container.addView(dotCircleView);
        container.addView(fareBadgeView);

        container.setOnTouchListener(new View.OnTouchListener() {
            private int initialX;
            private int initialY;
            private float initialTouchX;
            private float initialTouchY;
            private boolean moved;

            @Override
            public boolean onTouch(View v, MotionEvent event) {
                if (bubbleParams == null || windowManager == null) return false;
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        initialX = bubbleParams.x;
                        initialY = bubbleParams.y;
                        initialTouchX = event.getRawX();
                        initialTouchY = event.getRawY();
                        moved = false;
                        return true;
                    case MotionEvent.ACTION_MOVE:
                        int dx = Math.round(event.getRawX() - initialTouchX);
                        int dy = Math.round(event.getRawY() - initialTouchY);
                        if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
                            moved = true;
                        }
                        bubbleParams.x = initialX + dx;
                        bubbleParams.y = Math.max(dpToPx(40), initialY + dy);
                        try {
                            windowManager.updateViewLayout(bubbleRootView, bubbleParams);
                        } catch (Exception ignored) {}
                        return true;
                    case MotionEvent.ACTION_UP:
                        if (!moved) {
                            handleBubbleTap();
                        } else {
                            snapBubbleToEdge();
                        }
                        return true;
                    default:
                        return false;
                }
            }
        });

        bubbleRootView = container;
    }

    private void snapBubbleToEdge() {
        if (bubbleParams == null || windowManager == null || bubbleRootView == null) return;
        DisplayMetrics dm = getResources().getDisplayMetrics();
        int midScreen = dm.widthPixels / 2;
        int viewWidth = bubbleRootView.getWidth() > 0 ? bubbleRootView.getWidth() : dpToPx(60);
        bubbleParams.x = bubbleParams.x + (viewWidth / 2) < midScreen
            ? dpToPx(12)
            : Math.max(dpToPx(12), dm.widthPixels - viewWidth - dpToPx(12));
        try {
            windowManager.updateViewLayout(bubbleRootView, bubbleParams);
        } catch (Exception ignored) {}
    }

    private void handleBubbleTap() {
        String tappedOfferId = activeOfferId;
        String tappedOfferJson = activeOfferJson;
        cancelOfferNotification();

        UberFloatingBubblePlugin.notifyBubbleTapped(tappedOfferId, tappedOfferJson);

        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.setFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_SINGLE_TOP |
            Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
        );
        if (tappedOfferId != null) launchIntent.putExtra("uber_open_offer_id", tappedOfferId);
        if (tappedOfferJson != null) launchIntent.putExtra("uber_offer_json", tappedOfferJson);
        startActivity(launchIntent);
    }

    private void renderBubbleVisualState() {
        if (dotCircleView == null || dotMonogramView == null || fareBadgeView == null) return;

        boolean hasOffer = activeOfferId != null && activeFareText != null;

        GradientDrawable circleBg = new GradientDrawable();
        circleBg.setShape(GradientDrawable.OVAL);
        if (hasOffer) {
            circleBg.setColor(Color.parseColor("#276EF1"));
            circleBg.setStroke(dpToPx(3), Color.WHITE);
            dotMonogramView.setText(activeFareText);
            dotMonogramView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
        } else {
            circleBg.setColor(Color.parseColor("#000000"));
            circleBg.setStroke(dpToPx(3), Color.parseColor("#276EF1"));
            dotMonogramView.setText("Uber");
            dotMonogramView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13);
        }
        dotCircleView.setBackground(circleBg);

        if (hasOffer) {
            GradientDrawable badgeBg = new GradientDrawable();
            badgeBg.setCornerRadius(dpToPx(999));
            badgeBg.setColor(Color.parseColor("#05944F"));
            badgeBg.setStroke(dpToPx(2), Color.WHITE);
            fareBadgeView.setBackground(badgeBg);
            fareBadgeView.setText("Accept · " + activeOfferSecLeft + "s");
            fareBadgeView.setVisibility(View.VISIBLE);
        } else {
            fareBadgeView.setVisibility(View.GONE);
        }
    }

    private int dpToPx(int dp) {
        return Math.round(dp * getResources().getDisplayMetrics().density);
    }

    private int pendingIntentFlags() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            return PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_MUTABLE;
        }
        return PendingIntent.FLAG_UPDATE_CURRENT;
    }

    @Override
    public void onDestroy() {
        cancelScheduledOffer();
        clearOfferState();
        removeBubbleView();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
