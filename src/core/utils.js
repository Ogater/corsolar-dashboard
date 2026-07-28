// Мелкие помощники, не зависящие ни от DOM, ни от Chart.js.

export function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value));
}

export function numberOr(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function formatNumber(value, digits = 0) {
  return value.toLocaleString('ru-RU', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatFactor(value) {
  return formatNumber(value, 2);
}

export function getTimeLabel(value) {
  if (!value) return '--:--';
  const text = String(value);
  const directMatch = text.match(/(?:^|T)(\d{2}:\d{2})/);
  if (directMatch) return directMatch[1];
  const date = new Date(text);
  return Number.isNaN(date.getTime())
    ? text.slice(0, 5)
    : date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function timeToMinutes(value) {
  const [hours, minutes] = getTimeLabel(value).split(':').map(Number);
  return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : 0;
}

export function findClosestLabelIndex(chartLabels, time) {
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

export function findClosestRow(rows, targetMinutes) {
  const target = targetMinutes ?? new Date().getHours() * 60 + new Date().getMinutes();
  return rows.reduce((closest, row) => (
    Math.abs(timeToMinutes(row.time) - target) < Math.abs(timeToMinutes(closest.time) - target)
      ? row
      : closest
  ), rows[0]);
}
