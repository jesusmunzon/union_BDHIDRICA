/* Periodos y conversiones compartidos por Estadísticos 1 y Estadísticos 2. */

export function isLeapYear(year) {
  return year % 400 === 0 || (year % 4 === 0 && year % 100 !== 0);
}

export function daysInYear(year) {
  return isLeapYear(year) ? 366 : 365;
}

export function daysThroughMonth(year, month) {
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new RangeError("month debe estar entre 1 y 12");
  }
  return Math.round(
    (Date.UTC(year, month, 1) - Date.UTC(year, 0, 1)) / 86400000,
  );
}

export function statistics2Periods(selectedYear, selectedMonth) {
  const periods = [];
  for (let year = selectedYear - 10; year < selectedYear; year += 1) {
    periods.push({
      year,
      endMonth: 12,
      days: daysInYear(year),
      completeYear: true,
    });
  }
  periods.push({
    year: selectedYear,
    endMonth: selectedMonth,
    days: daysThroughMonth(selectedYear, selectedMonth),
    completeYear: false,
  });
  return periods;
}

export function convertHydraulicVolume(cubicMetres, days) {
  const m3 = Number(cubicMetres || 0);
  return Object.freeze({
    m3,
    dam3: m3 / 1000,
    m3PerDay: days ? m3 / days : 0,
  });
}

export function buildStatistics2Series({
  calculator,
  concept,
  selectedYear,
  selectedMonth,
}) {
  return statistics2Periods(selectedYear, selectedMonth).map((period) => ({
    ...period,
    ...convertHydraulicVolume(
      calculator.accumulated(concept, period.year, period.endMonth),
      period.days,
    ),
  }));
}
