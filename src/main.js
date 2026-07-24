import Chart from 'chart.js/auto';
import './style.css';
import { apiConfig, fetchSolarComparison, getTimeLabel, minMaxSampleIndices } from './api.js';

const stations = [
  { id: 'east', short: 'СЭС–01', name: 'Поле «Восток»', place: 'Контур A / 2 040 панелей', nominal: 850, value: 0.74 },
  { id: 'south', short: 'СЭС–02', name: 'Поле «Юг»', place: 'Контур B / 1 728 панелей', nominal: 720, value: 0.69 },
  { id: 'steppe', short: 'СЭС–03', name: 'Поле «Степь»', place: 'Контур C / 2 640 панелей', nominal: 1100, value: 0.78 },
  { id: 'reserve', short: 'СЭС–04', name: 'Поле «Резерв»', place: 'Контур D / 1 536 панелей', nominal: 640, value: 0.66 },
];

const icons = {
  sun: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.5"/><path d="M12 2v2.2M12 19.8V22M4.9 4.9l1.6 1.6m11 11 1.6 1.6M2 12h2.2M19.8 12H22M4.9 19.1l1.6-1.6m11-11 1.6-1.6"/></svg>`,
  battery: `<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="17" height="12" rx="2"/><path d="M20 10h2v4h-2M8 9v6M5 12h6"/></svg>`,
  bolt: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13.4 2-8 11h6l-.8 9 8-12h-6l.8-8Z"/></svg>`,
  cloud: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 18h11a4 4 0 0 0 .2-8 6 6 0 0 0-11.3-1.8A4.9 4.9 0 0 0 6.5 18Z"/></svg>`,
};

const DEMO_POINT_COUNT = 144;
const PLAYBACK_DURATION_MS = 60_000;
const labels = Array.from({ length: DEMO_POINT_COUNT }, (_, index) => {
  const minutes = index * (24 * 60 / DEMO_POINT_COUNT);
  const hour = Math.floor(minutes / 60);
  const minute = Math.round(minutes % 60);
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
});
let cloudIndex = Math.round(13 / 24 * labels.length);
let totalNominal = stations.reduce((sum, station) => sum + station.nominal, 0);

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function daylight(hour) {
  if (hour < 5 || hour > 21) return 0.025;
  return Math.max(0.04, Math.sin(((hour - 5) / 16) * Math.PI));
}

function cloudLoss(hour, offset = 0) {
  if (!apiConfig.cloud) return 1;
  const [startHour, startMinute] = apiConfig.cloudStartTime.split(':').map(Number);
  const durationHours = apiConfig.cloudDurationMinutes / 60;
  const center = startHour + startMinute / 60 + durationHours / 2 + offset;
  const sigma = Math.max(durationHours / 2.6, 0.07);
  const cloudShape = Math.exp(-0.5 * Math.pow((hour - center) / sigma, 2));
  return clamp(1 - (1 - apiConfig.cloudTransmissionFactor) * cloudShape, 0.08, 1);
}

function createStationHistory(stationIndex) {
  const offset = (stationIndex - 1.5) * 0.12;
  const efficiency = 0.92 + stationIndex * 0.018;
  return labels.map((_, index) => {
    const hour = index * 24 / labels.length;
    const texture = (Math.random() - 0.5) * 0.075;
    return clamp(daylight(hour) * cloudLoss(hour, offset) * efficiency + texture, 0.02, 1);
  });
}

let histories = stations.map((_, index) => createStationHistory(index));
let averageHistory = labels.map((_, pointIndex) => (
  histories.reduce((sum, history) => sum + history[pointIndex], 0) / histories.length
));

function buildBatteryCorrection(rawSeries) {
  const battery = rawSeries.map((raw, index) => {
    const hour = index * 24 / rawSeries.length;
    const desired = daylight(hour) * 0.73;
    return clamp(desired - raw, 0, 0.34);
  });
  const corrected = rawSeries.map((raw, index) => clamp(raw + battery[index]));
  return { battery, corrected };
}

let correction = buildBatteryCorrection(averageHistory);

const app = document.querySelector('#app');

