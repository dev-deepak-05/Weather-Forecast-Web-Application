const form = document.getElementById('search-form');
const input = document.getElementById('city-input');
const status = document.getElementById('status');
const statusTextEl = document.getElementById('status-text');
const loadingOverlayEl = document.getElementById('loading-overlay');
const currentWeather = document.getElementById('current-weather');
const locationBtn = document.getElementById('location-btn');
const recentSearchesEl = document.getElementById('recent-searches');
const clearHistoryBtn = document.getElementById('clear-history-btn');
const alertsListEl = document.getElementById('alerts-list');
const aqiValueEl = document.getElementById('aqi-value');
const aqiCategoryEl = document.getElementById('aqi-category');
const aqiAdviceEl = document.getElementById('aqi-advice');
const aqiCardEl = document.getElementById('aqi-card');

const locationEl = document.getElementById('location');
const dateEl = document.getElementById('date');
const weatherIconEl = document.getElementById('weather-icon');
const temperatureEl = document.getElementById('temperature');
const conditionEl = document.getElementById('condition');
const feelsLikeEl = document.getElementById('feels-like');
const humidityEl = document.getElementById('humidity');
const windEl = document.getElementById('wind');
const sunriseEl = document.getElementById('sunrise');
const sunsetEl = document.getElementById('sunset');
const uvIndexEl = document.getElementById('uv-index');
const pressureEl = document.getElementById('pressure');
const visibilityEl = document.getElementById('visibility');
const windDirectionEl = document.getElementById('wind-direction');
const cloudCoverEl = document.getElementById('cloud-cover');
const feelsLikeDetailEl = document.getElementById('feels-like-detail');

const storageKey = 'weather-recent-searches';
const recentLimit = 5;
const chartInstances = {};

const weatherCodeMap = {
  0: { icon: '☀️', text: 'Clear sky', scene: 'sunny' },
  1: { icon: '🌤️', text: 'Mainly clear', scene: 'sunny' },
  2: { icon: '⛅', text: 'Partly cloudy', scene: 'cloudy' },
  3: { icon: '☁️', text: 'Cloudy', scene: 'cloudy' },
  45: { icon: '🌫️', text: 'Fog', scene: 'fog' },
  48: { icon: '🌫️', text: 'Rime fog', scene: 'fog' },
  51: { icon: '🌦️', text: 'Light drizzle', scene: 'rain' },
  53: { icon: '🌦️', text: 'Drizzle', scene: 'rain' },
  55: { icon: '🌦️', text: 'Dense drizzle', scene: 'rain' },
  61: { icon: '🌧️', text: 'Light rain', scene: 'rain' },
  63: { icon: '🌧️', text: 'Rain', scene: 'rain' },
  65: { icon: '🌧️', text: 'Heavy rain', scene: 'rain' },
  71: { icon: '❄️', text: 'Light snow', scene: 'snow' },
  73: { icon: '❄️', text: 'Snow', scene: 'snow' },
  75: { icon: '❄️', text: 'Heavy snow', scene: 'snow' },
  95: { icon: '⛈️', text: 'Thunderstorm', scene: 'thunderstorm' },
  96: { icon: '⛈️', text: 'Thunderstorm with hail', scene: 'thunderstorm' },
  99: { icon: '⛈️', text: 'Thunderstorm with hail', scene: 'thunderstorm' }
};

function getRecentSearches() {
  try {
    return JSON.parse(localStorage.getItem(storageKey)) || [];
  } catch {
    return [];
  }
}

function setLoading(isLoading, message = 'Loading weather…') {
  if (status) {
    status.classList.toggle('is-loading', isLoading);
    status.classList.remove('is-error');
  }

  const overlay = loadingOverlayEl || document.getElementById('loading-overlay');
  if (overlay) {
    overlay.classList.toggle('is-visible', isLoading);
    overlay.classList.toggle('is-hidden', !isLoading);
  }

  if (statusTextEl) {
    statusTextEl.textContent = message;
  }
}

