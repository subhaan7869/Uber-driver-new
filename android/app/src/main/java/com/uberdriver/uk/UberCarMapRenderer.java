package com.uberdriver.uk;

import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.Rect;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.view.Surface;

import androidx.annotation.NonNull;
import androidx.car.app.SurfaceCallback;
import androidx.car.app.SurfaceContainer;

import org.json.JSONArray;

/**
 * Renders a live dark-mode UK navigation map canvas onto the Android Auto car surface.
 */
public class UberCarMapRenderer implements SurfaceCallback {

    private final Object surfaceLock = new Object();
    private Surface surface;
    private int width = 0;
    private int height = 0;
    private Rect visibleArea = null;
    private Rect stableArea = null;

    private float panOffsetX = 0f;
    private float panOffsetY = 0f;
    private float zoomScale = 16.0f; // pixels per UK map unit
    private boolean isPanMode = false;

    private UberCarAutoBridge.CarAutoState state = new UberCarAutoBridge.CarAutoState();

    private final Paint bgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint minorRoadPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint majorRoadPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint routeCasingPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint routeLinePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint surgeFillPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint surgeStrokePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint surgeTextPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint pinPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint pinLabelPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint puckRingPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint puckFillPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint puckArrowPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint speedRingPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint speedFillPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint speedTextPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint hudBgPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
    private final Paint hudTextPaint = new Paint(Paint.ANTI_ALIAS_FLAG);

    public UberCarMapRenderer() {
        bgPaint.setColor(Color.parseColor("#0D1017"));

        minorRoadPaint.setColor(Color.parseColor("#1B212E"));
        minorRoadPaint.setStrokeWidth(3f);
        minorRoadPaint.setStyle(Paint.Style.STROKE);

        majorRoadPaint.setColor(Color.parseColor("#2A3447"));
        majorRoadPaint.setStrokeWidth(7f);
        majorRoadPaint.setStyle(Paint.Style.STROKE);
        majorRoadPaint.setStrokeCap(Paint.Cap.ROUND);

        routeCasingPaint.setColor(Color.parseColor("#0B2559"));
        routeCasingPaint.setStrokeWidth(18f);
        routeCasingPaint.setStyle(Paint.Style.STROKE);
        routeCasingPaint.setStrokeCap(Paint.Cap.ROUND);
        routeCasingPaint.setStrokeJoin(Paint.Join.ROUND);

        routeLinePaint.setColor(Color.parseColor("#276EF1"));
        routeLinePaint.setStrokeWidth(10f);
        routeLinePaint.setStyle(Paint.Style.STROKE);
        routeLinePaint.setStrokeCap(Paint.Cap.ROUND);
        routeLinePaint.setStrokeJoin(Paint.Join.ROUND);

        surgeFillPaint.setColor(Color.argb(46, 234, 88, 12));
        surgeFillPaint.setStyle(Paint.Style.FILL);

        surgeStrokePaint.setColor(Color.argb(170, 249, 115, 22));
        surgeStrokePaint.setStrokeWidth(2.5f);
        surgeStrokePaint.setStyle(Paint.Style.STROKE);

        surgeTextPaint.setColor(Color.WHITE);
        surgeTextPaint.setTextSize(26f);
        surgeTextPaint.setTypeface(Typeface.DEFAULT_BOLD);
        surgeTextPaint.setTextAlign(Paint.Align.CENTER);

        pinPaint.setStyle(Paint.Style.FILL);
        pinLabelPaint.setColor(Color.WHITE);
        pinLabelPaint.setTextSize(24f);
        pinLabelPaint.setTypeface(Typeface.DEFAULT_BOLD);
        pinLabelPaint.setTextAlign(Paint.Align.CENTER);

        puckRingPaint.setColor(Color.WHITE);
        puckRingPaint.setStyle(Paint.Style.FILL);

        puckFillPaint.setColor(Color.parseColor("#276EF1"));
        puckFillPaint.setStyle(Paint.Style.FILL);

        puckArrowPaint.setColor(Color.WHITE);
        puckArrowPaint.setStyle(Paint.Style.FILL);

        speedFillPaint.setColor(Color.WHITE);
        speedFillPaint.setStyle(Paint.Style.FILL);

        speedRingPaint.setColor(Color.parseColor("#DC2626"));
        speedRingPaint.setStrokeWidth(6f);
        speedRingPaint.setStyle(Paint.Style.STROKE);

        speedTextPaint.setColor(Color.parseColor("#111111"));
        speedTextPaint.setTextSize(28f);
        speedTextPaint.setTypeface(Typeface.DEFAULT_BOLD);
        speedTextPaint.setTextAlign(Paint.Align.CENTER);

        hudBgPaint.setColor(Color.argb(215, 17, 20, 27));
        hudBgPaint.setStyle(Paint.Style.FILL);

        hudTextPaint.setColor(Color.WHITE);
        hudTextPaint.setTextSize(24f);
        hudTextPaint.setTypeface(Typeface.DEFAULT_BOLD);
        hudTextPaint.setTextAlign(Paint.Align.LEFT);
    }

