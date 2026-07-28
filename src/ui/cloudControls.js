// Форма настройки облака: читает значения в apiConfig и сообщает наверх.

import { apiConfig } from '../core/config.js';
import { clamp, numberOr } from '../core/utils.js';

export function initCloudControls({ onApply }) {
  const form = document.querySelector('#cloudForm');
  const enabled = document.querySelector('#cloudEnabled');
  const fields = document.querySelector('#cloudFields');
  const start = document.querySelector('#cloudStart');
  const duration = document.querySelector('#cloudDuration');
  const drop = document.querySelector('#cloudDrop');
  const dropOutput = document.querySelector('#cloudDropOutput');
  const applyButton = document.querySelector('#applyCloudButton');

  if (!form) return;

  function updateControlsState() {
    const isEnabled = enabled.checked;
    fields.classList.toggle('is-disabled', !isEnabled);
    enabled.parentElement.querySelector('b').textContent = isEnabled ? 'ВКЛ' : 'ВЫКЛ';
    [start, duration, drop].forEach((input) => { input.disabled = !isEnabled; });
  }

  enabled.addEventListener('change', updateControlsState);
  drop.addEventListener('input', () => { dropOutput.textContent = `${drop.value}%`; });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    apiConfig.cloud = enabled.checked;
    apiConfig.cloudStartTime = start.value || '13:00';
    apiConfig.cloudDurationMinutes = clamp(numberOr(duration.value, 15), 1, 360);
    apiConfig.cloudTransmissionFactor = clamp(1 - numberOr(drop.value, 52) / 100, 0.1, 0.9);
    duration.value = apiConfig.cloudDurationMinutes;

    applyButton.disabled = true;
    applyButton.textContent = 'ПРИМЕНЯЕМ…';

    try {
      await onApply();
    } finally {
      applyButton.disabled = false;
      applyButton.textContent = 'ПРИМЕНИТЬ';
    }
  });

  updateControlsState();
}