function setError(message) {
  if (status) {
    status.classList.remove('is-loading');
    status.classList.add('is-error');
  }

  const overlay = loadingOverlayEl || document.getElementById('loading-overlay');
  if (overlay) {
    overlay.classList.remove('is-visible');
    overlay.classList.add('is-hidden');
  }

  if (statusTextEl) {
    statusTextEl.textContent = message;
  }
}

function saveRecentSearch(city) {
  const normalized = city.trim();
  if (!normalized) return;

  const searches = getRecentSearches();
  const updated = [normalized, ...searches.filter((item) => item !== normalized)].slice(0, recentLimit);
  localStorage.setItem(storageKey, JSON.stringify(updated));
  renderRecentSearches(updated);
}

function renderRecentSearches(items) {
  if (!items.length) {
    recentSearchesEl.innerHTML = '<p>No searches yet.</p>';
    return;
  }

  recentSearchesEl.innerHTML = items
    .map((item) => `<button class="recent-chip" type="button">${item}</button>`)
    .join('');

  recentSearchesEl.querySelectorAll('.recent-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      input.value = chip.textContent;
      fetchWeather(chip.textContent);
    });
  });
}

function clearRecentSearches() {
  localStorage.removeItem(storageKey);
  renderRecentSearches([]);
}

function setWeatherScene(scene, isDay) {
  let nextScene = scene;
  if (isDay === 0 && ['sunny', 'cloudy'].includes(scene)) {
    nextScene = 'night';
  }
  document.body.dataset.weather = nextScene;
}

function getAQIInfo(aqi) {
  const numericAqi = Number(aqi) || 30;
  if (numericAqi <= 50) {
    return { category: 'Good', advice: 'Air quality looks comfortable for most people.', className: 'good' };
  }
  if (numericAqi <= 100) {
    return { category: 'Moderate', advice: 'Sensitive groups may want to limit outdoor exertion.', className: 'moderate' };
  }
  if (numericAqi <= 150) {
    return { category: 'Unhealthy for Sensitive Groups', advice: 'Reduce time outdoors if you are sensitive to air pollution.', className: 'unhealthy' };
  }
  if (numericAqi <= 200) {
    return { category: 'Unhealthy', advice: 'Consider wearing a mask and staying indoors during peak hours.', className: 'unhealthy' };
  }
  return { category: 'Very Unhealthy', advice: 'Avoid prolonged outdoor activity and keep indoor air clean.', className: 'very-unhealthy' };
}

async function fetchAirQuality(latitude, longitude) {
  try {
    const response = await fetch(
      `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${latitude}&longitude=${longitude}&hourly=us_aqi&timezone=auto`
    );
    const data = await response.json();
    return data.hourly?.us_aqi?.[0] ?? 30;
  } catch {
    return 30;
  }
}

function getAlerts(weatherCode, windSpeed, maxRainProbability, maxTemperature) {
  const alerts = [];

  if (weatherCode >= 95) {
    alerts.push('Thunderstorm');
  }

  if ((weatherCode >= 61 && weatherCode <= 65) || maxRainProbability >= 65) {
    alerts.push('Heavy Rain');
  }

  if (maxTemperature >= 35) {
    alerts.push('Heatwave');
  }

  if (windSpeed >= 35) {
    alerts.push('Storm');
  }

  if (weatherCode === 71 || weatherCode === 73 || weatherCode === 75) {
    alerts.push('Snow Warning');
  }

  if (maxRainProbability >= 85) {
    alerts.push('Flood Warning');
  }

  return alerts;
}

function renderAlerts(weatherCode, windSpeed, maxRainProbability, maxTemperature) {
  const alerts = getAlerts(weatherCode, windSpeed, maxRainProbability, maxTemperature);

  if (!alerts.length) {
    alertsListEl.innerHTML = '<li>No Weather Alerts</li>';
    return;
  }

  alertsListEl.innerHTML = alerts.map((message) => `<li>${message}</li>`).join('');
}

function destroyCharts() {
  Object.values(chartInstances).forEach((chart) => chart.destroy());
  Object.keys(chartInstances).forEach((key) => delete chartInstances[key]);
}

