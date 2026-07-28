// Общие настройки Chart.js: регистрация плагина, шкалы, тултип, пресеты линий.

import Chart from 'chart.js/auto';
import { chartFont, palette } from '../core/config.js';
import { cloudBandPlugin } from './cloudBandPlugin.js';

Chart.defaults.font.family = chartFont;
Chart.defaults.color = '#667085';
Chart.register(cloudBandPlugin);

export { Chart };

export const commonScales = {
  x: {
    grid: { color: palette.axis, drawTicks: false },
    border: { color: palette.axisBorder },
    ticks: { maxTicksLimit: 9, padding: 10, font: { size: 9 } },
  },
  y: {
    min: 0,
    max: 1,
    grid: { color: palette.axis, drawTicks: false },
    border: { display: false },
    ticks: {
      stepSize: 0.25,
      padding: 10,
      font: { size: 9 },
      callback: (value) => Number(value).toFixed(2),
    },
  },
};

export const tooltip = {
  backgroundColor: '#111827',
  borderColor: '#344054',
  borderWidth: 1,
  titleColor: '#ffffff',
  bodyColor: '#f2f4f7',
  padding: 11,
  displayColors: true,
  callbacks: { label: (context) => ` ${context.dataset.label}: ${context.parsed.y.toFixed(2)}` },
};

// Плотная сетка точек делает радиус 0 обязательным, иначе Chart.js
// рисует сотни маркеров и теряет кадры.
const lineBase = {
  pointRadius: 0,
  pointHoverRadius: 0,
  borderCapStyle: 'round',
  borderJoinStyle: 'round',
  tension: 0.42,
  cubicInterpolationMode: 'monotone',
  // spanGaps: false обязателен — проигрывание гасит «будущее» через null.
  spanGaps: false,
};

export function generationLine(overrides = {}) {
  return {
    ...lineBase,
    label: 'Генерация',
    borderColor: palette.generation,
    backgroundColor: palette.generationFill,
    borderWidth: 3,
    ...overrides,
  };
}

export function correctionLine(overrides = {}) {
  return {
    ...lineBase,
    label: 'Итог с АКБ',
    borderColor: palette.correction,
    backgroundColor: 'transparent',
    borderWidth: 2.8,
    ...overrides,
  };
}

export function batteryLine(overrides = {}) {
  return {
    ...lineBase,
    label: 'Батарея',
    borderColor: palette.correction,
    backgroundColor: palette.correctionFill,
    fill: true,
    borderWidth: 1.8,
    borderDash: [2, 4],
    tension: 0.2,
    cubicInterpolationMode: undefined,
    ...overrides,
  };
}

export const responsiveBase = {
  responsive: true,
  maintainAspectRatio: false,
  // Собственная анимация проигрывания — встроенная только мешала бы.
  animation: false,
  animations: { colors: false, x: false, y: false },
  transitions: { active: { animation: { duration: 0 } } },
  interaction: { intersect: false, mode: 'index' },
  elements: { line: { capBezierPoints: true } },
  layout: { autoPadding: false },
};
