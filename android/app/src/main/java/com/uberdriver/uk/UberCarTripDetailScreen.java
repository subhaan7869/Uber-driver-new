package com.uberdriver.uk;

import androidx.annotation.NonNull;
import androidx.car.app.CarContext;
import androidx.car.app.Screen;
import androidx.car.app.model.Action;
import androidx.car.app.model.CarColor;
import androidx.car.app.model.Pane;
import androidx.car.app.model.PaneTemplate;
import androidx.car.app.model.Row;
import androidx.car.app.model.Template;

/**
 * Android Auto active trip details screen (Rider, Pickup/Dropoff, PIN, Next Stage Action).
 */
public class UberCarTripDetailScreen extends Screen {

    public UberCarTripDetailScreen(@NonNull CarContext carContext) {
        super(carContext);
    }

    @NonNull
    @Override
    public Template onGetTemplate() {
        UberCarAutoBridge.CarAutoState state = UberCarAutoBridge.getState(getCarContext());

        String riderTitle = state.activeServiceName + " · " + state.activeRiderName + " (" + state.activeFareText + ")";
        String pinText = (state.activePinCode != null && !state.activePinCode.isEmpty())
            ? "Rider PIN: " + state.activePinCode
            : "Standard pickup";

        Row riderRow = new Row.Builder()
            .setTitle(riderTitle)
            .addText(pinText)
            .build();

        Row pickupRow = new Row.Builder()
            .setTitle("Pickup")
            .addText(state.activePickupAddress != null && !state.activePickupAddress.isEmpty()
                ? state.activePickupAddress
                : state.city)
            .build();

        Row dropoffRow = new Row.Builder()
            .setTitle(state.hasStopCoords && !state.activeStopVisited ? "Stop 1 → Dropoff" : "Dropoff")
            .addText(state.hasStopCoords && !state.activeStopVisited && state.activeStopAddress != null && !state.activeStopAddress.isEmpty()
                ? state.activeStopAddress + " → " + state.activeDropoffAddress
                : (state.activeDropoffAddress != null && !state.activeDropoffAddress.isEmpty()
                    ? state.activeDropoffAddress
                    : state.city))
            .build();

        String stageBtnTitle = UberCarMainScreen.resolvePrimaryTripButtonTitle(state);
        String stageAction = UberCarMainScreen.resolvePrimaryTripAction(state);

        Pane.Builder paneBuilder = new Pane.Builder()
            .addRow(riderRow)
            .addRow(pickupRow)
            .addRow(dropoffRow);

        if (stageBtnTitle != null && stageAction != null) {
            paneBuilder.addAction(
                new Action.Builder()
                    .setTitle(stageBtnTitle)
                    .setBackgroundColor(CarColor.createCustom(0xFF05944F, 0xFF05944F))
                    .setOnClickListener(() -> {
                        UberCarAutoBridge.dispatchAction(getCarContext(), stageAction, null, null);
                        getScreenManager().pop();
                    })
                    .build()
            );
        }

        paneBuilder.addAction(
            new Action.Builder()
                .setTitle("Back to Nav")
                .setOnClickListener(() -> getScreenManager().pop())
                .build()
        );

        return new PaneTemplate.Builder(paneBuilder.build())
            .setHeaderAction(Action.BACK)
            .setTitle("Active Trip Details")
            .build();
    }
}
