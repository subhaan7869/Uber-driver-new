package com.uberdriver.uk;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.car.app.AppManager;
import androidx.car.app.CarContext;
import androidx.car.app.Screen;
import androidx.car.app.model.Action;
import androidx.car.app.model.ActionStrip;
import androidx.car.app.model.CarIcon;
import androidx.car.app.model.DateTimeWithZone;
import androidx.car.app.model.Distance;
import androidx.car.app.model.Template;
import androidx.car.app.navigation.NavigationManager;
import androidx.car.app.navigation.NavigationManagerCallback;
import androidx.car.app.navigation.model.Destination;
import androidx.car.app.navigation.model.Maneuver;
import androidx.car.app.navigation.model.MessageInfo;
import androidx.car.app.navigation.model.NavigationTemplate;
import androidx.car.app.navigation.model.RoutingInfo;
import androidx.car.app.navigation.model.Step;
import androidx.car.app.navigation.model.TravelEstimate;
import androidx.car.app.navigation.model.Trip;
import androidx.core.graphics.drawable.IconCompat;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;

import java.util.TimeZone;

/**
 * Primary Android Auto NavigationTemplate screen synced live with Uber Driver UK.
 */
public class UberCarMainScreen extends Screen implements DefaultLifecycleObserver {

    private final UberCarMapRenderer mapRenderer = new UberCarMapRenderer();
    private NavigationManager navigationManager;
    private boolean navigationActive = false;

    public UberCarMainScreen(@NonNull CarContext carContext) {
        super(carContext);
        getLifecycle().addObserver(this);
        carContext.getCarService(AppManager.class).setSurfaceCallback(mapRenderer);
        navigationManager = carContext.getCarService(NavigationManager.class);
        navigationManager.setNavigationManagerCallback(new NavigationManagerCallback() {
            @Override
            public void onStopNavigation() {
                navigationActive = false;
            }

            @Override
            public void onAutoDriveEnabled() {
                // App drives route telemetry directly from UK GPS / route simulator
            }
        });
    }

    @Override
    public void onResume(@NonNull LifecycleOwner owner) {
        UberCarAutoBridge.CarAutoState state = UberCarAutoBridge.getState(getCarContext());
        mapRenderer.updateState(state);
    }

    public void onBridgeStateUpdated(UberCarAutoBridge.CarAutoState state) {
        mapRenderer.updateState(state);
        invalidate();
    }

    @Nullable
    public static String resolvePrimaryTripButtonTitle(UberCarAutoBridge.CarAutoState state) {
        if (state == null || state.tripStage == null) return null;
        switch (state.tripStage) {
            case "pickup":
                return "Arrived";
            case "waiting":
                return "Start Trip";
            case "enroute":
                return (state.hasStopCoords && !state.activeStopVisited) ? "At Stop" : "Dropoff";
            case "stop_wait":
                return "Continue";
            case "dropoff_arrived":
                return "Complete";
            default:
                return null;
        }
    }

    @Nullable
    public static String resolvePrimaryTripAction(UberCarAutoBridge.CarAutoState state) {
        if (state == null || state.tripStage == null) return null;
        switch (state.tripStage) {
            case "pickup":
                return "trip_arrive_pickup";
            case "waiting":
                return "trip_start";
            case "enroute":
                return (state.hasStopCoords && !state.activeStopVisited)
                    ? "trip_arrive_stop"
                    : "trip_arrive_dropoff";
            case "stop_wait":
                return "trip_continue_stop";
            case "dropoff_arrived":
                return "trip_complete";
            default:
                return null;
        }
    }

