// Разметка приложения. Секции вынесены в отдельные функции, чтобы
// шаблон читался по блокам экрана, а не сплошной простынёй.

import { apiConfig } from '../core/config.js';
import { stations } from '../data/stations.js';
import { icons } from './icons.js';

function renderTopbar() {
  return `
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
  `;
}

function renderHero() {
  return `
    <section class="hero-row">
      <div>
        <p class="eyebrow">СОЛНЕЧНЫЙ ЭНЕРГОКОМПЛЕКС / СЕКТОР 07</p>
        <h1>Пульт генерации</h1>
        <p class="subtitle">Четыре солнечные электростанции · генерация, просадки и компенсация АКБ</p>
      </div>
      <div class="master-output">
        <span>СУММАРНАЯ ГЕНЕРАЦИЯ</span>
        <strong id="averageOutput">0 <small>кВт</small></strong>
        <em id="totalOutput">установленная мощность: 0 кВт</em>
      </div>
    </section>
  `;
}

function renderScenarioConsole() {
  const dropPercent = Math.round((1 - apiConfig.cloudTransmissionFactor) * 100);

  return `
    <section class="scenario-console" aria-labelledby="scenarioTitle">
      <div class="playback-control">
        <div>
          <p class="eyebrow">ПАНЕЛЬ УПРАВЛЕНИЯ / ДАННЫЕ API</p>
          <h2 id="scenarioTitle">Обновление графиков</h2>
        </div>
        <button class="primary-button" id="playbackButton" type="button">
          <span class="reload-icon" aria-hidden="true">↻</span>
          <span class="button-label">ПЕРЕЗАГРУЗИТЬ ГРАФИК</span>
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
            <span>СИЛА ПРОСАДКИ <output id="cloudDropOutput">${dropPercent}%</output></span>
            <input id="cloudDrop" type="range" min="10" max="90" step="1" value="${dropPercent}" />
          </label>
          <button class="secondary-button" id="applyCloudButton" type="submit">ПРИМЕНИТЬ</button>
        </div>
      </form>

      ${renderBatteryConsole()}
    </section>
  `;
}

function renderBatteryConsole() {
  return `
    <form class="battery-console" id="batteryForm">
      <div class="cloud-console-title">
        <span class="cloud-icon battery-icon">${icons.battery}</span>
        <div>
          <p class="eyebrow">ПАРАМЕТРЫ НАКОПИТЕЛЯ</p>
          <h2>Настройка АКБ</h2>
        </div>
      </div>
      <div class="battery-fields">
        <label>
          <span>ЁМКОСТЬ</span>
          <span class="input-with-unit">
            <input id="batteryCapacity" type="number" min="0" max="100000" step="10" value="${apiConfig.batteryCapacityKwh}" />
            <b>кВт·ч</b>
          </span>
        </label>
        <label>
          <span>МАКС. РАЗРЯД</span>
          <span class="input-with-unit">
            <input id="batteryDischarge" type="number" min="0" max="10000" step="5" value="${apiConfig.maxDischargePowerKw}" />
            <b>кВт</b>
          </span>
        </label>
        <label>
          <span>МАКС. ЗАРЯД</span>
          <span class="input-with-unit">
            <input id="batteryCharge" type="number" min="0" max="10000" step="5" value="${apiConfig.maxChargePowerKw}" />
            <b>кВт</b>
          </span>
        </label>
        <label class="range-field">
          <span>НАЧАЛЬНЫЙ ЗАРЯД <output id="batterySocOutput">${apiConfig.initialSocPercent}%</output></span>
          <input id="batterySoc" type="range" min="0" max="100" step="1" value="${apiConfig.initialSocPercent}" />
        </label>
        <label class="range-field">
          <span>МИН. РАЗРЯД <output id="batteryMinSocOutput">${apiConfig.minSocPercent}%</output></span>
          <input id="batteryMinSoc" type="range" min="0" max="100" step="1" value="${apiConfig.minSocPercent}" />
        </label>
        <button class="secondary-button" id="applyBatteryButton" type="submit">ПРИМЕНИТЬ</button>
      </div>
      <p class="battery-hint" id="batteryHint">Резерв: <b>0</b> кВт·ч доступно до нижнего порога</p>
    </form>
  `;
}

