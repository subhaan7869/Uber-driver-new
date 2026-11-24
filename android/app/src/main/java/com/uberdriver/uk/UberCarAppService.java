package com.uberdriver.uk;

import android.content.pm.ApplicationInfo;

import androidx.annotation.NonNull;
import androidx.car.app.CarAppService;
import androidx.car.app.Session;
import androidx.car.app.validation.HostValidator;

/**
 * Android Auto CarAppService entry point for Uber Driver UK.
 */
public class UberCarAppService extends CarAppService {

    @NonNull
    @Override
    public HostValidator createHostValidator() {
        // Allow Android Auto head units & Desktop Head Unit (DHU) for sideloaded debug/release APKs
        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            return HostValidator.ALLOW_ALL_HOSTS_VALIDATOR;
        }
        return HostValidator.ALLOW_ALL_HOSTS_VALIDATOR;
    }

    @NonNull
    @Override
    public Session onCreateSession() {
        return new UberCarSession();
    }
}
