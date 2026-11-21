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
import android.text.TextUtils;
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

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.Locale;

public class UberBubbleService extends Service {

    public static final String ACTION_START_ONLINE = "com.uberdriver.uk.ACTION_START_ONLINE";
    public static final String ACTION_STOP_ONLINE = "com.uberdriver.uk.ACTION_STOP_ONLINE";
    public static final String ACTION_APP_FOREGROUND = "com.uberdriver.uk.ACTION_APP_FOREGROUND";
    public static final String ACTION_SHOW_OFFER = "com.uberdriver.uk.ACTION_SHOW_OFFER";
    public static final String ACTION_CLEAR_OFFER = "com.uberdriver.uk.ACTION_CLEAR_OFFER";
    public static final String ACTION_SCHEDULE_OFFER = "com.uberdriver.uk.ACTION_SCHEDULE_OFFER";
    public static final String ACTION_CANCEL_SCHEDULED = "com.uberdriver.uk.ACTION_CANCEL_SCHEDULED";
    public static final String ACTION_PREVIEW_BUBBLE = "com.uberdriver.uk.ACTION_PREVIEW_BUBBLE";
    public static final String ACTION_PREVIEW_OFFER_CARD = "com.uberdriver.uk.ACTION_PREVIEW_OFFER_CARD";

    public static final String EXTRA_IN_FOREGROUND = "in_foreground";
    public static final String EXTRA_CITY = "city";
    public static final String EXTRA_DRIVER_NAME = "driver_name";
    public static final String EXTRA_OFFER_ID = "offer_id";
    public static final String EXTRA_OFFER_JSON = "offer_json";
    public static final String EXTRA_OFFERS_QUEUE_JSON = "offers_queue_json";
    public static final String EXTRA_FARE_TEXT = "fare_text";
    public static final String EXTRA_OFFER_TITLE = "offer_title";
    public static final String EXTRA_OFFER_SUBTITLE = "offer_subtitle";
    public static final String EXTRA_EXPIRES_SEC = "expires_sec";
    public static final String EXTRA_DELAY_MS = "delay_ms";

    private static final String CHANNEL_ONLINE_ID = "uber_driver_online_v1";
    private static final String CHANNEL_OFFERS_ID = "uber_driver_offers_v1";
    private static final int ONLINE_NOTIF_ID = 7101;
    private static final int OFFER_NOTIF_ID = 7102;

    public static volatile boolean isServiceRunning = false;
    private static volatile UberBubbleService instance = null;
    private static volatile boolean desiredOnline = false;
    private static volatile boolean desiredInForeground = true;
    private static volatile String desiredCity = "London";

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private WindowManager windowManager;

    private View activeOverlayView;
    private WindowManager.LayoutParams activeOverlayParams;
    private boolean currentModeIsCard = false;

    // Compact Dot references
    private FrameLayout dotCircleView;
    private TextView dotMonogramView;
    private TextView fareBadgeView;
    private int lastDotX = -1;
    private int lastDotY = -1;

    // Expanded Job Card references
    private View cardProgressFill;
    private int cardProgressMaxPx = 0;
    private TextView cardCountdownText;
    private TextView cardActionBtnText;

    private boolean isOnline = false;
    private boolean appInForeground = true;
    private boolean previewMode = false;
    private boolean previewCardMode = false;
    private boolean cardCollapsedToDot = false;
    private String currentCity = "London";

    // Active Offer State
    private String activeOfferId = null;
    private String activeOfferJson = null;
    private String activeFareText = null;
    private int activeOfferSecLeft = 0;
    private int activeOfferTotalSec = 15;

    // Parsed Job Card Fields
    private String offerType = "exclusive";
    private String offerServiceName = "UberX";
    private double offerFare = 15.0;
    private double offerRating = 4.92;
    private int offerPickupMin = 4;
    private double offerPickupMiles = 1.1;
    private String offerPickupAddress = "Soho Square";
    private String offerPickupArea = "West End";
    private int offerTripMin = 16;
    private double offerTripMiles = 4.6;
    private String offerDropoffAddress = "Canary Wharf";
    private String offerDropoffArea = "Docklands";
    private double offerSurgeBonus = 0.0;
    private boolean offerIsIntercity = false;
    private String offerStopAddress = null;
    private String offerPinCode = null;
    private String offerSurchargeLabel = null;
    private double offerSurchargeAmount = 0.0;
    private String offerIntercityCorridor = null;

    // Background Offer Queue so subsequent jobs keep arriving while minimized
    private JSONArray backgroundOffersQueue = null;
    private int backgroundQueueIdx = 0;

    private Runnable offerCountdownRunnable;
    private Runnable scheduledOfferRunnable;
    private Runnable previewStopRunnable;

    // --- Direct in-process hooks so Android 12+ restrictions never drop updates ---

    public static void setDesiredOnlineState(boolean online, String city) {
        desiredOnline = online;
        if (city != null && !city.isEmpty()) {
            desiredCity = city;
        }
        UberBubbleService inst = instance;
        if (inst != null) {
            inst.mainHandler.post(() -> {
                inst.isOnline = desiredOnline;
                inst.currentCity = desiredCity;
                if (inst.isOnline) {
                    inst.startOnlineForeground();
                    inst.appInForeground = desiredInForeground;
                    inst.updateOverlayVisibility();
                } else {
                    inst.handleStopOnline();
                }
            });
        }
    }

