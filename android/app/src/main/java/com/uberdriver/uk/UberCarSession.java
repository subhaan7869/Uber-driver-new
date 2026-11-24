package com.uberdriver.uk;

import android.content.Intent;

import androidx.annotation.NonNull;
import androidx.car.app.Screen;
import androidx.car.app.ScreenManager;
import androidx.car.app.Session;
import androidx.lifecycle.DefaultLifecycleObserver;
import androidx.lifecycle.LifecycleOwner;

/**
 * Android Auto Session bridging live Uber Driver UK state updates and offer alerts to the car display.
 */
public class UberCarSession extends Session implements DefaultLifecycleObserver, UberCarAutoBridge.StateListener {

    private UberCarMainScreen mainScreen;
    private String lastPresentedOfferId = "";

    public UberCarSession() {
        getLifecycle().addObserver(this);
    }

    @NonNull
    @Override
    public Screen onCreateScreen(@NonNull Intent intent) {
        mainScreen = new UberCarMainScreen(getCarContext());
        return mainScreen;
    }

    @Override
    public void onCreate(@NonNull LifecycleOwner owner) {
        UberCarAutoBridge.setAutoConnected(true);
        UberCarAutoBridge.addListener(this);
    }

    @Override
    public void onDestroy(@NonNull LifecycleOwner owner) {
        UberCarAutoBridge.removeListener(this);
        UberCarAutoBridge.setAutoConnected(false);
    }

    @Override
    public void onCarAutoStateChanged(UberCarAutoBridge.CarAutoState state) {
        if (mainScreen != null) {
            mainScreen.onBridgeStateUpdated(state);
        }

        ScreenManager sm = getCarContext().getCarService(ScreenManager.class);
        Screen top = sm.getTop();

        boolean shouldShowOffer = state.hasOffer && "idle".equals(state.tripStage) && state.offerId != null && !state.offerId.isEmpty();
        if (shouldShowOffer) {
            if (!(top instanceof UberCarOfferScreen) && !state.offerId.equals(lastPresentedOfferId)) {
                lastPresentedOfferId = state.offerId;
                sm.push(new UberCarOfferScreen(getCarContext()));
            } else if (top instanceof UberCarOfferScreen) {
                top.invalidate();
            }
        } else {
            lastPresentedOfferId = "";
            if (top instanceof UberCarOfferScreen) {
                ((UberCarOfferScreen) top).popSafely();
            } else if (top != mainScreen) {
                top.invalidate();
            }
        }
    }
}
