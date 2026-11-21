package com.uberdriver.uk;

import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.view.Window;

import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import com.getcapacitor.BridgeActivity;

import java.lang.ref.WeakReference;

public class MainActivity extends BridgeActivity {

    private static WeakReference<MainActivity> activityRef = new WeakReference<>(null);
    private static volatile boolean onlineImmersiveMode = false;

    public static void setOnlineImmersiveMode(boolean hideNavBar) {
        onlineImmersiveMode = hideNavBar;
        MainActivity act = activityRef.get();
        if (act != null) {
            act.runOnUiThread(act::applyImmersiveNavState);
        }
    }

    private void applyImmersiveNavState() {
        Window window = getWindow();
        if (window == null) return;
        View decorView = window.getDecorView();
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, decorView);
        if (controller == null) return;

        controller.setSystemBarsBehavior(
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        );
        if (onlineImmersiveMode) {
            controller.hide(WindowInsetsCompat.Type.navigationBars());
        } else {
            controller.show(WindowInsetsCompat.Type.navigationBars());
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        activityRef = new WeakReference<>(this);
        registerPlugin(UberFloatingBubblePlugin.class);
        super.onCreate(savedInstanceState);
        UberFloatingBubblePlugin.dispatchLaunchIntent(getIntent());
        applyImmersiveNavState();
    }

    @Override
    public void onResume() {
        super.onResume();
        activityRef = new WeakReference<>(this);
        applyImmersiveNavState();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            applyImmersiveNavState();
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        UberFloatingBubblePlugin.dispatchLaunchIntent(intent);
        applyImmersiveNavState();
    }
}