app.innerHTML = `
  <main class="console-shell">
    <header class="topbar">
      <a class="brand" href="#" aria-label="CorSolar — главная">
        <span class="brand-mark">${icons.bolt}</span>
        <span><b>COR</b>SOLAR</span>
      </a>
      <div class="top-status">
        <span class="live-dot"></span>
        <span id="connectionStatus">ДЕМО-ДАННЫЕ / ПОДКЛЮЧЕНИЕ К API</span>
        <span class="separator"></span>
        <time id="clock">--:--:--</time>
      </div>
      <span class="weather-state">${icons.cloud}<b id="weatherStatus">ОБЛАЧНОСТЬ: ПЕРЕМЕННАЯ</b></span>
    </header>

    <section class="hero-row">
      <div>
        <p class="eyebrow">СОЛНЕЧНЫЙ ЭНЕРГОКОМПЛЕКС / СЕКТОР 07</p>
        <h1>Пульт генерации</h1>
        <p class="subtitle">Четыре солнечные электростанции · генерация, просадки и компенсация АКБ</p>
      </div>
      <div class="master-output">
        <span>СРЕДНЯЯ ПРОИЗВОДИТЕЛЬНОСТЬ</span>
        <strong id="averageOutput">0,00 <small>/ 1,00</small></strong>
        <em id="totalOutput">0,00 МВт суммарно</em>
      </div>
    </section>

    <section class="scenario-console" aria-labelledby="scenarioTitle" hidden>
      <div class="playback-control">
        <div>
          <p class="eyebrow">ИНТЕРАКТИВНЫЙ СЦЕНАРИЙ / 24 ЧАСА ЗА 1 МИНУТУ</p>
          <h2 id="scenarioTitle">Проигрывание суток</h2>
        </div>
        <button class="primary-button" id="playbackButton" type="button">
          <span class="play-icon" aria-hidden="true"></span>
          <span class="button-label">ПРОИГРАТЬ СУТКИ</span>
        </button>
        <div class="playback-timeline">
          <time id="playbackTime" datetime="00:00">00:00</time>
          <progress id="playbackProgress" max="100" value="0" aria-label="Прогресс проигрывания суток"></progress>
          <span>24:00</span>
        </div>
      </div>

      <form class="cloud-console" id="cloudForm">
        <div class="cloud-console-title">
          <span class="cloud-icon">${icons.cloud}</span>
          <div>
            <p class="eyebrow">СЦЕНАРИЙ ПОГОДЫ</p>
            <h2>Настройка облака</h2>
          </div>
          <label class="cloud-toggle">
            <input id="cloudEnabled" type="checkbox" checked />
            <span aria-hidden="true"></span>
            <b>ВКЛ</b>
          </label>
        </div>
        <div class="cloud-fields" id="cloudFields">
          <label class="cloud-start-field">
            <span>НАЧАЛО</span>
            <input id="cloudStart" type="time" value="${apiConfig.cloudStartTime}" required />
          </label>
          <label>
            <span>ДЛИТЕЛЬНОСТЬ</span>
            <span class="input-with-unit">
              <input id="cloudDuration" type="number" min="1" max="360" step="1" value="${apiConfig.cloudDurationMinutes}" required />
              <b>МИН</b>
            </span>
          </label>
          <label class="range-field">
            <span>СИЛА ПРОСАДКИ <output id="cloudDropOutput">${Math.round((1 - apiConfig.cloudTransmissionFactor) * 100)}%</output></span>
            <input id="cloudDrop" type="range" min="10" max="90" step="1" value="${Math.round((1 - apiConfig.cloudTransmissionFactor) * 100)}" />
          </label>
          <button class="secondary-button" id="applyCloudButton" type="submit">ПРИМЕНИТЬ</button>
        </div>
      </form>
    </section>

    <div class="section-label"><span>01</span> ГЕНЕРАЦИЯ ПО ОБЪЕКТАМ</div>
    <section class="station-grid" aria-label="Солнечные электростанции">
      ${stations.map((station) => `
        <article class="station-card" data-station="${station.id}" style="--station-color: #ed1064">
          <div class="station-head">
            <span class="station-icon">${icons.sun}</span>
            <div>
              <span class="station-code">${station.short} / SOLAR</span>
              <h2 class="station-name">${station.name}</h2>
            </div>
            <span class="station-state"><i></i> В СЕТИ</span>
          </div>
          <div class="station-reading">
            <div class="dial" style="--value: ${Math.round(station.value * 100)}">
              <div class="dial-inner">
                <strong class="factor-value">${Math.round(station.value * 100)}%</strong>
                <span>ОТ НОМИНАЛА</span>
              </div>
            </div>
            <div class="power-reading">
              <span>ТЕКУЩАЯ ГЕНЕРАЦИЯ</span>
              <strong><span class="kw-value">${Math.round(station.value * station.nominal)}</span> <small>кВт</small></strong>
              <div class="nominal-row"><span>НОМИНАЛ</span><b class="nominal-value">${station.nominal.toLocaleString('ru-RU')} кВт</b></div>
            </div>
          </div>
          <div class="mini-chart-wrap"><canvas id="mini-${station.id}"></canvas></div>
          <footer><span class="station-place">${station.place}</span><span class="signal">СИГНАЛ <b>•••</b></span></footer>
        </article>
      `).join('')}
    </section>

    <div class="section-label"><span>02</span> СРЕДНЕЕ ПО ЧЕТЫРЁМ СТАНЦИЯМ / БЕЗ КОРРЕКЦИИ</div>
    <section class="panel average-panel">
      <div class="panel-head">
        <div>
          <p class="eyebrow">ИСХОДНАЯ ГЕНЕРАЦИЯ / 0–1</p>
          <h2>Средняя производительность</h2>
        </div>
        <div class="chart-facts">
          <span><i class="red-key"></i> ГЕНЕРАЦИЯ</span>
          <span>${icons.cloud} <b class="cloud-label" id="cloudEventLabel">ТУЧА = ПРОСАДКА</b></span>
          <b id="cloudLoss">−72%</b>
        </div>
      </div>
      <div class="average-chart-wrap"><canvas id="averageChart"></canvas></div>
    </section>

    <div class="section-label"><span>03</span> ПОСЛЕ УСТАНОВКИ НАКОПИТЕЛЯ</div>
    <section class="main-grid correction-section">
      <article class="panel chart-panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">АКБ КОМПЕНСИРУЕТ ПАДЕНИЕ ГЕНЕРАЦИИ</p>
            <h2>Генерация с поддержкой батареи</h2>
          </div>
          <div class="legend">
            <span><i style="--legend-color:#ed1064"></i>ГЕНЕРАЦИЯ</span>
            <span><i style="--legend-color:#111111"></i>АКБ</span>
            <span><i class="is-dashed" style="--legend-color:#111111"></i>КОРРЕКЦИЯ</span>
          </div>
        </div>
        <div class="main-chart-wrap"><canvas id="correctedChart"></canvas></div>
      </article>

      <aside class="panel storage-panel is-active" id="storagePanel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">МОДУЛЬ СТАБИЛИЗАЦИИ</p>
            <h2>Накопитель</h2>
          </div>
          <span class="battery-online"><i></i> АКТИВЕН</span>
        </div>
        <div class="battery-visual">
          <div class="battery-case">
            <div class="battery-fill" id="batteryFill"></div>
            <div class="battery-grid"></div>
            <span id="batteryCharge">68%</span>
          </div>
          <div class="battery-cap"></div>
        </div>
        <div class="storage-state">
          <span>КОМПЕНСАЦИЯ ПРИ ПРОСАДКЕ</span>
          <b id="batteryPower">+0,00 МВт</b>
        </div>
        <p>Когда туча снижает выработку панелей, накопитель автоматически отдаёт запас энергии и поддерживает общую мощность.</p>
        <div class="metric-list">
          <div><span>ЁМКОСТЬ</span><b id="batteryCapacityMetric">1,8 МВт·ч</b></div>
          <div><span>ЗАРЯД</span><b id="batteryChargeMetric">68%</b></div>
          <div><span>СОСТОЯНИЕ</span><b class="status-active">В РАБОТЕ</b></div>
        </div>
      </aside>
    </section>

    <footer class="footerbar">
      <span>CORSOLAR OS / BUILD 0.8.15</span>
      <span><i></i> <b id="dataSourceLabel">ОЖИДАНИЕ API</b></span>
      <span>ОБНОВЛЕНО: <b id="lastSync">—</b></span>
    </footer>
  </main>
`;

