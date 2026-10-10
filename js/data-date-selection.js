/**
 * data-date-selection.js
 *
 * Funciones compartidas para seleccionar FECHA y FECHA DATOS en:
 * - BD_Datos_ACUCON
 * - BD_Datos_CARNF
 * - BD_Datos_Aforos_y_Perdidas
 *
 * Salidas previstas:
 * - Gráfico: año-10 ... año consulta, mes/año-1 y mes/año consulta.
 * - Tabla: año-1, año consulta, mes/año consulta y mes/año-1 consulta.
 */

const DAY_MS = 86400000;
const EXCEL_EPOCH_UTC = Date.UTC(1899, 11, 30);

const DATABASE_KEYS = Object.freeze({
  acucon: "acucon",
  carnf: "carnf",
  aforosPerdidas: "aforosPerdidas",
});

function normalizeHeader(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\r\n\t_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function utcDate(year, month, day) {
  const result = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(result.getTime()) ? null : result;
}

/**
 * Admite Date, serial Excel, texto serial Excel, dd/mm/aaaa,
 * aaaa-mm-dd y cadenas interpretables por Date.
 */
export function parseDataDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return utcDate(
      value.getUTCFullYear(),
      value.getUTCMonth() + 1,
      value.getUTCDate(),
    );
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return new Date(EXCEL_EPOCH_UTC + Math.trunc(value) * DAY_MS);
  }

  const text = String(value ?? "").trim();
  if (!text) return null;

  if (/^\d+(?:\.\d+)?$/.test(text)) {
    const serial = Number(text);
    return Number.isFinite(serial)
      ? new Date(EXCEL_EPOCH_UTC + Math.trunc(serial) * DAY_MS)
      : null;
  }

  let match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (match) {
    return utcDate(Number(match[3]), Number(match[2]), Number(match[1]));
  }

  match = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/);
  if (match) {
    return utcDate(Number(match[1]), Number(match[2]), Number(match[3]));
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return utcDate(
    parsed.getUTCFullYear(),
    parsed.getUTCMonth() + 1,
    parsed.getUTCDate(),
  );
}

function dateTimestamp(value) {
  const parsed = parseDataDate(value);
  return parsed ? parsed.getTime() : Number.NaN;
}

export function formatDataDate(value) {
  const parsed = parseDataDate(value);
  if (!parsed) return null;

  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(parsed);
}

export function formatMonthYear(year, month) {
  return new Intl.DateTimeFormat("es-ES", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  })
    .format(utcDate(year, month, 1))
    .replace(".", "")
    .replace(" ", "-");
}

function valueFromRecord(record, acceptedHeaders) {
  if (!record || typeof record !== "object") return null;
  const accepted = new Set(acceptedHeaders.map(normalizeHeader));
  const found = Object.entries(record).find(([key]) =>
    accepted.has(normalizeHeader(key)),
  );
  return found ? found[1] : null;
}

function consultationDateValue(record) {
  return valueFromRecord(record, ["FECHA", "Fecha"]);
}

function dataDateValue(record) {
  return valueFromRecord(record, [
    "FECHA DATOS",
    "FECHA\nDATOS",
    "Fecha Datos",
    "FECHA_DATOS",
  ]);
}

function normalizeRecords(records) {
  if (!Array.isArray(records)) return [];

  return records
    .map((record) => {
      const selectedDate = parseDataDate(consultationDateValue(record));
      const selectedDataDate = parseDataDate(dataDateValue(record));
      return {
        record,
        selectedDate,
        selectedDataDate,
        selectedDateTimestamp: selectedDate?.getTime() ?? Number.NaN,
        selectedDataDateTimestamp: selectedDataDate?.getTime() ?? Number.NaN,
      };
    })
    .filter(
      (item) =>
        Number.isFinite(item.selectedDateTimestamp) &&
        Number.isFinite(item.selectedDataDateTimestamp),
    );
}

function emptySelection({ year, month = null, referenceDate = null, type }) {
  return Object.freeze({
    type,
    consultationYear: year,
    consultationMonth: month,
    referenceDate: parseDataDate(referenceDate),
    selectedDate: null,
    selectedDataDate: null,
    selectedDateFormatted: null,
    selectedDataDateFormatted: null,
    records: [],
  });
}

function buildSelection(items, metadata) {
  if (!items.length) return emptySelection(metadata);

  const selectedDateTimestamp = Math.max(
    ...items.map((item) => item.selectedDateTimestamp),
  );
  const recordsAtSelectedDate = items.filter(
    (item) => item.selectedDateTimestamp === selectedDateTimestamp,
  );
  const selectedDataDateTimestamp = Math.max(
    ...recordsAtSelectedDate.map((item) => item.selectedDataDateTimestamp),
  );
  const selectedItems = recordsAtSelectedDate.filter(
    (item) => item.selectedDataDateTimestamp === selectedDataDateTimestamp,
  );

  const selectedDate = new Date(selectedDateTimestamp);
  const selectedDataDate = new Date(selectedDataDateTimestamp);

  return Object.freeze({
    type: metadata.type,
    consultationYear: metadata.year,
    consultationMonth: metadata.month ?? null,
    referenceDate: parseDataDate(metadata.referenceDate),
    selectedDate,
    selectedDataDate,
    selectedDateFormatted: formatDataDate(selectedDate),
    selectedDataDateFormatted: formatDataDate(selectedDataDate),
    records: selectedItems.map((item) => item.record),
  });
}

