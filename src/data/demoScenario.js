// Локальный генератор суточного профиля: используется до первого ответа API
// и остаётся на экране, если backend недоступен.

import { apiConfig, playbackConfig } from '../core/config.js';
import { clamp } from '../core/utils.js';
import { stations } from './stations.js';

export function buildLabels(pointCount = playbackConfig.demoPointCount) {
  return Array.from({ length: pointCount }, (_, index) => {
    const minutes = index * (24 * 60 / pointCount);
    const hour = Math.floor(minutes / 60);
    const minute = Math.round(minutes % 60);
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  });
}

function daylight(hour) {
  if (hour < 5 || hour > 21) return 0.025;
  return Math.max(0.04, Math.sin(((hour - 5) / 16) * Math.PI));
}

function cloudLoss(hour, offset = 0) {
  if (!apiConfig.cloud) return 1;
  const [startHour, startMinute] = apiConfig.cloudStartTime.split(':').map(Number);
  const durationHours = apiConfig.cloudDurationMinutes / 60;
  const center = startHour + startMinute / 60 + durationHours / 2 + offset;
  const sigma = Math.max(durationHours / 2.6, 0.07);
  const cloudShape = Math.exp(-0.5 * ((hour - center) / sigma) ** 2);
  return clamp(1 - (1 - apiConfig.cloudTransmissionFactor) * cloudShape, 0.08, 1);
}

function createStationHistory(stationIndex, labels) {
  const offset = (stationIndex - 1.5) * 0.12;
  const efficiency = 0.92 + stationIndex * 0.018;

  return labels.map((_, index) => {
    const hour = index * 24 / labels.length;
    // Шум масштабируем к шагу сетки: на плотной сетке крупная текстура
    // превратила бы кривую в «пилу».
    const texture = (Math.random() - 0.5) * 0.075 * Math.min(1, 144 / labels.length);
    return clamp(daylight(hour) * cloudLoss(hour, offset) * efficiency + texture, 0.02, 1);
  });
}

export function buildBatteryCorrection(rawSeries, nominalKw) {
  const battery = rawSeries.map((raw, index) => {
    const hour = index * 24 / rawSeries.length;
    const desired = daylight(hour) * nominalKw * 0.73;
    return clamp(desired - raw, 0, apiConfig.maxDischargePowerKw);
  });
  const corrected = rawSeries.map((raw, index) => raw + battery[index]);
  return { battery, corrected };
}

export function createDemoScenario(labels) {
  const histories = stations.map((station, index) => (
    createStationHistory(index, labels).map((value) => value * station.nominal)
  ));
  const stationCorrections = histories.map((history, index) => (
    buildBatteryCorrection(history, stations[index].nominal)
  ));
  const correctedHistories = stationCorrections.map(({ corrected }) => corrected);
  const totalGeneration = labels.map((_, pointIndex) => (
    histories.reduce((sum, history) => sum + history[pointIndex], 0)
  ));
  const corrected = labels.map((_, pointIndex) => (
    correctedHistories.reduce((sum, history) => sum + history[pointIndex], 0)
  ));
  const battery = corrected.map((value, index) => value - totalGeneration[index]);

  return {
    histories,
    correctedHistories,
    totalGeneration,
    correction: { battery, corrected },
  };
}
