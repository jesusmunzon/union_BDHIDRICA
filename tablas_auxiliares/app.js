const CONFIG = {
  template: "tablas_excel/Distribuido_Poblaciones.xlsx",
  source: "../base-datos/tablas-excel/BD_Balance_Poblaciones.xlsx",
  sourceRed: "../base-datos/tablas-excel/BD_Datos_Red.xlsx",
  sheet: "Distribuido_Poblaciones",
};
const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];
const state = {
  templateWorkbook: null,
  templateSheet: null,
  matrix: [],
  records: [],
  aggregates: new Map(),
  redRecords: [],
  redAggregates: new Map(),
  dirty: false,
  month: 8,
  year: 2023,
};
const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, "0");
const norm = (s) =>
  String(s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();
function toast(text) {
  $("toast").textContent = text;
  $("toast").classList.add("show");
  setTimeout(() => $("toast").classList.remove("show"), 2200);
}
function excelDate(value) {
  if (value instanceof Date && !isNaN(value))
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
  if (typeof value === "number") {
    const d = XLSX.SSF.parse_date_code(value);
    return d ? `${d.y}-${pad(d.m)}-${pad(d.d)}` : "";
  }
  const s = String(value ?? "").trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  return m ? `${m[3]}-${pad(m[2])}-${pad(m[1])}` : "";
}
async function loadWorkbook(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  return XLSX.read(await response.arrayBuffer(), {
    type: "array",
    cellDates: true,
  });
}
function parseBalance(workbook) {
  const sheet =
    workbook.Sheets[
      workbook.SheetNames.includes("Balance_Pobla")
        ? "Balance_Pobla"
        : workbook.SheetNames[0]
    ];
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const find = (...names) => headers.find((h) => names.includes(norm(h)));
  const dateKey = find("FECHA", "FECHA DATOS");
  const codeKey = find("COD_DISP", "COD DISP", "CODIGO DISP.", "CÓDIGO DISP.");
  const valueKey = find("CMES");
  if (!dateKey || !codeKey || !valueKey)
    throw new Error(
      "El Excel de Balance debe contener FECHA, COD_DISP y CMES.",
    );
  return rows
    .map((row) => ({
      date: excelDate(row[dateKey]),
      code: String(row[codeKey] ?? "").trim(),
      value: Number(row[valueKey]) || 0,
    }))
    .filter((r) => r.date && r.code);
}
/*
 * Lee los ajustes mensuales de BD_Datos_Red.xlsx.
 *
 * Para la excepción ATE Burguillos se utilizan:
 * - FECHA
 * - Procedencia 1
 * - Ajuste
 */
function parseDatosRed(workbook) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];

  const rows = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: true,
  });

  const headers = rows.length ? Object.keys(rows[0]) : [];

  const find = (...names) =>
    headers.find((header) => names.includes(norm(header)));

  const dateKey = find("FECHA", "FECHA DATOS");

  const originKey = find(
    "PROCEDENCIA 1",
    "PROCEDENCIA1",
    "PROCEDENCIA",
  );

  const adjustmentKey = find("AJUSTE");

  if (!dateKey || !originKey || !adjustmentKey) {
    throw new Error(
      "BD_Datos_Red.xlsx debe contener FECHA, Procedencia 1 y Ajuste.",
    );
  }

  return rows
    .map((row) => ({
      date: excelDate(row[dateKey]),
      origin: String(row[originKey] ?? "").trim(),
      adjustment: parseSpanishNumber(row[adjustmentKey]),
    }))
    .filter((record) => record.date && record.origin);
}

/*
 * Convierte correctamente números procedentes de Excel,
 * incluidos valores escritos como texto con formato español.
 */
function parseSpanishNumber(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  let text = String(value ?? "").trim();

  if (!text) return 0;

  text = text.replace(/\s/g, "");

  /*
   * Formato español:
   * 1.234,56 -> 1234.56
   */
  if (text.includes(",")) {
    text = text.replace(/\./g, "").replace(",", ".");
  }

  const number = Number(text);

  return Number.isFinite(number) ? number : 0;
}

/*
 * Crea un acumulado mensual por:
 *
 * Procedencia 1 + año + mes
 */
