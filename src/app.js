// Сборка приложения: связывает данные, графики и интерфейс.

import { apiConfig } from './core/config.js';
import { findClosestLabelIndex, numberOr } from './core/utils.js';
import { fetchSolarComparison } from './data/api.js';
import { buildLabels, createDemoScenario } from './data/demoScenario.js';
import { mapApiResponse } from './data/mapApiResponse.js';
import { thinSeries } from './data/series.js';
import { stations, sumNominal } from './data/stations.js';
import {
  createAverageChart,
  createCorrectedChart,
  createMiniCharts,
} from './charts/createCharts.js';
import { createPlayback } from './charts/playback.js';
import { initBatteryControls } from './ui/batteryControls.js';
import { initCloudControls } from './ui/cloudControls.js';
import {
  bindDashboard,
  renderStation,
  renderSummary,
  setBattery,
  setCloudInfo,
  setConnectionStatus,
  setDataSource,
  setLastSync,
  setPlaybackButtonState,
  setPlaybackFrame,
  startClock,
} from './ui/dashboard.js';
import { renderApp } from './ui/template.js';

const API_TIMEOUT_MS = 15_000;

export function startApp(root) {
  renderApp(root);
  bindDashboard();

  const state = {
    labels: buildLabels(),
    totalNominal: sumNominal(),
    currentGridRow: null,
    cloud: { enabled: apiConfig.cloud, index: 0 },
  };

  const demo = createDemoScenario(state.labels);
  state.cloud.index = findClosestLabelIndex(state.labels, apiConfig.cloudStartTime);

  const miniCharts = createMiniCharts(state.labels, demo.histories, demo.correctedHistories);
  const averageChart = createAverageChart(state.labels, demo.totalGeneration, state.cloud.index);
  const correctedChart = createCorrectedChart(
    state.labels,
    demo.totalGeneration,
    { corrected: demo.correction.corrected },
    state.cloud.index,
  );

  const playback = createPlayback({
    charts: [...miniCharts, averageChart, correctedChart],
    timelineChart: averageChart,
    getCloudState: () => state.cloud,
    onFrame: ({ progress, label, finished }) => {
      setPlaybackFrame({ progress, label });
      if (finished) setPlaybackButtonState(false);
    },
  });

  function startPlayback(manual = false) {
    if (manual) setPlaybackButtonState(true);
    playback.start(manual);
  }

  function updateSummaryFromState() {
    const totalKw = state.currentGridRow
      ? numberOr(state.currentGridRow.with_battery_total_output_kw
        ?? state.currentGridRow.solar_generation_kw)
      : stations.reduce((sum, station) => sum + station.value * station.nominal, 0);
    renderSummary({ totalKw, totalNominal: state.totalNominal });
  }

  function applyDemoScenario() {
    const scenario = createDemoScenario(state.labels);
    state.cloud = {
      enabled: apiConfig.cloud,
      index: findClosestLabelIndex(state.labels, apiConfig.cloudStartTime),
    };
    state.currentGridRow = null;

    miniCharts.forEach((chart, index) => {
      const thinned = thinSeries(scenario.histories[index], apiConfig.maxMiniChartPoints);
      chart.data.labels = thinned.indices.map((pointIndex) => state.labels[pointIndex]);
      chart.data.datasets[0].data = thinned.values;
      chart.data.datasets[1].data = thinned.indices.map(
        (pointIndex) => scenario.correctedHistories[index][pointIndex],
      );
    });
    averageChart.data.labels = state.labels;
    averageChart.data.datasets[0].data = scenario.totalGeneration;
    correctedChart.data.labels = state.labels;
    correctedChart.data.datasets[0].data = scenario.totalGeneration;
    correctedChart.data.datasets[1].data = scenario.correction.corrected;

    [averageChart, correctedChart].forEach((chart) => {
      Object.assign(chart.options.plugins.cloudBand, {
        index: state.cloud.index,
        durationMinutes: apiConfig.cloudDurationMinutes,
        display: apiConfig.cloud,
      });
    });

    const label = apiConfig.cloud
      ? `${apiConfig.cloudStartTime} / ${apiConfig.cloudDurationMinutes} МИН`
      : 'ОБЛАКО ОТКЛЮЧЕНО';
    setCloudInfo({
      label,
      dropPercent: apiConfig.cloud ? Math.round((1 - apiConfig.cloudTransmissionFactor) * 100) : 0,
      weather: apiConfig.cloud ? `ОБЛАКО: ${label}` : 'ОБЛАЧНОСТЬ: НЕТ',
    });
    setBattery({ powerMw: Math.max(...scenario.correction.battery) * state.totalNominal / 1000 });
    setConnectionStatus('СЦЕНАРИЙ ПРИМЕНЁН / ОБНОВЛЕНИЕ API');

    playback.syncSources();
    playback.applyFrame(playback.getProgress(), true);
    updateSummaryFromState();
  }

  function applyApiData(data) {
    const model = mapApiResponse(data);
    state.totalNominal = model.totalNominal;
    state.currentGridRow = model.currentGridRow;

    model.stationResults.forEach(({ station, chart }, index) => {
      if (chart) {
        miniCharts[index].data.labels = chart.labels;
        miniCharts[index].data.datasets[0].data = chart.generation;
        miniCharts[index].data.datasets[1].data = chart.corrected;
        miniCharts[index].update('none');
      }
      renderStation(station);
    });

    averageChart.data.labels = model.grid.labels;
    averageChart.data.datasets[0].data = model.grid.generation;
    correctedChart.data.labels = model.grid.labels;
    correctedChart.data.datasets[0].data = model.grid.generation;
    correctedChart.data.datasets[1].data = model.grid.corrected;

    state.cloud = {
      enabled: model.cloud.enabled,
      index: findClosestLabelIndex(model.grid.labels, model.cloud.startTime),
    };
    [averageChart, correctedChart].forEach((chart) => {
      Object.assign(chart.options.plugins.cloudBand, {
        index: state.cloud.index,
        durationMinutes: model.cloud.durationMinutes,
      });
    });

    playback.syncSources();
    playback.applyFrame(playback.getProgress(), true);

    setCloudInfo({
      label: model.cloud.label,
      dropPercent: model.cloud.dropPercent,
      weather: model.cloud.enabled ? `ОБЛАКО: ${model.cloud.label}` : 'ОБЛАЧНОСТЬ: НЕТ',
    });
    setBattery({
      powerMw: model.battery.maxOutputMw,
      chargePercent: model.battery.chargePercent,
      capacityMwh: model.battery.capacityMwh,
    });
    setConnectionStatus(`${model.meta.stationCount} СТАНЦИИ / API В СЕТИ`);
    setDataSource(`API · ${model.meta.intervalMinutes} МИН · ${model.meta.pointCount} ТОЧЕК`);
    setLastSync();
    updateSummaryFromState();
  }

  let requestController;

  async function refreshApi() {
    requestController?.abort();
    requestController = new AbortController();
    const timeoutId = setTimeout(() => requestController.abort(), API_TIMEOUT_MS);
    setConnectionStatus('ОБНОВЛЕНИЕ ДАННЫХ API…');

    try {
      applyApiData(await fetchSolarComparison(requestController.signal));
    } catch (error) {
      setConnectionStatus(
        error.name === 'AbortError' ? 'API: ПРЕВЫШЕНО ВРЕМЯ ОЖИДАНИЯ' : 'API НЕДОСТУПНО · ДЕМО-РЕЖИМ',
        true,
      );
      setDataSource('ДЕМО-ДАННЫЕ / ОЖИДАНИЕ API');
      console.warn('Не удалось обновить CorSolar:', error);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  document.querySelector('#playbackButton')?.addEventListener('click', async () => {
    startPlayback(true);
    await refreshApi();
  });
  initCloudControls({
    onApply: async () => {
      applyDemoScenario();
      startPlayback(true);
      await refreshApi();
    },
  });
  initBatteryControls({
    onApply: async () => {
      // Демо-сценарий не моделирует параметры АКБ — их считает только
      // бэкенд, поэтому здесь идём сразу за свежим ответом API.
      setBattery({ capacityMwh: apiConfig.batteryCapacityKwh / 1000 });
      setConnectionStatus('ПАРАМЕТРЫ АКБ ПРИМЕНЕНЫ / ЗАПРОС API…');
      await refreshApi();
    },
  });

  stations.forEach(renderStation);
  applyDemoScenario();
  startClock();
  startPlayback();
  refreshApi();
  setInterval(refreshApi, apiConfig.pollIntervalMs);
}