    public void updateState(UberCarAutoBridge.CarAutoState newState) {
        if (newState != null) {
            this.state = newState;
            renderFrame();
        }
    }

    public void setPanMode(boolean panMode) {
        this.isPanMode = panMode;
        if (!panMode) {
            recenter();
        } else {
            renderFrame();
        }
    }

    public void recenter() {
        panOffsetX = 0f;
        panOffsetY = 0f;
        zoomScale = 16.0f;
        renderFrame();
    }

    @Override
    public void onSurfaceAvailable(@NonNull SurfaceContainer surfaceContainer) {
        synchronized (surfaceLock) {
            this.surface = surfaceContainer.getSurface();
            this.width = surfaceContainer.getWidth();
            this.height = surfaceContainer.getHeight();
        }
        renderFrame();
    }

    @Override
    public void onVisibleAreaChanged(@NonNull Rect visibleArea) {
        synchronized (surfaceLock) {
            this.visibleArea = new Rect(visibleArea);
        }
        renderFrame();
    }

    @Override
    public void onStableAreaChanged(@NonNull Rect stableArea) {
        synchronized (surfaceLock) {
            this.stableArea = new Rect(stableArea);
        }
        renderFrame();
    }

    @Override
    public void onSurfaceDestroyed(@NonNull SurfaceContainer surfaceContainer) {
        synchronized (surfaceLock) {
            this.surface = null;
            this.width = 0;
            this.height = 0;
        }
    }

    @Override
    public void onScroll(float distanceX, float distanceY) {
        if (!isPanMode) return;
        panOffsetX -= distanceX;
        panOffsetY -= distanceY;
        renderFrame();
    }

    @Override
    public void onScale(float focusX, float focusY, float scaleFactor) {
        zoomScale = Math.max(4.0f, Math.min(48.0f, zoomScale * scaleFactor));
        renderFrame();
    }

    @Override
    public void onFling(float velocityX, float velocityY) {
        if (!isPanMode) return;
        panOffsetX += velocityX * 0.06f;
        panOffsetY += velocityY * 0.06f;
        renderFrame();
    }

    public void renderFrame() {
        synchronized (surfaceLock) {
            if (surface == null || !surface.isValid() || width <= 0 || height <= 0) return;
            Canvas canvas = null;
            try {
                canvas = surface.lockCanvas(null);
                if (canvas != null) {
                    drawMapScene(canvas);
                }
            } catch (Exception ignored) {
            } finally {
                if (canvas != null) {
                    try {
                        surface.unlockCanvasAndPost(canvas);
                    } catch (Exception ignored) {}
                }
            }
        }
    }

    private void drawMapScene(Canvas canvas) {
        canvas.drawRect(0f, 0f, width, height, bgPaint);

        Rect vis = visibleArea != null ? visibleArea : new Rect(0, 0, width, height);
        Rect stab = stableArea != null ? stableArea : vis;

        float centerX = vis.exactCenterX() + panOffsetX;
        float centerY = vis.exactCenterY() + (vis.height() * 0.08f) + panOffsetY;

        double drvX = state.driverX;
        double drvY = state.driverY;

        // 1. Moving UK road grid locked to driver map coordinates
        drawMovingUkStreetGrid(canvas, centerX, centerY, drvX, drvY);

        // 2. Surge zones when idle
        boolean isActiveTrip = state.tripStage != null && !"idle".equals(state.tripStage) && !"completed".equals(state.tripStage);
        if (!isActiveTrip) {
            drawSurgeZones(canvas, centerX, centerY, drvX, drvY);
        }

        // 3. Active trip polyline + pins
        if (isActiveTrip) {
            drawActiveRoute(canvas, centerX, centerY, drvX, drvY);
        }

        // 4. Driver blue directional navigation puck
        drawDriverPuck(canvas, centerX, centerY, (float) state.driverHeading);

        // 5. UK Speed Limit badge + Live HUD Pill inside safe visible bounds
        drawHudOverlays(canvas, stab, isActiveTrip);
    }

