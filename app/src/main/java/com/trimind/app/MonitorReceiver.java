package com.trimind.app;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.os.Build;

/**
 * Local reminder ONLY. Actual information comparison needs authenticated Puter
 * and runs when the user opens the app; no background AI network activity is claimed.
 */
public final class MonitorReceiver extends BroadcastReceiver {
    private static final String CHANNEL = "trimind_review";
    private static final int REQUEST_CODE = 8370;

    static void schedule(Context context, long epochMs) {
        if (epochMs <= System.currentTimeMillis()) return;
        AlarmManager alarms=(AlarmManager)context.getSystemService(Context.ALARM_SERVICE);
        PendingIntent intent=pending(context);
        if (alarms != null) alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP,epochMs,intent);
    }

    static void cancel(Context context) {
        AlarmManager alarms=(AlarmManager)context.getSystemService(Context.ALARM_SERVICE);
        if (alarms != null) alarms.cancel(pending(context));
    }

    private static PendingIntent pending(Context context) {
        Intent intent=new Intent(context,MonitorReceiver.class);
        return PendingIntent.getBroadcast(context,REQUEST_CODE,intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    @Override public void onReceive(Context context, Intent event) {
        if (Build.VERSION.SDK_INT >= 33 &&
            context.checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                != android.content.pm.PackageManager.PERMISSION_GRANTED) return;

        NotificationManager manager=(NotificationManager)context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager==null) return;
        if (Build.VERSION.SDK_INT >= 26) {
            NotificationChannel channel=new NotificationChannel(CHANNEL,
                "TriMind: перевірка змін",NotificationManager.IMPORTANCE_DEFAULT);
            manager.createNotificationChannel(channel);
        }
        Intent open=new Intent(context,PuterActivity.class);
        open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent click=PendingIntent.getActivity(context,REQUEST_CODE,open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification.Builder builder=Build.VERSION.SDK_INT>=26
            ? new Notification.Builder(context,CHANNEL):new Notification.Builder(context);
        Notification message=builder
            .setSmallIcon(R.drawable.ic_trimind)
            .setContentTitle("TriMind: час перевірити джерела")
            .setContentText("Відкрийте TriMind для нового порівняння результатів моніторингу.")
            .setAutoCancel(true)
            .setContentIntent(click)
            .build();
        manager.notify(REQUEST_CODE,message);
    }
}
