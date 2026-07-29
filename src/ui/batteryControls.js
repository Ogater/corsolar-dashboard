// Форма параметров накопителя: пишет значения в apiConfig и сообщает наверх.

import { apiConfig } from '../core/config.js';
import { clamp, numberOr } from '../core/utils.js';

export function initBatteryControls({ onApply }) {
  const form = document.querySelector('#batteryForm');
  if (!form) return;

  const capacity = document.querySelector('#batteryCapacity');
  const discharge = document.querySelector('#batteryDischarge');
  const charge = document.querySelector('#batteryCharge');
  const soc = document.querySelector('#batterySoc');
  const socOutput = document.querySelector('#batterySocOutput');
  const minSoc = document.querySelector('#batteryMinSoc');
  const minSocOutput = document.querySelector('#batteryMinSocOutput');
  const hint = document.querySelector('#batteryHint');
  const applyButton = document.querySelector('#applyBatteryButton');

  // Нижний порог не может быть выше стартового заряда — иначе АКБ
  // начинает сутки уже «ниже дна» и никогда не отдаёт энергию.
  function clampSocPair(source) {
    if (numberOr(minSoc.value) <= numberOr(soc.value)) return;
    if (source === minSoc) soc.value = minSoc.value;
    else minSoc.value = soc.value;
  }

  function updateReadouts(source) {
    if (source) clampSocPair(source);
    socOutput.textContent = `${soc.value}%`;
    minSocOutput.textContent = `${minSoc.value}%`;

    const usableShare = Math.max(0, numberOr(soc.value) - numberOr(minSoc.value)) / 100;
    const capacityKwh = capacity.value.trim() === ''
      ? apiConfig.batteryCapacityKwh
      : numberOr(capacity.value, apiConfig.batteryCapacityKwh);
    const usableKwh = Math.round(capacityKwh * usableShare);
    hint.innerHTML = `Резерв: <b>${usableKwh.toLocaleString('ru-RU')}</b> кВт·ч доступно до нижнего порога`;
  }

  [soc, minSoc].forEach((input) => {
    input.addEventListener('input', () => updateReadouts(input));
  });
  capacity.addEventListener('input', () => updateReadouts());

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    // Пустое поле даёт Number('') === 0, а не NaN, поэтому numberOr его
    // не поймает — откатываемся на текущее значение конфига вручную.
    const readField = (input, fallback) => (
      input.value.trim() === '' ? fallback : numberOr(input.value, fallback)
    );

    apiConfig.batteryCapacityKwh = Math.max(1, readField(capacity, apiConfig.batteryCapacityKwh));
    apiConfig.maxDischargePowerKw = Math.max(0, readField(discharge, apiConfig.maxDischargePowerKw));
    apiConfig.maxChargePowerKw = Math.max(0, readField(charge, apiConfig.maxChargePowerKw));
    apiConfig.initialSocPercent = clamp(numberOr(soc.value, 100), 0, 100);
    apiConfig.minSocPercent = clamp(numberOr(minSoc.value, 20), 0, apiConfig.initialSocPercent);

    capacity.value = apiConfig.batteryCapacityKwh;
    discharge.value = apiConfig.maxDischargePowerKw;
    charge.value = apiConfig.maxChargePowerKw;
    minSoc.value = apiConfig.minSocPercent;
    updateReadouts();

    applyButton.disabled = true;
    applyButton.textContent = 'ПРИМЕНЯЕМ…';

    try {
      await onApply();
    } finally {
      applyButton.disabled = false;
      applyButton.textContent = 'ПРИМЕНИТЬ';
    }
  });

  updateReadouts();
}
