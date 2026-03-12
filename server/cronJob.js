const cron = require("node-cron");
const fs   = require("fs");
const path = require("path");

const { fetchWaveData, evaluateConditions } = require("./waveService");
const { sendPushNotification }              = require("./notificationService");

const USERS_FILE = path.join(__dirname, "users.json");

function loadUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

async function runMorningCheck() {
  console.log("[Cron] Running morning wave check...");
  const users = loadUsers();

  if (users.length === 0) {
    console.log("[Cron] No registered users, skipping.");
    return;
  }

  for (const user of users) {
    try {
      const { beach, waveSettings, expoPushToken } = user;

      // 1. Fetch wave data for the user's beach
      const waveData = await fetchWaveData(beach.lat, beach.lon);

      // 2. Evaluate against user's settings (or defaults)
      const result = evaluateConditions(waveData, waveSettings);

      // 3. Determine alarm time
      const alarmTime = result.isGood ? "06:00" : "08:00";

      // 4. Send push notification
      await sendPushNotification({
        expoPushToken,
        alarmTime,
        isGood: result.isGood,
        waveData,
      });

      console.log(
        `[Cron] ${user.name || user.expoPushToken} — ${beach.name} — waves ${result.isGood ? "GOOD" : "BAD"} — alarm ${alarmTime}`
      );
    } catch (err) {
      console.error(`[Cron] Error processing user ${user.expoPushToken}:`, err.message);
    }
  }
}

// Schedule: every day at 05:45 Israel time (Asia/Jerusalem handles DST automatically)
function startCronJob() {
  cron.schedule(
    "45 5 * * *",
    () => { runMorningCheck(); },
    { timezone: "Asia/Jerusalem" }
  );
  console.log("[Cron] Scheduled daily wave check at 05:45 Asia/Jerusalem");
}

module.exports = { startCronJob, runMorningCheck };
