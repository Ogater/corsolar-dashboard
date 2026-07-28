// Приведение ответа backend к рядам, которые понимают графики.

import { apiConfig } from '../core/config.js';
import { clamp, findClosestRow, getTimeLabel, numberOr } from '../core/utils.js';
import { minMaxSampleIndices, smoothSeries } from './series.js';
import { stations, sumNominal } from './stations.js';

function mapStations(data) {
  const objects = data.objects.slice(0, stations.length);
  const timelinesById = new Map(
    data.object_generation_timelines.map((timeline) => [String(timeline.id), timeline]),
  );

  return objects.map((source, index) => {
    const station = stations[index];
    const timeline = timelinesById.get(String(source.id)) || data.object_generation_timelines[index];
    const rows = Array.isArray(timeline?.timeline) ? timeline.timeline : [];
    const nominal = numberOr(source.solar_power_kw ?? timeline?.solar_power_kw, station.nominal);

    station.name = source.name || timeline?.name || station.name;
    station.short = String(source.id || `СЭС–0${index + 1}`).toUpperCase();
    station.nominal = nominal;
    station.place = source.battery_capacity_kwh
      ? `СОЛНЕЧНЫЙ ОБЪЕКТ / АКБ ${numberOr(source.battery_capacity_kwh).toLocaleString('ru-RU')} кВт·ч`
      : 'СОЛНЕЧНЫЙ ОБЪЕКТ / ДАННЫЕ API';

    if (!rows.length) return { station, chart: null };

    station.value = clamp(numberOr(findClosestRow(rows).solar_generation_kw) / Math.max(1, nominal));
    const indices = minMaxSampleIndices(
      rows,
      apiConfig.maxMiniChartPoints,
      (row) => numberOr(row.solar_generation_kw),
    );

    return {
      station,
      chart: {
        labels: indices.map((rowIndex) => getTimeLabel(rows[rowIndex].time)),
        values: indices.map((rowIndex) => (
          clamp(numberOr(rows[rowIndex].solar_generation_kw) / Math.max(1, nominal))
        )),
      },
    };
  });
}

function mapGrid(data, totalNominal) {
  const gridRows = data.grid_timeline;
  if (!gridRows.length) throw new Error('grid_timeline пуст');

  const indices = minMaxSampleIndices(
    gridRows,
    apiConfig.maxChartPoints,
    (row) => numberOr(row.without_battery_total_output_kw ?? row.solar_generation_kw),
  );
  const sampled = indices.map((index) => gridRows[index]);
  const labels = sampled.map((row) => getTimeLabel(row.time));
  const generation = sampled.map((row) => clamp(
    numberOr(row.without_battery_total_output_kw ?? row.solar_generation_kw) / Math.max(1, totalNominal),
  ));
  const battery = sampled.map((row) => clamp(
    numberOr(row.battery_output_kw) / Math.max(1, totalNominal),
  ));
  // Итоговая линия — сумма панелей и вклада АКБ, сглаженная для читаемости.
  const corrected = smoothSeries(generation.map((value, index) => clamp(value + battery[index])));

  return { gridRows, labels, generation, battery, corrected };
}

export function mapApiResponse(data) {
  const stationResults = mapStations(data);
  const totalNominal = numberOr(data.with_battery_summary?.installed_power_kw, sumNominal());
  const grid = mapGrid(data, totalNominal);

  const cloudEvent = data.cloud_event || {};
  const cloudDuration = numberOr(cloudEvent.duration_minutes, apiConfig.cloudDurationMinutes);
  const cloudEnabled = data.cloud_enabled !== false;
  const cloudLabel = cloudEnabled
    ? `${getTimeLabel(cloudEvent.start_time || apiConfig.cloudStartTime)} / ${cloudDuration} МИН`
    : 'ОБЛАКО ОТКЛЮЧЕНО';

  const currentGridRow = findClosestRow(grid.gridRows);
  const maxDropKw = numberOr(
    data.without_battery_summary?.max_drop_kw,
    Math.max(...grid.gridRows.map((row) => numberOr(row.without_battery_drop_kw))),
  );

  return {
    stationResults,
    totalNominal,
    grid,
    currentGridRow,
    cloud: {
      enabled: cloudEnabled,
      startTime: cloudEvent.start_time || apiConfig.cloudStartTime,
      durationMinutes: cloudDuration,
      label: cloudLabel,
      dropPercent: Math.round(maxDropKw / Math.max(1, totalNominal) * 100),
    },
    battery: {
      maxOutputMw: Math.max(...grid.gridRows.map((row) => numberOr(row.battery_output_kw))) / 1000,
      chargePercent: clamp(numberOr(currentGridRow.battery_soc_percent, 68) / 100) * 100,
      capacityMwh: numberOr(
        data.with_battery_summary?.battery_capacity_kwh,
        data.objects.reduce((sum, object) => sum + numberOr(object.battery_capacity_kwh), 0),
      ) / 1000,
    },
    meta: {
      intervalMinutes: numberOr(data.data_interval_minutes, 1),
      pointCount: grid.gridRows.length,
      stationCount: stationResults.length,
    },
  };
}
