const CONFIG = {
  template: "tablas_excel/Distribuido_Poblaciones.xlsx",
  source: "../base-datos/tablas-excel/BD_Balance_Poblaciones.xlsx",
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
  if (a && row.slice(1).every((v) => v === "" || v == null)) return "section";
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
      const code = state.matrix[r][0],
        factor = Number(state.matrix[r][3]) || 0;
      state.matrix[r][4] = monthly(code, py, pm) * factor;
      state.matrix[r][5] = monthly(code, state.year, state.month) * factor;
      state.matrix[r][6] = monthly(code, state.year - 1, state.month) * factor;
      state.matrix[r][8] = cumulative(code, state.year, state.month) * factor;
      state.matrix[r][9] =
        cumulative(code, state.year - 1, state.month) * factor;
      for (let c = 11; c <= 20; c++)
        state.matrix[r][c] = annual(code, state.year - 10 + (c - 11)) * factor;
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

  if (row === 1 && column >= 11 && column <= 20) {
    return String(Math.trunc(Number(value)));
  }

  if (column >= 4 && typeof value === "number") {
    return value.toLocaleString("es-ES", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  return String(value);
}

function renderTable() {
  const body = $("tableBody");

  body.innerHTML = "";

  state.matrix.forEach((row, rowIndex) => {
    const type = rowIndex < 2 ? "top" : rowType(row);
    const tableRow = document.createElement("tr");

    tableRow.className = `${type}-row`;

    if (type === "section") {
      const populationCell = document.createElement("td");

      populationCell.colSpan = 4;
      populationCell.className = "section-title-cell sticky-span";
      populationCell.textContent = row[0] ?? "";

      tableRow.appendChild(populationCell);

      for (let column = 4; column < 21; column += 1) {
        const cell = document.createElement("td");

        cell.classList.add(`logical-column-${column + 1}`);

        if (column === 7 || column === 10) {
          cell.classList.add("spacer-column");
        }

        cell.textContent = formatValue(
          row[column],
          column,
          rowIndex,
        );

        tableRow.appendChild(cell);
      }

      body.appendChild(tableRow);
      return;
    }

    if (type === "total") {
      const totalLabelCell = document.createElement("td");

      totalLabelCell.colSpan = 4;
      totalLabelCell.className = "total-label-cell sticky-span";
      totalLabelCell.textContent = row[3] ?? "";

      tableRow.appendChild(totalLabelCell);

      for (let column = 4; column < 21; column += 1) {
        const cell = document.createElement("td");

        cell.classList.add(`logical-column-${column + 1}`);

        if (column === 7 || column === 10) {
          cell.classList.add("spacer-column");
        } else {
          cell.classList.add("calculated");
        }

        cell.textContent = formatValue(
          row[column],
          column,
          rowIndex,
        );

        tableRow.appendChild(cell);
      }

      body.appendChild(tableRow);
      return;
    }

    for (let column = 0; column < 21; column += 1) {
      const cell = document.createElement("td");

      cell.classList.add(`logical-column-${column + 1}`);

      if (rowIndex === 0) {
        cell.classList.add("sticky-header-one");
      }

      if (rowIndex === 1) {
        cell.classList.add("sticky-header-two");
      }

      if (column <= 3) {
        cell.classList.add("sticky-left");
        cell.classList.add(`sticky-left-${column + 1}`);
      }

      if (column === 7 || column === 10) {
        cell.classList.add("spacer-column");
      }

      if (type === "detail" && column === 0) {
        cell.classList.add("editable-cell");

        const input = document.createElement("input");

        input.type = "text";
        input.value = row[column] ?? "";
        input.setAttribute(
          "aria-label",
          "Código de dispositivo",
        );

        input.addEventListener("change", () => {
          state.matrix[rowIndex][column] =
            input.value.trim();

          state.dirty = true;
          $("dirtyBadge").hidden = false;

          calculate();
        });

        cell.appendChild(input);
      } else if (type === "detail" && column === 3) {
        cell.classList.add("editable-cell");

        const select = document.createElement("select");

        select.className = "factor-select";
        select.setAttribute("aria-label", "Factor");

        [-1, 0, 1].forEach((factor) => {
          const option = document.createElement("option");

          option.value = String(factor);
          option.textContent = String(factor);
          option.selected =
            Number(row[column]) === factor;

          select.appendChild(option);
        });

        select.addEventListener("change", () => {
          state.matrix[rowIndex][column] =
            Number(select.value);

          state.dirty = true;
          $("dirtyBadge").hidden = false;

          calculate();
        });

        cell.appendChild(select);
      } else {
        cell.textContent = formatValue(
          row[column],
          column,
          rowIndex,
        );

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
      const value = state.matrix[r][c];
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
    const [template, balance] = await Promise.all([
      loadWorkbook(CONFIG.template),
      loadWorkbook(CONFIG.source),
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

    /*Eliminar únicamente las filas completamente vacías situadas al final del Excel.*/
    while (
      state.matrix.length > 0 &&
      state.matrix[state.matrix.length - 1].every((value) => value == null || String(value).trim() === "",)
    ) {
      state.matrix.pop();
    }

    /*Mantener 21 columnas en las filas que sí forman parte de la plantilla.*/
    for (const row of state.matrix) {
      while (row.length < 21) {
        row.push("");
      }
    }
    state.records = parseBalance(balance);
    buildAggregates();
    $("dataStatus").textContent =
      `${state.records.length.toLocaleString("es-ES")} registros cargados`;
    $("sourceInfo").textContent =
      `Balance de poblaciones: ${state.records.length.toLocaleString("es-ES")} registros`;
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