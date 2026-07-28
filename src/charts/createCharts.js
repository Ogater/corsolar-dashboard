// Создание трёх типов графиков: мини-спарклайны, средняя генерация, итог с АКБ.

import { apiConfig } from '../core/config.js';
import { thinSeries } from '../data/series.js';
import { stations } from '../data/stations.js';
import {
  Chart,
  batteryLine,
  commonScales,
  correctionLine,
  generationLine,
  responsiveBase,
  tooltip,
} from './chartSetup.js';

export function createMiniCharts(labels, histories) {
  return stations.map((station, index) => {
    const thinned = thinSeries(histories[index], apiConfig.maxMiniChartPoints);

    return new Chart(document.querySelector(`#mini-${station.id}`), {
      type: 'line',
      data: {
        labels: thinned.indices.map((pointIndex) => labels[pointIndex]),
        datasets: [generationLine({ data: thinned.values, fill: true, borderWidth: 1.6 })],
      },
      options: {
        ...responsiveBase,
        interaction: { intersect: false, mode: 'nearest' },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: { x: { display: false }, y: { display: false, min: 0, max: 1 } },
      },
    });
  });
}

export function createAverageChart(labels, averageHistory, cloudIndex) {
  return new Chart(document.querySelector('#averageChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [generationLine({ data: averageHistory, fill: true })],
    },
    options: {
      ...responsiveBase,
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
}

export function createCorrectedChart(labels, averageHistory, correction, cloudIndex) {
  return new Chart(document.querySelector('#correctedChart'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        // Тоньше верхнего графика: чёрная итоговая линия идёт поверх красной,
        // и при равной толщине они спорят за внимание.
        generationLine({ data: averageHistory, backgroundColor: 'transparent', borderWidth: 1.8 }),
        batteryLine({ data: correction.battery }),
        correctionLine({ data: correction.corrected }),
      ],
    },
    options: {
      ...responsiveBase,
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
}
