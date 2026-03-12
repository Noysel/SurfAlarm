const axios = require("axios");

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";

// Send a push notification via Expo's push service
async function sendPushNotification({ expoPushToken, alarmTime, isGood, waveData }) {
  const title = isGood
    ? `Waves are good! Alarm set for ${alarmTime}`
    : `Waves are flat. Alarm set for ${alarmTime}`;

  const body = isGood
    ? `Height: ${waveData.waveHeight}m | Period: ${waveData.wavePeriod}s | Wind: ${waveData.windSpeed} km/h`
    : `Height: ${waveData.waveHeight}m | Period: ${waveData.wavePeriod}s | Wind: ${waveData.windSpeed} km/h`;

  const message = {
    to: expoPushToken,
    sound: "alarm.mp3",
    channelId: "surf-alarm",
    title,
    body,
    data: { alarmTime, isGood, waveData },
    priority: "high",
  };

  try {
    const response = await axios.post(EXPO_PUSH_URL, message, {
      headers: {
        Accept: "application/json",
        "Accept-encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
    });
    console.log(`[Notification] Sent to ${expoPushToken} — alarm: ${alarmTime}`);
    return response.data;
  } catch (err) {
    console.error(`[Notification] Failed to send to ${expoPushToken}:`, err.message);
    throw err;
  }
}

module.exports = { sendPushNotification };