function renderHourlyForecast(hourly) {
  if (!hourly?.time?.length || typeof Chart === 'undefined') {
    return;
  }

  const labels = hourly.time.slice(0, 24).map((value) => new Date(value).toLocaleTimeString([], { hour: 'numeric' }));
  const temperatureData = hourly.temperature_2m.slice(0, 24);
  const humidityData = hourly.relative_humidity_2m?.slice(0, 24) || [];
  const windData = hourly.wind_speed_10m?.slice(0, 24) || [];
  const rainData = hourly.precipitation_probability?.slice(0, 24) || [];

  destroyCharts();

  const chartConfigs = [
    { id: 'temp-chart', data: temperatureData, label: 'Temperature', color: '#67e8f9', suggestedMax: null },
    { id: 'humidity-chart', data: humidityData, label: 'Humidity', color: '#f0abfc', suggestedMax: 100 },
    { id: 'wind-chart', data: windData, label: 'Wind', color: '#fbbf24', suggestedMax: null },
    { id: 'rain-chart', data: rainData, label: 'Rain', color: '#38bdf8', suggestedMax: 100 }
  ];

  chartConfigs.forEach((config) => {
    const canvas = document.getElementById(config.id);
    if (!canvas) return;

    chartInstances[config.id] = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: config.label,
            data: config.data,
            borderColor: config.color,
            backgroundColor: `${config.color}33`,
            fill: true,
            tension: 0.35,
            pointRadius: 2.6,
            pointHoverRadius: 4.5,
            borderWidth: 2.8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: {
          duration: 700,
          easing: 'easeOutQuart'
        },
        interaction: {
          intersect: false,
          mode: 'index'
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: 'rgba(2, 6, 23, 0.9)',
            titleColor: '#f8fafc',
            bodyColor: '#e2e8f0',
            padding: 10,
            displayColors: false,
            borderColor: 'rgba(125, 211, 252, 0.18)',
            borderWidth: 1
          }
        },
        scales: {
          x: {
            grid: { color: 'rgba(255,255,255,0.08)' },
            ticks: { color: '#dbeafe', maxTicksLimit: 6 }
          },
          y: {
            beginAtZero: true,
            suggestedMax: config.suggestedMax,
            grid: { color: 'rgba(255,255,255,0.08)' },
            ticks: { color: '#dbeafe' }
          }
        }
      }
    });
  });
}

async function fetchWeather(city) {
  const query = city.trim();
  if (!query) {
    setError('Please enter a city name.');
    return;
  }

  setLoading(true, `Fetching weather for ${query}...`);

  try {
    const geoRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`);
    if (!geoRes.ok) {
      throw new Error('The location service is unavailable right now. Please try again in a moment.');
    }

    const geoData = await geoRes.json();
    if (!geoData.results?.length) {
      throw new Error(`We couldn’t find “${query}”. Please try another city.`);
    }

    const { name, country, latitude, longitude } = geoData.results[0];
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,cloud_cover,is_day&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation_probability,weather_code&daily=sunrise,sunset,uv_index_max&forecast_days=1&timezone=auto`
    );
    if (!weatherRes.ok) {
      throw new Error('The weather service is temporarily unavailable. Please try again shortly.');
    }

    const weatherData = await weatherRes.json();
    const aqi = await fetchAirQuality(latitude, longitude);

    renderWeather({
      name,
      country,
      current: weatherData.current,
      hourly: weatherData.hourly,
      daily: weatherData.daily,
      cityName: name,
      aqi
    });
    saveRecentSearch(`${name}, ${country}`);
    setLoading(false, 'Weather loaded successfully.');
  } catch (error) {
    setError(error.message || 'Unable to load weather right now.');
    if (currentWeather) {
      currentWeather.hidden = true;
    }
  }
}

