import { GOOGLE_DATABASE } from '../js/config.js';
import { loadGoogleSheet } from '../js/google-sheets.js';
import { excelDate, norm, parseSpanishNumber } from '../js/formats.js';
import {
  findColumnIndex,
  findHeaderRow,
  headerIndexMap,
  sheetRows,
} from '../js/table-utils.js';
import { createHydraulicCalculator, HYDRAULIC_COLUMN_INDEXES } from '../js/hydraulic-calculations.js';
import {
  selectMonthlyDataDate,
  selectAnnualDataDate,
} from '../js/data-date-selection.js';
import { C, options } from './Chart.js';

const MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const charts = {};
let data = {
  red: [],
  acuconRows: [],
  carnfRows: [],
  aforosRows: [],
  populationRows: [],
  legacyRows: [],
  phgAnnualRows: [],
};

const number = (value) => Number(value || 0);
const key = (value, year, month) => `${norm(value)}|${year}|${month}`;

function rawRowsFromSheet(workbook) {
  return sheetRows(workbook).slice(1);
}
function cleanCode(value) {
  return String(value ?? '').trim().toUpperCase();
}

/*
 * BD_CHG_Poblacion:
 * A = Año, B = Población, C = Nº Habitantes, D = código EM/TO.
 */
function populationSum(rows, requestedPopulation, populationYear, options = {}) {
  const acceptedCodes =
    requestedPopulation === 0
      ? new Set(['EM'])
      : new Set(['EM', 'TO']);

  return rows.reduce((total, row) => {
    const rowYear = Number(parseSpanishNumber(row[HYDRAULIC_COLUMN_INDEXES.population.year], NaN));
    const populationName = norm(row[HYDRAULIC_COLUMN_INDEXES.population.name]);
    const inhabitants = parseSpanishNumber(row[HYDRAULIC_COLUMN_INDEXES.population.inhabitants], 0);
    const populationCode = cleanCode(row[HYDRAULIC_COLUMN_INDEXES.population.code]);

    if (rowYear !== Number(populationYear)) return total;
    if (!acceptedCodes.has(populationCode)) return total;
    if (
      options.excludePopulation &&
      populationName === norm(options.excludePopulation)
    ) {
      return total;
    }

    return total + inhabitants;
  }, 0);
}

/* BD_PDistribucion_Antiguo: A = Año; B = pérdidas en dam³/día. */
function legacyLossesDaily(rows, year) {
  const row = rows.find(
    (candidate) =>
      Number(parseSpanishNumber(candidate[0], NaN)) === Number(year),
  );
  return row ? parseSpanishNumber(row[1], 0) : 0;
}

function redRecords(workbook) {
  return sheetRows(workbook).slice(1).map((row) => ({
    date: excelDate(row[0]), type: String(row[2] ?? ''), subtype: String(row[3] ?? ''),
    origin1: String(row[4] ?? ''), origin2: String(row[5] ?? ''),
    value: parseSpanishNumber(row[7], 0),
  })).filter((record) => record.date);
}
function makeCumulative(records, property) {
  const monthly = new Map();
  const result = new Map();

  records.forEach((record) => {
    const year = Number(record.date.slice(0, 4));
    const month = Number(record.date.slice(5, 7));
    const mapKey = key(record[property], year, month);
    monthly.set(mapKey, (monthly.get(mapKey) || 0) + number(record.value));
  });

  const concepts = [...new Set(records.map((record) => norm(record[property])))];
  const years = [...new Set(records.map((record) => Number(record.date.slice(0, 4))))];

  concepts.forEach((concept) => {
    years.forEach((year) => {
      let accumulated = 0;
      for (let month = 1; month <= 12; month += 1) {
        accumulated += monthly.get(`${concept}|${year}|${month}`) || 0;
        result.set(`${concept}|${year}|${month}`, accumulated);
      }
    });
  });

  return result;
}