Chart.defaults.font.family = '"Share Tech Mono", "Courier New", monospace';
Chart.defaults.color = '#667085';

const cloudBandPlugin = {
  id: 'cloudBand',
  beforeDatasetsDraw(chart, _args, options) {
    if (!options?.display) return;
    const { ctx, chartArea, scales } = chart;
    if (!chartArea || !scales.x) return;
    const index = options.index ?? cloudIndex;
    const center = scales.x.getPixelForValue(index);
    const labelStep = chart.data.labels.length > 1
      ? Math.max(1, Math.abs(timeToMinutes(chart.data.labels[1]) - timeToMinutes(chart.data.labels[0])))
      : 60;
    const durationInPoints = Math.max(1, (options.durationMinutes || 15) / labelStep);
    const end = scales.x.getPixelForValue(Math.min(index + durationInPoints, chart.data.labels.length - 1));
    const width = Math.max(22, Math.abs(end - center));
    const labelCenter = Math.min(chartArea.right - 28, center + width / 2);
    ctx.save();
    ctx.fillStyle = options.color || 'rgba(237, 16, 100, 0.06)';
    ctx.fillRect(center, chartArea.top, width, chartArea.bottom - chartArea.top);
    ctx.strokeStyle = options.stroke || 'rgba(211, 19, 90, 0.5)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(center, chartArea.top);
    ctx.lineTo(center, chartArea.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = options.textColor || '#d3135a';
    ctx.font = '9px "Share Tech Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(options.label || 'ТУЧА', labelCenter, chartArea.top + 13);
    ctx.restore();
  },
};

Chart.register(cloudBandPlugin);

const gridColor = 'rgba(152, 162, 179, 0.22)';
const commonScales = {
  x: {
    grid: { color: gridColor, drawTicks: false },
    border: { color: '#d0d5dd' },
    ticks: { maxTicksLimit: 9, padding: 10, font: { size: 9 } },
  },
  y: {
    min: 0,
    max: 1,
    grid: { color: gridColor, drawTicks: false },
    border: { display: false },
    ticks: {
      stepSize: 0.25,
      padding: 10,
      font: { size: 9 },
      callback: (value) => Number(value).toFixed(2),
    },
  },
};

const tooltip = {
  backgroundColor: '#111827',
  borderColor: '#344054',
  borderWidth: 1,
  titleColor: '#ffffff',
  bodyColor: '#f2f4f7',
  padding: 11,
  displayColors: true,
  callbacks: { label: (context) => ` ${context.dataset.label}: ${context.parsed.y.toFixed(2)}` },
};

const miniCharts = stations.map((station, index) => new Chart(document.querySelector(`#mini-${station.id}`), {
  type: 'line',
  data: {
    labels,
    datasets: [{
      data: histories[index],
      borderColor: '#ed1064',
      backgroundColor: 'rgba(237, 16, 100, 0.08)',
      fill: true,
      borderWidth: 1.6,
      pointRadius: 0,
      tension: 0.26,
    }],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: { legend: { display: false }, tooltip: { enabled: false } },
    scales: { x: { display: false }, y: { display: false, min: 0, max: 1 } },
  },
}));

const averageChart = new Chart(document.querySelector('#averageChart'), {
  type: 'line',
  data: {
    labels,
    datasets: [{
      label: 'Генерация',
      data: averageHistory,
      borderColor: '#ed1064',
      backgroundColor: 'rgba(237, 16, 100, 0.08)',
      fill: true,
      borderWidth: 3,
      pointRadius: 0,
      tension: 0.25,
    }],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: { display: false },
      tooltip,
      cloudBand: {
        display: true,
        index: cloudIndex,
        durationMinutes: apiConfig.cloudDurationMinutes,
        label: 'ТУЧА / ПРОСАДКА',
      },
    },
    scales: commonScales,
  },
});

