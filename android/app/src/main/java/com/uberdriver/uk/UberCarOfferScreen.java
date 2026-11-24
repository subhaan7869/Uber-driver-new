package com.uberdriver.uk;

import android.os.Handler;
import android.os.Looper;

import androidx.annotation.NonNull;
import androidx.car.app.CarContext;
import androidx.car.app.Screen;
import androidx.car.app.model.Action;
import androidx.car.app.model.CarColor;
import androidx.car.app.model.Pane;
import androidx.car.app.model.PaneTemplate;
import androidx.car.app.model.Row;
import androidx.car.app.model.Template;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;

import java.util.Locale;

/**
 * Android Auto incoming Uber trip offer screen (Accept / Decline).
 */
public class UberCarOfferScreen extends Screen implements DefaultLifecycleObserver {

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final Runnable countdownTicker = new Runnable() {
        @Override
        public void run() {
            UberCarAutoBridge.CarAutoState state = UberCarAutoBridge.getState(getCarContext());
            if (!state.hasOffer || !"idle".equals(state.tripStage)) {
                popSafely();
                return;
            }
            if (state.offerExpiresAtMs > 0L && System.currentTimeMillis() >= state.offerExpiresAtMs) {
                UberCarAutoBridge.dispatchAction(getCarContext(), "decline", state.offerId, state.offerJson);
                popSafely();
                return;
            }
            invalidate();
            handler.postDelayed(this, 1000L);
        }
    };

    private boolean popped = false;

    public UberCarOfferScreen(@NonNull CarContext carContext) {
        super(carContext);
        getLifecycle().addObserver(this);
    }

    @Override
    public void onStart(@NonNull LifecycleOwner owner) {
        handler.removeCallbacks(countdownTicker);
        handler.postDelayed(countdownTicker, 1000L);
    }

    @Override
    public void onStop(@NonNull LifecycleOwner owner) {
        handler.removeCallbacks(countdownTicker);
    }

    public void popSafely() {
        if (popped) return;
        popped = true;
        handler.removeCallbacks(countdownTicker);
        try {
            getScreenManager().pop();
        } catch (Exception ignored) {}
    }

    @NonNull
    @Override
    public Template onGetTemplate() {
        UberCarAutoBridge.CarAutoState state = UberCarAutoBridge.getState(getCarContext());
        if (!state.hasOffer) {
            Pane emptyPane = new Pane.Builder()
                .addRow(new Row.Builder().setTitle("Offer ended").addText("Returning to map...").build())
                .build();
            return new PaneTemplate.Builder(emptyPane)
                .setHeaderAction(Action.BACK)
                .setTitle("Trip Request")
                .build();
        }

        long secLeft = state.offerExpiresAtMs > 0L
            ? Math.max(0L, (state.offerExpiresAtMs - System.currentTimeMillis() + 999L) / 1000L)
            : 15L;

        String offerKind = "radar".equals(state.offerType) ? "Trip Radar" : "Exclusive";
        String title = state.offerServiceName + " · " + state.offerFareText;

        Row pickupRow = new Row.Builder()
            .setTitle(String.format(Locale.UK, "Pickup · %d min (%.1f mi)", state.offerPickupMin, state.offerPickupMiles))
            .addText(state.offerPickupAddress != null && !state.offerPickupAddress.isEmpty()
                ? state.offerPickupAddress
                : state.city)
            .build();

        Row dropoffRow = new Row.Builder()
            .setTitle(String.format(Locale.UK, "Trip · %d min (%.1f mi)", state.offerTripMin, state.offerTripMiles))
            .addText(state.offerDropoffAddress != null && !state.offerDropoffAddress.isEmpty()
                ? state.offerDropoffAddress
                : state.city)
            .build();

        String metaLine = String.format(Locale.UK, "★ %s · %s · %ds left", state.offerRatingText, offerKind, secLeft);
        if (state.offerSurchargeLabel != null && !state.offerSurchargeLabel.isEmpty()) {
            metaLine += " · " + state.offerSurchargeLabel;
        }
        Row metaRow = new Row.Builder()
            .setTitle(metaLine)
            .build();

        final String offerId = state.offerId;
        final String offerJson = state.offerJson;

        Action acceptAction = new Action.Builder()
            .setTitle("Accept " + state.offerFareText)
            .setBackgroundColor(CarColor.createCustom(0xFF276EF1, 0xFF276EF1))
            .setOnClickListener(() -> {
                UberCarAutoBridge.dispatchAction(getCarContext(), "accept", offerId, offerJson);
                popSafely();
            })
            .build();

        Action declineAction = new Action.Builder()
            .setTitle("Decline")
            .setOnClickListener(() -> {
                UberCarAutoBridge.dispatchAction(getCarContext(), "decline", offerId, offerJson);
                popSafely();
            })
            .build();

        Pane pane = new Pane.Builder()
            .addRow(pickupRow)
            .addRow(dropoffRow)
            .addRow(metaRow)
            .addAction(acceptAction)
            .addAction(declineAction)
            .build();

        return new PaneTemplate.Builder(pane)
            .setHeaderAction(Action.BACK)
            .setTitle(title)
            .build();
    }
}