function selectedExternal(rows, valueIndexes, year, month, dateIndex, dataDateIndex) {
  const indexes = Array.isArray(valueIndexes) ? valueIndexes : [valueIndexes];
  const referenceTimestamp = Date.parse(`${document.getElementById('referenceDate').value}T23:59:59Z`);
  const prepared = rows.map((row) => {
    const date = excelDate(row[dateIndex]); const dataDate = excelDate(row[dataDateIndex]);
    return { row, timestamp: date ? Date.parse(`${date}T00:00:00Z`) : NaN,
      dataTimestamp: dataDate ? Date.parse(`${dataDate}T00:00:00Z`) : NaN };
  }).filter((x) => Number.isFinite(x.timestamp) && Number.isFinite(x.dataTimestamp));
  let selected;
  if (month === 12) {
    const yr = prepared.filter((x) => new Date(x.timestamp).getUTCFullYear() === year);
    if (!yr.length) return 0;
    const last = Math.max(...yr.map((x) => x.timestamp));
    selected = Math.max(...yr.filter((x) => x.timestamp === last).map((x) => x.dataTimestamp));
  } else {
    const mr = prepared.filter((x) => { const d = new Date(x.timestamp); return d.getUTCFullYear() === year && d.getUTCMonth() + 1 === month && x.dataTimestamp <= referenceTimestamp; });
    if (!mr.length) return 0; selected = Math.max(...mr.map((x) => x.dataTimestamp));
  }
  const begin=Date.UTC(year,0,1), end=Date.UTC(year,month,1);
  return prepared.reduce((total,x) => x.timestamp >= begin && x.timestamp < end && x.dataTimestamp === selected
    ? total + indexes.reduce((subtotal,index) => subtotal + parseSpanishNumber(x.row[index],0),0) : total, 0);
}
function createCalculator() {
  const type = makeCumulative(data.red, 'type');
  const subtype = makeCumulative(data.red, 'subtype');
  const origin1 = makeCumulative(data.red, 'origin1');
  const origin2 = makeCumulative(data.red, 'origin2');
  const get = (map, concept, year, month) =>
    map.get(key(concept, year, month)) || 0;

  return createHydraulicCalculator({
    typeAccumulated: (concept, year, month) => get(type, concept, year, month),
    subtypeAccumulated: (concept, year, month) =>
      get(subtype, concept, year, month),
    origin1Accumulated: (concept, year, month) =>
      get(origin1, concept, year, month),
    origin2Accumulated: (concept, year, month) =>
      get(origin2, concept, year, month),

    acuconAccumulated: (index, year, month) => selectedExternal(data.acuconRows, index, year, month, 0, 1),
    externalColumnsAccumulated: (source, indexes, year, month) =>
      source === 'acucon' ? selectedExternal(data.acuconRows, indexes, year, month, 0, 1) : 0,
    carnfAccumulated: (index, year, month) => selectedExternal(data.carnfRows, index, year, month, 0, 1),
    aforosAccumulated: (index, year, month) => selectedExternal(data.aforosRows, index, year, month, 0, 1),
    populationAccumulated: (populationType, populationYear, options = {}) =>
      populationSum(data.populationRows, populationType, populationYear, options),
    legacyDistributionLossesDaily: (year) =>
      legacyLossesDaily(data.legacyRows, year),
  });
}

const horizontalBarValueLabels = {
  id: 'horizontalBarValueLabels',
  afterDatasetsDraw(chart) {
    if (chart.canvas.id !== 'unitChart') return;

    const { ctx, chartArea } = chart;
    ctx.save();
    ctx.font = '600 10px Inter, sans-serif';
    ctx.fillStyle = '#46556b';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      meta.data.forEach((bar, index) => {
        const value = Number(dataset.data[index]);
        if (!Number.isFinite(value)) return;

        const label = Math.round(value).toLocaleString('es-ES');
        const preferredX = bar.x + 6;
        const labelWidth = ctx.measureText(label).width;
        const x = Math.min(preferredX, chartArea.right - labelWidth - 2);
        ctx.fillText(label, x, bar.y);
      });
    });

    ctx.restore();
  },
};

function draw(id, type, datasets, labels, chartOptions) {
  charts[id]?.destroy();
  charts[id] = new Chart(document.getElementById(id), {
    type,
    data: { labels, datasets },
    options: chartOptions,
    plugins: id === 'unitChart' ? [horizontalBarValueLabels] : [],
  });
}