/**
 * Consulta mensual:
 * 1. FECHA dentro del mes/año pedido.
 * 2. FECHA DATOS <= fecha de referencia.
 * 3. FECHA más alta del mes.
 * 4. FECHA DATOS más alta asociada a esa FECHA.
 */
export function selectMonthlyDataDate(
  records,
  { consultationYear, consultationMonth, referenceDate },
) {
  if (!Number.isInteger(consultationYear)) {
    throw new TypeError("consultationYear debe ser un año entero.");
  }
  if (
    !Number.isInteger(consultationMonth) ||
    consultationMonth < 1 ||
    consultationMonth > 12
  ) {
    throw new RangeError("consultationMonth debe estar entre 1 y 12.");
  }

  const referenceTimestamp = dateTimestamp(referenceDate);
  if (!Number.isFinite(referenceTimestamp)) {
    throw new TypeError("referenceDate no es una fecha válida.");
  }

  const candidates = normalizeRecords(records).filter((item) => {
    const date = item.selectedDate;
    return (
      date.getUTCFullYear() === consultationYear &&
      date.getUTCMonth() + 1 === consultationMonth &&
      item.selectedDataDateTimestamp <= referenceTimestamp
    );
  });

  return buildSelection(candidates, {
    type: "monthly",
    year: consultationYear,
    month: consultationMonth,
    referenceDate,
  });
}

/**
 * Consulta anual:
 * 1. Localiza la FECHA más alta existente dentro del año.
 * 2. Para esa FECHA, localiza la FECHA DATOS más alta.
 * No aplica límite de fecha de referencia.
 */
export function selectAnnualDataDate(records, consultationYear) {
  if (!Number.isInteger(consultationYear)) {
    throw new TypeError("consultationYear debe ser un año entero.");
  }

  const candidates = normalizeRecords(records).filter(
    (item) => item.selectedDate.getUTCFullYear() === consultationYear,
  );

  return buildSelection(candidates, {
    type: "annual",
    year: consultationYear,
  });
}

function validateDatabases({ acuconRecords, carnfRecords, lossesRecords }) {
  return {
    [DATABASE_KEYS.acucon]: Array.isArray(acuconRecords) ? acuconRecords : [],
    [DATABASE_KEYS.carnf]: Array.isArray(carnfRecords) ? carnfRecords : [],
    [DATABASE_KEYS.aforosPerdidas]: Array.isArray(lossesRecords)
      ? lossesRecords
      : [],
  };
}

/** Devuelve las tres fechas mensuales, una por base de datos. */
export function selectThreeMonthlyDataDates({
  acuconRecords,
  carnfRecords,
  lossesRecords,
  consultationYear,
  consultationMonth,
  referenceDate,
}) {
  const databases = validateDatabases({
    acuconRecords,
    carnfRecords,
    lossesRecords,
  });
  const parameters = { consultationYear, consultationMonth, referenceDate };

  return Object.freeze({
    acucon: selectMonthlyDataDate(databases.acucon, parameters),
    carnf: selectMonthlyDataDate(databases.carnf, parameters),
    aforosPerdidas: selectMonthlyDataDate(
      databases.aforosPerdidas,
      parameters,
    ),
  });
}

/** Devuelve las tres fechas anuales, una por base de datos. */
export function selectThreeAnnualDataDates({
  acuconRecords,
  carnfRecords,
  lossesRecords,
  consultationYear,
}) {
  const databases = validateDatabases({
    acuconRecords,
    carnfRecords,
    lossesRecords,
  });

  return Object.freeze({
    acucon: selectAnnualDataDate(databases.acucon, consultationYear),
    carnf: selectAnnualDataDate(databases.carnf, consultationYear),
    aforosPerdidas: selectAnnualDataDate(
      databases.aforosPerdidas,
      consultationYear,
    ),
  });
}

/**
 * Obtiene en una sola llamada las fechas mensual y anual necesarias
 * para las tres bases, sin imponer ninguna estructura de gráfico o tabla.
 */
export function createDataDateSelections({
  acuconRecords,
  carnfRecords,
  lossesRecords,
  consultationYear,
  consultationMonth,
  referenceDate,
  annualYears = [],
}) {
  const monthlyCurrent = selectThreeMonthlyDataDates({
    acuconRecords,
    carnfRecords,
    lossesRecords,
    consultationYear,
    consultationMonth,
    referenceDate,
  });

  const monthlyPreviousYear = selectThreeMonthlyDataDates({
    acuconRecords,
    carnfRecords,
    lossesRecords,
    consultationYear: consultationYear - 1,
    consultationMonth,
    referenceDate,
  });

  const annual = Object.fromEntries(
    annualYears.map((year) => [
      year,
      selectThreeAnnualDataDates({
        acuconRecords,
        carnfRecords,
        lossesRecords,
        consultationYear: year,
      }),
    ]),
  );

  return Object.freeze({
    monthlyCurrent,
    monthlyPreviousYear,
    annual: Object.freeze(annual),
  });
}
