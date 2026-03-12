# SurfAlarm

A full-stack mobile app that checks surf conditions every morning and wakes you up at the right time — 06:00 if the waves are good, 08:00 if they're not.

Built for surfers on the Israeli coast.

---

## How It Works

Every evening when you open the app, it fetches tomorrow's forecast and schedules your alarm automatically. No need to check anything — just go to sleep and let it decide.

- **Waves are good** → alarm rings at 06:00
- **Waves are flat** → alarm rings at 08:00 (sleep in)

At 05:45 the server also runs a background check and sends a push notification confirming the alarm time.

---

## Features

- Fetches real wave height, wave period, and wind speed from Open-Meteo Marine API
- Evaluates conditions against customizable thresholds (or smart defaults)
- Schedules a local alarm notification with a custom alarm sound
- Server-side cron job sends a push notification at 05:45 every morning
- Supports 10 beaches along the Israeli coast
- Clean dark UI with live wave data cards

---

## Tech Stack

### Mobile App (React Native / Expo)
- React Native with Expo SDK 54
- `expo-notifications` — local alarm scheduling with custom sound
- `expo-background-fetch` + `expo-task-manager` — background wave checks
- `expo-av` — plays alarm sound on the AlarmScreen
- `@react-navigation/native` — screen navigation
- AsyncStorage — local settings persistence

### Backend (Node.js)
- Express.js REST API
- `node-cron` — scheduled daily wave check at 05:45 (Asia/Jerusalem)
- Expo Push Notification API — delivers push notifications to registered devices
- Deployed on **Render**

### External APIs
- [Open-Meteo Marine API](https://marine-api.open-meteo.com) — wave height & period
- [Open-Meteo Forecast API](https://api.open-meteo.com) — wind speed

---

## Architecture

```
┌─────────────────────────────────────────┐
│              Mobile App                 │
│                                         │
│  HomeScreen ──► fetchWaveData()         │
│      │          (Open-Meteo direct)     │
│      └──► scheduleLocalNotification()  │
│           (alarm at 06:00 or 08:00)    │
│                                         │
│  SettingsScreen ──► POST /register     │
│           (saves beach + push token)   │
│                                         │
│  AlarmScreen ──► plays alarm.mp3       │
└─────────────────────────────────────────┘
                      │
                      │ register / save settings
                      ▼
┌─────────────────────────────────────────┐
│           Backend (Render)              │
│                                         │
│  Cron 05:45 ──► fetchWaveData()        │
│      └──► evaluateConditions()         │
│      └──► sendPushNotification()       │
│           (Expo Push API)              │
└─────────────────────────────────────────┘
```

---

## Wave Conditions (Defaults)

| Parameter | Threshold |
|-----------|-----------|
| Wave height | 0.5m – 3.0m |
| Wave period | ≥ 8 seconds |
| Wind speed | ≤ 20 km/h |

Users can override these in the Settings screen.

---

## Supported Beaches

Gordon Beach, Frishman Beach, Hilton Beach (Tel Aviv), Herzliya, Netanya, Habonim, Haifa - Bat Galim, Nahariya, Ashkelon, Ashdod.

---

## Project Structure

```
ClaudeCode/
├── app/                        # React Native (Expo)
│   ├── screens/
│   │   ├── HomeScreen.js       # Main screen — wave status + alarm scheduling
│   │   ├── SettingsScreen.js   # Beach picker + wave thresholds
│   │   └── AlarmScreen.js      # Full-screen alarm with sound
│   ├── services/
│   │   └── waveService.js      # Open-Meteo API calls + condition evaluation
│   ├── tasks/
│   │   └── waveCheckTask.js    # Background fetch task
│   ├── components/
│   │   ├── BeachPicker.js
│   │   └── WaveSettings.js
│   ├── constants/
│   │   ├── beaches.js
│   │   ├── defaults.js
│   │   └── config.js
│   └── assets/
│       └── alarm.mp3
└── server/                     # Node.js backend
    ├── index.js                # Express API
    ├── cronJob.js              # Daily 05:45 wave check
    ├── waveService.js          # Open-Meteo calls (server-side)
    ├── notificationService.js  # Expo push notification sender
    └── users.json              # Registered users store
```

---

## Running Locally

**Server:**
```bash
cd server
npm install
npm run dev
```

**App:**
```bash
cd app
npm install
npx expo start
```

Scan the QR code with Expo Go, or run on an emulator.

---

## Environment

The server URL is configured in `app/constants/config.js`. Update it to point to your own deployed server.
