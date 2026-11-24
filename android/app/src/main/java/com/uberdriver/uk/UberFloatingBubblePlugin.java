package com.uberdriver.uk;

import android.Manifest;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.lang.ref.WeakReference;

@CapacitorPlugin(
    name = "UberFloatingBubble",
    permissions = {
        @Permission(
            alias = "notifications",
            strings = { Manifest.permission.POST_NOTIFICATIONS }
        )
    }
)
public class UberFloatingBubblePlugin extends Plugin {

    private static WeakReference<UberFloatingBubblePlugin> instanceRef = new WeakReference<>(null);
    private static String pendingAction = null;
    private static String pendingOfferId = null;
    private static String pendingOfferJson = null;
    private static String lastActionKey = "";
    private static long lastActionAtMs = 0L;

    @Override
    public void load() {
        super.load();
        instanceRef = new WeakReference<>(this);
        UberBubbleService.updateForegroundState(true);
    }

    @Override
    protected void handleOnStart() {
        super.handleOnStart();
        UberBubbleService.updateForegroundState(true);
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        UberBubbleService.updateForegroundState(true);
        emitPermissionsSnapshot();
    }

    @Override
    protected void handleOnStop() {
        super.handleOnStop();
        UberBubbleService.updateForegroundState(false);
    }

