import * as TaskManager from "expo-task-manager";
import * as BackgroundFetch from "expo-background-fetch";
import * as Notifications from "expo-notifications";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { fetchWaveData, evaluateConditions } from "../services/waveService";

export const WAVE_CHECK_TASK = "WAVE_CHECK_TASK";

// Define the background task
TaskManager.defineTask(WAVE_CHECK_TASK, async () => {
  try {
    // Only run between 05:30 and 06:30 Israel time
    const now = new Date();
    const israelHour = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" })
    ).getHours();
    const israelMinute = new Date(
      now.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" })
    ).getMinutes();
    const totalMinutes = israelHour * 60 + israelMinute;

    // 05:30 = 330 minutes, 06:00 = 360 minutes
    if (totalMinutes < 330 || totalMinutes > 360) {
      console.log("[WaveCheck] Not in morning window, skipping.");
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // Load user settings
    const raw = await AsyncStorage.getItem("userSettings");
    if (!raw) return BackgroundFetch.BackgroundFetchResult.NoData;

    const { beach, waveSettings } = JSON.parse(raw);
    if (!beach) return BackgroundFetch.BackgroundFetchResult.NoData;

    // Fetch wave data directly from Open-Meteo
    const waveData = await fetchWaveData(beach.lat, beach.lon);
    const result   = evaluateConditions(waveData, waveSettings);
    const data     = { ...result, alarmTime: result.isGood ? "06:00" : "08:00" };

    // Schedule notification for 06:00 or 08:00
    await Notifications.cancelAllScheduledNotificationsAsync();

    const [hours, minutes] = data.alarmTime.split(":").map(Number);
    const alarmDate = new Date();
    alarmDate.setHours(hours, minutes, 0, 0);

    // If the alarm time has already passed today, don't schedule
    if (alarmDate <= new Date()) {
      console.log("[WaveCheck] Alarm time already passed.");
      return BackgroundFetch.BackgroundFetchResult.NewData;
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title: data.isGood ? "Waves are good! Time to surf!" : "Waves are flat. Sleep in.",
        body: `Height: ${data.waveHeight}m | Period: ${data.wavePeriod}s | Wind: ${data.windSpeed} km/h`,
        sound: "alarm.mp3",
        android: {
          channelId: "surf-alarm",
          sound: "alarm.mp3",
        },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: alarmDate,
      },
    });

    console.log(`[WaveCheck] Alarm scheduled for ${data.alarmTime}`);
    return BackgroundFetch.BackgroundFetchResult.NewData;
  } catch (err) {
    console.error("[WaveCheck] Error:", err.message);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

// Register the background task
export async function registerWaveCheckTask() {
  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(WAVE_CHECK_TASK);
    if (!isRegistered) {
      await BackgroundFetch.registerTaskAsync(WAVE_CHECK_TASK, {
        minimumInterval: 60 * 30, // every 30 min minimum
        stopOnTerminate: false,
        startOnBoot: true,
      });
      console.log("[WaveCheck] Background task registered.");
    }
  } catch (err) {
    console.warn("[WaveCheck] Could not register background task:", err.message);
  }
}
