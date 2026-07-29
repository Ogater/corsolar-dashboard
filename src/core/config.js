// Единая точка настройки сценария и параметров отрисовки.

export const API_PATH = '/api/demo-solar-battery/compare';

export const apiConfig = {
  insolationProfile: 'real',
  cloud: true,
  cloudStartTime: '13:00',
  cloudDurationMinutes: 15,
  cloudTransmissionFactor: 0.48,
  // Параметры накопителя. Раньше шли дефолтами бэкенда — теперь ими
  // управляет консоль сценария, поэтому держим их здесь явно.
  batteryCapacityKwh: 500,
  initialSocPercent: 100,
  minSocPercent: 20,
  maxDischargePowerKw: 100,
  maxChargePowerKw: 100,
  pollIntervalMs: 60_000,
  // Большие графики держат плотную сетку — по ней движется линия проигрывания.
  maxChartPoints: 720,
  // Спарклайны в карточках высотой 58px: лишние точки там не видны,
  // но стоят кадров, поэтому бюджет отдельный и меньший.
  maxMiniChartPoints: 180,
};

export const playbackConfig = {
  durationMs: 60_000,
  // Точек в демо-наборе: чем плотнее сетка, тем чаще проигрывание
  // открывает новый сегмент и тем глаже растёт линия.
  demoPointCount: 720,
};

export const palette = {
  generation: '#ed1064',
  generationFill: 'rgba(237, 16, 100, 0.08)',
  correction: '#111111',
  correctionFill: 'rgba(17, 17, 17, 0.07)',
  axis: 'rgba(152, 162, 179, 0.22)',
  axisBorder: '#d0d5dd',
};

export const chartFont = '"Share Tech Mono", "Courier New", monospace';
