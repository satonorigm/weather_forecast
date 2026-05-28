const BASE_FORECAST         = 'https://www.jma.go.jp/bosai/forecast/data/overview_forecast/';
const BASE_FORECAST_DETAIL  = 'https://www.jma.go.jp/bosai/forecast/data/forecast/';
const LIST_URL              = 'https://www.jma.go.jp/bosai/weather_map/data/list.json';
const BASE_MAP_IMG          = 'https://www.jma.go.jp/bosai/weather_map/data/png/';
const RADAR_TIMES_URL       = 'https://www.jma.go.jp/bosai/jmatile/data/nowc/targetTimes_N1.json';
const RADAR_TILE = (basetime, validtime) =>
  `https://www.jma.go.jp/bosai/jmatile/data/nowc/${basetime}/none/${validtime}/surf/hrpns/{z}/{x}/{y}.png`;

const gpsStatus     = document.getElementById('gps-status');
const forecast      = document.getElementById('forecast');
const forecastCards = document.getElementById('forecast-cards');
const radarTimeEl   = document.getElementById('radar-time');
const weatherChart  = document.getElementById('weather-chart');
const chartTimeEl   = document.getElementById('chart-time');

function weatherIcon(code) {
  const n = parseInt(code);
  if (n >= 400) return '❄️';
  if ([306, 307, 308, 406, 407].includes(n)) return '⛈️';
  if (n >= 300) return '🌧️';
  if (n >= 200) return (n <= 203) ? '⛅' : '🌦️';
  if (n === 100) return '☀️';
  if (n <= 115) return '🌤️';
  return '🌦️';
}

const DAY_LABELS = ['今日', '明日', '明後日'];

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
  let best = PREFECTURES[0], minDist = Infinity;
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

function parseRadarTime(t) {
  // t = '20260527150500'
  const mo = parseInt(t.slice(4, 6));
  const d  = parseInt(t.slice(6, 8));
  const h  = t.slice(8, 10);
  const mi = t.slice(10, 12);
  return `${mo}/${d} ${h}:${mi}`;
}

// --- Map ---
const map = L.map('weather-map', { center: [36.5, 136.0], zoom: 5 });

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
  opacity: 0.6,
}).addTo(map);

// レーダー専用 pane を OSM より高い z-index に固定。
// 同一 tilePane 内だとズーム時に重ね順が入れ替わるバグを防ぐ。
map.createPane('radarPane');
map.getPane('radarPane').style.zIndex = 250;
map.getPane('radarPane').style.pointerEvents = 'none';

// JMA hrpns タイルは偶数ズームレベルのみデータを提供する。
// 奇数ズームは透明 PNG が返るため、常に偶数にスナップする。
const JmaRadarLayer = L.TileLayer.extend({
  _clampZoom: function (zoom) {
    if (zoom % 2 !== 0) zoom -= 1;
    return L.TileLayer.prototype._clampZoom.call(this, zoom);
  },
});

let radarLayer = null;
let locationMarker = null;

