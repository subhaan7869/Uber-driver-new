package com.uberdriver.uk;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.widget.RemoteViews;

public class UberDriverWidgetProvider extends AppWidgetProvider {

    private static final String PREFS_NAME = "uber_driver_widget_prefs";
    private static final String KEY_ONLINE = "online";
    private static final String KEY_EARNINGS = "earnings";
    private static final String KEY_CITY = "city";
    private static final String KEY_DRIVER_NAME = "driver_name";
    private static final String KEY_QUEST_STREAK = "quest_streak";
    private static final String KEY_DEMAND = "demand";

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        for (int appWidgetId : appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId);
        }
    }

    public static void saveAndRefresh(
        Context context,
        boolean online,
        String earningsText,
        String city,
        String driverName,
        String questStreakText,
        String demandText
    ) {
        if (context == null) return;
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        editor.putBoolean(KEY_ONLINE, online);
        if (earningsText != null) editor.putString(KEY_EARNINGS, earningsText);
        if (city != null) editor.putString(KEY_CITY, city);
        if (driverName != null) editor.putString(KEY_DRIVER_NAME, driverName);
        if (questStreakText != null) editor.putString(KEY_QUEST_STREAK, questStreakText);
        if (demandText != null) editor.putString(KEY_DEMAND, demandText);
        editor.apply();
        refreshAll(context);
    }

    public static void setOnlineOnlyAndRefresh(Context context, boolean online, String city) {
        if (context == null) return;
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        editor.putBoolean(KEY_ONLINE, online);
        if (city != null && !city.isEmpty()) {
            editor.putString(KEY_CITY, city);
        }
        editor.apply();
        refreshAll(context);
    }

    public static void refreshAll(Context context) {
        if (context == null) return;
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        if (manager == null) return;
        ComponentName provider = new ComponentName(context, UberDriverWidgetProvider.class);
        int[] ids = manager.getAppWidgetIds(provider);
        if (ids == null || ids.length == 0) return;
        for (int appWidgetId : ids) {
            updateAppWidget(context, manager, appWidgetId);
        }
    }

    private static PendingIntent buildActionPendingIntent(Context context, String action, int requestCode) {
        Intent intent = new Intent(context, MainActivity.class);
        intent.setFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK
                | Intent.FLAG_ACTIVITY_SINGLE_TOP
                | Intent.FLAG_ACTIVITY_CLEAR_TOP
        );
        intent.putExtra("uber_action", action);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(context, requestCode, intent, flags);
    }

    private static void updateAppWidget(
        Context context,
        AppWidgetManager appWidgetManager,
        int appWidgetId
    ) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        boolean isOnline = prefs.getBoolean(KEY_ONLINE, false);
        String earnings = prefs.getString(KEY_EARNINGS, "£0.00");
        String city = prefs.getString(KEY_CITY, "London");
        String driverName = prefs.getString(KEY_DRIVER_NAME, "Uber Driver UK");
        String questStreak = prefs.getString(KEY_QUEST_STREAK, "Quest 16/20 · Streak 0/3");
        String demand = prefs.getString(KEY_DEMAND, "Peak Rush · Clear");

        RemoteViews views = new RemoteViews(context.getPackageName(), R.layout.uber_driver_widget);
        views.setTextViewText(R.id.widget_title, driverName);
        views.setTextViewText(
            R.id.widget_subtitle,
            isOnline ? city + " · Finding UK trips" : city + " · Ready to drive"
        );
        views.setTextViewText(R.id.widget_earnings, earnings);
        views.setTextViewText(R.id.widget_demand, demand);
        views.setTextViewText(R.id.widget_quest_streak, questStreak);

        if (isOnline) {
            views.setTextViewText(R.id.widget_status_pill, "ONLINE");
            views.setInt(R.id.widget_status_pill, "setBackgroundResource", R.drawable.widget_pill_online);
            views.setTextViewText(R.id.widget_btn_go_online, "Go Offline");
            views.setInt(R.id.widget_btn_go_online, "setBackgroundResource", R.drawable.widget_btn_secondary);
        } else {
            views.setTextViewText(R.id.widget_status_pill, "OFFLINE");
            views.setInt(R.id.widget_status_pill, "setBackgroundResource", R.drawable.widget_pill_offline);
            views.setTextViewText(R.id.widget_btn_go_online, "Go Online");
            views.setInt(R.id.widget_btn_go_online, "setBackgroundResource", R.drawable.widget_btn_primary);
        }

        views.setOnClickPendingIntent(
            R.id.widget_root,
            buildActionPendingIntent(context, "open", 1001)
        );
        views.setOnClickPendingIntent(
            R.id.widget_btn_go_online,
            buildActionPendingIntent(context, "toggle_online", 1002)
        );
        views.setOnClickPendingIntent(
            R.id.widget_btn_earnings,
            buildActionPendingIntent(context, "open_earnings", 1003)
        );

        appWidgetManager.updateAppWidget(appWidgetId, views);
    }
}
