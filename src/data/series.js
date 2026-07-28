// Преобразования рядов данных: сглаживание и прореживание.

import { clamp } from '../core/utils.js';

// Взвешенное скользящее среднее: убирает «острые углы» у итоговой линии,
// оставляя форму суточной кривой.
export function smoothSeries(values) {
  if (values.length < 5) return [...values];
  const radius = Math.max(2, Math.min(6, Math.round(values.length / 72)));

  return values.map((_, index) => {
    let weightedSum = 0;
    let totalWeight = 0;

    for (let offset = -radius; offset <= radius; offset += 1) {
      const sourceIndex = Math.max(0, Math.min(values.length - 1, index + offset));
      const weight = radius + 1 - Math.abs(offset);
      weightedSum += values[sourceIndex] * weight;
      totalWeight += weight;
    }

    return clamp(weightedSum / totalWeight);
  });
}

// Прореживание готового ряда значений (без исходных строк API).
// Нужно спарклайнам: их высота 58px, плотная сетка там не читается,
// но каждый кадр стоит времени отрисовки.
export function thinSeries(values, maxPoints) {
  if (values.length <= maxPoints) return { values: [...values], indices: values.map((_, i) => i) };

  const indices = minMaxSampleIndices(values, maxPoints, (value) => value);
  return { values: indices.map((index) => values[index]), indices };
}

// Min/max-прореживание сохраняет пики и провалы, но уменьшает 1440 минутных
// значений до безопасного для постоянной перерисовки количества точек.
export function minMaxSampleIndices(rows, maxPoints, valueAccessor) {
  if (rows.length <= maxPoints) return rows.map((_, index) => index);

  const result = [0];
  const bucketCount = Math.max(1, Math.floor((maxPoints - 2) / 2));
  const bucketSize = (rows.length - 2) / bucketCount;

  for (let bucket = 0; bucket < bucketCount; bucket += 1) {
    const start = Math.floor(1 + bucket * bucketSize);
    const end = Math.min(rows.length - 1, Math.floor(1 + (bucket + 1) * bucketSize));
    let minIndex = start;
    let maxIndex = start;

    for (let index = start + 1; index < end; index += 1) {
      if (valueAccessor(rows[index]) < valueAccessor(rows[minIndex])) minIndex = index;
      if (valueAccessor(rows[index]) > valueAccessor(rows[maxIndex])) maxIndex = index;
    }

    if (minIndex < maxIndex) result.push(minIndex, maxIndex);
    else if (maxIndex < minIndex) result.push(maxIndex, minIndex);
    else result.push(minIndex);
  }

  result.push(rows.length - 1);
  return [...new Set(result)];
}
