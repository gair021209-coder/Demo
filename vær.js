const HALDEN = { latitude: 59.12, longitude: 11.39 };
const WEATHER_URL = "https://api.open-meteo.com/v1/forecast";
const statusMessage = document.querySelector("#api-status");
const refreshButton = document.querySelector("#refresh-button");
const themeToggle = document.querySelector("#theme-toggle");
const themeLabel = document.querySelector("#theme-label");

document.querySelector("#today-date").textContent = new Intl.DateTimeFormat("en", {
  weekday: "long",
  day: "numeric",
  month: "long"
}).format(new Date());

themeToggle.addEventListener("click", () => {
  const isHalloween = document.body.classList.toggle("halloween");
  themeToggle.setAttribute("aria-pressed", String(isHalloween));
  themeLabel.textContent = isHalloween ? "Normal mode" : "Halloween mode";
  document.querySelector(".theme-icon").textContent = isHalloween ? "☀️" : "🎃";
  document.querySelector('meta[name="theme-color"]').content = isHalloween ? "#201b2c" : "#dceeff";
});

refreshButton.addEventListener("click", loadWeather);
loadWeather();

async function loadWeather() {
  setLoading(true);
  setStatus("Getting the latest weather…");
  try {
    const weather = await fetchWeather();
    renderCurrent(weather.current, weather.daily);
    renderHourly(weather.hourly);
    setStatus(`Forecast updated ${new Intl.DateTimeFormat("en", {
      hour: "numeric",
      minute: "2-digit"
    }).format(new Date())}.`, "success");
  } catch (error) {
    setStatus(error.message, "error");
  } finally {
    setLoading(false);
  }
}

async function fetchWeather() {
  const url = new URL(WEATHER_URL);
  url.searchParams.set("latitude", HALDEN.latitude);
  url.searchParams.set("longitude", HALDEN.longitude);
  url.searchParams.set("current", [
    "temperature_2m",
    "relative_humidity_2m",
    "apparent_temperature",
    "is_day",
    "precipitation",
    "rain",
    "weather_code",
    "wind_speed_10m",
    "wind_direction_10m"
  ].join(","));
  url.searchParams.set("hourly", "temperature_2m,precipitation_probability,weather_code");
  url.searchParams.set("daily", "uv_index_max");
  url.searchParams.set("forecast_hours", "8");
  url.searchParams.set("timezone", "Europe/Oslo");
  url.searchParams.set("wind_speed_unit", "kmh");

  let response;
  try {
    response = await fetch(url);
  } catch {
    throw new Error("Could not reach the weather service. Check your internet connection and try again.");
  }
  if (!response.ok) {
    throw new Error(`The weather service returned an error (${response.status}). Please try again.`);
  }

  const data = await response.json();
  if (!data.current || !data.hourly) {
    throw new Error("The weather service returned incomplete forecast data. Please try again.");
  }
  return {
    current: data.current,
    daily: data.daily,
    hourly: data.hourly
  };
}

function renderCurrent(current, daily) {
  const condition = conditionForCode(current.weather_code);
  const temperature = current.temperature_2m;
  const apparent = current.apparent_temperature;
  const rain = current.precipitation;
  const degrees = value => value == null ? "--°" : `${Math.round(value)}°`;

  document.querySelector("#temperature").textContent = degrees(temperature);
  document.querySelector("#condition").textContent = condition;
  document.querySelector("#feels-like").textContent = degrees(apparent);
  document.querySelector("#wind").textContent = current.wind_speed_10m == null
    ? "--"
    : `${Math.round(current.wind_speed_10m)} km/h ${windDirection(current.wind_direction_10m)}`;
  document.querySelector("#humidity").textContent = current.relative_humidity_2m == null ? "--" : `${current.relative_humidity_2m}%`;
  document.querySelector("#rain-chance").textContent = rain == null ? "--" : `${Math.round(rain)} mm`;
  document.querySelector("#uv-index").textContent = daily?.uv_index_max?.[0] == null ? "--" : `${Math.round(daily.uv_index_max[0])}`;
  const tip = makeStudentTip({ rain, temperature }, condition);
  document.querySelector("#weather-note").textContent = tip;
  document.querySelector("#student-tip").textContent = tip;
  document.querySelector("#weather-symbol").textContent = symbolForCode(current.weather_code, current.is_day);
  document.querySelector("#updated-at").textContent = `Halden, Østfold · Updated ${new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit"
  }).format(new Date())}`;
}

function makeStudentTip({ rain, temperature }, condition) {
  if (rain >= 1) return "Rain is expected—bring a jacket or umbrella for the walk to class.";
  if (temperature != null && temperature <= 3) return "It’s chilly outside—an extra layer will help on your way to class.";
  if (temperature != null && temperature >= 23) return "It’s warm out—keep some water handy between classes.";
  return `${condition} in Halden. Check again before heading out.`;
}

function conditionForCode(code) {
  if (code === 0) return "Clear sky";
  if (code === 1) return "Mostly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if ([45, 48].includes(code)) return "Foggy";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67].includes(code)) return "Rain";
  if ([71, 73, 75, 77].includes(code)) return "Snow";
  if ([80, 81, 82].includes(code)) return "Rain showers";
  if ([85, 86].includes(code)) return "Snow showers";
  if ([95, 96, 99].includes(code)) return "Thunderstorms";
  return "Current conditions";
}

function symbolForCode(code, isDay = 1) {
  if ([95, 96, 99].includes(code)) return "ϟ";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "❄";
  if ([51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "☂";
  if ([2, 3, 45, 48].includes(code)) return "☁";
  return isDay ? "☀" : "☾";
}

function windDirection(degrees) {
  if (degrees == null) return "";
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(degrees / 45) % 8];
}

function renderHourly(hourly) {
  const list = document.querySelector("#hourly-list");
  list.replaceChildren();
  if (!hourly.time?.length) {
    const empty = document.createElement("p");
    empty.className = "forecast-empty";
    empty.textContent = "The weather service did not return an hourly forecast.";
    list.append(empty);
    return;
  }

  const currentHour = new Date();
  currentHour.setMinutes(0, 0, 0);
  const startIndex = Math.max(0, hourly.time.findIndex(time => new Date(time) >= currentHour));
  for (let index = startIndex; index < Math.min(startIndex + 8, hourly.time.length); index++) {
    const item = document.createElement("div");
    item.className = "hour-item";
    const time = document.createElement("span");
    time.className = "hour-time";
    time.textContent = new Intl.DateTimeFormat("en", { hour: "numeric", timeZone: "Europe/Oslo" })
      .format(new Date(hourly.time[index]));
    const icon = document.createElement("span");
    icon.className = "hour-icon";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = symbolForCode(hourly.weather_code?.[index]);
    const temp = document.createElement("strong");
    temp.className = "hour-temp";
    temp.textContent = hourly.temperature_2m?.[index] == null ? "--°" : `${Math.round(hourly.temperature_2m[index])}°`;
    item.append(time, icon, temp);
    list.append(item);
  }
}

function setStatus(message, state) {
  statusMessage.textContent = message;
  if (state) statusMessage.dataset.state = state;
  else delete statusMessage.dataset.state;
}

function setLoading(loading) {
  refreshButton.disabled = loading;
  refreshButton.innerHTML = loading ? "Loading…" : 'Refresh forecast <span aria-hidden="true">↻</span>';
}