    private JSObject buildPermissionsSnapshot() {
        Context ctx = getContext();
        boolean overlayGranted = Build.VERSION.SDK_INT < Build.VERSION_CODES.M || Settings.canDrawOverlays(ctx);

        boolean notificationsGranted = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            notificationsGranted = ContextCompat.checkSelfPermission(
                ctx,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED;
        }

        boolean batteryIgnored = true;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                batteryIgnored = pm.isIgnoringBatteryOptimizations(ctx.getPackageName());
            }
        }

        JSObject ret = new JSObject();
        ret.put("isNative", true);
        ret.put("overlayGranted", overlayGranted);
        ret.put("notificationsGranted", notificationsGranted);
        ret.put("batteryIgnored", batteryIgnored);
        ret.put("androidAutoConnected", UberCarAutoBridge.isAutoConnected());
        return ret;
    }

    public static boolean isPluginAttached() {
        return instanceRef.get() != null;
    }

    private void emitPermissionsSnapshot() {
        if (getContext() == null) return;
        notifyListeners("permissionsChanged", buildPermissionsSnapshot());
    }

    public static void notifyBubbleAction(String action, String offerId, String offerJson) {
        String safeAction = (action != null && !action.isEmpty()) ? action : "open";
        String key = safeAction + ":" + (offerId != null ? offerId : "");
        long now = System.currentTimeMillis();
        if (key.equals(lastActionKey) && (now - lastActionAtMs) < 2500L) {
            return;
        }
        lastActionKey = key;
        lastActionAtMs = now;

        pendingAction = safeAction;
        pendingOfferId = offerId;
        pendingOfferJson = offerJson;

        UberFloatingBubblePlugin plugin = instanceRef.get();
        if (plugin != null) {
            JSObject payload = new JSObject();
            payload.put("action", safeAction);
            if (offerId != null) payload.put("offerId", offerId);
            if (offerJson != null) payload.put("offerJson", offerJson);
            payload.put("tappedAt", now);
            plugin.notifyListeners("bubbleTapped", payload, true);
        }
    }

    public static void notifyBubbleTapped(String offerId, String offerJson) {
        notifyBubbleAction("open", offerId, offerJson);
    }

    public static void dispatchLaunchIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getStringExtra("uber_action");
        String offerId = intent.getStringExtra("uber_open_offer_id");
        String offerJson = intent.getStringExtra("uber_offer_json");
        if (action != null || offerId != null || offerJson != null) {
            notifyBubbleAction(action != null ? action : "open", offerId, offerJson);
        }
    }

    @PluginMethod
    public void checkPermissions(PluginCall call) {
        call.resolve(buildPermissionsSnapshot());
    }

    @PluginMethod
    public void requestOverlayPermission(PluginCall call) {
        Context ctx = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && !Settings.canDrawOverlays(ctx)) {
            Intent intent = new Intent(
                Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                Uri.parse("package:" + ctx.getPackageName())
            );
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
        }
        JSObject ret = new JSObject();
        ret.put("openedSettings", true);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (getPermissionState("notifications") != PermissionState.GRANTED) {
                requestPermissionForAlias("notifications", call, "notificationsPermsCallback");
                return;
            }
        }
        JSObject ret = new JSObject();
        ret.put("granted", true);
        call.resolve(ret);
    }

    @PermissionCallback
    private void notificationsPermsCallback(PluginCall call) {
        boolean granted = getPermissionState("notifications") == PermissionState.GRANTED;
        emitPermissionsSnapshot();
        JSObject ret = new JSObject();
        ret.put("granted", granted);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestBatteryOptimization(PluginCall call) {
        Context ctx = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
            if (pm != null && !pm.isIgnoringBatteryOptimizations(ctx.getPackageName())) {
                try {
                    Intent intent = new Intent(
                        Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                        Uri.parse("package:" + ctx.getPackageName())
                    );
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    ctx.startActivity(intent);
                } catch (Exception e) {
                    Intent fallback = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                    fallback.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    ctx.startActivity(fallback);
                }
            }
        }
        call.resolve();
    }

    @PluginMethod
    public void startOnlineService(PluginCall call) {
        String city = call.getString("city", "London");
        String alertMode = call.getString("alertMode", "dot");
        boolean autoExpand = "card".equals(alertMode);
        UberBubbleService.setAutoExpandCardDirect(autoExpand);
        UberBubbleService.setDesiredOnlineState(true, city);
        MainActivity.setOnlineImmersiveMode(true);

        Intent svc = new Intent(getContext(), UberBubbleService.class);
        svc.setAction(UberBubbleService.ACTION_START_ONLINE);
        svc.putExtra(UberBubbleService.EXTRA_CITY, city);
        svc.putExtra(UberBubbleService.EXTRA_DRIVER_NAME, call.getString("driverName", "Driver"));
        svc.putExtra(UberBubbleService.EXTRA_AUTO_EXPAND_CARD, autoExpand);
        startServiceCompat(svc);
        UberDriverWidgetProvider.setOnlineOnlyAndRefresh(getContext(), true, city);
        call.resolve();
    }

    @PluginMethod
    public void stopOnlineService(PluginCall call) {
        UberBubbleService.stopOnlineDirect();
        MainActivity.setOnlineImmersiveMode(false);
        UberDriverWidgetProvider.setOnlineOnlyAndRefresh(getContext(), false, null);
        call.resolve();
    }

    @PluginMethod
    public void updateWidgetState(PluginCall call) {
        boolean online = Boolean.TRUE.equals(call.getBoolean("online", false));
        String earningsText = call.getString("earningsText", "£0.00");
        String city = call.getString("city", "London");
        String driverName = call.getString("driverName", "Uber Driver UK");
        String questStreakText = call.getString("questStreakText", "Quest 16/20 · Streak 0/3");
        String demandText = call.getString("demandText", "Peak Rush · Clear");
        UberDriverWidgetProvider.saveAndRefresh(
            getContext(),
            online,
            earningsText,
            city,
            driverName,
            questStreakText,
            demandText
        );
        call.resolve();
    }

    @PluginMethod
    public void updateCarAutoState(PluginCall call) {
        if (call.getData() != null) {
            UberCarAutoBridge.updateFromJson(getContext(), call.getData());
        }
        call.resolve();
    }

    @PluginMethod
    public void requestPinWidget(PluginCall call) {
        boolean pinned = false;
        Context ctx = getContext();
        if (ctx != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            AppWidgetManager manager = AppWidgetManager.getInstance(ctx);
            if (manager != null && manager.isRequestPinAppWidgetSupported()) {
                ComponentName provider = new ComponentName(ctx, UberDriverWidgetProvider.class);
                pinned = manager.requestPinAppWidget(provider, null, null);
            }
        }
        JSObject ret = new JSObject();
        ret.put("supported", pinned);
        call.resolve(ret);
    }

    @PluginMethod
    public void setImmersiveNavHidden(PluginCall call) {
        boolean hidden = Boolean.TRUE.equals(call.getBoolean("hidden", false));
        MainActivity.setOnlineImmersiveMode(hidden);
        call.resolve();
    }

    @PluginMethod
    public void setAppInForeground(PluginCall call) {
        boolean inForeground = Boolean.TRUE.equals(call.getBoolean("inForeground", true));
        UberBubbleService.updateForegroundState(inForeground);
        call.resolve();
    }

    @PluginMethod
    public void setBubbleAlertMode(PluginCall call) {
        String mode = call.getString("mode", "dot");
        boolean autoExpand = "card".equals(mode);
        UberBubbleService.setAutoExpandCardDirect(autoExpand);
        call.resolve();
    }

    @PluginMethod
    public void showOfferOnBubble(PluginCall call) {
        String offerId = call.getString("offerId", "");
        String offerJson = call.getString("offerJson", "");
        String fareText = call.getString("fareText", "£15");
        String title = call.getString("title", "New Uber Trip");
        String subtitle = call.getString("subtitle", "Tap to view or accept trip");
        int expiresInSec = call.getInt("expiresInSec", 15);

        if (UberBubbleService.isServiceRunning) {
            UberBubbleService.updateOfferDirect(offerId, offerJson, fareText, title, subtitle, expiresInSec);
        } else {
            Intent svc = new Intent(getContext(), UberBubbleService.class);
            svc.setAction(UberBubbleService.ACTION_SHOW_OFFER);
            svc.putExtra(UberBubbleService.EXTRA_OFFER_ID, offerId);
            svc.putExtra(UberBubbleService.EXTRA_OFFER_JSON, offerJson);
            svc.putExtra(UberBubbleService.EXTRA_FARE_TEXT, fareText);
            svc.putExtra(UberBubbleService.EXTRA_OFFER_TITLE, title);
            svc.putExtra(UberBubbleService.EXTRA_OFFER_SUBTITLE, subtitle);
            svc.putExtra(UberBubbleService.EXTRA_EXPIRES_SEC, expiresInSec);
            startServiceCompat(svc);
        }
        call.resolve();
    }

    @PluginMethod
    public void clearOfferOnBubble(PluginCall call) {
        pendingAction = null;
        pendingOfferId = null;
        pendingOfferJson = null;
        UberBubbleService.clearOfferDirect();
        call.resolve();
    }

    @PluginMethod
    public void scheduleBackgroundOffer(PluginCall call) {
        if (UberBubbleService.isServiceRunning) {
            Integer delaySec = call.getInt("delaySec", 10);
            UberBubbleService.scheduleOfferDirect(
                delaySec.longValue() * 1000L,
                call.getString("offerId", ""),
                call.getString("offerJson", ""),
                call.getString("offersQueueJson", ""),
                call.getString("fareText", "£15"),
                call.getString("title", "New Uber Trip"),
                call.getString("subtitle", "Tap floating job card to accept"),
                call.getInt("expiresInSec", 15)
            );
        }
        call.resolve();
    }

    @PluginMethod
    public void cancelScheduledOffer(PluginCall call) {
        UberBubbleService.cancelScheduledDirect();
        call.resolve();
    }

    @PluginMethod
    public void showBubblePreview(PluginCall call) {
        Intent svc = new Intent(getContext(), UberBubbleService.class);
        svc.setAction(UberBubbleService.ACTION_PREVIEW_BUBBLE);
        startServiceCompat(svc);
        call.resolve();
    }

    @PluginMethod
    public void previewOfferCard(PluginCall call) {
        Intent svc = new Intent(getContext(), UberBubbleService.class);
        svc.setAction(UberBubbleService.ACTION_PREVIEW_OFFER_CARD);
        svc.putExtra(UberBubbleService.EXTRA_OFFER_ID, call.getString("offerId", ""));
        svc.putExtra(UberBubbleService.EXTRA_OFFER_JSON, call.getString("offerJson", ""));
        svc.putExtra(UberBubbleService.EXTRA_FARE_TEXT, call.getString("fareText", "£18"));
        svc.putExtra(UberBubbleService.EXTRA_OFFER_TITLE, call.getString("title", "New Uber Trip"));
        svc.putExtra(UberBubbleService.EXTRA_OFFER_SUBTITLE, call.getString("subtitle", "Preview job card"));
        svc.putExtra(UberBubbleService.EXTRA_EXPIRES_SEC, call.getInt("expiresInSec", 15));
        startServiceCompat(svc);
        call.resolve();
    }

    @PluginMethod
    public void consumePendingLaunchOffer(PluginCall call) {
        JSObject ret = new JSObject();
        if (pendingAction != null) ret.put("action", pendingAction);
        if (pendingOfferId != null) ret.put("offerId", pendingOfferId);
        if (pendingOfferJson != null) ret.put("offerJson", pendingOfferJson);
        pendingAction = null;
        pendingOfferId = null;
        pendingOfferJson = null;
        call.resolve(ret);
    }

    private void startServiceCompat(Intent intent) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }
        } catch (Exception ignored) {}
    }
}
