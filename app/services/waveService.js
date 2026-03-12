import { DEFAULT_WAVE_SETTINGS } from "../constants/defaults";

// Fetch wave + wind data directly from Open-Meteo (no server needed)
export async function fetchWaveData(lat, lon) {
  const [marineRes, weatherRes] = await Promise.all([
    fetch(
      `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&hourly=wave_height,wave_period&timezone=Asia%2FJerusalem&forecast_days=2`
    ),
    fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=windspeed_10m&timezone=Asia%2FJerusalem&forecast_days=2`
    ),
  ]);

  if (!marineRes.ok || !weatherRes.ok) throw new Error("API error");

  const marineData  = await marineRes.json();
  const weatherData = await weatherRes.json();

  const marineHourly  = marineData.hourly;
  const weatherHourly = weatherData.hourly;

  // Look at tomorrow's morning hours (06:00-10:00)
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowDate = tomorrow.toISOString().split("T")[0];

  const morningHours = marineHourly.time
    .map((time, i) => ({ time, i }))
    .filter(({ time }) => {
      const hour = new Date(time).getHours();
      return time.startsWith(tomorrowDate) && hour >= 6 && hour <= 10;
    });

  // Fallback to today if no tomorrow data
  const hours = morningHours.length > 0
    ? morningHours
    : marineHourly.time
        .map((time, i) => ({ time, i }))
        .filter(({ time }) => {
          const hour = new Date(time).getHours();
          return hour >= 6 && hour <= 10;
        });

  const avgWaveHeight =
    hours.reduce((sum, { i }) => sum + (marineHourly.wave_height[i] || 0), 0) / hours.length;
  const avgWavePeriod =
    hours.reduce((sum, { i }) => sum + (marineHourly.wave_period[i] || 0), 0) / hours.length;
  const avgWindSpeed =
    hours.reduce((sum, { i }) => sum + (weatherHourly.windspeed_10m[i] || 0), 0) / hours.length;

  return {
    waveHeight: parseFloat(avgWaveHeight.toFixed(2)),
    wavePeriod: parseFloat(avgWavePeriod.toFixed(1)),
    windSpeed:  parseFloat(avgWindSpeed.toFixed(1)),
  };
}

export function evaluateConditions(waveData, userSettings = {}) {
  const settings = { ...DEFAULT_WAVE_SETTINGS, ...userSettings };
  const { waveHeight, wavePeriod, windSpeed } = waveData;

  const isGood =
    waveHeight >= settings.minWaveHeight &&
    waveHeight <= settings.maxWaveHeight &&
    wavePeriod >= settings.minWavePeriod &&
    windSpeed  <= settings.maxWindSpeed;

  return { isGood, waveHeight, wavePeriod, windSpeed, settings };
}