const correctedChart = new Chart(document.querySelector('#correctedChart'), {
  type: 'line',
  data: {
    labels,
    datasets: [
      {
        label: 'Генерация',
        data: averageHistory,
        borderColor: '#ed1064',
        backgroundColor: 'transparent',
        borderWidth: 3,
        pointRadius: 0,
        tension: 0.25,
      },
      {
        label: 'Батарея',
        data: correction.battery,
        borderColor: '#111111',
        backgroundColor: 'rgba(17, 17, 17, 0.07)',
        fill: true,
        borderWidth: 2.4,
        pointRadius: 0,
        tension: 0.2,
      },
      {
        label: 'Коррекция',
        data: correction.corrected,
        borderColor: '#111111',
        backgroundColor: 'transparent',
        borderWidth: 2.4,
        borderDash: [6, 4],
        pointRadius: 0,
        tension: 0.25,
      },
    ],
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: { intersect: false, mode: 'index' },
    plugins: {
      legend: { display: false },
      tooltip,
      cloudBand: {
        display: true,
        index: cloudIndex,
        durationMinutes: apiConfig.cloudDurationMinutes,
        label: 'АКБ КОМПЕНСИРУЕТ',
        color: 'rgba(36, 107, 253, 0.055)',
        stroke: 'rgba(36, 107, 253, 0.48)',
        textColor: '#174ea6',
      },
    },
    scales: commonScales,
  },
});

const playbackCharts = [...miniCharts, averageChart, correctedChart];
let playbackSources = [];
let playbackAnimationFrame = null;
let playbackProgress = 1;
let playbackStartedAt = 0;
let playbackRunning = false;
let cloudScenarioEnabled = apiConfig.cloud;

