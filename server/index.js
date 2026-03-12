const express = require("express");
const cors    = require("cors");
const fs      = require("fs");
const path    = require("path");

const { startCronJob }                      = require("./cronJob");
const { runMorningCheck }                   = require("./cronJob");
const { fetchWaveData, evaluateConditions } = require("./waveService");

const app      = express();
const PORT     = process.env.PORT || 3000;
const USERS_FILE = path.join(__dirname, "users.json");

app.use(cors());
app.use(express.json());

// --- Helpers ---

function loadUsers() {
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
  } catch {
    return [];
  }
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

// --- Routes ---

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// Register or update a user
// Body: { expoPushToken, name, beach: { id, name, lat, lon }, waveSettings? }
app.post("/register", (req, res) => {
  const { expoPushToken, name, beach, waveSettings } = req.body;

  if (!beach?.lat || !beach?.lon) {
    return res.status(400).json({ error: "beach is required" });
  }

  const users = loadUsers();
  const existingIndex = users.findIndex((u) => u.expoPushToken === expoPushToken);

  const userData = {
    expoPushToken,
    name: name || "Surfer",
    beach,
    waveSettings: waveSettings || null, // null = use defaults
    registeredAt: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    users[existingIndex] = { ...users[existingIndex], ...userData };
    console.log(`[Register] Updated user ${expoPushToken}`);
  } else {
    users.push(userData);
    console.log(`[Register] New user ${expoPushToken}`);
  }

  saveUsers(users);
  res.json({ success: true, user: userData });
});

// Get current wave status for a beach (used by the app to show live data)
// Query: ?lat=32.08&lon=34.78
app.get("/wave-status", async (req, res) => {
  const { lat, lon, minWaveHeight, maxWaveHeight, minWavePeriod, maxWindSpeed } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: "lat and lon are required" });
  }

  try {
    const waveData = await fetchWaveData(parseFloat(lat), parseFloat(lon));

    const userSettings =
      minWaveHeight || maxWaveHeight || minWavePeriod || maxWindSpeed
        ? {
            minWaveHeight: parseFloat(minWaveHeight),
            maxWaveHeight: parseFloat(maxWaveHeight),
            minWavePeriod: parseFloat(minWavePeriod),
            maxWindSpeed:  parseFloat(maxWindSpeed),
          }
        : {};

    const result = evaluateConditions(waveData, userSettings);
    const alarmTime = result.isGood ? "06:00" : "08:00";

    res.json({ ...result, alarmTime });
  } catch (err) {
    console.error("[Wave Status] Error:", err.message);
    res.status(500).json({ error: "Failed to fetch wave data" });
  }
});

// Manually trigger the morning check (for testing)
app.post("/trigger-check", async (req, res) => {
  try {
    await runMorningCheck();
    res.json({ success: true, message: "Morning check triggered" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// --- Start ---

app.listen(PORT, () => {
  console.log(`[Server] Running on port ${PORT}`);
  startCronJob();
});
