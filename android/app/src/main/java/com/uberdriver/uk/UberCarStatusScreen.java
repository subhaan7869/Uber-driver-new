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
 * Android Auto driver summary screen (Today's Earnings, Quest/Streak, UK Demand, Go Online toggle).
 */
public class UberCarStatusScreen extends Screen {

    public UberCarStatusScreen(@NonNull CarContext carContext) {
        super(carContext);
    }

    @NonNull
    @Override
    public Template onGetTemplate() {
        UberCarAutoBridge.CarAutoState state = UberCarAutoBridge.getState(getCarContext());

        Row earningsRow = new Row.Builder()
            .setTitle("Today's Earnings · " + state.earningsText)
            .addText(state.online ? "Online · Finding UK trips in " + state.city : "Offline · " + state.city)
            .build();

        Row questRow = new Row.Builder()
            .setTitle(state.questStreakText)
            .addText(state.demandText)
            .build();

        Row driverRow = new Row.Builder()
            .setTitle(state.driverName)
            .addText("Uber Driver UK · Android Auto")
            .build();

        Action toggleAction = new Action.Builder()
            .setTitle(state.online ? "Go Offline" : "Go Online")
            .setBackgroundColor(state.online
                ? CarColor.createCustom(0xFFDC2626, 0xFFDC2626)
                : CarColor.createCustom(0xFF276EF1, 0xFF276EF1))
            .setOnClickListener(() -> {
                UberCarAutoBridge.dispatchAction(getCarContext(), "toggle_online", null, null);
                getScreenManager().pop();
            })
            .build();

        Action backAction = new Action.Builder()
            .setTitle("Back to Map")
            .setOnClickListener(() -> getScreenManager().pop())
            .build();

        Pane pane = new Pane.Builder()
            .addRow(earningsRow)
            .addRow(questRow)
            .addRow(driverRow)
            .addAction(toggleAction)
            .addAction(backAction)
            .build();

        return new PaneTemplate.Builder(pane)
            .setHeaderAction(Action.BACK)
            .setTitle("Driver Status & Earnings")
            .build();
    }
}