    @NonNull
    @Override
    public Template onGetTemplate() {
        UberCarAutoBridge.CarAutoState state = UberCarAutoBridge.getState(getCarContext());
        mapRenderer.updateState(state);

        boolean isActiveTrip = state.tripStage != null
            && !"idle".equals(state.tripStage)
            && !"completed".equals(state.tripStage);

        // 1. Top-right ActionStrip (max 2 text buttons)
        ActionStrip.Builder actionStripBuilder = new ActionStrip.Builder();
        if (isActiveTrip) {
            String primaryLabel = resolvePrimaryTripButtonTitle(state);
            String primaryAction = resolvePrimaryTripAction(state);
            if (primaryLabel != null && primaryAction != null) {
                actionStripBuilder.addAction(
                    new Action.Builder()
                        .setTitle(primaryLabel)
                        .setOnClickListener(() ->
                            UberCarAutoBridge.dispatchAction(getCarContext(), primaryAction, null, null)
                        )
                        .build()
                );
            }
            actionStripBuilder.addAction(
                new Action.Builder()
                    .setTitle("Trip Info")
                    .setOnClickListener(() ->
                        getScreenManager().push(new UberCarTripDetailScreen(getCarContext()))
                    )
                    .build()
            );
        } else {
            actionStripBuilder.addAction(
                new Action.Builder()
                    .setTitle(state.online ? "Go Offline" : "Go Online")
                    .setOnClickListener(() ->
                        UberCarAutoBridge.dispatchAction(getCarContext(), "toggle_online", null, null)
                    )
                    .build()
            );
            String earningsLabel = (state.earningsText != null && !state.earningsText.isEmpty())
                ? state.earningsText
                : "£0.00";
            actionStripBuilder.addAction(
                new Action.Builder()
                    .setTitle(earningsLabel)
                    .setOnClickListener(() ->
                        getScreenManager().push(new UberCarStatusScreen(getCarContext()))
                    )
                    .build()
            );
        }

        // 2. Map ActionStrip (Pan + Recenter)
        CarIcon recenterIcon = new CarIcon.Builder(
            IconCompat.createWithResource(getCarContext(), R.drawable.ic_aa_recenter)
        ).build();

        ActionStrip mapActionStrip = new ActionStrip.Builder()
            .addAction(Action.PAN)
            .addAction(
                new Action.Builder()
                    .setIcon(recenterIcon)
                    .setOnClickListener(mapRenderer::recenter)
                    .build()
            )
            .build();

        NavigationTemplate.Builder templateBuilder = new NavigationTemplate.Builder()
            .setActionStrip(actionStripBuilder.build())
            .setMapActionStrip(mapActionStrip)
            .setPanModeListener(mapRenderer::setPanMode);

        // 3. NavigationInfo (Turn-by-turn RoutingInfo during trip OR MessageInfo when idle)
        if (isActiveTrip) {
            syncNavigationManager(true, state);

            Step currentStep = buildCurrentStep(state);
            Distance stepDistance = toCarDistance(state.milesToTurn);

            RoutingInfo routingInfo = new RoutingInfo.Builder()
                .setCurrentStep(currentStep, stepDistance)
                .setLoading(false)
                .build();

            TravelEstimate destEstimate = buildDestinationEstimate(state);

            templateBuilder.setNavigationInfo(routingInfo);
            templateBuilder.setDestinationTravelEstimate(destEstimate);
        } else {
            syncNavigationManager(false, state);

            CarIcon carIcon = new CarIcon.Builder(
                IconCompat.createWithResource(getCarContext(), R.drawable.ic_aa_car)
            ).build();

            String msgTitle = state.online
                ? ("Finding UK trips · " + state.city)
                : ("Uber Driver UK · Offline");
            String msgBody = state.online
                ? (state.demandText + " · " + state.questStreakText)
                : (state.city + " · Tap Go Online to start driving");

            MessageInfo messageInfo = new MessageInfo.Builder(msgTitle)
                .setText(msgBody)
                .setImage(carIcon)
                .build();

            templateBuilder.setNavigationInfo(messageInfo);
        }

        return templateBuilder.build();
    }

    private Step buildCurrentStep(UberCarAutoBridge.CarAutoState state) {
        int maneuverType = mapManeuverType(state.maneuverKind, state.tripStage);
        int iconRes = mapManeuverIconRes(state.maneuverKind, state.tripStage);
        CarIcon maneuverIcon = new CarIcon.Builder(
            IconCompat.createWithResource(getCarContext(), iconRes)
        ).build();

        Maneuver.Builder maneuverBuilder = new Maneuver.Builder(maneuverType)
            .setIcon(maneuverIcon);
        if (maneuverType == Maneuver.TYPE_ROUNDABOUT_ENTER_AND_EXIT_CW) {
            maneuverBuilder.setRoundaboutExitNumber(1);
        }
        Maneuver maneuver = maneuverBuilder.build();

        String title = (state.maneuverTitle != null && !state.maneuverTitle.isEmpty())
            ? state.maneuverTitle
            : ("pickup".equals(state.tripStage)
                ? ("Pickup · " + state.activeRiderName)
                : ("Dropoff · " + state.activeDropoffAddress));

        return new Step.Builder(title)
            .setManeuver(maneuver)
            .build();
    }