function syncPlaybackSources() {
  playbackSources = playbackCharts.map((chart) => ({
    chart,
    labels: [...chart.data.labels],
    datasets: chart.data.datasets.map((dataset) => [...dataset.data]),
  }));
}

function setPlaybackButtonState(isPlaying) {
  const button = document.querySelector('#playbackButton');
  button.classList.toggle('is-playing', isPlaying);
  button.setAttribute('aria-label', isPlaying ? 'Перезапустить проигрывание суток' : 'Проиграть сутки за одну минуту');
  button.querySelector('.button-label').textContent = isPlaying ? 'ПЕРЕЗАПУСТИТЬ' : 'ПРОИГРАТЬ СУТКИ';
}

function applyPlaybackFrame(progress, force = false) {
  playbackProgress = clamp(progress);

  playbackSources.forEach(({ chart, labels: sourceLabels, datasets }) => {
    const revealCount = playbackProgress >= 1
      ? sourceLabels.length
      : Math.max(1, Math.ceil(sourceLabels.length * playbackProgress));

    if (force || chart.$revealCount !== revealCount) {
      chart.data.labels = sourceLabels;
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        const source = datasets[datasetIndex] || [];
        dataset.data = source.map((value, index) => (index < revealCount ? value : null));
      });

      if (chart.options.plugins.cloudBand) {
        chart.options.plugins.cloudBand.display = cloudScenarioEnabled && cloudIndex < revealCount;
      }

      chart.$revealCount = revealCount;
      chart.update('none');
    }
  });

  const timelineSource = playbackSources.find(({ chart }) => chart === averageChart);
  const labelsForTime = timelineSource?.labels || labels;
  const timeIndex = Math.min(
    labelsForTime.length - 1,
    Math.max(0, Math.floor(playbackProgress * labelsForTime.length)),
  );
  const timeLabel = playbackProgress >= 1 ? '24:00' : getTimeLabel(labelsForTime[timeIndex]);
  const playbackTime = document.querySelector('#playbackTime');
  playbackTime.textContent = timeLabel;
  playbackTime.setAttribute('datetime', timeLabel);
  document.querySelector('#playbackProgress').value = playbackProgress * 100;
}

function finishPlayback() {
  playbackRunning = false;
  playbackAnimationFrame = null;
  applyPlaybackFrame(1, true);
  setPlaybackButtonState(false);
}

function tickPlayback(now) {
  const progress = (now - playbackStartedAt) / PLAYBACK_DURATION_MS;
  if (progress >= 1) {
    finishPlayback();
    return;
  }

  applyPlaybackFrame(progress);
  playbackAnimationFrame = requestAnimationFrame(tickPlayback);
}

function startPlayback(manual = false) {
  if (!playbackSources.length) return;
  if (!manual && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    finishPlayback();
    return;
  }

  if (playbackAnimationFrame) cancelAnimationFrame(playbackAnimationFrame);
  playbackRunning = true;
  playbackStartedAt = performance.now();
  applyPlaybackFrame(0, true);
  setPlaybackButtonState(true);
  playbackAnimationFrame = requestAnimationFrame(tickPlayback);
}

syncPlaybackSources();

