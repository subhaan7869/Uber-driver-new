package com.uberdriver.uk;

import android.content.Intent;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(UberFloatingBubblePlugin.class);
        super.onCreate(savedInstanceState);
        UberFloatingBubblePlugin.dispatchLaunchIntent(getIntent());
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        UberFloatingBubblePlugin.dispatchLaunchIntent(intent);
    }
}
