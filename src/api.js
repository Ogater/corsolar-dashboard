const API_PATH = '/api/demo-solar-battery/compare';

export const apiConfig = {
  insolationProfile: 'real',
  cloud: true,
  cloudStartTime: '13:00',
  cloudDurationMinutes: 15,
  cloudTransmissionFactor: 0.48,
  pollIntervalMs: 60_000,
  maxChartPoints: 360,
};

function getApiUrl() {
  const configuredBase = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
  const url = new URL(`${configuredBase}${API_PATH}`, window.location.origin);
  url.searchParams.set('insolation_profile', apiConfig.insolationProfile);
  url.searchParams.set('cloud', String(apiConfig.cloud));
  url.searchParams.set('cloud_start_time', apiConfig.cloudStartTime);
  url.searchParams.set('cloud_duration_minutes', String(apiConfig.cloudDurationMinutes));
  url.searchParams.set('cloud_transmission_factor', String(apiConfig.cloudTransmissionFactor));
  return url;
}

function assertCompareResponse(data) {
  if (!data || typeof data !== 'object') throw new Error('API вернул пустой ответ');
  if (!Array.isArray(data.objects)) throw new Error('В ответе отсутствует objects');
  if (!Array.isArray(data.object_generation_timelines)) throw new Error('В ответе отсутствует object_generation_timelines');
  if (!Array.isArray(data.grid_timeline)) throw new Error('В ответе отсутствует grid_timeline');
  return data;
}

export async function fetchSolarComparison(signal) {
  const response = await fetch(getApiUrl(), {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  });

  if (!response.ok) {
    throw new Error(`API ответил ${response.status}`);
  }

  return assertCompareResponse(await response.json());
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
