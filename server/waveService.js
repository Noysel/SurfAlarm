const axios = require("axios");

// Cache wave data for 30 minutes per location
const cache = {};
const CACHE_TTL = 30 * 60 * 1000;

function getCacheKey(lat, lon) {
  return `${lat},${lon}`;
}

const DEFAULT_SETTINGS = {
  minWaveHeight: 0.5,
  maxWaveHeight: 3.0,
  minWavePeriod: 8,
  maxWindSpeed: 20,
};

// Fetch wave + wind data from Open-Meteo Marine API for a given location
async function fetchWaveData(lat, lon) {
  const key = getCacheKey(lat, lon);
  if (cache[key] && Date.now() - cache[key].timestamp < CACHE_TTL) {
    console.log(`[Cache] Returning cached wave data for ${key}`);
    return cache[key].data;
  }
  const [marineRes, weatherRes] = await Promise.all([
    axios.get("https://marine-api.open-meteo.com/v1/marine", {
      params: {
        latitude: lat,
        longitude: lon,
        hourly: "wave_height,wave_period",
        timezone: "Asia/Jerusalem",
        forecast_days: 1,
      },
    }),
    axios.get("https://api.open-meteo.com/v1/forecast", {
      params: {
        latitude: lat,
        longitude: lon,
        hourly: "windspeed_10m",
        timezone: "Asia/Jerusalem",
        forecast_days: 1,
      },
    }),
  ]);

  const marineHourly = marineRes.data.hourly;
  const weatherHourly = weatherRes.data.hourly;

  // Look at conditions between 06:00 and 10:00 (morning surf window)
  const morningHours = marineHourly.time
    .map((time, i) => ({ time, i }))
    .filter(({ time }) => {
      const hour = new Date(time).getHours();
      return hour >= 6 && hour <= 10;
    });

  if (morningHours.length === 0) {
    throw new Error("No morning hours found in forecast data");
  }

  // Average the morning conditions
  const avgWaveHeight =
    morningHours.reduce((sum, { i }) => sum + (marineHourly.wave_height[i] || 0), 0) /
    morningHours.length;

  const avgWavePeriod =
    morningHours.reduce((sum, { i }) => sum + (marineHourly.wave_period[i] || 0), 0) /
    morningHours.length;

  const avgWindSpeed =
    morningHours.reduce((sum, { i }) => sum + (weatherHourly.windspeed_10m[i] || 0), 0) /
    morningHours.length;

  const result = {
    waveHeight: parseFloat(avgWaveHeight.toFixed(2)),
    wavePeriod: parseFloat(avgWavePeriod.toFixed(1)),
    windSpeed:  parseFloat(avgWindSpeed.toFixed(1)),
  };

  cache[key] = { data: result, timestamp: Date.now() };
  return result;
}

// Evaluate if conditions are good based on user's settings (or defaults)
function evaluateConditions(waveData, userSettings = {}) {
  const settings = { ...DEFAULT_SETTINGS, ...userSettings };

  const { waveHeight, wavePeriod, windSpeed } = waveData;

  const isGood =
    waveHeight >= settings.minWaveHeight &&
    waveHeight <= settings.maxWaveHeight &&
    wavePeriod >= settings.minWavePeriod &&
    windSpeed  <= settings.maxWindSpeed;

  return {
    isGood,
    waveHeight,
    wavePeriod,
    windSpeed,
    settings,
  };
}

module.exports = { fetchWaveData, evaluateConditions };