    private void drawMovingUkStreetGrid(Canvas canvas, float cx, float cy, double drvX, double drvY) {
        double spacingUnits = 4.5;
        double startUx = Math.floor((drvX - (cx / zoomScale)) / spacingUnits) * spacingUnits;
        double endUx = drvX + ((width - cx) / zoomScale) + spacingUnits;
        for (double ux = startUx; ux <= endUx; ux += spacingUnits) {
            float sx = cx + (float) ((ux - drvX) * zoomScale);
            boolean major = Math.abs(Math.round(ux / spacingUnits)) % 3 == 0;
            canvas.drawLine(sx, 0f, sx, height, major ? majorRoadPaint : minorRoadPaint);
        }

        double startUy = Math.floor((drvY - (cy / zoomScale)) / spacingUnits) * spacingUnits;
        double endUy = drvY + ((height - cy) / zoomScale) + spacingUnits;
        for (double uy = startUy; uy <= endUy; uy += spacingUnits) {
            float sy = cy + (float) ((uy - drvY) * zoomScale);
            boolean major = Math.abs(Math.round(uy / spacingUnits)) % 3 == 0;
            canvas.drawLine(0f, sy, width, sy, major ? majorRoadPaint : minorRoadPaint);
        }

        // Subtle diagonal arterial A-road corridor lines for realism
        double diagStep = 22.0;
        double baseDiag = Math.floor(drvX / diagStep) * diagStep;
        for (double dx = baseDiag - diagStep; dx <= baseDiag + diagStep * 2; dx += diagStep) {
            float x1 = cx + (float) ((dx - 18.0 - drvX) * zoomScale);
            float y1 = cy + (float) ((-22.0) * zoomScale);
            float x2 = cx + (float) ((dx + 22.0 - drvX) * zoomScale);
            float y2 = cy + (float) ((22.0) * zoomScale);
            canvas.drawLine(x1, y1, x2, y2, majorRoadPaint);
        }
    }

    private void drawSurgeZones(Canvas canvas, float cx, float cy, double drvX, double drvY) {
        try {
            JSONArray arr = new JSONArray(state.surgePointsJson != null ? state.surgePointsJson : "[]");
            for (int i = 0; i < arr.length(); i++) {
                JSONArray item = arr.optJSONArray(i);
                if (item == null || item.length() < 3) continue;
                double zx = item.optDouble(0);
                double zy = item.optDouble(1);
                String label = item.optString(2, "£+3");
                float sx = cx + (float) ((zx - drvX) * zoomScale);
                float sy = cy + (float) ((zy - drvY) * zoomScale);
                float radius = Math.max(46f, zoomScale * 2.8f);
                canvas.drawCircle(sx, sy, radius, surgeFillPaint);
                canvas.drawCircle(sx, sy, radius, surgeStrokePaint);
                canvas.drawText(label, sx, sy + 9f, surgeTextPaint);
            }
        } catch (Exception ignored) {}
    }

