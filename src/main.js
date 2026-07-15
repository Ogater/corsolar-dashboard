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

const labels = Array.from({ length: 24 }, (_, hour) => `${String(hour).padStart(2, '0')}:00`);
let cloudIndex = 15;
let totalNominal = stations.reduce((sum, station) => sum + station.nominal, 0);

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

function daylight(hour) {
  if (hour < 5 || hour > 21) return 0.025;
  return Math.max(0.04, Math.sin(((hour - 5) / 16) * Math.PI));
}

function cloudLoss(hour, offset = 0) {
  const morningCloud = 0.28 * Math.exp(-Math.pow(hour - (9 + offset), 2) / 1.5);
  const mainCloud = 0.73 * Math.exp(-Math.pow(hour - (15 + offset), 2) / 0.75);
  return clamp(1 - morningCloud - mainCloud, 0.18, 1);
}

function createStationHistory(stationIndex) {
  const offset = (stationIndex - 1.5) * 0.12;
  const efficiency = 0.92 + stationIndex * 0.018;
  return labels.map((_, hour) => {
    const texture = (Math.random() - 0.5) * 0.075;
    return clamp(daylight(hour) * cloudLoss(hour, offset) * efficiency + texture, 0.02, 1);
  });
}

const histories = stations.map((_, index) => createStationHistory(index));
const averageHistory = labels.map((_, pointIndex) => (
  histories.reduce((sum, history) => sum + history[pointIndex], 0) / histories.length
));

function buildBatteryCorrection(rawSeries) {
  const battery = rawSeries.map((raw, hour) => {
    const desired = daylight(hour) * 0.73;
    return clamp(desired - raw, 0, 0.34);
  });
  const corrected = rawSeries.map((raw, index) => clamp(raw + battery[index]));
  return { battery, corrected };
}

const correction = buildBatteryCorrection(averageHistory);

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

    <div class="section-label"><span>01</span> ГЕНЕРАЦИЯ ПО ОБЪЕКТАМ</div>
    <section class="station-grid" aria-label="Солнечные электростанции">
      ${stations.map((station) => `
        <article class="station-card" data-station="${station.id}" style="--station-color: #e5b44e">
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
            <span><i style="--legend-color:#e3604f"></i>ГЕНЕРАЦИЯ</span>
            <span><i style="--legend-color:#e5b44e"></i>БАТАРЕЯ</span>
            <span><i style="--legend-color:#f0e6c7"></i>ИТОГ</span>
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
Chart.defaults.color = '#7f897c';

const cloudBandPlugin = {
  id: 'cloudBand',
  beforeDatasetsDraw(chart, _args, options) {
    if (!options?.display) return;
    const { ctx, chartArea, scales } = chart;
    if (!chartArea || !scales.x) return;
    const index = options.index ?? cloudIndex;
    const center = scales.x.getPixelForValue(index);
    const next = scales.x.getPixelForValue(Math.min(index + 1, chart.data.labels.length - 1));
    const width = Math.max(22, Math.abs(next - center) * 1.7);
    ctx.save();
    ctx.fillStyle = options.color || 'rgba(227, 96, 79, 0.075)';
    ctx.fillRect(center - width / 2, chartArea.top, width, chartArea.bottom - chartArea.top);
    ctx.strokeStyle = options.stroke || 'rgba(227, 96, 79, 0.42)';
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(center, chartArea.top);
    ctx.lineTo(center, chartArea.bottom);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = options.textColor || '#c98779';
    ctx.font = '9px "Share Tech Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText(options.label || 'ТУЧА', center, chartArea.top + 13);
    ctx.restore();
  },
};

Chart.register(cloudBandPlugin);

const gridColor = 'rgba(183, 194, 169, 0.1)';
const commonScales = {
  x: {
    grid: { color: gridColor, drawTicks: false },
    border: { color: 'rgba(183, 194, 169, 0.22)' },
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
  backgroundColor: '#1b201b',
  borderColor: '#4b5548',
  borderWidth: 1,
  titleColor: '#f0e6c7',
  bodyColor: '#b7c2a9',
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
      borderColor: '#e3604f',
      backgroundColor: 'rgba(227, 96, 79, 0.09)',
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
      borderColor: '#e3604f',
      backgroundColor: 'rgba(227, 96, 79, 0.1)',
      fill: true,
      borderWidth: 2.2,
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
      cloudBand: { display: true, index: cloudIndex, label: 'ТУЧА / ПРОСАДКА' },
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
        borderColor: '#e3604f',
        backgroundColor: 'transparent',
        borderWidth: 1.7,
        pointRadius: 0,
        tension: 0.25,
      },
      {
        label: 'Батарея',
        data: correction.battery,
        borderColor: '#e5b44e',
        backgroundColor: 'rgba(229, 180, 78, 0.12)',
        fill: true,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.2,
      },
      {
        label: 'Итог',
        data: correction.corrected,
        borderColor: '#f0e6c7',
        backgroundColor: 'transparent',
        borderWidth: 2.3,
        borderDash: [7, 4],
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
        label: 'АКБ КОМПЕНСИРУЕТ',
        color: 'rgba(229, 180, 78, 0.065)',
        stroke: 'rgba(229, 180, 78, 0.42)',
        textColor: '#d8b96e',
      },
    },
    scales: commonScales,
  },
});

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
  cloudIndex = findClosestLabelIndex(apiLabels, cloudEvent.start_time || apiConfig.cloudStartTime);
  const cloudText = data.cloud_enabled === false
    ? 'ОБЛАКО ОТКЛЮЧЕНО'
    : `${getTimeLabel(cloudEvent.start_time || apiConfig.cloudStartTime)} / ${numberOr(cloudEvent.duration_minutes, 15)} МИН`;
  averageChart.options.plugins.cloudBand.index = cloudIndex;
  averageChart.options.plugins.cloudBand.label = 'ТУЧА / ПРОСАДКА';
  correctedChart.options.plugins.cloudBand.index = cloudIndex;
  correctedChart.options.plugins.cloudBand.label = 'АКБ КОМПЕНСИРУЕТ';
  averageChart.update('none');
  correctedChart.update('none');

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

const deepestLoss = Math.round((1 - averageHistory[cloudIndex] / daylight(cloudIndex)) * 100);
document.querySelector('#cloudLoss').textContent = `−${deepestLoss}%`;
const maxBattery = Math.max(...correction.battery) * totalNominal / 1000;
document.querySelector('#batteryPower').textContent = `+${maxBattery.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} МВт`;
document.querySelector('#batteryFill').style.height = '68%';

stations.forEach(renderStation);
renderSummary();
updateClock();
setInterval(updateClock, 1000);
refreshApi();
setInterval(refreshApi, apiConfig.pollIntervalMs);
