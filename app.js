const BASE_FORECAST = 'https://www.jma.go.jp/bosai/forecast/data/overview_forecast/';
const LIST_URL = 'https://www.jma.go.jp/bosai/weather_map/data/list.json';
const BASE_MAP_IMG = 'https://www.jma.go.jp/bosai/weather_map/data/png/';

const gpsStatus = document.getElementById('gps-status');
const weatherMap = document.getElementById('weather-map');
const forecast = document.getElementById('forecast');

// [area_code, lat, lon, name]
const PREFECTURES = [
  ['016000', 43.06, 141.35, '北海道'],
  ['020000', 40.82, 140.74, '青森県'],
  ['030000', 39.70, 141.15, '岩手県'],
  ['040000', 38.27, 140.87, '宮城県'],
  ['050000', 39.72, 140.10, '秋田県'],
  ['060000', 38.24, 140.36, '山形県'],
  ['070000', 37.75, 140.47, '福島県'],
  ['080000', 36.34, 140.45, '茨城県'],
  ['090000', 36.57, 139.88, '栃木県'],
  ['100000', 36.39, 139.06, '群馬県'],
  ['110000', 35.86, 139.65, '埼玉県'],
  ['120000', 35.61, 140.12, '千葉県'],
  ['130000', 35.69, 139.69, '東京都'],
  ['140000', 35.45, 139.64, '神奈川県'],
  ['150000', 37.90, 139.02, '新潟県'],
  ['160000', 36.70, 137.21, '富山県'],
  ['170000', 36.59, 136.63, '石川県'],
  ['180000', 36.07, 136.22, '福井県'],
  ['190000', 35.66, 138.57, '山梨県'],
  ['200000', 36.65, 138.18, '長野県'],
  ['210000', 35.39, 136.72, '岐阜県'],
  ['220000', 34.98, 138.38, '静岡県'],
  ['230000', 35.18, 136.91, '愛知県'],
  ['240000', 34.73, 136.51, '三重県'],
  ['250000', 35.00, 135.87, '滋賀県'],
  ['260000', 35.02, 135.76, '京都府'],
  ['270000', 34.69, 135.50, '大阪府'],
  ['280000', 34.69, 135.18, '兵庫県'],
  ['290000', 34.69, 135.83, '奈良県'],
  ['300000', 34.22, 135.17, '和歌山県'],
  ['310000', 35.50, 134.24, '鳥取県'],
  ['320000', 35.47, 133.05, '島根県'],
  ['330000', 34.66, 133.93, '岡山県'],
  ['340000', 34.40, 132.46, '広島県'],
  ['350000', 34.19, 131.47, '山口県'],
  ['360000', 34.07, 134.56, '徳島県'],
  ['370000', 34.34, 134.04, '香川県'],
  ['380000', 33.84, 132.77, '愛媛県'],
  ['390000', 33.56, 133.53, '高知県'],
  ['400000', 33.61, 130.42, '福岡県'],
  ['410000', 33.25, 130.30, '佐賀県'],
  ['420000', 32.74, 129.87, '長崎県'],
  ['430000', 32.79, 130.74, '熊本県'],
  ['440000', 33.24, 131.61, '大分県'],
  ['450000', 31.91, 131.42, '宮崎県'],
  ['460100', 31.56, 130.56, '鹿児島県'],
  ['471000', 26.21, 127.68, '沖縄県'],
];

function nearestPrefecture(lat, lon) {
  let best = PREFECTURES[0];
  let minDist = Infinity;
  for (const p of PREFECTURES) {
    const d = Math.hypot(lat - p[1], lon - p[2]);
    if (d < minDist) { minDist = d; best = p; }
  }
  return best;
}

function formatDatetime(iso) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}月${d.getDate()}日 ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')} 発表`;
}

async function loadWeatherMap() {
  try {
    const res = await fetch(LIST_URL);
    const list = await res.json();
    const filename = list.near.now.at(-1);
    const img = document.createElement('img');
    img.src = BASE_MAP_IMG + filename;
    img.alt = '最新天気図';
    weatherMap.innerHTML = '';
    weatherMap.appendChild(img);
  } catch {
    weatherMap.innerHTML = '<p class="placeholder">天気図の読み込みに失敗しました</p>';
  }
}

async function loadForecast(areaCode) {
  try {
    const res = await fetch(BASE_FORECAST + areaCode + '.json');
    const data = await res.json();
    forecast.innerHTML = `
      <div class="forecast-meta">
        <span class="area-name">${data.targetArea}</span>
        <span class="report-time">${formatDatetime(data.reportDatetime)}</span>
      </div>
      ${data.headlineText ? `<p class="headline">${data.headlineText}</p>` : ''}
      <p class="forecast-text">${data.text}</p>
    `;
  } catch {
    forecast.innerHTML = '<p class="placeholder">予報データの読み込みに失敗しました</p>';
  }
}

function getLocation() {
  if (!navigator.geolocation) {
    gpsStatus.textContent = '⚠️ GPS 非対応';
    loadForecast('130000');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      const pref = nearestPrefecture(coords.latitude, coords.longitude);
      gpsStatus.textContent = `📍 ${pref[3]}`;
      loadForecast(pref[0]);
    },
    () => {
      gpsStatus.textContent = '⚠️ 現在地を取得できませんでした（東京都の予報を表示）';
      loadForecast('130000');
    }
  );
}

loadWeatherMap();
getLocation();