    private void drawActiveRoute(Canvas canvas, float cx, float cy, double drvX, double drvY) {
        boolean isEnroute = "enroute".equals(state.tripStage) || "stop_wait".equals(state.tripStage) || "dropoff_arrived".equals(state.tripStage);
        routeCasingPaint.setColor(isEnroute ? Color.parseColor("#044926") : Color.parseColor("#0B2559"));
        routeLinePaint.setColor(isEnroute ? Color.parseColor("#05944F") : Color.parseColor("#276EF1"));

        try {
            JSONArray arr = new JSONArray(state.routePointsJson != null ? state.routePointsJson : "[]");
            if (arr.length() >= 2) {
                Path routePath = new Path();
                for (int i = 0; i < arr.length(); i++) {
                    JSONArray pt = arr.optJSONArray(i);
                    if (pt == null || pt.length() < 2) continue;
                    float sx = cx + (float) ((pt.optDouble(0) - drvX) * zoomScale);
                    float sy = cy + (float) ((pt.optDouble(1) - drvY) * zoomScale);
                    if (i == 0) {
                        routePath.moveTo(sx, sy);
                    } else {
                        routePath.lineTo(sx, sy);
                    }
                }
                canvas.drawPath(routePath, routeCasingPaint);
                canvas.drawPath(routePath, routeLinePaint);
            }
        } catch (Exception ignored) {}

        // Pickup pin (while heading to pickup or waiting)
        if (!isEnroute && state.pickupX != 0.0 && state.pickupY != 0.0) {
            drawMapPin(canvas, cx + (float) ((state.pickupX - drvX) * zoomScale), cy + (float) ((state.pickupY - drvY) * zoomScale), Color.parseColor("#276EF1"), "P");
        }
        // Stop pin (if multi-stop)
        if (state.hasStopCoords && !state.activeStopVisited && state.stopX != 0.0 && state.stopY != 0.0) {
            drawMapPin(canvas, cx + (float) ((state.stopX - drvX) * zoomScale), cy + (float) ((state.stopY - drvY) * zoomScale), Color.parseColor("#F59E0B"), "S");
        }
        // Dropoff pin
        if (state.dropoffX != 0.0 && state.dropoffY != 0.0) {
            drawMapPin(canvas, cx + (float) ((state.dropoffX - drvX) * zoomScale), cy + (float) ((state.dropoffY - drvY) * zoomScale), Color.parseColor("#05944F"), "D");
        }
    }

    private void drawMapPin(Canvas canvas, float x, float y, int color, String letter) {
        pinPaint.setColor(Color.WHITE);
        canvas.drawCircle(x, y, 24f, pinPaint);
        pinPaint.setColor(color);
        canvas.drawCircle(x, y, 19f, pinPaint);
        canvas.drawText(letter, x, y + 8f, pinLabelPaint);
    }

    private void drawDriverPuck(Canvas canvas, float cx, float cy, float headingDeg) {
        canvas.save();
        canvas.translate(cx, cy);
        canvas.rotate(headingDeg);

        canvas.drawCircle(0f, 0f, 28f, puckRingPaint);
        canvas.drawCircle(0f, 0f, 22f, puckFillPaint);

        Path arrow = new Path();
        arrow.moveTo(0f, -14f);
        arrow.lineTo(11f, 11f);
        arrow.lineTo(0f, 5f);
        arrow.lineTo(-11f, 11f);
        arrow.close();
        canvas.drawPath(arrow, puckArrowPaint);
        canvas.restore();
    }

    private void drawHudOverlays(Canvas canvas, Rect stab, boolean isActiveTrip) {
        if (isActiveTrip) {
            float badgeX = stab.left + 44f;
            float badgeY = stab.bottom - 44f;
            canvas.drawCircle(badgeX, badgeY, 32f, speedFillPaint);
            canvas.drawCircle(badgeX, badgeY, 29f, speedRingPaint);
            canvas.drawText(String.valueOf(Math.max(20, state.speedLimitMph)), badgeX, badgeY + 10f, speedTextPaint);
        }

        String statusText = state.online
            ? ("ONLINE · " + state.city + " · " + state.earningsText)
            : ("OFFLINE · " + state.city + " · " + state.earningsText);
        float textW = hudTextPaint.measureText(statusText);
        float pillW = textW + 44f;
        float pillH = 48f;
        float right = stab.right - 16f;
        float bottom = stab.bottom - 16f;
        RectF pill = new RectF(right - pillW, bottom - pillH, right, bottom);
        canvas.drawRoundRect(pill, 24f, 24f, hudBgPaint);

        Paint dotPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
        dotPaint.setColor(state.online ? Color.parseColor("#276EF1") : Color.parseColor("#9CA3AF"));
        canvas.drawCircle(pill.left + 20f, pill.centerY(), 6f, dotPaint);
        canvas.drawText(statusText, pill.left + 34f, pill.centerY() + 8f, hudTextPaint);
    }
}