function formatNumber(value, digits = 0) {
  return value.toLocaleString('ru-RU', { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

function numberOr(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function timeToMinutes(value) {
  const [hours, minutes] = getTimeLabel(value).split(':').map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : 0;
}

function findClosestRow(rows, targetMinutes = new Date().getHours() * 60 + new Date().getMinutes()) {
  return rows.reduce((closest, row) => (
    Math.abs(timeToMinutes(row.time) - targetMinutes) < Math.abs(timeToMinutes(closest.time) - targetMinutes)
      ? row
      : closest
  ), rows[0]);
}

function findClosestLabelIndex(chartLabels, time) {
  const target = timeToMinutes(time);
  let bestIndex = 0;
  let bestDistance = Infinity;
  chartLabels.forEach((label, index) => {
    const distance = Math.abs(timeToMinutes(label) - target);
    if (distance < bestDistance) {
      bestIndex = index;
      bestDistance = distance;
    }
  });
  return bestIndex;
}

function applyDemoScenario() {
  histories = stations.map((_, index) => createStationHistory(index));
  averageHistory = labels.map((_, pointIndex) => (
    histories.reduce((sum, history) => sum + history[pointIndex], 0) / histories.length
  ));
  correction = buildBatteryCorrection(averageHistory);
  cloudScenarioEnabled = apiConfig.cloud;
  cloudIndex = findClosestLabelIndex(labels, apiConfig.cloudStartTime);

  miniCharts.forEach((chart, index) => {
    chart.data.labels = labels;
    chart.data.datasets[0].data = histories[index];
  });
  averageChart.data.labels = labels;
  averageChart.data.datasets[0].data = averageHistory;
  correctedChart.data.labels = labels;
  correctedChart.data.datasets[0].data = averageHistory;
  correctedChart.data.datasets[1].data = correction.battery;
  correctedChart.data.datasets[2].data = correction.corrected;

  [averageChart, correctedChart].forEach((chart) => {
    chart.options.plugins.cloudBand.index = cloudIndex;
    chart.options.plugins.cloudBand.durationMinutes = apiConfig.cloudDurationMinutes;
    chart.options.plugins.cloudBand.display = apiConfig.cloud;
  });

  const cloudText = apiConfig.cloud
    ? `${apiConfig.cloudStartTime} / ${apiConfig.cloudDurationMinutes} МИН`
    : 'ОБЛАКО ОТКЛЮЧЕНО';
  const dropPercent = apiConfig.cloud ? Math.round((1 - apiConfig.cloudTransmissionFactor) * 100) : 0;
  const maxBattery = Math.max(...correction.battery) * totalNominal / 1000;
  currentApiGridPoint = null;
  document.querySelector('#cloudLoss').textContent = `−${dropPercent}%`;
  document.querySelector('#cloudEventLabel').textContent = cloudText;
  document.querySelector('#weatherStatus').textContent = apiConfig.cloud ? `ОБЛАКО: ${cloudText}` : 'ОБЛАЧНОСТЬ: НЕТ';
  document.querySelector('#batteryPower').textContent = `+${formatNumber(maxBattery, 2)} МВт`;
  document.querySelector('#connectionStatus').textContent = 'СЦЕНАРИЙ ПРИМЕНЁН / ОБНОВЛЕНИЕ API';

  syncPlaybackSources();
  applyPlaybackFrame(playbackProgress, true);
  renderSummary();
}

function renderStation(station) {
  const card = document.querySelector(`[data-station="${station.id}"]`);
  card.querySelector('.factor-value').textContent = `${Math.round(station.value * 100)}%`;
  card.querySelector('.kw-value').textContent = formatNumber(station.value * station.nominal);
  card.querySelector('.dial').style.setProperty('--value', Math.round(station.value * 100));
  card.querySelector('.station-name').textContent = station.name;
  card.querySelector('.station-code').textContent = `${station.short} / SOLAR`;
  card.querySelector('.nominal-value').textContent = `${formatNumber(station.nominal)} кВт`;
  card.querySelector('.station-place').textContent = station.place;
}

let currentApiGridPoint = null;

function renderSummary() {
  const stationTotalKw = stations.reduce((sum, station) => sum + station.value * station.nominal, 0);
  const totalKw = currentApiGridPoint
    ? numberOr(currentApiGridPoint.without_battery_total_output_kw ?? currentApiGridPoint.solar_generation_kw)
    : stationTotalKw;
  const average = totalKw / Math.max(1, totalNominal);
  const total = totalKw / 1000;
  document.querySelector('#averageOutput').innerHTML = `${average.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} <small>/ 1,00</small>`;
  document.querySelector('#totalOutput').textContent = `${total.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} МВт суммарно`;
}

function applyApiData(data) {
  const objects = data.objects.slice(0, stations.length);
  const timelinesById = new Map(
    data.object_generation_timelines.map((timeline) => [String(timeline.id), timeline]),
  );

  objects.forEach((source, index) => {
    const station = stations[index];
    const objectTimeline = timelinesById.get(String(source.id)) || data.object_generation_timelines[index];
    const rows = Array.isArray(objectTimeline?.timeline) ? objectTimeline.timeline : [];
    const nominal = numberOr(source.solar_power_kw ?? objectTimeline?.solar_power_kw, station.nominal);

    station.name = source.name || objectTimeline?.name || station.name;
    station.short = String(source.id || `СЭС–0${index + 1}`).toUpperCase();
    station.nominal = nominal;
    station.place = source.battery_capacity_kwh
      ? `СОЛНЕЧНЫЙ ОБЪЕКТ / АКБ ${formatNumber(numberOr(source.battery_capacity_kwh))} кВт·ч`
      : 'СОЛНЕЧНЫЙ ОБЪЕКТ / ДАННЫЕ API';

    if (rows.length) {
      const currentRow = findClosestRow(rows);
      station.value = clamp(numberOr(currentRow.solar_generation_kw) / Math.max(1, nominal));
      const indices = minMaxSampleIndices(
        rows,
        apiConfig.maxChartPoints,
        (row) => numberOr(row.solar_generation_kw),
      );
      miniCharts[index].data.labels = indices.map((rowIndex) => getTimeLabel(rows[rowIndex].time));
      miniCharts[index].data.datasets[0].data = indices.map((rowIndex) => (
        clamp(numberOr(rows[rowIndex].solar_generation_kw) / Math.max(1, nominal))
      ));
      miniCharts[index].update('none');
    }

    renderStation(station);
  });

  totalNominal = numberOr(
    data.with_battery_summary?.installed_power_kw,
    stations.reduce((sum, station) => sum + station.nominal, 0),
  );

  const gridRows = data.grid_timeline;
  if (!gridRows.length) throw new Error('grid_timeline пуст');
  const gridIndices = minMaxSampleIndices(
    gridRows,
    apiConfig.maxChartPoints,
    (row) => numberOr(row.without_battery_total_output_kw ?? row.solar_generation_kw),
  );
  const sampledRows = gridIndices.map((index) => gridRows[index]);
  const apiLabels = sampledRows.map((row) => getTimeLabel(row.time));
  const rawSeries = sampledRows.map((row) => clamp(
    numberOr(row.without_battery_total_output_kw ?? row.solar_generation_kw) / Math.max(1, totalNominal),
  ));
  const batterySeries = sampledRows.map((row) => clamp(
    numberOr(row.battery_output_kw) / Math.max(1, totalNominal),
  ));
  const correctedSeries = sampledRows.map((row) => clamp(
    numberOr(row.with_battery_total_output_kw) / Math.max(1, totalNominal),
  ));

  averageChart.data.labels = apiLabels;
  averageChart.data.datasets[0].data = rawSeries;
  correctedChart.data.labels = apiLabels;
  correctedChart.data.datasets[0].data = rawSeries;
  correctedChart.data.datasets[1].data = batterySeries;
  correctedChart.data.datasets[2].data = correctedSeries;

  const cloudEvent = data.cloud_event || {};
  cloudScenarioEnabled = data.cloud_enabled !== false;
  cloudIndex = findClosestLabelIndex(apiLabels, cloudEvent.start_time || apiConfig.cloudStartTime);
  const cloudDuration = numberOr(cloudEvent.duration_minutes, apiConfig.cloudDurationMinutes);
  const cloudText = data.cloud_enabled === false
    ? 'ОБЛАКО ОТКЛЮЧЕНО'
    : `${getTimeLabel(cloudEvent.start_time || apiConfig.cloudStartTime)} / ${cloudDuration} МИН`;
  averageChart.options.plugins.cloudBand.index = cloudIndex;
  averageChart.options.plugins.cloudBand.durationMinutes = cloudDuration;
  averageChart.options.plugins.cloudBand.label = 'ТУЧА / ПРОСАДКА';
  correctedChart.options.plugins.cloudBand.index = cloudIndex;
  correctedChart.options.plugins.cloudBand.durationMinutes = cloudDuration;
  correctedChart.options.plugins.cloudBand.label = 'АКБ КОМПЕНСИРУЕТ';
  syncPlaybackSources();
  applyPlaybackFrame(playbackProgress, true);

  const maxDropKw = numberOr(
    data.without_battery_summary?.max_drop_kw,
    Math.max(...gridRows.map((row) => numberOr(row.without_battery_drop_kw))),
  );
  const maxBatteryKw = Math.max(...gridRows.map((row) => numberOr(row.battery_output_kw)));
  const currentGridRow = findClosestRow(gridRows);
  currentApiGridPoint = currentGridRow;
  const charge = clamp(numberOr(currentGridRow.battery_soc_percent, 68) / 100) * 100;
  const capacity = numberOr(
    data.with_battery_summary?.battery_capacity_kwh,
    objects.reduce((sum, object) => sum + numberOr(object.battery_capacity_kwh), 0),
  );

  document.querySelector('#cloudLoss').textContent = `−${Math.round(maxDropKw / Math.max(1, totalNominal) * 100)}%`;
  document.querySelector('#cloudEventLabel').textContent = cloudText;
  document.querySelector('#weatherStatus').textContent = data.cloud_enabled === false ? 'ОБЛАЧНОСТЬ: НЕТ' : `ОБЛАКО: ${cloudText}`;
  document.querySelector('#batteryPower').textContent = `+${formatNumber(maxBatteryKw / 1000, 2)} МВт`;
  document.querySelector('#batteryCharge').textContent = `${Math.round(charge)}%`;
  document.querySelector('#batteryChargeMetric').textContent = `${Math.round(charge)}%`;
  document.querySelector('#batteryFill').style.height = `${charge}%`;
  document.querySelector('#batteryCapacityMetric').textContent = `${formatNumber(capacity / 1000, 2)} МВт·ч`;
  document.querySelector('#connectionStatus').textContent = `${objects.length} СТАНЦИИ / API В СЕТИ`;
  document.querySelector('#connectionStatus').classList.remove('is-error');
  document.querySelector('#dataSourceLabel').textContent = `API · ${numberOr(data.data_interval_minutes, 1)} МИН · ${gridRows.length} ТОЧЕК`;
  document.querySelector('#lastSync').textContent = new Date().toLocaleTimeString('ru-RU');

  renderSummary();
}

let apiRequestController;

async function refreshApi() {
  apiRequestController?.abort();
  apiRequestController = new AbortController();
  const timeoutId = setTimeout(() => apiRequestController.abort(), 15_000);
  const connectionStatus = document.querySelector('#connectionStatus');
  connectionStatus.textContent = 'ОБНОВЛЕНИЕ ДАННЫХ API…';

  try {
    const data = await fetchSolarComparison(apiRequestController.signal);
    applyApiData(data);
  } catch (error) {
    if (error.name === 'AbortError') {
      connectionStatus.textContent = 'API: ПРЕВЫШЕНО ВРЕМЯ ОЖИДАНИЯ';
    } else {
      connectionStatus.textContent = `API НЕДОСТУПНО · ДЕМО-РЕЖИМ`;
    }
    connectionStatus.classList.add('is-error');
    document.querySelector('#dataSourceLabel').textContent = 'ДЕМО-ДАННЫЕ / ОЖИДАНИЕ API';
    console.warn('Не удалось обновить CorSolar:', error);
  } finally {
    clearTimeout(timeoutId);
  }
}

function updateClock() {
  document.querySelector('#clock').textContent = new Date().toLocaleTimeString('ru-RU');
}

const cloudForm = document.querySelector('#cloudForm');
const cloudEnabledInput = document.querySelector('#cloudEnabled');
const cloudFields = document.querySelector('#cloudFields');
const cloudStartInput = document.querySelector('#cloudStart');
const cloudDurationInput = document.querySelector('#cloudDuration');
const cloudDropInput = document.querySelector('#cloudDrop');
const cloudDropOutput = document.querySelector('#cloudDropOutput');
const applyCloudButton = document.querySelector('#applyCloudButton');

function updateCloudControlsState() {
  const enabled = cloudEnabledInput.checked;
  cloudFields.classList.toggle('is-disabled', !enabled);
  cloudEnabledInput.parentElement.querySelector('b').textContent = enabled ? 'ВКЛ' : 'ВЫКЛ';
  [cloudStartInput, cloudDurationInput, cloudDropInput].forEach((input) => {
    input.disabled = !enabled;
  });
}

cloudEnabledInput.addEventListener('change', updateCloudControlsState);
cloudDropInput.addEventListener('input', () => {
  cloudDropOutput.textContent = `${cloudDropInput.value}%`;
});
document.querySelector('#playbackButton').addEventListener('click', () => startPlayback(true));

cloudForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  apiConfig.cloud = cloudEnabledInput.checked;
  apiConfig.cloudStartTime = cloudStartInput.value || '13:00';
  apiConfig.cloudDurationMinutes = clamp(numberOr(cloudDurationInput.value, 15), 1, 360);
  apiConfig.cloudTransmissionFactor = clamp(1 - numberOr(cloudDropInput.value, 52) / 100, 0.1, 0.9);
  cloudDurationInput.value = apiConfig.cloudDurationMinutes;

  applyCloudButton.disabled = true;
  applyCloudButton.textContent = 'ПРИМЕНЯЕМ…';
  applyDemoScenario();
  startPlayback(true);

  try {
    await refreshApi();
  } finally {
    applyCloudButton.disabled = false;
    applyCloudButton.textContent = 'ПРИМЕНИТЬ';
  }
});

updateCloudControlsState();
document.querySelector('#batteryFill').style.height = '68%';

stations.forEach(renderStation);
applyDemoScenario();
updateClock();
setInterval(updateClock, 1000);
startPlayback();
refreshApi();
setInterval(refreshApi, apiConfig.pollIntervalMs);
