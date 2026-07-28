// HTTP-слой: только запрос и валидация формы ответа.

import { API_PATH, apiConfig } from '../core/config.js';

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

  if (!response.ok) throw new Error(`API ответил ${response.status}`);

  return assertCompareResponse(await response.json());
}
