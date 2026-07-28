// Проигрывание суток. Плавность держится на двух вещах:
// 1) кадр считается по времени, а не по номеру открытой точки;
// 2) головная точка линии интерполируется между соседями, поэтому фронт
//    движется непрерывно, а не прыгает от узла к узлу сетки.

import { playbackConfig } from '../core/config.js';
import { clamp, getTimeLabel } from '../core/utils.js';

export function createPlayback({ charts, timelineChart, getCloudState, onFrame }) {
  let sources = [];
  let animationFrame = null;
  let progress = 1;
  let startedAt = 0;
  let running = false;

  function syncSources() {
    sources = charts.map((chart) => ({
      chart,
      labels: [...chart.data.labels],
      datasets: chart.data.datasets.map((dataset) => [...dataset.data]),
    }));
  }

  // Возвращает ряд, обрезанный по позиции фронта. Последняя видимая точка
  // подтягивается к дробной позиции — это и даёт «текучесть» вместо ступенек.
  function revealSeries(source, headPosition) {
    const lastIndex = Math.floor(headPosition);
    const fraction = headPosition - lastIndex;

    return source.map((value, index) => {
      if (index < lastIndex) return value;
      if (index > lastIndex) return null;
      if (fraction <= 0 || index + 1 >= source.length) return value;

      const next = source[index + 1];
      if (typeof value !== 'number' || typeof next !== 'number') return value;
      return value + (next - value) * fraction;
    });
  }

  function applyFrame(nextProgress, force = false) {
    progress = clamp(nextProgress);

    sources.forEach(({ chart, labels, datasets }) => {
      const maxIndex = labels.length - 1;
      const headPosition = progress >= 1 ? maxIndex : progress * maxIndex;
      // Пересчитываем только при заметном сдвиге фронта — экономит работу
      // на плотной сетке, но шаг достаточно мал, чтобы глаз не видел ступеней.
      const changed = force || chart.$headPosition === undefined
        || Math.abs(chart.$headPosition - headPosition) > 0.01;
      if (!changed) return;

      chart.data.labels = labels;
      chart.data.datasets.forEach((dataset, datasetIndex) => {
        dataset.data = revealSeries(datasets[datasetIndex] || [], headPosition);
      });

      const cloudBand = chart.options.plugins.cloudBand;
      if (cloudBand) {
        const { enabled, index } = getCloudState();
        cloudBand.index = index;
        cloudBand.display = enabled && index <= headPosition;
      }

      chart.$headPosition = headPosition;
      chart.update('none');
    });

    const timelineSource = sources.find(({ chart }) => chart === timelineChart);
    const timelineLabels = timelineSource?.labels || [];
    const timeIndex = Math.min(
      Math.max(timelineLabels.length - 1, 0),
      Math.max(0, Math.floor(progress * timelineLabels.length)),
    );
    const label = progress >= 1 ? '24:00' : getTimeLabel(timelineLabels[timeIndex]);
    onFrame?.({ progress, label });
  }

  function finish() {
    running = false;
    animationFrame = null;
    applyFrame(1, true);
    onFrame?.({ progress: 1, label: '24:00', finished: true });
  }

  function tick(now) {
    const elapsed = (now - startedAt) / playbackConfig.durationMs;
    if (elapsed >= 1) {
      finish();
      return;
    }

    applyFrame(elapsed);
    animationFrame = requestAnimationFrame(tick);
  }

  function start(manual = false) {
    if (!sources.length) return;
    if (!manual && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      finish();
      return;
    }

    if (animationFrame) cancelAnimationFrame(animationFrame);
    running = true;
    startedAt = performance.now();
    applyFrame(0, true);
    animationFrame = requestAnimationFrame(tick);
  }

  return {
    start,
    syncSources,
    applyFrame,
    isRunning: () => running,
    getProgress: () => progress,
  };
}
