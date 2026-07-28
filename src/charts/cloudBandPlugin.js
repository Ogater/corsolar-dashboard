// Подсветка интервала прохождения тучи поверх сетки графика.

import { timeToMinutes } from '../core/utils.js';

export const cloudBandPlugin = {
  id: 'cloudBand',

  beforeDatasetsDraw(chart, _args, options) {
    if (!options?.display) return;

    const { ctx, chartArea, scales } = chart;
    if (!chartArea || !scales.x) return;

    const index = options.index ?? 0;
    const center = scales.x.getPixelForValue(index);
    const labels = chart.data.labels;
    const labelStep = labels.length > 1
      ? Math.max(1, Math.abs(timeToMinutes(labels[1]) - timeToMinutes(labels[0])))
      : 60;
    const durationInPoints = Math.max(1, (options.durationMinutes || 15) / labelStep);
    const end = scales.x.getPixelForValue(Math.min(index + durationInPoints, labels.length - 1));
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
