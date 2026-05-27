const gpsStatus = document.getElementById('gps-status');
const weatherMap = document.getElementById('weather-map');
const forecast = document.getElementById('forecast');

function getLocation() {
  if (!navigator.geolocation) {
    gpsStatus.textContent = '⚠️ このブラウザは GPS に対応していません';
    return;
  }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const { latitude, longitude } = pos.coords;
      gpsStatus.textContent = `📍 ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
      loadWeather(latitude, longitude);
    },
    () => {
      gpsStatus.textContent = '⚠️ 現在地を取得できませんでした';
    }
  );
}

function loadWeather(lat, lon) {
  // TODO: 日本気象協会 API から天気図・予報データを取得する
  weatherMap.innerHTML = '<p class="placeholder">天気図表示（実装予定）</p>';
  forecast.innerHTML = '<p class="placeholder">予報テキスト表示（実装予定）</p>';
}

getLocation();