    public static void updateForegroundState(boolean inForeground) {
        desiredInForeground = inForeground;
        UberBubbleService inst = instance;
        if (inst != null) {
            inst.mainHandler.post(() -> {
                inst.appInForeground = inForeground;
                if (inForeground) {
                    inst.previewCardMode = false;
                    inst.cancelScheduledOffer();
                }
                inst.updateOverlayVisibility();
            });
        }
    }

    public static void updateOfferDirect(
        String offerId,
        String offerJson,
        String fareText,
        String title,
        String subtitle,
        int expiresSec
    ) {
        UberBubbleService inst = instance;
        if (inst != null) {
            inst.mainHandler.post(() ->
                inst.triggerOfferDisplay(offerId, offerJson, fareText, title, subtitle, expiresSec, !inst.appInForeground)
            );
        }
    }

    public static void clearOfferDirect() {
        UberBubbleService inst = instance;
        if (inst != null) {
            inst.mainHandler.post(() -> {
                inst.previewCardMode = false;
                inst.clearOfferState();
                inst.cancelOfferNotification();
                inst.updateOverlayVisibility();
            });
        }
    }

    public static void scheduleOfferDirect(
        long delayMs,
        String offerId,
        String offerJson,
        String queueJson,
        String fareText,
        String title,
        String subtitle,
        int expiresSec
    ) {
        UberBubbleService inst = instance;
        if (inst != null) {
            inst.mainHandler.post(() -> {
                inst.setOffersQueueJson(queueJson);
                inst.scheduleNativeOffer(delayMs, offerId, offerJson, fareText, title, subtitle, expiresSec);
            });
        }
    }

    public static void cancelScheduledDirect() {
        UberBubbleService inst = instance;
        if (inst != null) {
            inst.mainHandler.post(inst::cancelScheduledOffer);
        }
    }

    public static void stopOnlineDirect() {
        desiredOnline = false;
        UberBubbleService inst = instance;
        if (inst != null) {
            inst.mainHandler.post(inst::handleStopOnline);
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        isServiceRunning = true;
        isOnline = desiredOnline;
        appInForeground = desiredInForeground;
        currentCity = desiredCity;
        windowManager = (WindowManager) getSystemService(WINDOW_SERVICE);
        createNotificationChannels();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            if (isOnline || desiredOnline) {
                isOnline = true;
                appInForeground = desiredInForeground;
                startOnlineForeground();
                updateOverlayVisibility();
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
                desiredOnline = true;
                appInForeground = desiredInForeground;
                String city = intent.getStringExtra(EXTRA_CITY);
                if (city != null && !city.isEmpty()) {
                    currentCity = city;
                    desiredCity = city;
                }
                startOnlineForeground();
                updateOverlayVisibility();
                break;
            }
            case ACTION_STOP_ONLINE: {
                desiredOnline = false;
                handleStopOnline();
                break;
            }
            case ACTION_APP_FOREGROUND: {
                appInForeground = intent.getBooleanExtra(EXTRA_IN_FOREGROUND, true);
                desiredInForeground = appInForeground;
                if (appInForeground) {
                    previewCardMode = false;
                    cancelScheduledOffer();
                }
                updateOverlayVisibility();
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
                previewCardMode = false;
                clearOfferState();
                cancelOfferNotification();
                updateOverlayVisibility();
                break;
            }
            case ACTION_SCHEDULE_OFFER: {
                long delayMs = intent.getLongExtra(EXTRA_DELAY_MS, 9000L);
                String offerId = intent.getStringExtra(EXTRA_OFFER_ID);
                String offerJson = intent.getStringExtra(EXTRA_OFFER_JSON);
                String queueJson = intent.getStringExtra(EXTRA_OFFERS_QUEUE_JSON);
                String fareText = intent.getStringExtra(EXTRA_FARE_TEXT);
                String title = intent.getStringExtra(EXTRA_OFFER_TITLE);
                String subtitle = intent.getStringExtra(EXTRA_OFFER_SUBTITLE);
                int expiresSec = intent.getIntExtra(EXTRA_EXPIRES_SEC, 15);
                setOffersQueueJson(queueJson);
                scheduleNativeOffer(delayMs, offerId, offerJson, fareText, title, subtitle, expiresSec);
                break;
            }
            case ACTION_CANCEL_SCHEDULED: {
                cancelScheduledOffer();
                break;
            }
            case ACTION_PREVIEW_BUBBLE: {
                previewMode = true;
                previewCardMode = false;
                startOnlineForeground();
                updateOverlayVisibility();
                schedulePreviewTimeout(8000L);
                break;
            }
            case ACTION_PREVIEW_OFFER_CARD: {
                previewMode = true;
                previewCardMode = true;
                cardCollapsedToDot = false;
                startOnlineForeground();
                String offerId = intent.getStringExtra(EXTRA_OFFER_ID);
                String offerJson = intent.getStringExtra(EXTRA_OFFER_JSON);
                String fareText = intent.getStringExtra(EXTRA_FARE_TEXT);
                String title = intent.getStringExtra(EXTRA_OFFER_TITLE);
                String subtitle = intent.getStringExtra(EXTRA_OFFER_SUBTITLE);
                int expiresSec = intent.getIntExtra(EXTRA_EXPIRES_SEC, 15);
                triggerOfferDisplay(offerId, offerJson, fareText, title, subtitle, expiresSec, false);
                schedulePreviewTimeout((expiresSec + 1L) * 1000L);
                break;
            }
        }

        return START_STICKY;
    }