function buildRedAggregates() {
  state.redAggregates.clear();
  for (const record of state.redRecords) {
    const year = Number(record.date.slice(0, 4));
    const month = Number(record.date.slice(5, 7));
    const key = `${norm(record.origin)}|${year}|${month}`;
    state.redAggregates.set(
      key,
      (state.redAggregates.get(key) || 0) + record.adjustment,
    );
  }
}
/* Devuelve la suma de Ajuste para una procedencia,
 * año y mes determinados.*/
function monthlyRedAdjustment(origin, year, month) {
  const key = `${norm(origin)}|${year}|${month}`;

  return state.redAggregates.get(key) || 0;
}
/* Determina si una fila es la excepción ATE Burguillos.
 *
 * Columna B: NOM_DISP
 * Columna C: POBLACIÓN*/
function isAteBurguillos(row) {
  const deviceName = norm(row[1]);
  const population = norm(row[2]);
  return (
    deviceName === "ATE BURGUILLOS" &&
    population === "BURGUILLOS"
  );
}
function buildAggregates() {
  state.aggregates.clear();
  for (const r of state.records) {
    const year = +r.date.slice(0, 4),
      month = +r.date.slice(5, 7),
      key = `${norm(r.code)}|${year}|${month}`;
    state.aggregates.set(key, (state.aggregates.get(key) || 0) + r.value);
  }
}
function monthly(code, year, month) {
  return state.aggregates.get(`${norm(code)}|${year}|${month}`) || 0;
}
function cumulative(code, year, endMonth) {
  let total = 0;
  for (let m = 1; m <= endMonth; m++) total += monthly(code, year, m);
  return total;
}
function annual(code, year) {
  return cumulative(code, year, 12);
}
function updatePeriodHeaders() {
  let py = state.year,
    pm = state.month - 1;
  if (pm === 0) {
    pm = 12;
    py--;
  }
  state.matrix[1][4] = `${pad(pm)}/${py}`;
  state.matrix[1][5] = `${pad(state.month)}/${state.year}`;
  state.matrix[1][6] = `${pad(state.month)}/${state.year - 1}`;
  state.matrix[1][8] = state.matrix[1][5];
  state.matrix[1][9] = state.matrix[1][6];
  for (let c = 11; c <= 20; c++)
    state.matrix[1][c] = state.year - 10 + (c - 11);
}
function rowType(row) {
  const a = String(row[0] ?? "").trim(),
    d = row[3];
  /* Una fila es un título de población cuando:
  * - La columna A contiene el nombre.
  * - Las columnas B, C y D están vacías.
  *
  * Se ignoran posibles valores residuales desde E hasta U.
  */
  if (a && [row[1], row[2], row[3]].every((value) => value == null || String(value).trim() === "",)) {
    return "section";
  }
  if (norm(a) === "COD_DISP") return "header";
  if (
    String(d ?? "")
      .trim()
      .toUpperCase()
      .startsWith("TOTAL")
  )
    return "total";
  if (a && typeof d === "number") return "detail";
  return "blank";
}
function calculate() {
  updatePeriodHeaders();
  let py = state.year,
    pm = state.month - 1;
  if (pm === 0) {
    pm = 12;
    py--;
  }
  let blockStart = null;
  for (let r = 2; r < state.matrix.length; r++) {
    const type = rowType(state.matrix[r]);
    if (type === "header") {
      blockStart = r + 1;
      continue;
    }
    
    if (type === "detail") {
      const currentRow = state.matrix[r];
      const code = currentRow[0];
      const population = currentRow[2];
      const factor = Number(currentRow[3]) || 0;
      /* EXCEPCIÓN: ATE Burguillos
      * Solamente afecta a las columnas E, F y G.
      * El valor de la columna C, Burguillos, se busca
      * en Procedencia 1 de BD_Datos_Red.xlsx.
      * El resultado procede de la columna Ajuste.*/
      if (isAteBurguillos(currentRow)) {
        state.matrix[r][4] =
          monthlyRedAdjustment(population, py, pm) * factor;
        state.matrix[r][5] =
          monthlyRedAdjustment(population, state.year, state.month,) * factor;
        state.matrix[r][6] =
          monthlyRedAdjustment(population, state.year - 1, state.month,) * factor;
        /* Por ahora no se modifican I, J ni L-U para esta excepción.*/
        continue;
      }
      /* Comportamiento normal del resto de dispositivos.*/
      state.matrix[r][4] = monthly(code, py, pm) * factor;
      state.matrix[r][5] =
        monthly(code, state.year, state.month) * factor;
      state.matrix[r][6] =
        monthly(code, state.year - 1, state.month) * factor;
      state.matrix[r][8] =
        cumulative(code, state.year, state.month) * factor;
      state.matrix[r][9] =
        cumulative(code, state.year - 1, state.month) * factor;
      for (let c = 11; c <= 20; c++) {
        state.matrix[r][c] =
          annual(code, state.year - 10 + (c - 11)) * factor;
      }
      continue;
    }
    if (type === "total" && blockStart !== null) {
      for (const c of [4, 5, 6, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]) {
        let total = 0;
        for (let rr = blockStart; rr < r; rr++)
          if (rowType(state.matrix[rr]) === "detail")
            total += Number(state.matrix[rr][c]) || 0;
        state.matrix[r][c] = total;
      }
      blockStart = null;
    }
  }
  renderTable();
}
function formatValue(value, column, row) {
  if (value == null || value === "") return "";

  /* Los años de la segunda fila se muestran sin decimales.*/
  if (row === 1 && column >= 11 && column <= 20) {
    return String(Math.trunc(Number(value)));
  }
  /* Formato de los resultados numéricos.*/
  if (column >= 4 && typeof value === "number") {
    /* Cualquier valor cuya representación con dos decimales
     * sea cero se normaliza como cero positivo.
     * Ejemplos:
     * -0,0049 -> 0,00
     * -0,0001 -> 0,00
     * -0       -> 0,00
     * -0,005   -> -0,01
     */
    const displayValue = Math.abs(value) < 0.005 ? 0 : value;

    return displayValue.toLocaleString("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }
  return String(value);
}

function renderTable() {
  const body = $("tableBody");

  body.innerHTML = "";

  /* Localiza la última fila que contiene algún valor.
  * Las filas vacías intermedias se conservan, pero las filas
  * vacías situadas al final de la tabla no se muestran.*/
  let lastContentRow = state.matrix.length - 1;

  while (
    lastContentRow >= 0 &&
    state.matrix[lastContentRow].every(
      (value) => value == null || String(value).trim() === "",
    )
  ) {
    lastContentRow -= 1;
  }

  state.matrix.slice(0, lastContentRow + 1).forEach((row, rowIndex) => {
    const type = rowIndex < 2 ? "top" : rowType(row);
    const tableRow = document.createElement("tr");

    tableRow.className = `${type}-row`;

    /*
     * FILA CON EL NOMBRE DE LA POBLACIÓN
     * Combina visualmente las columnas A, B, C y D.
     */
    if (type === "section") {
      const populationCell = document.createElement("td");

      populationCell.colSpan = 4;
      populationCell.className = "section-title-cell";
      populationCell.textContent = row[0] ?? "";

      tableRow.appendChild(populationCell);

      /*
       * Añade las columnas E hasta U.
       */
      for (let column = 4; column < 21; column += 1) {
        const cell = document.createElement("td");

        if (column >= 4 && column <= 6) {
          cell.classList.add("period-column");
        }
        if (column === 8 || column === 9) {
          cell.classList.add("accumulated-column");
        }

        if (column >= 11 && column <= 20) {
          cell.classList.add("annual-column");
        }

        if (column === 7 || column === 10) {
          cell.classList.add("spacer-column");
        }

        cell.textContent = formatValue(row[column], column, rowIndex);
        tableRow.appendChild(cell);
      }

      body.appendChild(tableRow);
      return;
    }

    /*
     * FILAS DE TOTAL
     * Combina las columnas A, B, C y D.
     */
    if (type === "total") {
      const totalLabelCell = document.createElement("td");

      totalLabelCell.colSpan = 4;
      totalLabelCell.className = "total-label-cell";
      totalLabelCell.textContent = row[3] ?? "";

      tableRow.appendChild(totalLabelCell);

      /*
       * Añade los resultados desde E hasta U.
       */
      for (let column = 4; column < 21; column += 1) {
        const cell = document.createElement("td");

        if (column >= 4 && column <= 6) {
          cell.classList.add("period-column");
        }
        if (column === 8 || column === 9) {
          cell.classList.add("accumulated-column");
        }

        if (column >= 11 && column <= 20) {
          cell.classList.add("annual-column");
        }

        if (column === 7 || column === 10) {
          cell.classList.add("spacer-column");
        } else {
          cell.classList.add("calculated");
        }

        cell.textContent = formatValue(row[column], column, rowIndex);
        tableRow.appendChild(cell);
      }

      body.appendChild(tableRow);
      return;
    }

    /* RESTO DE FILAS
     * Incluye encabezados, detalles y filas vacías.*/
    for (let column = 0; column < 21; column += 1) {
      /* En la primera fila, las columnas E, F y G se muestran
       * como un único encabezado combinado.*/
      if (
          rowIndex === 0 &&
          (
            column === 5 ||
            column === 6 ||
            column === 9 ||
            (column >= 12 && column <= 20)
          )
        ) {
          continue;
        }

      const cell = document.createElement("td");

      if (rowIndex === 0 && column === 4) {
        /* Encabezado combinado de E, F y G.*/
        cell.colSpan = 3;
        cell.classList.add("period-group-header");
      } else if (rowIndex === 0 && column === 8) {
        /* Encabezado combinado de I y J.*/
        cell.colSpan = 2;
        cell.classList.add("accumulated-group-header");
      } else if (rowIndex === 0 && column === 11) {
        /* Encabezado combinado desde L hasta U.*/
        cell.colSpan = 10;
        cell.classList.add("annual-group-header");
      } else {
        if (column >= 4 && column <= 6) {
          cell.classList.add("period-column");
        }
        if (column === 8 || column === 9) {
          cell.classList.add("accumulated-column");
        }
        if (column >= 11 && column <= 20) {
          cell.classList.add("annual-column");
        }
      }


      if (column === 7 || column === 10) {
        cell.classList.add("spacer-column");
      }

      /*
       * Solo son editables COD_DISP y FACTOR
       * en las filas de detalle.
       */
      if (type === "detail" && (column === 0 || column === 3)) {
        cell.classList.add("editable-cell");

        /*
         * Columna D: selector FACTOR.
         */
        if (column === 3) {
          const select = document.createElement("select");

          select.className = "factor-select";
          select.setAttribute("aria-label", "Factor");

          [-1, 0, 1].forEach((factor) => {
            const option = document.createElement("option");

            option.value = String(factor);
            option.textContent = String(factor);
            option.selected = Number(row[column]) === factor;

            select.appendChild(option);
          });

          select.addEventListener("change", () => {
            state.matrix[rowIndex][column] = Number(select.value);
            state.dirty = true;
            $("dirtyBadge").hidden = false;

            calculate();
          });

          cell.appendChild(select);
        } else {
          /*
           * Columna A: COD_DISP.
           */
          const input = document.createElement("input");

          input.type = "text";
          input.value = row[column] ?? "";
          input.setAttribute("aria-label", "Código de dispositivo");

          input.addEventListener("change", () => {
            state.matrix[rowIndex][column] = input.value.trim();
            state.dirty = true;
            $("dirtyBadge").hidden = false;

            calculate();
          });

          cell.appendChild(input);
        }
      } else {
        /*
         * Celdas no editables.
         */
        cell.textContent = formatValue(row[column], column, rowIndex);

        if (column >= 4 && ![7, 10].includes(column)) {
          cell.classList.add("calculated");
        }
      }

      tableRow.appendChild(cell);
    }

    body.appendChild(tableRow);
  });
}

function saveExcel() {
  const ws = state.templateSheet;
  for (let r = 0; r < state.matrix.length; r++) {
    for (let c = 0; c < 21; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      const originalValue = state.matrix[r][c];
      const value = typeof originalValue === "number" && c >= 4 && Math.abs(originalValue) < 0.005 ? 0 : originalValue;
      if (value == null || value === "") {
        if (ws[addr]) delete ws[addr];
        continue;
      }
      ws[addr] = { t: typeof value === "number" ? "n" : "s", v: value };
      if (typeof value === "number" && c >= 4) {
        ws[addr].z = r === 1 && c >= 11 && c <= 20 ? "0" : "#,##0.00";
      }
    }
  }
  let blockStart = null;
  for (let r = 2; r < state.matrix.length; r++) {
    const type = rowType(state.matrix[r]);
    if (type === "header") blockStart = r + 1;
    if (type === "total" && blockStart !== null) {
      for (const c of [4, 5, 6, 8, 9, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]) {
        const addr = XLSX.utils.encode_cell({ r, c });
        const col = XLSX.utils.encode_col(c);
        ws[addr] = {
          t: "n",
          f: `SUM(${col}${blockStart + 1}:${col}${r})`,
          v: Number(state.matrix[r][c]) || 0,
          z: "#,##0.00",
        };
      }
      blockStart = null;
    }
  }
  XLSX.writeFile(
    state.templateWorkbook,
    "Distribuido_Poblaciones_modificado.xlsx",
    { compression: true },
  );
  state.dirty = false;
  $("dirtyBadge").hidden = true;
  toast("Excel descargado");
}
function initializeFilters() {
  const storedMonth = Number(localStorage.getItem("control-red-month")),
    storedYear = Number(localStorage.getItem("control-red-year"));
  state.month = storedMonth >= 1 && storedMonth <= 12 ? storedMonth : 8;
  state.year = storedYear >= 2000 ? storedYear : 2023;
  $("monthFilter").innerHTML = MONTHS.map(
    (m, i) =>
      `<option value="${i + 1}" ${i + 1 === state.month ? "selected" : ""}>${m}</option>`,
  ).join("");
  const years = [];
  for (let y = 2009; y <= new Date().getFullYear(); y++) years.push(y);
  $("yearFilter").innerHTML = years
    .map((y) => `<option ${y === state.year ? "selected" : ""}>${y}</option>`)
    .join("");
  $("monthFilter").onchange = () => {
    state.month = +$("monthFilter").value;
    localStorage.setItem("control-red-month", state.month);
    calculate();
  };
  $("yearFilter").onchange = () => {
    state.year = +$("yearFilter").value;
    localStorage.setItem("control-red-year", state.year);
    calculate();
  };
}
function initializeShell() {
  lucide.createIcons();
  const sidebar = $("sidebar"),
    overlay = $("overlay"),
    close = () => {
      sidebar.classList.remove("open");
      overlay.classList.remove("open");
    };
  $("openMenu").onclick = () => {
    sidebar.classList.add("open");
    overlay.classList.add("open");
  };
  $("closeMenu").onclick = close;
  overlay.onclick = close;
  $("saveExcel").onclick = saveExcel;
}
async function initialize() {
  initializeShell();
  initializeFilters();
  try {
    const [template, balance, datosRed] = await Promise.all([
      loadWorkbook(CONFIG.template),
      loadWorkbook(CONFIG.source),
      loadWorkbook(CONFIG.sourceRed),
    ]);
    state.templateWorkbook = template;
    state.templateSheet =
      template.Sheets[
        template.SheetNames.includes(CONFIG.sheet)
          ? CONFIG.sheet
          : template.SheetNames[0]
      ];
    state.matrix = XLSX.utils.sheet_to_json(state.templateSheet, {
      header: 1,
      defval: "",
      raw: true,
    });
    while (state.matrix.length < 217) state.matrix.push([]);
    for (const row of state.matrix) while (row.length < 21) row.push("");
    state.records = parseBalance(balance);
    buildAggregates();
    state.redRecords = parseDatosRed(datosRed);
    buildRedAggregates();
    $("dataStatus").textContent =
      `${state.records.length.toLocaleString("es-ES")} registros cargados`;
    $("sourceInfo").textContent =
      `Balance de poblaciones: ${state.records.length.toLocaleString("es-ES")} registros · ` +
      `Datos de red: ${state.redRecords.length.toLocaleString("es-ES")} registros`;
    calculate();
  } catch (error) {
    console.error(error);
    $("dataStatus").textContent = "Error cargando datos";
    $("errorBox").hidden = false;
    $("errorBox").textContent =
      `No se pudo completar la carga: ${error.message}`;
  }
}
initialize();