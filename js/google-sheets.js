import {
  GOOGLE_DATABASE,
} from "./config.js";

export function googleSheetCsvUrl(sheetName) {
  const parameters = new URLSearchParams({
    tqx: "out:csv",
    sheet: sheetName,
    headers: "1",
    _: String(Date.now()),
  });

  return (
    "https://docs.google.com/spreadsheets/d/" +
    `${GOOGLE_DATABASE.spreadsheetId}/gviz/tq?` +
    parameters
  );
}

export async function loadGoogleSheet(sheetName) {
  const response = await fetch(
    googleSheetCsvUrl(sheetName),
    {
      cache: "no-store",
    },
  );

  if (!response.ok) {
    throw new Error(
      `${sheetName}: HTTP ${response.status}`,
    );
  }

  const csv = await response.text();

  if (
    !csv.trim() ||
    /^<!doctype html/i.test(csv.trim())
  ) {
    throw new Error(
      `No se pudo leer la pestaña ${sheetName}. ` +
      "Comprueba el acceso y el nombre.",
    );
  }

  return XLSX.read(csv, {
    type: "string",
    raw: true,
    cellDates: false,
  });
}

export async function loadGoogleSheets(
  sheetNames,
) {
  const workbooks = await Promise.all(
    sheetNames.map(loadGoogleSheet),
  );

  return Object.fromEntries(
    sheetNames.map((sheetName, index) => [
      sheetName,
      workbooks[index],
    ]),
  );
}
