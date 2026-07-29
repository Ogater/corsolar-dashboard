// Обновление текстовых показателей на экране.

import { formatFactor, formatNumber } from '../core/utils.js';

const refs = {};

export function bindDashboard() {
  const ids = [
    'averageOutput', 'totalOutput', 'connectionStatus', 'dataSourceLabel', 'lastSync',
    'cloudLoss', 'cloudEventLabel', 'weatherStatus', 'batteryPower', 'batteryCharge',
    'batteryChargeMetric', 'batteryCapacityMetric', 'batteryFill', 'clock',
    'playbackTime', 'playbackProgress', 'playbackButton',
  ];
  ids.forEach((id) => { refs[id] = document.querySelector(`#${id}`); });
  return refs;
}

export function renderStation(station) {
  const card = document.querySelector(`[data-station="${station.id}"]`);
  if (!card) return;

  const percent = Math.round(station.value * 100);
  card.querySelector('.factor-value').textContent = `${percent}%`;
  card.querySelector('.kw-value').textContent = formatNumber(station.value * station.nominal);
  card.querySelector('.dial').style.setProperty('--value', percent);
  card.querySelector('.station-name').textContent = station.name;
  card.querySelector('.station-code').textContent = `${station.short} / SOLAR`;
  card.querySelector('.nominal-value').textContent = `${formatNumber(station.nominal)} кВт`;
  card.querySelector('.station-place').textContent = station.place;
}

export function renderSummary({ totalKw, totalNominal }) {
  const average = totalKw / Math.max(1, totalNominal);
  refs.averageOutput.innerHTML = `${formatFactor(average)} <small>/ 1,00</small>`;
  refs.totalOutput.textContent = `${formatFactor(totalKw / 1000)} МВт суммарно`;
}

export function setConnectionStatus(text, isError = false) {
  refs.connectionStatus.textContent = text;
  refs.connectionStatus.classList.toggle('is-error', isError);
}

export function setDataSource(text) {
  refs.dataSourceLabel.textContent = text;
}

export function setLastSync(date = new Date()) {
  refs.lastSync.textContent = date.toLocaleTimeString('ru-RU');
}

export function setCloudInfo({ label, dropPercent, weather }) {
  refs.cloudLoss.textContent = `−${dropPercent}%`;
  refs.cloudEventLabel.textContent = label;
  refs.weatherStatus.textContent = weather;
}

export function setBattery({ powerMw, chargePercent, capacityMwh }) {
  if (powerMw !== undefined) {
    refs.batteryPower.textContent = `+${formatFactor(powerMw)} МВт`;
  }

  if (chargePercent !== undefined) {
    const rounded = Math.round(chargePercent);
    refs.batteryCharge.textContent = `${rounded}%`;
    refs.batteryChargeMetric.textContent = `${rounded}%`;
    refs.batteryFill.style.height = `${chargePercent}%`;
  }

  if (capacityMwh !== undefined) {
    refs.batteryCapacityMetric.textContent = `${formatFactor(capacityMwh)} МВт·ч`;
  }
}

export function setPlaybackFrame({ progress, label }) {
  refs.playbackTime.textContent = label;
  refs.playbackTime.setAttribute('datetime', label);
  refs.playbackProgress.value = progress * 100;
}

export function setPlaybackButtonState(isPlaying) {
  const button = refs.playbackButton;
  if (!button) return;

  button.classList.toggle('is-playing', isPlaying);
  button.setAttribute('aria-label', isPlaying
    ? 'Перезапустить проигрывание суток'
    : 'Проиграть сутки за одну минуту');
  button.querySelector('.button-label').textContent = isPlaying ? 'ПЕРЕЗАПУСТИТЬ' : 'ПРОИГРАТЬ СУТКИ';
}

export function startClock() {
  const tick = () => { refs.clock.textContent = new Date().toLocaleTimeString('ru-RU'); };
  tick();
  setInterval(tick, 1000);
}
