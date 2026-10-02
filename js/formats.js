export function pad(value) {
  return String(value).padStart(2, "0");
}

export function normalizeText(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
}

export function parseSpanishNumber(value) {
  if (value == null || value === "") {
    return 0;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  let text = String(value)
    .trim()
    .replace(/\s+/g, "");

  if (!text) {
    return 0;
  }

  /*
   * Formato español con puntos de millares:
   *
   * 4.916        -> 4916
   * 7.897.930    -> 7897930
   * 25.306,20    -> 25306.20
   */
  if (
    /^[+-]?\d{1,3}(?:\.\d{3})+(?:,\d+)?$/.test(
      text,
    )
  ) {
    text = text
      .replace(/\./g, "")
      .replace(",", ".");
  } else if (/^[+-]?\d+,\d+$/.test(text)) {
    text = text.replace(",", ".");
  }

  const number = Number(text);

  return Number.isFinite(number) ? number : 0;
}

export function formatSpanishNumber(
  value,
  decimals = 2,
) {
  const number =
    typeof value === "number"
      ? value
      : parseSpanishNumber(value);

  if (!Number.isFinite(number)) {
    return String(value ?? "");
  }

  const factor = 10 ** decimals;

  let rounded =
    Math.round((number + Number.EPSILON) * factor) /
    factor;

  if (
    Object.is(rounded, -0) ||
    Math.abs(rounded) < 0.005
  ) {
    rounded = 0;
  }

  /*
   * Entero real:
   * 90       -> 90
   * 4916     -> 4.916
   *
   * No entero que redondea a entero:
   * 90.00001 -> 90,00
   */
  const visibleDecimals = Number.isInteger(number)
    ? 0
    : decimals;

  return rounded.toLocaleString("es-ES", {
    minimumFractionDigits: visibleDecimals,
    maximumFractionDigits: visibleDecimals,
    useGrouping: "always",
  });
}
const SPANISH_MONTHS = {
  enero: 1,
  ene: 1,
  febrero: 2,
  feb: 2,
  marzo: 3,
  mar: 3,
  abril: 4,
  abr: 4,
  mayo: 5,
  may: 5,
  junio: 6,
  jun: 6,
  julio: 7,
  jul: 7,
  agosto: 8,
  ago: 8,
  septiembre: 9,
  sept: 9,
  sep: 9,
  octubre: 10,
  oct: 10,
  noviembre: 11,
  nov: 11,
  diciembre: 12,
  dic: 12,
};

export function parseSpreadsheetDate(value) {
  if (value == null || value === "") {
    return "";
  }

  if (value instanceof Date && !isNaN(value)) {
    return (
      `${value.getFullYear()}-` +
      `${pad(value.getMonth() + 1)}-` +
      `${pad(value.getDate())}`
    );
  }

  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);

    return parsed
      ? `${parsed.y}-${pad(parsed.m)}-${pad(parsed.d)}`
      : "";
  }

  const text = String(value)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  let match = text.match(
    /^(\d{4})-(\d{1,2})-(\d{1,2})/,
  );

  if (match) {
    return (
      `${match[1]}-` +
      `${pad(match[2])}-` +
      `${pad(match[3])}`
    );
  }

  match = text.match(
    /^(\d{1,2})\d{1,2}\d{2}|\d{4}$/,
  );

  if (match) {
    let year = Number(match[3]);

    if (year < 100) {
      year += year >= 70 ? 1900 : 2000;
    }

    return (
      `${year}-` +
      `${pad(match[2])}-` +
      `${pad(match[1])}`
    );
  }

  match = text.match(
    /^([a-z]+)[\s/-]+(\d{2}|\d{4})$/,
  );

  if (match && SPANISH_MONTHS[match[1]]) {
    let year = Number(match[2]);

    if (year < 100) {
      year += year >= 70 ? 1900 : 2000;
    }

    return (
      `${year}-` +
      `${pad(SPANISH_MONTHS[match[1]])}-01`
    );
  }

  return "";
}
