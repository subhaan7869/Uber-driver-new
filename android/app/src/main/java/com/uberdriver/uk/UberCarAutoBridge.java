package com.uberdriver.uk;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.concurrent.CopyOnWriteArrayList;

/**
 * Thread-safe native bridge + persistent state store shared between the Capacitor WebView
 * (UberFloatingBubblePlugin) and Android Auto (UberCarSession / Screens / MapRenderer).
 */
public final class UberCarAutoBridge {

    private static final String PREFS_NAME = "uber_car_auto_state_v1";
    private static final String KEY_STATE_JSON = "state_json";

    public static final class CarAutoState {
        public boolean online = false;
        public String city = "London";
        public String driverName = "Uber Driver UK";
        public String earningsText = "£0.00";
        public String questStreakText = "Quest 16/20 · Streak 0/3";
        public String demandText = "Standard · Clear";
        public String tripStage = "idle";

        public double driverX = 646.0;
        public double driverY = 771.0;
        public double driverHeading = 0.0;

        // Incoming offer state
        public boolean hasOffer = false;
        public String offerId = "";
        public String offerJson = "";
        public String offerType = "exclusive";
        public String offerServiceName = "UberX";
        public String offerFareText = "£0.00";
        public String offerRatingText = "4.92";
        public int offerPickupMin = 4;
        public double offerPickupMiles = 1.1;
        public String offerPickupAddress = "";
        public int offerTripMin = 15;
        public double offerTripMiles = 4.2;
        public String offerDropoffAddress = "";
        public String offerSurchargeLabel = "";
        public long offerExpiresAtMs = 0L;

        // Active trip & turn-by-turn navigation state
        public String activeTripId = "";
        public String activeServiceName = "UberX";
        public String activeRiderName = "Rider";
        public String activeFareText = "£0.00";
        public String activePickupAddress = "";
        public String activeStopAddress = "";
        public String activeDropoffAddress = "";
        public boolean activeStopVisited = false;
        public String activePinCode = "";

        public String etaMinLabel = "";
        public String distanceRemaining = "";
        public long remainingSeconds = 0L;
        public double remainingMiles = 0.0;
        public double milesToTurn = 0.0;
        public String maneuverKind = "straight";
        public String maneuverTitle = "";
        public String maneuverSubtitle = "";
        public int speedLimitMph = 30;

        public String routePointsJson = "[]";
        public String surgePointsJson = "[]";
        public double pickupX = 0.0;
        public double pickupY = 0.0;
        public double stopX = 0.0;
        public double stopY = 0.0;
        public double dropoffX = 0.0;
        public double dropoffY = 0.0;
        public boolean hasStopCoords = false;

        public CarAutoState copy() {
            CarAutoState c = new CarAutoState();
            c.online = online;
            c.city = city;
            c.driverName = driverName;
            c.earningsText = earningsText;
            c.questStreakText = questStreakText;
            c.demandText = demandText;
            c.tripStage = tripStage;
            c.driverX = driverX;
            c.driverY = driverY;
            c.driverHeading = driverHeading;
            c.hasOffer = hasOffer;
            c.offerId = offerId;
            c.offerJson = offerJson;
            c.offerType = offerType;
            c.offerServiceName = offerServiceName;
            c.offerFareText = offerFareText;
            c.offerRatingText = offerRatingText;
            c.offerPickupMin = offerPickupMin;
            c.offerPickupMiles = offerPickupMiles;
            c.offerPickupAddress = offerPickupAddress;
            c.offerTripMin = offerTripMin;
            c.offerTripMiles = offerTripMiles;
            c.offerDropoffAddress = offerDropoffAddress;
            c.offerSurchargeLabel = offerSurchargeLabel;
            c.offerExpiresAtMs = offerExpiresAtMs;
            c.activeTripId = activeTripId;
            c.activeServiceName = activeServiceName;
            c.activeRiderName = activeRiderName;
            c.activeFareText = activeFareText;
            c.activePickupAddress = activePickupAddress;
            c.activeStopAddress = activeStopAddress;
            c.activeDropoffAddress = activeDropoffAddress;
            c.activeStopVisited = activeStopVisited;
            c.activePinCode = activePinCode;
            c.etaMinLabel = etaMinLabel;
            c.distanceRemaining = distanceRemaining;
            c.remainingSeconds = remainingSeconds;
            c.remainingMiles = remainingMiles;
            c.milesToTurn = milesToTurn;
            c.maneuverKind = maneuverKind;
            c.maneuverTitle = maneuverTitle;
            c.maneuverSubtitle = maneuverSubtitle;
            c.speedLimitMph = speedLimitMph;
            c.routePointsJson = routePointsJson;
            c.surgePointsJson = surgePointsJson;
            c.pickupX = pickupX;
            c.pickupY = pickupY;
            c.stopX = stopX;
            c.stopY = stopY;
            c.dropoffX = dropoffX;
            c.dropoffY = dropoffY;
            c.hasStopCoords = hasStopCoords;
            return c;
        }
    }