function renderStationCard(station) {
  const percent = Math.round(station.value * 100);

  return `
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
        <div class="dial" style="--value: ${percent}">
          <div class="dial-inner">
            <strong class="factor-value">${percent}%</strong>
            <span>ОТ НОМИНАЛА</span>
          </div>
        </div>
        <div class="power-reading">
          <span>ТЕКУЩАЯ ГЕНЕРАЦИЯ</span>
          <strong><span class="kw-value">${Math.round(station.value * station.nominal)}</span> <small>кВт</small></strong>
          <div class="nominal-row"><span>НОМИНАЛ</span><b class="nominal-value">${station.nominal.toLocaleString('ru-RU')} кВт</b></div>
        </div>
      </div>
      <div class="mini-chart-legend" aria-hidden="true">
        <span><i class="is-raw"></i> БЕЗ КОРРЕКЦИИ</span>
        <span><i class="is-corrected"></i> С КОРРЕКЦИЕЙ</span>
      </div>
      <div class="mini-chart-wrap"><canvas id="mini-${station.id}"></canvas></div>
      <footer><span class="station-place">${station.place}</span><span class="signal">СИГНАЛ <b>•••</b></span></footer>
    </article>
  `;
}

function renderStationGrid() {
  return `
    <div class="section-label"><span>01</span> ГЕНЕРАЦИЯ ПО ОБЪЕКТАМ</div>
    <section class="station-grid" aria-label="Солнечные электростанции">
      ${stations.map(renderStationCard).join('')}
    </section>
  `;
}

function renderAveragePanel() {
  return `
    <div class="section-label"><span>02</span> СУММА ПО ЧЕТЫРЁМ ОБЪЕКТАМ / БЕЗ КОРРЕКЦИИ</div>
    <section class="panel average-panel">
      <div class="panel-head">
        <div>
          <p class="eyebrow">ИСХОДНАЯ ГЕНЕРАЦИЯ / МОЩНОСТЬ, кВт</p>
          <h2>Суммарная генерация объектов</h2>
        </div>
        <div class="chart-facts">
          <span><i class="red-key"></i> БЕЗ КОРРЕКЦИИ</span>
          <span>${icons.cloud} <b class="cloud-label" id="cloudEventLabel">ТУЧА = ПРОСАДКА</b></span>
          <b id="cloudLoss">−72%</b>
        </div>
      </div>
      <div class="average-chart-wrap"><canvas id="averageChart"></canvas></div>
    </section>
  `;
}

function renderCorrectionSection() {
  return `
    <div class="section-label"><span>03</span> ПОСЛЕ УСТАНОВКИ НАКОПИТЕЛЯ</div>
    <section class="main-grid correction-section">
      <article class="panel chart-panel">
        <div class="panel-head">
          <div>
            <p class="eyebrow">СУММА ПО ОБЪЕКТАМ / МОЩНОСТЬ, кВт</p>
            <h2>Суммарная генерация с коррекцией и без</h2>
          </div>
          <div class="legend">
            <span><i style="--legend-color:#ed1064"></i>БЕЗ КОРРЕКЦИИ</span>
            <span><i style="--legend-color:#111111"></i>С КОРРЕКЦИЕЙ</span>
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
  `;
}

function renderFooter() {
  return `
    <footer class="footerbar">
      <span>CORSOLAR OS / BUILD 0.8.15</span>
      <span><i></i> <b id="dataSourceLabel">ОЖИДАНИЕ API</b></span>
      <span>ОБНОВЛЕНО: <b id="lastSync">—</b></span>
    </footer>
  `;
}

export function renderApp(root) {
  root.innerHTML = `
    <main class="console-shell">
      ${renderTopbar()}
      ${renderHero()}
      ${renderScenarioConsole()}
      ${renderStationGrid()}
      ${renderAveragePanel()}
      ${renderCorrectionSection()}
      ${renderFooter()}
    </main>
  `;
}
