import {
  normalizeText,
} from "./formats.js";

export function sheetRows(workbook) {
  const sheet =
    workbook.Sheets[workbook.SheetNames[0]];

  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: true,
  });
}

export function findHeaderRow(
  rows,
  requiredHeaders,
) {
  return rows.findIndex((row) => {
    const normalized = row.map(normalizeText);

    return requiredHeaders.every((acceptedNames) =>
      acceptedNames.some((name) =>
        normalized.includes(normalizeText(name)),
      ),
    );
  });
}

export function headerIndexMap(headerRow) {
  const indexes = new Map();

  headerRow.forEach((value, index) => {
    indexes.set(normalizeText(value), index);
  });

  return indexes;
}

export function findColumnIndex(
  indexMap,
  ...acceptedNames
) {
  for (const name of acceptedNames) {
    const index = indexMap.get(
      normalizeText(name),
    );

    if (index !== undefined) {
      return index;
    }
  }

  return -1;
}