async function loadWeatherChart() {
  try {
    const res = await fetch(LIST_URL);
    const list = await res.json();
    const filename = list.near.now.at(-1);
    const f = filename;
    // ファイル名は UTC — Date 経由で JST に変換
    const utc = new Date(`${f.slice(0,4)}-${f.slice(4,6)}-${f.slice(6,8)}T${f.slice(8,10)}:${f.slice(10,12)}:00Z`);
    const jst = new Intl.DateTimeFormat('ja-JP', {
      timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(utc);
    const img = document.createElement('img');
    img.src = BASE_MAP_IMG + filename;
    img.alt = '地上天気図';
    weatherChart.innerHTML = '';
    weatherChart.appendChild(img);
    chartTimeEl.textContent = jst;
  } catch {
    weatherChart.innerHTML = '<p class="placeholder">天気図の読み込みに失敗しました</p>';
  }
}

async function loadRadar() {
  try {
    const res = await fetch(RADAR_TIMES_URL);
    const times = await res.json();
    const latest = times[0];
    if (radarLayer) map.removeLayer(radarLayer);
    radarLayer = new JmaRadarLayer(RADAR_TILE(latest.basetime, latest.validtime), {
      pane: 'radarPane',
      opacity: 0.75,
      maxNativeZoom: 10,
      attribution: '© JMA',
    }).addTo(map);
    radarTimeEl.textContent = parseRadarTime(latest.validtime);
  } catch {
    radarTimeEl.textContent = '読み込み失敗';
  }
}

// --- Forecast ---
async function loadForecast(areaCode) {
  try {
    const [overviewRes, detailRes] = await Promise.all([
      fetch(BASE_FORECAST        + areaCode + '.json'),
      fetch(BASE_FORECAST_DETAIL + areaCode + '.json'),
    ]);
    const overview = await overviewRes.json();
    const detail   = await detailRes.json();

    // 3-day cards
    // 短期予報 (detail[0]) は都府県によって 2〜3 日分しかない。
    // 不足分は週間予報 (detail[1]) で補完して常に 3 日分表示する。
    const st0     = detail[0].timeSeries[0];          // 短期: 天気・風
    const st2     = detail[0].timeSeries[2];          // 短期: 気温 (09:00=最高, 00:00=最低)
    const stArea  = st0.areas[0];
    const wk0     = detail[1].timeSeries[0];          // 週間: 天気コード
    const wk1     = detail[1].timeSeries[1];          // 週間: 気温
    const wkArea  = wk0.areas[0];
    const wkTemps = wk1?.areas[0];

    // 短期気温を日付→{max, min}で保持（09:00=最高, 00:00=最低）
    const stTempMap = {};
    st2?.timeDefines.forEach((iso, i) => {
      const date = iso.slice(0, 10);
      const hour = iso.slice(11, 13);
      if (!stTempMap[date]) stTempMap[date] = {};
      if (hour === '09') stTempMap[date].max = st2.areas[0].temps[i];
      else               stTempMap[date].min = st2.areas[0].temps[i];
    });

    // 短期天気・風を日付→オブジェクトで保持
    const stMap = new Map(
      st0.timeDefines.map((iso, i) => [iso.slice(0, 10), {
        code: stArea.weatherCodes[i],
        wind: stArea.winds?.[i] ?? '',
      }])
    );

    // 週間データから 3 日分を構築（短期が存在する日は短期を優先）
    const days = wk0.timeDefines.slice(0, 3).map((iso, i) => {
      const date = iso.slice(0, 10);
      const st   = stMap.get(date);
      const stT  = stTempMap[date] ?? {};
      return {
        code:     st?.code ?? wkArea.weatherCodes[i],
        wind:     st?.wind ?? '',
        maxTemp:  stT.max  || wkTemps?.tempsMax?.[i] || '',
        minTemp:  stT.min  || wkTemps?.tempsMin?.[i] || '',
      };
    });

    const cards = days.map((day, i) => {
      const tempStr = (day.maxTemp || day.minTemp)
        ? `<span class="temp-max">${day.maxTemp || '—'}°</span><span class="temp-min">${day.minTemp || '—'}°</span>`
        : '';
      return `
        <div class="card">
          <div class="card-day">${DAY_LABELS[i] ?? ''}</div>
          <div class="card-icon">${weatherIcon(day.code)}</div>
          ${tempStr ? `<div class="card-temp">${tempStr}</div>` : ''}
          <div class="card-wind">${day.wind}</div>
        </div>`;
    }).join('');

    forecastCards.innerHTML = `<div class="cards">${cards}</div>`;

    // Overview text
    forecast.innerHTML = `
      <div class="forecast-meta">
        <span class="area-name">${overview.targetArea}</span>
        <span class="report-time">${formatDatetime(overview.reportDatetime)}</span>
      </div>
      ${overview.headlineText ? `<p class="headline">${overview.headlineText}</p>` : ''}
      <p class="forecast-text">${overview.text}</p>
    `;
  } catch {
    forecast.innerHTML = '<p class="placeholder">予報データの読み込みに失敗しました</p>';
  }
}

// --- GPS ---
function getLocation() {
  if (!navigator.geolocation) {
    gpsStatus.textContent = '⚠️ GPS 非対応';
    loadForecast('130000');
    return;
  }
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      const { latitude: lat, longitude: lon } = coords;
      const pref = nearestPrefecture(lat, lon);
      gpsStatus.textContent = `📍 ${pref[3]}付近`;
      if (locationMarker) map.removeLayer(locationMarker);
      locationMarker = L.circleMarker([lat, lon], {
        radius: 9, fillColor: '#7ec8a4', color: '#fff', weight: 2, fillOpacity: 0.9,
      }).addTo(map).bindPopup('現在地').openPopup();
      map.setView([lat, lon], 8);
      loadForecast(pref[0]);
    },
    () => {
      gpsStatus.textContent = '⚠️ 現在地を取得できませんでした（東京都の予報を表示）';
      loadForecast('130000');
    },
    { timeout: 10000, maximumAge: 60000 }
  );
}

function initApp() {
  loadWeatherChart();
  loadRadar();
  getLocation();
}

document.getElementById('refresh-btn').addEventListener('click', () => {
  const btn = document.getElementById('refresh-btn');
  btn.style.opacity = '0.4';
  btn.style.pointerEvents = 'none';
  document.getElementById('weather-chart').innerHTML = '<p class="placeholder">読み込み中…</p>';
  document.getElementById('forecast').innerHTML = '<p class="placeholder">読み込み中…</p>';
  document.getElementById('forecast-cards').innerHTML = '';
  initApp();
  setTimeout(() => {
    btn.style.opacity = '';
    btn.style.pointerEvents = '';
  }, 2000);
});

initApp();