    public interface StateListener {
        void onCarAutoStateChanged(CarAutoState state);
    }

    private static final Handler MAIN_HANDLER = new Handler(Looper.getMainLooper());
    private static final CopyOnWriteArrayList<StateListener> LISTENERS = new CopyOnWriteArrayList<>();
    private static final Object LOCK = new Object();

    private static CarAutoState currentState = new CarAutoState();
    private static volatile boolean loadedFromPrefs = false;
    private static volatile boolean autoConnected = false;

    private UberCarAutoBridge() {}

    public static void setAutoConnected(boolean connected) {
        autoConnected = connected;
    }

    public static boolean isAutoConnected() {
        return autoConnected;
    }

    public static void addListener(StateListener listener) {
        if (listener != null) {
            LISTENERS.addIfAbsent(listener);
        }
    }

    public static void removeListener(StateListener listener) {
        if (listener != null) {
            LISTENERS.remove(listener);
        }
    }

    public static CarAutoState getState(Context context) {
        synchronized (LOCK) {
            if (!loadedFromPrefs && context != null) {
                loadedFromPrefs = true;
                try {
                    SharedPreferences prefs = context.getApplicationContext()
                        .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                    String raw = prefs.getString(KEY_STATE_JSON, null);
                    if (raw != null && !raw.isEmpty()) {
                        applyJsonLocked(new JSONObject(raw));
                    }
                } catch (Exception ignored) {}
            }
            return currentState.copy();
        }
    }

    public static void updateFromJson(Context context, JSONObject obj) {
        if (obj == null) return;
        CarAutoState snapshot;
        synchronized (LOCK) {
            loadedFromPrefs = true;
            applyJsonLocked(obj);
            snapshot = currentState.copy();
        }
        if (context != null) {
            try {
                SharedPreferences prefs = context.getApplicationContext()
                    .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                prefs.edit().putString(KEY_STATE_JSON, obj.toString()).apply();
            } catch (Exception ignored) {}
        }
        notifyListeners(snapshot);
    }

    public static void dispatchAction(Context context, String action, String offerId, String offerJson) {
        if (action == null || action.isEmpty()) return;

        // Instant optimistic feedback on Android Auto while WebView processes the event
        if ("accept".equals(action) || "decline".equals(action)) {
            CarAutoState snapshot = null;
            synchronized (LOCK) {
                if (currentState.hasOffer) {
                    currentState.hasOffer = false;
                    currentState.offerId = "";
                    currentState.offerExpiresAtMs = 0L;
                    snapshot = currentState.copy();
                }
            }
            UberBubbleService.clearOfferDirect();
            if (snapshot != null) {
                notifyListeners(snapshot);
            }
        }

        UberFloatingBubblePlugin.notifyBubbleAction(action, offerId, offerJson);

        // If MainActivity hasn't loaded the WebView yet (cold Android Auto boot), bring it up silently if needed
        if (!UberFloatingBubblePlugin.isPluginAttached() && context != null) {
            try {
                Intent launch = new Intent(context.getApplicationContext(), MainActivity.class);
                launch.addFlags(
                    Intent.FLAG_ACTIVITY_NEW_TASK
                        | Intent.FLAG_ACTIVITY_SINGLE_TOP
                        | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
                );
                launch.putExtra("uber_action", action);
                if (offerId != null) launch.putExtra("uber_open_offer_id", offerId);
                if (offerJson != null) launch.putExtra("uber_offer_json", offerJson);
                context.getApplicationContext().startActivity(launch);
            } catch (Exception ignored) {}
        }
    }

    private static void notifyListeners(CarAutoState snapshot) {
        MAIN_HANDLER.post(() -> {
            for (StateListener listener : LISTENERS) {
                try {
                    listener.onCarAutoStateChanged(snapshot);
                } catch (Exception ignored) {}
            }
        });
    }