    private void schedulePreviewTimeout(long durationMs) {
        if (previewStopRunnable != null) {
            mainHandler.removeCallbacks(previewStopRunnable);
        }
        previewStopRunnable = () -> {
            previewMode = false;
            previewCardMode = false;
            if (!isOnline) {
                clearOfferState();
                removeOverlayView();
                stopForegroundCompat();
                stopSelf();
            } else {
                updateOverlayVisibility();
            }
        };
        mainHandler.postDelayed(previewStopRunnable, durationMs);
    }

    private void handleStopOnline() {
        isOnline = false;
        previewMode = false;
        previewCardMode = false;
        backgroundOffersQueue = null;
        cancelScheduledOffer();
        clearOfferState();
        cancelOfferNotification();
        removeOverlayView();
        stopForegroundCompat();
        stopSelf();
    }

    private void setOffersQueueJson(String queueJson) {
        if (queueJson == null || queueJson.isEmpty()) return;
        try {
            JSONArray arr = new JSONArray(queueJson);
            if (arr.length() > 0) {
                backgroundOffersQueue = arr;
            }
        } catch (Exception ignored) {}
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
                // Fall back cleanly
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
        openIntent.putExtra("uber_action", "open");
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
            .setContentText(subtitle != null ? subtitle : "Tap to view or accept trip")
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

    private void scheduleNextFromBackgroundQueue(long delayMs) {
        if (!isOnline || appInForeground || backgroundOffersQueue == null || backgroundOffersQueue.length() == 0) {
            return;
        }
        try {
            backgroundQueueIdx = (backgroundQueueIdx + 1) % backgroundOffersQueue.length();
            JSONObject obj = backgroundOffersQueue.getJSONObject(backgroundQueueIdx);
            String nextId = obj.optString("id", "bg-offer-" + System.currentTimeMillis());
            String nextJson = obj.toString();
            double fare = obj.optDouble("fare", 15.0);
            String fareTxt = String.format(Locale.UK, "£%.0f", fare);
            String service = obj.optString("serviceName", "UberX");
            String rider = obj.optString("riderName", "Rider");
            int pickMin = obj.optInt("pickupMinutes", 4);
            int expSec = obj.optInt("expiresInSec", 15);
            String title = service + " · " + String.format(Locale.UK, "£%.2f", fare);
            String subtitle = rider + " · " + pickMin + " min away";
            scheduleNativeOffer(delayMs, nextId, nextJson, fareTxt, title, subtitle, expSec);
        } catch (Exception ignored) {}
    }

    private void cancelScheduledOffer() {
        if (scheduledOfferRunnable != null) {
            mainHandler.removeCallbacks(scheduledOfferRunnable);
            scheduledOfferRunnable = null;
        }
    }

    private void parseOfferFields(String offerJson, String fallbackFareText) {
        offerType = "exclusive";
        offerServiceName = "UberX";
        offerFare = 15.0;
        offerRating = 4.92;
        offerPickupMin = 4;
        offerPickupMiles = 1.1;
        offerPickupAddress = "High Street";
        offerPickupArea = currentCity;
        offerTripMin = 15;
        offerTripMiles = 4.5;
        offerDropoffAddress = "City Centre";
        offerDropoffArea = currentCity;
        offerSurgeBonus = 0.0;
        offerIsIntercity = false;
        offerStopAddress = null;
        offerPinCode = null;
        offerSurchargeLabel = null;
        offerSurchargeAmount = 0.0;
        offerIntercityCorridor = null;

        if (fallbackFareText != null && fallbackFareText.startsWith("£")) {
            try {
                offerFare = Double.parseDouble(fallbackFareText.substring(1));
            } catch (Exception ignored) {}
        }

        if (offerJson == null || offerJson.isEmpty()) return;
        try {
            JSONObject obj = new JSONObject(offerJson);
            offerType = obj.optString("type", "exclusive");
            offerServiceName = obj.optString("serviceName", "UberX");
            offerFare = obj.optDouble("fare", offerFare);
            offerRating = obj.optDouble("rating", 4.92);
            offerPickupMin = Math.max(1, obj.optInt("pickupMinutes", 4));
            offerPickupMiles = obj.optDouble("pickupMiles", 1.1);
            offerPickupAddress = obj.optString("pickupAddress", "Pickup Street");
            offerPickupArea = obj.optString("pickupArea", currentCity);
            offerTripMin = Math.max(1, obj.optInt("tripMinutes", 15));
            offerTripMiles = obj.optDouble("tripMiles", 4.5);
            offerDropoffAddress = obj.optString("dropoffAddress", "Dropoff Destination");
            offerDropoffArea = obj.optString("dropoffArea", currentCity);
            offerSurgeBonus = obj.optDouble("surgeBonus", 0.0);
            offerIsIntercity = obj.optBoolean("isIntercity", false);
            offerStopAddress = obj.isNull("stopAddress") ? null : obj.optString("stopAddress", null);
            if (offerStopAddress != null && offerStopAddress.isEmpty()) offerStopAddress = null;
            offerPinCode = obj.isNull("pinCode") ? null : obj.optString("pinCode", null);
            if (offerPinCode != null && offerPinCode.isEmpty()) offerPinCode = null;
            offerSurchargeLabel = obj.isNull("surchargeLabel") ? null : obj.optString("surchargeLabel", null);
            if (offerSurchargeLabel != null && offerSurchargeLabel.isEmpty()) offerSurchargeLabel = null;
            offerSurchargeAmount = obj.optDouble("surchargeAmount", 0.0);
            offerIntercityCorridor = obj.isNull("intercityCorridor") ? null : obj.optString("intercityCorridor", null);
            if (offerIntercityCorridor != null && offerIntercityCorridor.isEmpty()) offerIntercityCorridor = null;
        } catch (Exception ignored) {}
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
        parseOfferFields(offerJson, fareText);
        activeFareText = (fareText != null && !fareText.isEmpty())
            ? fareText
            : String.format(Locale.UK, "£%.0f", offerFare);
        activeOfferTotalSec = Math.max(5, expiresSec);
        activeOfferSecLeft = activeOfferTotalSec;
        cardCollapsedToDot = false;

        updateOverlayVisibility();

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
                    boolean wasPreviewOnly = previewCardMode && !isOnline;
                    clearOfferState();
                    cancelOfferNotification();
                    if (wasPreviewOnly) {
                        previewMode = false;
                        previewCardMode = false;
                        removeOverlayView();
                        stopForegroundCompat();
                        stopSelf();
                    } else {
                        previewCardMode = false;
                        updateOverlayVisibility();
                        scheduleNextFromBackgroundQueue(8000L);
                    }
                } else {
                    renderActiveCountdownOnly();
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
        cardCollapsedToDot = false;
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

    private void updateOverlayVisibility() {
        boolean shouldShow = (isOnline && !appInForeground) || previewMode || previewCardMode;
        if (!shouldShow) {
            removeOverlayView();
            return;
        }
        if (!canDrawOverlaysCompat() || windowManager == null) {
            return;
        }

        boolean hasOffer = activeOfferId != null && activeFareText != null;
        boolean shouldShowCard = (hasOffer && !cardCollapsedToDot && (!appInForeground || previewCardMode));

        if (shouldShowCard) {
            showOfferCardOverlay();
        } else {
            showDotOverlay();
        }
    }

    private boolean canDrawOverlaysCompat() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return Settings.canDrawOverlays(this);
        }
        return true;
    }