const fmtVol=v=>(Number(v||0)/1000).toLocaleString('es-ES',{minimumFractionDigits:1,maximumFractionDigits:1});
const fmtPct=v=>`${(Number(v||0)*100).toLocaleString('es-ES',{minimumFractionDigits:2,maximumFractionDigits:2})}%`;
const periods=model=>[model.annualPrevious,model.annualCurrent,model.comparePrevious,model.compareCurrent];
function periodCells(row,model){return periods(model).map(p=>`<td>${fmtVol(p[row.key])}</td><td>${fmtPct(p[row.percentKey])}</td>`).join('')}
const mainRows=[
 {label:'AGUA CAPTADA',key:'captured',percentKey:'capturedPct',cls:'major'},
 {label:'AGUA OPERACIONES DE ADUCCIÓN',key:'conveyanceOperations',percentKey:'conveyanceOperationsPct'},
 {label:'PÉRDIDAS SUBSISTEMA ADUCCIÓN',key:'conveyanceLosses',percentKey:'conveyanceLossesPct',phg:'conveyance',note:'(3)'},
 {label:'AGUA ADUCIDA',key:'conveyed',percentKey:'conveyedPct',cls:'major'},
 {label:'AGUA ADUCIDA BRUTA EXPORTADA (ABE)',key:'rawExported',percentKey:'rawExportedPct'},
 {label:'AGUA ENTRADA ETAP',key:'etapInput',percentKey:'etapInputPct',cls:'major'},
 {label:'AGUA OPERACIONES DE TRATAMIENTO',key:'treatmentOperations',percentKey:'treatmentOperationsPct'},
 {label:'PÉRDIDAS SUBSISTEMA TRATAMIENTO',key:'treatmentLosses',percentKey:'treatmentLossesPct',phg:'treatment',note:'(4)'},
 {label:'AGUA PRODUCIDA ETAP',key:'etapProduced',percentKey:'etapProducedPct',cls:'major'},
 {label:'AGUA TRATADA IMPORTADA (ATI)',key:'treatedImported',percentKey:'treatedImportedPct'},
 {label:'AGUA SUMINISTRADA (1)',key:'supplied',percentKey:'suppliedPct',cls:'major'},
 {label:'AGUA TRATADA EXPORTADA (ATE)',key:'treatedExported',percentKey:'treatedExportedPct'},
 {label:'AGUA DISTRIBUIDA',key:'distributed',percentKey:'distributedPct',cls:'major'},
 {label:'PÉRDIDAS SUBSISTEMA DISTRIBUCIÓN',key:'distributionSubsystemLosses',percentKey:'distributionSubsystemLossesPct',phg:'distribution',note:'(5)'},
];
function phgCells(row,model){const p=row.phg&&model.phg?.[row.phg];return p?`<td>${fmtVol(p.capacity)}</td><td>${fmtVol(p.targetVolume)}</td><td>${fmtPct(p.percentage)}</td><td>${row.note||''}</td>`:`<td class="phg-empty"></td><td class="phg-empty"></td><td class="phg-empty"></td><td></td>`}
function billingRows(values){const months=['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];return months.map((m,i)=>`<tr><td>${m}</td><td>${values[i]==null||values[i]===0?'–':`${Math.round(values[i]*100)}%`}</td></tr>`).join('')}
function smallRows(model) {
  const valueCells = (key, pct) => periods(model)
    .map((period) => `<td>${fmtVol(period[key])}</td><td>${fmtPct(period[pct])}</td>`)
    .join('');
  return [
    `<tr><td class="balance-group" rowspan="2">AGUA DISTRIBUIDA</td><td class="concept">AGUA REGISTRADA (AR)</td>${valueCells('registeredWater', 'registeredWaterPct')}</tr>`,
    `<tr><td class="concept">AGUA NO REGISTRADA (ANR)</td>${valueCells('unregisteredWater', 'unregisteredWaterPct')}</tr>`,
    `<tr><td class="balance-group" rowspan="2">AGUA SUMINISTRADA</td><td class="concept">CONSUMO AUTORIZADO FACTURADO TOTAL</td>${valueCells('totalAuthorizedBilledConsumption', 'totalAuthorizedBilledConsumptionPct')}</tr>`,
    `<tr><td class="concept">AGUA NO FACTURADA</td>${valueCells('unbilledWater', 'unbilledWaterPct')}</tr>`,
  ].join('');
}
function renderBalanceHidrico(container,model){container.innerHTML=`<section class="balance-section"><div class="balance-main"><div class="balance-title balance-title-main">BALANCE HÍDRICO</div><div class="balance-scroll"><table class="balance-table"><thead><tr><th rowspan="3" aria-label="Concepto"></th><th colspan="4">HISTÓRICO (anual)</th><th colspan="4">COMPARATIVA ${model.monthLabel}-${String(model.consultationYear).slice(-2)} (acumulado)</th><th colspan="3">PHG<br>${model.monthLabel}-${String(model.consultationYear).slice(-2)} (acumulado)</th><th rowspan="3"></th></tr><tr><th colspan="2">${model.consultationYear-2}</th><th colspan="2">${model.consultationYear-1}</th><th colspan="2">${model.monthLabel}-${String(model.consultationYear-1).slice(-2)}</th><th colspan="2">${model.monthLabel}-${String(model.consultationYear).slice(-2)}</th><th>Capacidad</th><th colspan="2">Volumen objetivo</th></tr><tr>${'<th>dam³</th><th>%</th>'.repeat(4)}<th>dam³</th><th>dam³</th><th>%</th></tr></thead><tbody>${mainRows.map(r=>`<tr class="${r.cls||''} ${r.phg?'loss':''}"><td class="concept">${r.label}</td>${periodCells(r,model)}${phgCells(r,model)}</tr>`).join('')}<tr class="system"><td>RENDIMIENTO HÍDRICO SISTEMA EMASESA (6)</td>${periodCells({key:'systemInputVolume',percentKey:'systemHydraulicEfficiency'},model)}<td colspan="4"></td></tr></tbody></table></div><div class="distributed-wrap"><div class="balance-scroll"><table class="balance-table"><thead><tr><th colspan="2" rowspan="3" aria-label="Conceptos"></th><th colspan="4">HISTÓRICO (anual)</th><th colspan="4">COMPARATIVA ${model.monthLabel}-${String(model.consultationYear).slice(-2)} (acumulado)</th></tr><tr><th colspan="2">${model.consultationYear-2}</th><th colspan="2">${model.consultationYear-1}</th><th colspan="2">${model.monthLabel}-${String(model.consultationYear-1).slice(-2)}</th><th colspan="2">${model.monthLabel}-${String(model.consultationYear).slice(-2)}</th></tr><tr>${'<th>dam³</th><th>%</th>'.repeat(4)}</tr></thead><tbody>${smallRows(model)}</tbody></table></div><div class="distributed-notes"><p><b>Agua registrada</b> = Consumo Registrado Facturado + Consumo Registrado No Facturado</p><p><b>Agua no registrada</b> = Pérdidas Aparentes + Pérdidas Reales + Consumo Autorizado No Registrado</p><p><b>Consumo autorizado facturado total</b> = Consumo Registrado Facturado + Consumo No Registrado Facturado + ATE</p><p><b>Agua no facturada</b> = Volumen suministrado − Consumo Autorizado Facturado Total</p></div></div></div><aside class="billing-panel"><div class="balance-title">FACTURACIÓN REAL<br>AÑO ${model.consultationYear}</div><table class="billing-table"><thead><tr><th>Mes</th><th>Porcentaje</th></tr></thead><tbody>${billingRows(model.realBilling)}</tbody></table></aside><div class="balance-notes"><h3>Notas:</h3><ol><li>Considerar el Volumen en Depósitos en el Agua Producida ETAP.</li><li>El consumo Autorizado Facturado TOTAL, incluye el Agua Tratada Exportada y los Aforos.</li><li>Pérdidas máximas en aducción: 5%. Hasta 2017 se calcula según la capacidad de transporte, 12,6 m³/h (PH 2009-2015). Desde 2018 según el volumen captado, máximo un 5% por cada 100km de conducción (PH 2016-2021). Se consideran 100km de conducciones.</li><li>Pérdidas máximas en tratamiento: 5%. Hasta 2017 se calcula según la capacidad de tratamiento, 10,0 m³/h (PH 2009-2015). Cierre 2018: según volumen captado. Desde 2019: según el volumen entrada ETAP (PH 2016-2021, acordado con CHG).</li><li>Eficiencia mínima distribución: 80%. Hasta 2018 se calcula según el volumen captado (PH 2009-2015 y PH 2016-2021). Desde 2019 según el volumen suministrado (PH 2016-2021, acordado con CHG).</li><li class="note6">Corresponde al volumen efectivamente utilizado para el suministro respecto al total introducido en el sistema:\nRendimiento Hídrico = Salidas autorizadas y controladas / Total entrada al sistema, donde el Total entrada al sistema corresponde a las extracciones totales anuales de agua del medioambiente, calculado como Captado (embalses + pozos) + ATI. En la celda de volumen se indica el volumen total de entrada de cada anualidad.</li></ol></div></section>`}



const supplementaryPeriods = (calculator, year, month) => [
  { year: year - 2, month: 12 },
  { year: year - 1, month: 12 },
  { year: year - 1, month },
  { year, month },
];
const supplementaryValue = (calculator, concept, period) =>
  calculator.accumulated(concept, period.year, period.month);
const supplementaryVolumeCells = (calculator, concept, periods) => {
  const values = periods.map((period) => fmtVol(supplementaryValue(calculator, concept, period)));
  return `<td class="numeric-value">${values[0]}</td><td class="numeric-value">${values[1]}</td><td class="water-band"></td><td class="numeric-value">${values[2]}</td><td class="numeric-value">${values[3]}</td>`;
};
const supplementaryMergedVolumeCells = (calculator, concept, periods) => {
  const values = periods.map((period) => fmtVol(supplementaryValue(calculator, concept, period)));
  return `<td rowspan="2" class="numeric-value loss-highlight">${values[0]}</td><td rowspan="2" class="numeric-value loss-highlight">${values[1]}</td><td rowspan="2" class="numeric-value loss-highlight">${values[2]}</td><td rowspan="2" class="numeric-value loss-highlight">${values[3]}</td>`;
};
const supplementaryEfficiencyCells = (calculator, concept, periods) =>
  periods.map((period) => `<td class="numeric-value">${fmtPct(supplementaryValue(calculator, concept, period))}</td>`).join('');
function renderSupplementaryBlocks(container, calculator, consultationYear, consultationMonth) {
  const periodList = supplementaryPeriods(calculator, consultationYear, consultationMonth);
  const previousYear = consultationYear - 1;
  const historicStartYear = consultationYear - 2;
  const monthName = MONTHS[consultationMonth - 1].toUpperCase();
  const efficiencyRows = [
    {
      label: 'Rdto. Subsistema Aducción',
      key: 'conveyanceSubsystemEfficiency',
      formula: '<i>RH<sub>Aducción</sub></i> = (Entrada ETAP + ABE + Agua Operaciones Aducción) / Agua Captada',
    },
    {
      label: 'Rdto. Subsistema Tratamiento',
      key: 'treatmentSubsystemEfficiency',
      formula: '<i>RH<sub>Tratamiento</sub></i> = (Producida ETAP + Agua Operaciones Tratamiento) / Agua Entrada ETAP',
    },
    {
      label: 'Rdto. Subsistema Distribución',
      key: 'distributionSubsystemEfficiency',
      formula: '<i>RH<sub>Distribución</sub></i> = (Consumo Autorizado + Agua Tratada Exportada) / Agua Suministrada',
    },
  ];
  const volume = (key) => supplementaryVolumeCells(calculator, key, periodList);
  const fraudCells = supplementaryMergedVolumeCells(calculator, 'fraudAndAvoidableLosses', periodList);
  const html = `
    <section class="supplementary-card efficiency-block">
      <div class="supplementary-title">INDICADORES DE EFICIENCIA HÍDRICA</div>
      <div class="supplementary-scroll">
        <table class="supplementary-table efficiency-table">
          <thead>
            <tr><th rowspan="2">CONCEPTO</th><th colspan="2">HISTÓRICO (anual)</th><th colspan="2">COMPARATIVA ${monthName}</th><th rowspan="2">FÓRMULA</th></tr>
            <tr><th>${historicStartYear}</th><th>${previousYear}</th><th>${previousYear}</th><th>${consultationYear}</th></tr>
          </thead>
          <tbody>${efficiencyRows.map((row) => `<tr><td>${row.label}</td>${supplementaryEfficiencyCells(calculator, row.key, periodList)}<td class="formula-cell">${row.formula}</td></tr>`).join('')}</tbody>
        </table>
      </div>
    </section>
    <section class="supplementary-card distributed-detail-block">
      <div class="supplementary-title">DESGLOSE DE VOLUMEN DE AGUA DISTRIBUIDO</div>
      <div class="supplementary-scroll">
        <table class="supplementary-table distributed-detail-table">
          <colgroup>
            <col class="col-group"><col class="col-subgroup"><col class="col-concept">
            <col class="col-year"><col class="col-year"><col class="col-water">
            <col class="col-compare"><col class="col-compare"><col class="col-origin">
          </colgroup>
          <thead>
            <tr><th colspan="2" rowspan="2">DESGLOSE DE VOLUMEN DE AGUA DISTRIBUIDA<br><span>(dam³)</span></th><th rowspan="2">Datos Periodo ANUAL</th><th rowspan="2">${historicStartYear}</th><th rowspan="2">${previousYear}</th><th rowspan="2" class="water-band-head"></th><th colspan="2">COMPARATIVA ${monthName}</th><th rowspan="2">Informe Origen</th></tr>
            <tr><th>${previousYear}</th><th>${consultationYear}</th></tr>
          </thead>
          <tbody>
            <tr><td rowspan="4" class="group-cell">CONSUMO<br>AUTORIZADO</td><td rowspan="2" class="subgroup-cell">Consumo Autorizado Registrado</td><td>Consumo Registrado Facturado</td>${volume('registeredBilledConsumption').replace('<td class="water-band"></td>', '<td rowspan="2" class="water-band registered-band">Agua Registrada</td>')}<td class="origin-cell">ACUCON-CONSPRE</td></tr>
            <tr><td>Consumo Registrado NO Facturado (7)</td>${volume('registeredUnbilledConsumption').replace('<td class="water-band"></td>', '')}<td class="origin-cell no-fill normal-weight">Consultas BI, Volumen zonas deprimidas y eventos</td></tr>
            <tr><td rowspan="2" class="subgroup-cell">Consumo Autorizado No Registrado</td><td>Consumo NO Registrado Facturado (8)</td>${volume('unregisteredBilledConsumption').replace('<td class="water-band"></td>', '<td rowspan="6" class="water-band unregistered-band">Agua No Registrada</td>')}<td class="origin-cell">Consulta botones AQUAWS</td></tr>
            <tr><td>Consumo NO Registrado NO Facturado (9)</td>${volume('unregisteredUnbilledConsumption').replace('<td class="water-band"></td>', '')}<td class="origin-cell no-fill normal-weight">Consulta BI</td></tr>
            <tr><td rowspan="4" class="group-cell">PÉRDIDAS</td><td rowspan="2" class="subgroup-cell">Pérdidas Aparentes</td><td>Imprecisión Equipos de Medida</td>${volume('meteringInaccuracy').replace('<td class="water-band"></td>', '')}<td class="origin-cell">Informe de Imprecisión de Equipos anual</td></tr>
            <tr><td>Consumo NO Autorizado (Fraudes)</td>${fraudCells}<td rowspan="2" class="origin-cell no-fill normal-weight">Obtenido por diferencia</td></tr>
            <tr><td rowspan="2" class="subgroup-cell">Pérdidas Reales</td><td class="no-fill normal-weight">Pérdidas Evitables</td></tr>
            <tr><td>Pérdidas Técnicas Mínimas (UARL)</td>${volume('minimumTechnicalLosses').replace('<td class="water-band"></td>', '')}<td class="origin-cell no-fill normal-weight">Informe ILI</td></tr>
          </tbody>
        </table>
      </div>
      <div class="supplementary-footnotes"><div>(7) Riegos y Baldeos, Consumos Propios, Purgas Contabilizadas, Consumo del Vacie</div><div>(8) Aforos</div><div>(9) Consumo de Mantenimiento</div></div>
    </section>`;
  container.insertAdjacentHTML('beforeend', html);
}

function createBalanceModel(calculator, consultationYear, consultationMonth) {
  const buildPeriod = (year, month) => {
    const v = (concept) => calculator.accumulated(concept, year, month);
    const captured = v('captured');
    const supplied = v('supplied');
    const distributed = v('distributed');
    const ratio = (a, b) => b ? a / b : 0;
    const period = {
      captured, conveyanceOperations: v('conveyanceOperations'),
      conveyanceLosses: v('conveyanceLosses'), conveyed: v('conveyed'),
      rawExported: v('rawExported'), etapInput: v('etapInput'),
      treatmentOperations: v('treatmentOperations'), treatmentLosses: v('treatmentLosses'),
      etapProduced: v('etapProduced'), treatedImported: v('treatedImported'),
      supplied, treatedExported: v('treatedExported'), distributed,
      distributionSubsystemLosses: v('distributionSubsystemLosses'),
      systemInputVolume: v('systemInputVolume'), systemHydraulicEfficiency: v('systemHydraulicEfficiency'),
      registeredWater: v('registeredWater'), unregisteredWater: v('unregisteredWater'),
      totalAuthorizedBilledConsumption: v('authorizedBilledConsumption'), unbilledWater: v('nonRevenueWater'),
    };
    const capturedKeys = ['captured','conveyanceOperations','conveyanceLosses','conveyed','rawExported','etapInput','treatmentOperations','treatmentLosses','etapProduced','treatedImported','supplied','treatedExported'];
    capturedKeys.forEach((key) => { period[`${key}Pct`] = ratio(period[key], captured); });
    period.distributedPct = ratio(distributed, captured);
    period.distributionSubsystemLossesPct = ratio(period.distributionSubsystemLosses, distributed);
    period.registeredWaterPct = ratio(period.registeredWater, distributed);
    period.unregisteredWaterPct = ratio(period.unregisteredWater, distributed);
    period.totalAuthorizedBilledConsumptionPct = ratio(period.totalAuthorizedBilledConsumption, supplied);
    period.unbilledWaterPct = ratio(period.unbilledWater, supplied);
    return period;
  };
  const annualPrevious = buildPeriod(consultationYear - 2, 12);
  const annualCurrent = buildPeriod(consultationYear - 1, 12);
  const comparePrevious = buildPeriod(consultationYear - 1, consultationMonth);
  const compareCurrent = buildPeriod(consultationYear, consultationMonth);
  const days = Math.round((Date.UTC(consultationYear, consultationMonth, 1) - Date.UTC(consultationYear, 0, 1)) / 86400000);
  const annualDays = Math.round((Date.UTC(consultationYear + 1, 0, 1) - Date.UTC(consultationYear, 0, 1)) / 86400000);
  const phgRow = data.phgAnnualRows.find((row) => Number(parseSpanishNumber(row[0], NaN)) === consultationYear);
  const historicConveyance = phgRow ? parseSpanishNumber(phgRow[1], 0) * days / annualDays : 0;
  const historicTreatment = phgRow ? parseSpanishNumber(phgRow[2], 0) * days / annualDays : 0;
  const conveyanceCapacity = consultationYear <= 2017 && historicConveyance > 0 ? historicConveyance : compareCurrent.captured;
  const treatmentCapacity = consultationYear <= 2017 && historicTreatment > 0 ? historicTreatment : consultationYear === 2018 ? compareCurrent.captured : compareCurrent.etapInput;
  const distributionCapacity = compareCurrent.distributed;
  return {
    consultationYear,
    monthLabel: MONTHS[consultationMonth - 1].slice(0, 3).toLowerCase(),
    annualPrevious, annualCurrent, comparePrevious, compareCurrent,
    phg: {
      conveyance: { capacity: conveyanceCapacity, targetVolume: conveyanceCapacity * 0.05, percentage: 0.05 },
      treatment: { capacity: treatmentCapacity, targetVolume: treatmentCapacity * 0.05, percentage: 0.05 },
      distribution: { capacity: distributionCapacity, targetVolume: distributionCapacity * 0.20, percentage: 0.20 },
    },
    realBilling: Array.from({ length: 12 }, (_, index) => calculator.accumulated('realBilling', consultationYear, index + 1)),
  };
}
function updateBalanceSection(calculator, consultationYear, consultationMonth) {
  let container = document.getElementById('balanceHydraulicSection');
  if (!container) {
    container = document.createElement('div');
    container.id = 'balanceHydraulicSection';
    const grid = document.querySelector('.estadisticos2-grid') || document.querySelector('.dashboard-grid');
    grid?.insertAdjacentElement('afterend', container);
  }
  renderBalanceHidrico(container, createBalanceModel(calculator, consultationYear, consultationMonth));
  renderSupplementaryBlocks(container, calculator, consultationYear, consultationMonth);
}

function updateCharts() {
  const consultationYear = Number(document.getElementById('year').value);
  const consultationMonth = Number(document.getElementById('month').value);
  const labels = Array.from(
    { length: 11 },
    (_, index) => consultationYear - 10 + index,
  );
  const calculator = createCalculator();

  const series = (concept) =>
    labels.map((year) =>
      calculator.accumulated(
        concept,
        year,
        year === consultationYear ? consultationMonth : 12,
      ),
    );

  const days = labels.map((year) => {
    const month = year === consultationYear ? consultationMonth : 12;
    return Math.round(
      (Date.UTC(year, month, 1) - Date.UTC(year, 0, 1)) / 86400000,
    );
  });
  const dailyDam3 = (concept) =>
    series(concept).map((value, index) => value / 1000 / days[index]);

  draw(
    'balanceChart',
    'line',
    [
      { label: 'Agua captada', data: dailyDam3('captured'), borderColor: C.captured, backgroundColor: C.captured, tension: 0.3, yAxisID: 'y' },
      { label: 'Agua suministrada', data: dailyDam3('supplied'), borderColor: C.supplied, backgroundColor: C.supplied, tension: 0.3, yAxisID: 'y' },
      { label: 'Pérdidas subsistema distribución', data: dailyDam3('distributionSubsystemLosses'), borderColor: C.losses, backgroundColor: C.losses, tension: 0.3, yAxisID: 'y' },
      { label: 'Porcentaje pérdidas distribución', data: series('distributionLossPercentage').map((value) => value * 100), borderColor: C.percentage, backgroundColor: C.percentage, tension: 0.3, yAxisID: 'yp' },
    ],
    labels,
    {
      ...options(),
      scales: {
        ...options().scales,
        yp: {
          position: "right",
          // Eje secundario fijo del 0 % al 60 %.
          min: 0,
          max: 60,
          grid: {drawOnChartArea: false},
          ticks: {
            stepSize: 10,
            callback: (value) =>
              `${value}%`,
          },
        },
      },
    },
  );

  const domesticUnitSeries = series('domesticUnitConsumption');
  const allocationSeries = series('allocation');
  const maximumUnitValue = Math.max(
    ...domesticUnitSeries,
    ...allocationSeries,
    0,
  );
  const dynamicUnitMaximum =
    maximumUnitValue > 0
      ? Math.ceil((maximumUnitValue * 1.06) / 5) * 5
      : 10;

  draw(
    'unitChart',
    'bar',
    [
      { label: 'Consumo unitario doméstico', data: domesticUnitSeries, backgroundColor: C.domestic, borderRadius: 4 },
      { label: 'Dotación', data: allocationSeries, backgroundColor: C.allocation, borderRadius: 4 },
    ],
    labels,
    {
      ...options('l/hab/día'),
      indexAxis: 'y',
      interaction: {
        mode: 'index',
        axis: 'y',
        intersect: false,
      },
      plugins: {
        ...options('l/hab/día').plugins,
        tooltip: {
          mode: 'index',
          axis: 'y',
          intersect: false,
          displayColors: true,
          usePointStyle: true,
          padding: 12,
          titleSpacing: 8,
          bodySpacing: 7,
          callbacks: {
            title: (items) => `Año ${items[0].label}`,
            label: (context) =>
              ` ${context.dataset.label}: ${Math.round(Number(context.raw)).toLocaleString('es-ES')} l/hab/día`,
          },
        },
      },
      layout: {
        padding: { right: 8 },
      },
      scales: {
        y: {
          reverse: true,
          grid: { display: false },
        },
        x: {
          beginAtZero: true,
          max: dynamicUnitMaximum,
          grid: { color: '#edf1f5' },
        },
      },
    },
  );

  draw(
    'efficiencyChart',
    'line',
    [
      { label: 'Aducción', data: series('conveyanceSubsystemEfficiency').map((value) => value * 100), borderColor: C.conveyance, tension: 0.3 },
      { label: 'Tratamiento', data: series('treatmentSubsystemEfficiency').map((value) => value * 100), borderColor: C.treatment, tension: 0.3 },
      { label: 'Distribución', data: series('distributionSubsystemEfficiency').map((value) => value * 100), borderColor: C.distribution, tension: 0.3 },
    ],
    labels,
    options('%', true),
  );

  draw(
    'lossIndexChart',
    'line',
    [
      { label: 'Índice pérdidas distribución', data: series('distributionLossIndex'), borderColor: C.index, backgroundColor: '#ef444420', fill: true, tension: 0.3 },
    ],
    labels,
    options(),
  );
  updateBalanceSection(calculator, consultationYear, consultationMonth);
}

async function init() {
  const monthSelect = document.getElementById('month');
  const yearSelect = document.getElementById('year');
  MONTHS.forEach((name, index) => monthSelect.add(new Option(name, index + 1)));
  monthSelect.value = 8;
  for (let year = 2009; year <= 2026; year += 1) {
    yearSelect.add(new Option(year, year));
  }
  yearSelect.value = 2023;

  const sheets = GOOGLE_DATABASE.sheets;
  const sheetNames = [
    sheets.datosRed,
    sheets.datosAcucon,
    sheets.datosCarnf,
    sheets.datosAforosPerdidas,
    sheets.chgPoblacion,
    sheets.pDistribucionAntiguo || 'BD_PDistribucion_Antiguo',
    sheets.phgAnual || 'BD_PHG_Anual',
  ];
  const books = await Promise.all(
    sheetNames.map((sheetName, index) =>
      loadGoogleSheet(sheetName, index === 0 ? 1 : 0),
    ),
  );

  data = {
    red: redRecords(books[0]),
    acuconRows: rawRowsFromSheet(books[1]),
    carnfRows: rawRowsFromSheet(books[2]),
    aforosRows: rawRowsFromSheet(books[3]),
    populationRows: sheetRows(books[4]),
    legacyRows: sheetRows(books[5]),
    phgAnnualRows: sheetRows(books[6]).slice(1),
  };

  const testCalculator = createCalculator();
  const testPopulation = testCalculator.accumulated("emasesaPopulation", 2023, 8);
  const testConveyancePopulation = testCalculator.accumulated("conveyancePopulation", 2023, 8);
  if (testPopulation <= 0 || testConveyancePopulation <= 0) {
    throw new Error(
      `BD_CHG_Poblacion no devolvió población válida para 2022 (EM=${testPopulation}; EM+TO=${testConveyancePopulation})`,
    );
  }

  updateCharts();
  document.getElementById('loading').style.display = 'none';
}

document.getElementById('apply').addEventListener('click', updateCharts);
document.getElementById('theme').addEventListener('click', () =>
  document.body.classList.toggle('dark'),
);
document.getElementById('print').addEventListener('click', () => window.print());

init().catch((error) => {
  console.error(error);
  document.getElementById('loading').textContent =
    `No se pudieron cargar los datos: ${error.message}`;
});