function renderWeather({ name, country, current, hourly, daily, cityName, aqi = 30 }) {
  const weather = weatherCodeMap[current?.weather_code] || { icon: '🌈', text: 'Weather', scene: 'sunny' };
  const date = new Date(current?.time || new Date());
  const aqiInfo = getAQIInfo(aqi);
  const maxRainProbability = Math.max(...(hourly?.precipitation_probability || []), 0);
  const maxTemperature = Math.max(...(hourly?.temperature_2m || []), current?.temperature_2m || 0);
  const visibilityKm = current?.visibility != null ? Math.round(current.visibility / 1000) : 10;

  locationEl.textContent = `${cityName || name || 'Location'}${country ? `, ${country}` : ''}`;
  dateEl.textContent = date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
  weatherIconEl.textContent = weather.icon;
  temperatureEl.textContent = `${Math.round(current?.temperature_2m ?? 0)}°C`;
  conditionEl.textContent = weather.text;
  feelsLikeEl.textContent = `Feels like ${Math.round(current?.apparent_temperature ?? 0)}°C`;
  feelsLikeDetailEl.textContent = `${Math.round(current?.apparent_temperature ?? 0)}°C`;
  humidityEl.textContent = `${current?.relative_humidity_2m ?? 0}%`;
  windEl.textContent = `${Math.round(current?.wind_speed_10m ?? 0)} km/h`;
  sunriseEl.textContent = daily?.sunrise?.[0] ? new Date(daily.sunrise[0]).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '--:--';
  sunsetEl.textContent = daily?.sunset?.[0] ? new Date(daily.sunset[0]).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '--:--';
  uvIndexEl.textContent = daily?.uv_index_max?.[0] != null ? daily.uv_index_max[0].toFixed(1) : '--';
  pressureEl.textContent = `${Math.round(current?.pressure_msl ?? 0)} hPa`;
  visibilityEl.textContent = `${visibilityKm} km`;
  windDirectionEl.textContent = `${Math.round(current?.wind_direction_10m ?? 0)}°`;
  cloudCoverEl.textContent = `${Math.round(current?.cloud_cover ?? 0)}%`;

  aqiValueEl.textContent = aqi;
  aqiCategoryEl.textContent = aqiInfo.category;
  aqiAdviceEl.textContent = aqiInfo.advice;
  aqiCardEl.className = `glass-card aqi-card ${aqiInfo.className}`;
  const indicator = aqiCardEl.querySelector('.aqi-indicator span');
  if (indicator) {
    indicator.style.width = `${Math.min(100, Number(aqi) || 0)}%`;
  }

  setWeatherScene(weather.scene, current?.is_day);
  renderAlerts(current?.weather_code ?? 0, current?.wind_speed_10m ?? 0, maxRainProbability, maxTemperature);
  renderHourlyForecast(hourly);

  currentWeather.hidden = false;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const city = input.value.trim();
  if (!city) {
    status.textContent = 'Please enter a city name.';
    return;
  }
  fetchWeather(city);
});

locationBtn.addEventListener('click', () => {
  if (!navigator.geolocation) {
    status.textContent = 'Geolocation is not supported on this device.';
    return;
  }

  setLoading(true, 'Finding your location...');
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      setLoading(true, 'Loading your local weather...');

      try {
        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,pressure_msl,cloud_cover,is_day&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation_probability,weather_code&daily=sunrise,sunset,uv_index_max&forecast_days=1&timezone=auto`
        );
        const weatherData = await weatherRes.json();
        const aqi = await fetchAirQuality(latitude, longitude);
        const cityName = weatherData.timezone?.split('/').pop()?.replace(/_/g, ' ') || 'Your location';
        renderWeather({
          name: cityName,
          country: '',
          current: weatherData.current,
          hourly: weatherData.hourly,
          daily: weatherData.daily,
          cityName,
          aqi
        });
        saveRecentSearch(cityName);
        setLoading(false, 'Weather loaded successfully.');
      } catch {
        setError('Unable to load your location weather.');
      }
    },
    () => {
      setError('Location access was denied.');
    }
  );
});

clearHistoryBtn.addEventListener('click', clearRecentSearches);

renderRecentSearches(getRecentSearches());
fetchWeather('London');