    private void removeOverlayView() {
        if (activeOverlayView != null && windowManager != null) {
            try {
                windowManager.removeView(activeOverlayView);
            } catch (Exception ignored) {}
        }
        activeOverlayView = null;
        activeOverlayParams = null;
        currentModeIsCard = false;
        dotCircleView = null;
        dotMonogramView = null;
        fareBadgeView = null;
        cardProgressFill = null;
        cardCountdownText = null;
        cardActionBtnText = null;
    }

    // ==================== 1. COMPACT DRAGGABLE UBER DOT ====================

    private void showDotOverlay() {
        if (activeOverlayView != null && !currentModeIsCard) {
            renderDotVisualState();
            return;
        }
        removeOverlayView();

        View dotView = buildDotView();
        int windowType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;

        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
            WindowManager.LayoutParams.WRAP_CONTENT,
            WindowManager.LayoutParams.WRAP_CONTENT,
            windowType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.TOP | Gravity.START;
        params.x = lastDotX >= 0 ? lastDotX : dpToPx(14);
        params.y = lastDotY >= 0 ? lastDotY : dpToPx(210);

        activeOverlayView = dotView;
        activeOverlayParams = params;
        currentModeIsCard = false;

        try {
            windowManager.addView(activeOverlayView, activeOverlayParams);
            renderDotVisualState();
        } catch (Exception ignored) {
            removeOverlayView();
        }
    }