    private static void applyJsonLocked(JSONObject obj) {
        currentState.online = obj.optBoolean("online", currentState.online);
        currentState.city = obj.optString("city", currentState.city);
        currentState.driverName = obj.optString("driverName", currentState.driverName);
        currentState.earningsText = obj.optString("earningsText", currentState.earningsText);
        currentState.questStreakText = obj.optString("questStreakText", currentState.questStreakText);
        currentState.demandText = obj.optString("demandText", currentState.demandText);
        currentState.tripStage = obj.optString("tripStage", "idle");

        currentState.driverX = obj.optDouble("driverX", currentState.driverX);
        currentState.driverY = obj.optDouble("driverY", currentState.driverY);
        currentState.driverHeading = obj.optDouble("driverHeading", currentState.driverHeading);

        currentState.hasOffer = obj.optBoolean("hasOffer", false);
        currentState.offerId = obj.optString("offerId", "");
        currentState.offerJson = obj.optString("offerJson", "");
        currentState.offerType = obj.optString("offerType", "exclusive");
        currentState.offerServiceName = obj.optString("offerServiceName", "UberX");
        currentState.offerFareText = obj.optString("offerFareText", "£0.00");
        currentState.offerRatingText = obj.optString("offerRatingText", "4.92");
        currentState.offerPickupMin = obj.optInt("offerPickupMin", 4);
        currentState.offerPickupMiles = obj.optDouble("offerPickupMiles", 1.1);
        currentState.offerPickupAddress = obj.optString("offerPickupAddress", "");
        currentState.offerTripMin = obj.optInt("offerTripMin", 15);
        currentState.offerTripMiles = obj.optDouble("offerTripMiles", 4.2);
        currentState.offerDropoffAddress = obj.optString("offerDropoffAddress", "");
        currentState.offerSurchargeLabel = obj.optString("offerSurchargeLabel", "");
        currentState.offerExpiresAtMs = obj.optLong("offerExpiresAtMs", 0L);

        currentState.activeTripId = obj.optString("activeTripId", "");
        currentState.activeServiceName = obj.optString("activeServiceName", "UberX");
        currentState.activeRiderName = obj.optString("activeRiderName", "Rider");
        currentState.activeFareText = obj.optString("activeFareText", "£0.00");
        currentState.activePickupAddress = obj.optString("activePickupAddress", "");
        currentState.activeStopAddress = obj.optString("activeStopAddress", "");
        currentState.activeDropoffAddress = obj.optString("activeDropoffAddress", "");
        currentState.activeStopVisited = obj.optBoolean("activeStopVisited", false);
        currentState.activePinCode = obj.optString("activePinCode", "");

        currentState.etaMinLabel = obj.optString("etaMinLabel", "");
        currentState.distanceRemaining = obj.optString("distanceRemaining", "");
        currentState.remainingSeconds = obj.optLong("remainingSeconds", 0L);
        currentState.remainingMiles = obj.optDouble("remainingMiles", 0.0);
        currentState.milesToTurn = obj.optDouble("milesToTurn", 0.0);
        currentState.maneuverKind = obj.optString("maneuverKind", "straight");
        currentState.maneuverTitle = obj.optString("maneuverTitle", "");
        currentState.maneuverSubtitle = obj.optString("maneuverSubtitle", "");
        currentState.speedLimitMph = obj.optInt("speedLimitMph", 30);

        JSONArray routeArr = obj.optJSONArray("routePoints");
        currentState.routePointsJson = routeArr != null ? routeArr.toString() : obj.optString("routePointsJson", "[]");
        JSONArray surgeArr = obj.optJSONArray("surgePoints");
        currentState.surgePointsJson = surgeArr != null ? surgeArr.toString() : obj.optString("surgePointsJson", "[]");

        currentState.pickupX = obj.optDouble("pickupX", 0.0);
        currentState.pickupY = obj.optDouble("pickupY", 0.0);
        currentState.stopX = obj.optDouble("stopX", 0.0);
        currentState.stopY = obj.optDouble("stopY", 0.0);
        currentState.dropoffX = obj.optDouble("dropoffX", 0.0);
        currentState.dropoffY = obj.optDouble("dropoffY", 0.0);
        currentState.hasStopCoords = obj.optBoolean("hasStopCoords", false);
    }
}
