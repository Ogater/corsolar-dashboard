// Справочник станций. Значения переписываются данными API, если он доступен.

export const stations = [
  { id: 'east', short: 'СЭС–01', name: 'Поле «Восток»', place: 'Контур A / 2 040 панелей', nominal: 850, value: 0.74 },
  { id: 'south', short: 'СЭС–02', name: 'Поле «Юг»', place: 'Контур B / 1 728 панелей', nominal: 720, value: 0.69 },
  { id: 'steppe', short: 'СЭС–03', name: 'Поле «Степь»', place: 'Контур C / 2 640 панелей', nominal: 1100, value: 0.78 },
  { id: 'reserve', short: 'СЭС–04', name: 'Поле «Резерв»', place: 'Контур D / 1 536 панелей', nominal: 640, value: 0.66 },
];

export function sumNominal(list = stations) {
  return list.reduce((sum, station) => sum + station.nominal, 0);
}
