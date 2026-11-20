package com.uberdriver.uk;

import android.Manifest;
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
    private static String pendingOfferId = null;
    private static String pendingOfferJson = null;

    @Override
    public void load() {
        super.load();
        instanceRef = new WeakReference<>(this);
    }

    public static void notifyBubbleTapped(String offerId, String offerJson) {
        pendingOfferId = offerId;
        pendingOfferJson = offerJson;

        UberFloatingBubblePlugin plugin = instanceRef.get();
        if (plugin != null) {
            JSObject payload = new JSObject();
            if (offerId != null) payload.put("offerId", offerId);
            if (offerJson != null) payload.put("offerJson", offerJson);
            payload.put("tappedAt", System.currentTimeMillis());
            plugin.notifyListeners("bubbleTapped", payload, true);
        }
    }

    public static void dispatchLaunchIntent(Intent intent) {
        if (intent == null) return;
        String offerId = intent.getStringExtra("uber_open_offer_id");
        String offerJson = intent.getStringExtra("uber_offer_json");
        if (offerId != null || offerJson != null) {
            notifyBubbleTapped(offerId, offerJson);
        }
    }

    @PluginMethod
    public void checkPermissions(PluginCall call) {
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
        call.resolve(ret);
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
        Intent svc = new Intent(getContext(), UberBubbleService.class);
        svc.setAction(UberBubbleService.ACTION_START_ONLINE);
        svc.putExtra(UberBubbleService.EXTRA_CITY, call.getString("city", "London"));
        svc.putExtra(UberBubbleService.EXTRA_DRIVER_NAME, call.getString("driverName", "Driver"));
        startServiceCompat(svc);
        call.resolve();
    }

    @PluginMethod
    public void stopOnlineService(PluginCall call) {
        if (UberBubbleService.isServiceRunning) {
            Intent svc = new Intent(getContext(), UberBubbleService.class);
            svc.setAction(UberBubbleService.ACTION_STOP_ONLINE);
            safeStartService(svc);
        }
        call.resolve();
    }

    @PluginMethod
    public void setAppInForeground(PluginCall call) {
        if (UberBubbleService.isServiceRunning) {
            boolean inForeground = Boolean.TRUE.equals(call.getBoolean("inForeground", true));
            Intent svc = new Intent(getContext(), UberBubbleService.class);
            svc.setAction(UberBubbleService.ACTION_APP_FOREGROUND);
            svc.putExtra(UberBubbleService.EXTRA_IN_FOREGROUND, inForeground);
            safeStartService(svc);
        }
        call.resolve();
    }

    @PluginMethod
    public void showOfferOnBubble(PluginCall call) {
        Intent svc = new Intent(getContext(), UberBubbleService.class);
        svc.setAction(UberBubbleService.ACTION_SHOW_OFFER);
        svc.putExtra(UberBubbleService.EXTRA_OFFER_ID, call.getString("offerId", ""));
        svc.putExtra(UberBubbleService.EXTRA_OFFER_JSON, call.getString("offerJson", ""));
        svc.putExtra(UberBubbleService.EXTRA_FARE_TEXT, call.getString("fareText", "£15"));
        svc.putExtra(UberBubbleService.EXTRA_OFFER_TITLE, call.getString("title", "New Uber Trip"));
        svc.putExtra(UberBubbleService.EXTRA_OFFER_SUBTITLE, call.getString("subtitle", "Tap floating dot to accept"));
        svc.putExtra(UberBubbleService.EXTRA_EXPIRES_SEC, call.getInt("expiresInSec", 15));
        startServiceCompat(svc);
        call.resolve();
    }

    @PluginMethod
    public void clearOfferOnBubble(PluginCall call) {
        pendingOfferId = null;
        pendingOfferJson = null;
        if (UberBubbleService.isServiceRunning) {
            Intent svc = new Intent(getContext(), UberBubbleService.class);
            svc.setAction(UberBubbleService.ACTION_CLEAR_OFFER);
            safeStartService(svc);
        }
        call.resolve();
    }

    @PluginMethod
    public void scheduleBackgroundOffer(PluginCall call) {
        if (UberBubbleService.isServiceRunning) {
            Intent svc = new Intent(getContext(), UberBubbleService.class);
            svc.setAction(UberBubbleService.ACTION_SCHEDULE_OFFER);
            Integer delaySec = call.getInt("delaySec", 10);
            svc.putExtra(UberBubbleService.EXTRA_DELAY_MS, delaySec.longValue() * 1000L);
            svc.putExtra(UberBubbleService.EXTRA_OFFER_ID, call.getString("offerId", ""));
            svc.putExtra(UberBubbleService.EXTRA_OFFER_JSON, call.getString("offerJson", ""));
            svc.putExtra(UberBubbleService.EXTRA_FARE_TEXT, call.getString("fareText", "£15"));
            svc.putExtra(UberBubbleService.EXTRA_OFFER_TITLE, call.getString("title", "New Uber Trip"));
            svc.putExtra(UberBubbleService.EXTRA_OFFER_SUBTITLE, call.getString("subtitle", "Tap floating dot to accept"));
            svc.putExtra(UberBubbleService.EXTRA_EXPIRES_SEC, call.getInt("expiresInSec", 15));
            safeStartService(svc);
        }
        call.resolve();
    }

    @PluginMethod
    public void cancelScheduledOffer(PluginCall call) {
        if (UberBubbleService.isServiceRunning) {
            Intent svc = new Intent(getContext(), UberBubbleService.class);
            svc.setAction(UberBubbleService.ACTION_CANCEL_SCHEDULED);
            safeStartService(svc);
        }
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
    public void consumePendingLaunchOffer(PluginCall call) {
        JSObject ret = new JSObject();
        if (pendingOfferId != null) ret.put("offerId", pendingOfferId);
        if (pendingOfferJson != null) ret.put("offerJson", pendingOfferJson);
        pendingOfferId = null;
        pendingOfferJson = null;
        call.resolve(ret);
    }

    private void safeStartService(Intent intent) {
        try {
            getContext().startService(intent);
        } catch (Exception ignored) {
            startServiceCompat(intent);
        }
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