    private View buildDotView() {
        LinearLayout container = new LinearLayout(this);
        container.setOrientation(LinearLayout.HORIZONTAL);
        container.setGravity(Gravity.CENTER_VERTICAL);
        container.setClipChildren(false);
        container.setClipToPadding(false);
        int pad = dpToPx(4);
        container.setPadding(pad, pad, pad, pad);

        int circleSize = dpToPx(60);
        dotCircleView = new FrameLayout(this);
        dotCircleView.setLayoutParams(new LinearLayout.LayoutParams(circleSize, circleSize));
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
                if (activeOverlayParams == null || windowManager == null) return false;
                switch (event.getAction()) {
                    case MotionEvent.ACTION_DOWN:
                        initialX = activeOverlayParams.x;
                        initialY = activeOverlayParams.y;
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
                        activeOverlayParams.x = initialX + dx;
                        activeOverlayParams.y = Math.max(dpToPx(40), initialY + dy);
                        lastDotX = activeOverlayParams.x;
                        lastDotY = activeOverlayParams.y;
                        try {
                            windowManager.updateViewLayout(activeOverlayView, activeOverlayParams);
                        } catch (Exception ignored) {}
                        return true;
                    case MotionEvent.ACTION_UP:
                        if (!moved) {
                            handleDotTap();
                        } else {
                            snapDotToEdge();
                        }
                        return true;
                    default:
                        return false;
                }
            }
        });

        return container;
    }

    private void snapDotToEdge() {
        if (activeOverlayParams == null || windowManager == null || activeOverlayView == null || currentModeIsCard) return;
        DisplayMetrics dm = getResources().getDisplayMetrics();
        int midScreen = dm.widthPixels / 2;
        int viewWidth = activeOverlayView.getWidth() > 0 ? activeOverlayView.getWidth() : dpToPx(60);
        activeOverlayParams.x = activeOverlayParams.x + (viewWidth / 2) < midScreen
            ? dpToPx(12)
            : Math.max(dpToPx(12), dm.widthPixels - viewWidth - dpToPx(12));
        lastDotX = activeOverlayParams.x;
        lastDotY = activeOverlayParams.y;
        try {
            windowManager.updateViewLayout(activeOverlayView, activeOverlayParams);
        } catch (Exception ignored) {}
    }

    private void handleDotTap() {
        boolean hasOffer = activeOfferId != null && activeFareText != null;
        if (hasOffer && cardCollapsedToDot) {
            cardCollapsedToDot = false;
            updateOverlayVisibility();
            return;
        }

        String tappedOfferId = activeOfferId;
        String tappedOfferJson = activeOfferJson;
        cancelOfferNotification();
        UberFloatingBubblePlugin.notifyBubbleAction("open", tappedOfferId, tappedOfferJson);
        launchMainApp("open", tappedOfferId, tappedOfferJson);
    }

    private void renderDotVisualState() {
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
            fareBadgeView.setText("View Job · " + activeOfferSecLeft + "s");
            fareBadgeView.setVisibility(View.VISIBLE);
        } else {
            fareBadgeView.setVisibility(View.GONE);
        }
    }

    // ==================== 2. REAL FLOATING UBER JOB CARD OVERLAY ====================

    private void showOfferCardOverlay() {
        removeOverlayView();

        DisplayMetrics dm = getResources().getDisplayMetrics();
        int cardWidth = Math.min(dm.widthPixels - dpToPx(24), dpToPx(410));
        View cardView = buildOfferCardView(cardWidth);

        int windowType = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
            ? WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            : WindowManager.LayoutParams.TYPE_PHONE;

        WindowManager.LayoutParams params = new WindowManager.LayoutParams(
            cardWidth,
            WindowManager.LayoutParams.WRAP_CONTENT,
            windowType,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE
                | WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN
                | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED,
            PixelFormat.TRANSLUCENT
        );
        params.gravity = Gravity.BOTTOM | Gravity.CENTER_HORIZONTAL;
        params.x = 0;
        params.y = dpToPx(24);

        activeOverlayView = cardView;
        activeOverlayParams = params;
        currentModeIsCard = true;

        try {
            windowManager.addView(activeOverlayView, activeOverlayParams);
            renderActiveCountdownOnly();
        } catch (Exception ignored) {
            removeOverlayView();
            showDotOverlay();
        }
    }

    private View buildOfferCardView(int cardWidth) {
        boolean isExclusive = "exclusive".equals(offerType);
        boolean isRadar = "radar".equals(offerType);
        int accentColor = offerIsIntercity
            ? Color.parseColor("#7A1C79")
            : (isExclusive ? Color.parseColor("#276EF1") : Color.parseColor("#000000"));

        LinearLayout outerCard = new LinearLayout(this);
        outerCard.setOrientation(LinearLayout.VERTICAL);
        outerCard.setClipChildren(true);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            outerCard.setElevation(dpToPx(16));
        }
        GradientDrawable cardBg = new GradientDrawable();
        cardBg.setCornerRadius(dpToPx(20));
        cardBg.setColor(Color.WHITE);
        cardBg.setStroke(dpToPx(1), Color.parseColor("#22000000"));
        outerCard.setBackground(cardBg);

        // 1. Top countdown progress strip
        FrameLayout progressTrack = new FrameLayout(this);
        progressTrack.setLayoutParams(new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dpToPx(5)
        ));
        progressTrack.setBackgroundColor(Color.parseColor("#EEEEEE"));

        cardProgressMaxPx = cardWidth;
        cardProgressFill = new View(this);
        cardProgressFill.setBackgroundColor(accentColor);
        cardProgressFill.setLayoutParams(new FrameLayout.LayoutParams(cardWidth, FrameLayout.LayoutParams.MATCH_PARENT));
        progressTrack.addView(cardProgressFill);
        outerCard.addView(progressTrack);

        // 2. Inner content padding
        LinearLayout body = new LinearLayout(this);
        body.setOrientation(LinearLayout.VERTICAL);
        int p = dpToPx(15);
        body.setPadding(p, dpToPx(12), p, p);
        outerCard.addView(body);

        // 3. Header badges + minimize + decline row
        LinearLayout headerRow = new LinearLayout(this);
        headerRow.setOrientation(LinearLayout.HORIZONTAL);
        headerRow.setGravity(Gravity.CENTER_VERTICAL);
        body.addView(headerRow);

        // Service Pill (e.g. UberX / Comfort / Intercity)
        headerRow.addView(makePill(
            isRadar && !offerIsIntercity ? ("👤 " + offerServiceName) : offerServiceName,
            offerIsIntercity
                ? Color.parseColor("#7A1C79")
                : (isRadar ? Color.parseColor("#737373") : Color.parseColor("#000000")),
            Color.WHITE,
            12,
            0
        ));

        // Exclusive / Out of City badge (omit clutter pill on standard Trip Radar)
        if (offerIsIntercity) {
            headerRow.addView(makePill(
                "Out of City",
                Color.parseColor("#F3E8FF"),
                Color.parseColor("#7A1C79"),
                11,
                dpToPx(6)
            ));
        } else if (isExclusive) {
            headerRow.addView(makePill(
                "Exclusive",
                Color.parseColor("#E8F0FE"),
                Color.parseColor("#276EF1"),
                11,
                dpToPx(6)
            ));
        }

        // Rating badge (only inline on Exclusive cards; Trip Radar puts rating cleanly under fare)
        if (isExclusive) {
            headerRow.addView(makePill(
                String.format(Locale.UK, "★ %.2f", offerRating),
                Color.parseColor("#F3F3F3"),
                Color.parseColor("#111111"),
                11,
                dpToPx(6)
            ));
        }

        // Flexible spacer
        View spacer = new View(this);
        LinearLayout.LayoutParams spacerLp = new LinearLayout.LayoutParams(0, 1, 1f);
        spacer.setLayoutParams(spacerLp);
        headerRow.addView(spacer);

        // Minimize-to-dot pill
        TextView minimizeBtn = makePill(
            "Dot",
            Color.parseColor("#F3F3F3"),
            Color.parseColor("#333333"),
            11,
            0
        );
        minimizeBtn.setOnClickListener(v -> {
            cardCollapsedToDot = true;
            updateOverlayVisibility();
        });
        headerRow.addView(minimizeBtn);

        // Decline X button
        TextView closeBtn = new TextView(this);
        closeBtn.setText("✕");
        closeBtn.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        closeBtn.setTypeface(Typeface.DEFAULT_BOLD);
        closeBtn.setTextColor(Color.parseColor("#111111"));
        closeBtn.setGravity(Gravity.CENTER);
        GradientDrawable closeBg = new GradientDrawable();
        closeBg.setCornerRadius(dpToPx(10));
        closeBg.setColor(Color.parseColor("#F3F3F3"));
        closeBtn.setBackground(closeBg);
        LinearLayout.LayoutParams closeLp = new LinearLayout.LayoutParams(dpToPx(34), dpToPx(34));
        closeLp.setMarginStart(dpToPx(6));
        closeBtn.setLayoutParams(closeLp);
        closeBtn.setOnClickListener(v -> handleCardDecline());
        headerRow.addView(closeBtn);

        // 4. Fare + Hourly Est + Surge row
        LinearLayout fareRow = new LinearLayout(this);
        fareRow.setOrientation(LinearLayout.HORIZONTAL);
        fareRow.setGravity(Gravity.CENTER_VERTICAL);
        LinearLayout.LayoutParams fareRowLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        fareRowLp.topMargin = dpToPx(6);
        fareRow.setLayoutParams(fareRowLp);
        body.addView(fareRow);

        TextView fareTextView = new TextView(this);
        fareTextView.setText(String.format(Locale.UK, "£%.2f", offerFare));
        fareTextView.setTextColor(Color.parseColor("#000000"));
        fareTextView.setTextSize(TypedValue.COMPLEX_UNIT_SP, isRadar ? 34 : 32);
        fareTextView.setTypeface(Typeface.DEFAULT_BOLD);
        fareRow.addView(fareTextView);

        if (isExclusive) {
            int totalMin = Math.max(1, offerTripMin + offerPickupMin);
            long hourlyEst = Math.round((offerFare / totalMin) * 60.0);
            fareRow.addView(makePill(
                String.format(Locale.UK, "£%d/hr est.", hourlyEst),
                Color.parseColor("#E6F4EA"),
                Color.parseColor("#05944F"),
                11,
                dpToPx(8)
            ));
        }

        if (offerSurgeBonus > 0.01 && isExclusive) {
            TextView surgeTxt = new TextView(this);
            surgeTxt.setText(String.format(Locale.UK, "+£%.2f surge", offerSurgeBonus));
            surgeTxt.setTextColor(Color.parseColor("#7A1C79"));
            surgeTxt.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12);
            surgeTxt.setTypeface(Typeface.DEFAULT_BOLD);
            LinearLayout.LayoutParams sLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.WRAP_CONTENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            );
            sLp.setMarginStart(dpToPx(8));
            surgeTxt.setLayoutParams(sLp);
            fareRow.addView(surgeTxt);
        }

        // Unboxed Rating row for Trip Radar (matches screenshot)
        if (!isExclusive) {
            TextView radarRatingTxt = new TextView(this);
            String ratingLine = String.format(Locale.UK, "★  %.2f", offerRating);
            if (offerSurgeBonus > 0.01) {
                ratingLine += String.format(Locale.UK, "  · +£%.2f surge", offerSurgeBonus);
            }
            radarRatingTxt.setText(ratingLine);
            radarRatingTxt.setTextColor(Color.parseColor("#222222"));
            radarRatingTxt.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13.5f);
            radarRatingTxt.setTypeface(Typeface.DEFAULT_BOLD);
            LinearLayout.LayoutParams rrLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            );
            rrLp.topMargin = dpToPx(2);
            radarRatingTxt.setLayoutParams(rrLp);
            body.addView(radarRatingTxt);
        }

        // Extras subtitle line (PIN / Corridor / Surcharge)
        StringBuilder extras = new StringBuilder();
        if (offerIntercityCorridor != null) extras.append(offerIntercityCorridor);
        if (offerSurchargeLabel != null && offerSurchargeAmount > 0.01) {
            if (extras.length() > 0) extras.append(" · ");
            extras.append(offerSurchargeLabel)
                  .append(" £")
                  .append(String.format(Locale.UK, "%.2f", offerSurchargeAmount));
        }
        if (offerPinCode != null) {
            if (extras.length() > 0) extras.append(" · ");
            extras.append("PIN Verified");
        }
        if (extras.length() > 0 && isExclusive) {
            TextView extrasTxt = new TextView(this);
            extrasTxt.setText(extras.toString());
            extrasTxt.setTextColor(Color.parseColor("#545454"));
            extrasTxt.setTextSize(TypedValue.COMPLEX_UNIT_SP, 11.5f);
            extrasTxt.setSingleLine(true);
            extrasTxt.setEllipsize(TextUtils.TruncateAt.END);
            LinearLayout.LayoutParams exLp = new LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            );
            exLp.topMargin = dpToPx(2);
            extrasTxt.setLayoutParams(exLp);
            body.addView(extrasTxt);
        }

        // Divider
        View divider = new View(this);
        divider.setBackgroundColor(Color.parseColor("#EAEAEA"));
        LinearLayout.LayoutParams divLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            dpToPx(1)
        );
        divLp.topMargin = dpToPx(10);
        divLp.bottomMargin = dpToPx(10);
        divider.setLayoutParams(divLp);
        body.addView(divider);

        // 5. Route timeline (Pickup -> Optional Stop -> Dropoff)
        LinearLayout timeline = new LinearLayout(this);
        timeline.setOrientation(LinearLayout.VERTICAL);
        body.addView(timeline);

        timeline.addView(makeTimelineRow(
            true,
            false,
            String.format(Locale.UK, "%d mins (%.1f mi) away", offerPickupMin, offerPickupMiles),
            offerPickupAddress + ", " + offerPickupArea
        ));

        if (offerStopAddress != null) {
            timeline.addView(makeTimelineRow(
                true,
                true,
                "Stop 1 · " + offerStopAddress,
                null
            ));
        }

        timeline.addView(makeTimelineRow(
            false,
            false,
            String.format(Locale.UK, "%d mins (%.1f mi) trip", offerTripMin, offerTripMiles),
            offerDropoffAddress + ", " + offerDropoffArea
        ));

        // 6. Primary Accept / Match button (top-right X already declines)
        LinearLayout actionsRow = new LinearLayout(this);
        actionsRow.setOrientation(LinearLayout.HORIZONTAL);
        LinearLayout.LayoutParams actLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        actLp.topMargin = dpToPx(12);
        actionsRow.setLayoutParams(actLp);
        body.addView(actionsRow);

        LinearLayout acceptBtn = new LinearLayout(this);
        acceptBtn.setOrientation(LinearLayout.HORIZONTAL);
        acceptBtn.setGravity(Gravity.CENTER);
        GradientDrawable accBg = new GradientDrawable();
        accBg.setCornerRadius(dpToPx(12));
        accBg.setColor(accentColor);
        acceptBtn.setBackground(accBg);
        LinearLayout.LayoutParams accLp = new LinearLayout.LayoutParams(0, dpToPx(46), 1f);
        acceptBtn.setLayoutParams(accLp);
        acceptBtn.setOnClickListener(v -> handleCardAccept());

        cardActionBtnText = new TextView(this);
        String baseLabel = isRadar
            ? "Match"
            : (offerIsIntercity ? "Accept Intercity" : "Accept");
        cardActionBtnText.setText(baseLabel);
        cardActionBtnText.setTextColor(Color.WHITE);
        cardActionBtnText.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15.5f);
        cardActionBtnText.setTypeface(Typeface.DEFAULT_BOLD);
        acceptBtn.addView(cardActionBtnText);

        cardCountdownText = new TextView(this);
        cardCountdownText.setText(" · " + activeOfferSecLeft + "s");
        cardCountdownText.setTextColor(Color.parseColor("#D6FFFFFF"));
        cardCountdownText.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13.5f);
        cardCountdownText.setTypeface(Typeface.DEFAULT_BOLD);
        acceptBtn.addView(cardCountdownText);

        actionsRow.addView(acceptBtn);

        return outerCard;
    }

    private LinearLayout makeTimelineRow(boolean isRoundMarker, boolean isAmberStop, String title, @Nullable String subtitle) {
        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.TOP);
        LinearLayout.LayoutParams rowLp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        rowLp.bottomMargin = dpToPx(6);
        row.setLayoutParams(rowLp);

        View marker = new View(this);
        GradientDrawable markerBg = new GradientDrawable();
        markerBg.setShape(isRoundMarker ? GradientDrawable.OVAL : GradientDrawable.RECTANGLE);
        markerBg.setColor(isAmberStop ? Color.parseColor("#F59E0B") : Color.parseColor("#111111"));
        marker.setBackground(markerBg);
        LinearLayout.LayoutParams mLp = new LinearLayout.LayoutParams(dpToPx(9), dpToPx(9));
        mLp.topMargin = dpToPx(5);
        mLp.setMarginEnd(dpToPx(10));
        marker.setLayoutParams(mLp);
        row.addView(marker);

        LinearLayout textCol = new LinearLayout(this);
        textCol.setOrientation(LinearLayout.VERTICAL);
        textCol.setLayoutParams(new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));

        TextView titleView = new TextView(this);
        titleView.setText(title);
        titleView.setTextColor(isAmberStop ? Color.parseColor("#B45309") : Color.parseColor("#111111"));
        titleView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 13.5f);
        titleView.setTypeface(Typeface.DEFAULT_BOLD);
        titleView.setSingleLine(true);
        titleView.setEllipsize(TextUtils.TruncateAt.END);
        textCol.addView(titleView);

        if (subtitle != null && !subtitle.isEmpty()) {
            TextView subView = new TextView(this);
            subView.setText(subtitle);
            subView.setTextColor(Color.parseColor("#545454"));
            subView.setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f);
            subView.setSingleLine(true);
            subView.setEllipsize(TextUtils.TruncateAt.END);
            textCol.addView(subView);
        }

        row.addView(textCol);
        return row;
    }

    private TextView makePill(String text, int bgColor, int textColor, int textSizeSp, int marginStartPx) {
        TextView tv = new TextView(this);
        tv.setText(text);
        tv.setTextColor(textColor);
        tv.setTextSize(TypedValue.COMPLEX_UNIT_SP, textSizeSp);
        tv.setTypeface(Typeface.DEFAULT_BOLD);
        tv.setPadding(dpToPx(8), dpToPx(4), dpToPx(8), dpToPx(4));
        GradientDrawable bg = new GradientDrawable();
        bg.setCornerRadius(dpToPx(6));
        bg.setColor(bgColor);
        tv.setBackground(bg);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.WRAP_CONTENT,
            LinearLayout.LayoutParams.WRAP_CONTENT
        );
        if (marginStartPx > 0) {
            lp.setMarginStart(marginStartPx);
        }
        tv.setLayoutParams(lp);
        return tv;
    }

    private void renderActiveCountdownOnly() {
        if (!currentModeIsCard) {
            renderDotVisualState();
            return;
        }
        if (cardCountdownText != null) {
            cardCountdownText.setText(" · " + Math.max(0, activeOfferSecLeft) + "s");
        }
        if (cardProgressFill != null && cardProgressMaxPx > 0 && activeOfferTotalSec > 0) {
            float ratio = Math.max(0f, Math.min(1f, (float) activeOfferSecLeft / (float) activeOfferTotalSec));
            FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) cardProgressFill.getLayoutParams();
            lp.width = Math.max(dpToPx(4), Math.round(cardProgressMaxPx * ratio));
            cardProgressFill.setLayoutParams(lp);
        }
    }

    private void handleCardAccept() {
        String acceptedId = activeOfferId;
        String acceptedJson = activeOfferJson;
        if (previewStopRunnable != null) {
            mainHandler.removeCallbacks(previewStopRunnable);
        }
        previewMode = false;
        previewCardMode = false;
        cancelScheduledOffer();
        clearOfferState();
        cancelOfferNotification();

        if (isOnline && !appInForeground) {
            showDotOverlay();
        } else {
            removeOverlayView();
        }

        UberFloatingBubblePlugin.notifyBubbleAction("accept", acceptedId, acceptedJson);
        launchMainApp("accept", acceptedId, acceptedJson);
    }

    private void handleCardDecline() {
        String declinedId = activeOfferId;
        String declinedJson = activeOfferJson;
        if (previewStopRunnable != null) {
            mainHandler.removeCallbacks(previewStopRunnable);
        }
        boolean wasPreviewOnly = previewCardMode && !isOnline;
        previewCardMode = false;
        clearOfferState();
        cancelOfferNotification();

        UberFloatingBubblePlugin.notifyBubbleAction("decline", declinedId, declinedJson);

        if (wasPreviewOnly) {
            previewMode = false;
            removeOverlayView();
            stopForegroundCompat();
            stopSelf();
        } else {
            updateOverlayVisibility();
            scheduleNextFromBackgroundQueue(7500L);
        }
    }

    private void launchMainApp(String action, @Nullable String offerId, @Nullable String offerJson) {
        Intent launchIntent = new Intent(this, MainActivity.class);
        launchIntent.setFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_SINGLE_TOP |
            Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
        );
        if (action != null) launchIntent.putExtra("uber_action", action);
        if (offerId != null) launchIntent.putExtra("uber_open_offer_id", offerId);
        if (offerJson != null) launchIntent.putExtra("uber_offer_json", offerJson);
        startActivity(launchIntent);
    }

    private int dpToPx(int dp) {
        return Math.round(dp * getResources().getDisplayMetrics().density);
    }

    private int pendingIntentFlags() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            return PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        }
        return PendingIntent.FLAG_UPDATE_CURRENT;
    }

    @Override
    public void onDestroy() {
        isServiceRunning = false;
        if (instance == this) {
            instance = null;
        }
        cancelScheduledOffer();
        clearOfferState();
        removeOverlayView();
        super.onDestroy();
    }

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