    private TravelEstimate buildDestinationEstimate(UberCarAutoBridge.CarAutoState state) {
        long remSec = Math.max(30L, state.remainingSeconds);
        long etaMs = System.currentTimeMillis() + (remSec * 1000L);
        DateTimeWithZone eta = DateTimeWithZone.create(etaMs, TimeZone.getDefault());
        Distance dist = toCarDistance(state.remainingMiles);
        return new TravelEstimate.Builder(dist, eta)
            .setRemainingTimeSeconds(remSec)
            .build();
    }

    private Distance toCarDistance(double miles) {
        double safeMiles = Math.max(0.0, miles);
        if (safeMiles >= 0.2) {
            return Distance.create(Math.round(safeMiles * 10.0) / 10.0, Distance.UNIT_MILES_P1);
        }
        double yards = Math.max(20.0, Math.round((safeMiles * 1760.0) / 10.0) * 10.0);
        return Distance.create(yards, Distance.UNIT_YARDS);
    }

    private void syncNavigationManager(boolean active, UberCarAutoBridge.CarAutoState state) {
        if (navigationManager == null) return;
        try {
            if (active) {
                if (!navigationActive) {
                    navigationManager.navigationStarted();
                    navigationActive = true;
                }
                String destName = "pickup".equals(state.tripStage) || "waiting".equals(state.tripStage)
                    ? ("Pickup " + state.activeRiderName)
                    : ((state.hasStopCoords && !state.activeStopVisited) ? "Stop 1" : "Dropoff");
                String destAddress = "pickup".equals(state.tripStage) || "waiting".equals(state.tripStage)
                    ? state.activePickupAddress
                    : ((state.hasStopCoords && !state.activeStopVisited)
                        ? state.activeStopAddress
                        : state.activeDropoffAddress);
                if (destAddress == null || destAddress.isEmpty()) destAddress = state.city;

                Destination dest = new Destination.Builder()
                    .setName(destName)
                    .setAddress(destAddress)
                    .build();
                TravelEstimate destEst = buildDestinationEstimate(state);
                Step step = buildCurrentStep(state);
                TravelEstimate stepEst = new TravelEstimate.Builder(
                    toCarDistance(state.milesToTurn),
                    DateTimeWithZone.create(System.currentTimeMillis() + 60_000L, TimeZone.getDefault())
                ).setRemainingTimeSeconds(60L).build();

                Trip trip = new Trip.Builder()
                    .addDestination(dest, destEst)
                    .addStep(step, stepEst)
                    .setCurrentRoad(state.city)
                    .build();
                navigationManager.updateTrip(trip);
            } else if (navigationActive) {
                navigationManager.navigationEnded();
                navigationActive = false;
            }
        } catch (Exception ignored) {}
    }

    private static int mapManeuverType(String kind, String stage) {
        if ("waiting".equals(stage) || "stop_wait".equals(stage) || "dropoff_arrived".equals(stage) || "arrive".equals(kind)) {
            return Maneuver.TYPE_DESTINATION;
        }
        if ("turn-left".equals(kind)) return Maneuver.TYPE_TURN_NORMAL_LEFT;
        if ("turn-right".equals(kind)) return Maneuver.TYPE_TURN_NORMAL_RIGHT;
        if ("roundabout".equals(kind)) return Maneuver.TYPE_ROUNDABOUT_ENTER_AND_EXIT_CW;
        if ("merge".equals(kind)) return Maneuver.TYPE_MERGE_SIDE_UNSPECIFIED;
        return Maneuver.TYPE_STRAIGHT;
    }

    private static int mapManeuverIconRes(String kind, String stage) {
        if ("waiting".equals(stage) || "stop_wait".equals(stage) || "dropoff_arrived".equals(stage) || "arrive".equals(kind)) {
            return R.drawable.ic_aa_arrive;
        }
        if ("turn-left".equals(kind)) return R.drawable.ic_aa_turn_left;
        if ("turn-right".equals(kind)) return R.drawable.ic_aa_turn_right;
        if ("roundabout".equals(kind)) return R.drawable.ic_aa_roundabout;
        return R.drawable.ic_aa_arrow_straight;
    }
}
