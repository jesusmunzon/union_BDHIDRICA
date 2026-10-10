/* Cálculos hidráulicos compartidos por Estadísticos 1 y Estadísticos 2. */
export const HYDRAULIC_CONCEPTS = Object.freeze({
  captured: "AGUA CAPTADA",
  conveyed: "AGUA ADUCIDA",
  conveyanceOperations: "AGUA OPERACIONES DE ADUCCIÓN",
  conveyanceLosses: "PÉRDIDAS SUBSISTEMA DE ADUCCIÓN",
  rawExported: "AGUA ADUCIDA BRUTA EXPORTADA",
  etapInput: "AGUA ENTRADA ETAP",
  etapProduced: "AGUA PRODUCIDA ETAP",
  treatmentOperations: "AGUA OPERACIONES DE TRATAMIENTO",
  treatmentLosses: "PÉRDIDAS SUBSISTEMA DE TRATAMIENTO",
  treatedImported: "AGUA TRATADA IMPORTADA",
  supplied: "AGUA SUMINISTRADA",
  treatedExported: "AGUA TRATADA EXPORTADA",
  distributed: "AGUA DISTRIBUIDA",
  registeredBilledConsumption: "CONSUMO REGISTRADO FACTURADO",
  registeredUnbilledConsumption: "CONSUMO REGISTRADO NO FACTURADO",
  unregisteredBilledConsumption: "CONSUMO NO REGISTRADO FACTURADO",
  unregisteredUnbilledConsumption: "CONSUMO NO REGISTRADO NO FACTURADO",
  meteringInaccuracy: "IMPRECISIÓN EQUIPOS DE MEDIDA",
  minimumTechnicalLosses: "PÉRDIDAS TÉCNICAS MÍNIMAS",
  fraudAndAvoidableLosses: "FRAUDES Y PÉRDIDAS EVITABLES",
  distributionSubsystemLosses: "PÉRDIDAS SUBSISTEMA DISTRIBUCIÓN",
  registeredWater: "AGUA REGISTRADA",
  unregisteredWater: "AGUA NO REGISTRADA",
  authorizedBilledConsumption: "CONSUMO AUTORIZADO FACTURADO",
  nonRevenueWater: "AGUA NO FACTURADA",
  conveyancePopulation: "POBLACIÓN ADUCCIÓN",
  emasesaPopulation: "POBLACIÓN EMASESA",
  allocation: "DOTACIÓN",
  totalUnitConsumption: "CONSUMO UNITARIO TOTAL",
  domesticUnitConsumption: "CONSUMO UNITARIO DOMÉSTICO",
  conveyanceSubsystemEfficiency: "RENDIMIENTO SUBSISTEMA ADUCCIÓN",
  treatmentSubsystemEfficiency: "RENDIMIENTO SUBSISTEMA TRATAMIENTO",
  distributionSubsystemEfficiency: "RENDIMIENTO SUBSISTEMA DISTRIBUCIÓN",
  distributionLossIndex: "ÍNDICE PÉRDIDAS DISTRIBUCIÓN",
  distributionLossPercentage: "PORCENTAJE PÉRDIDAS DISTRIBUCIÓN",
  realBilling: "FACTURACIÓN REAL",
  reservoirBalance: "BALANCE DEPÓSITOS",
  systemInputVolume: "VOLUMEN TOTAL ENTRADA SISTEMA",
  systemHydraulicEfficiency: "RENDIMIENTO HÍDRICO SISTEMA",
});
export const HYDRAULIC_COLUMN_INDEXES = Object.freeze({
  acucon: Object.freeze({ date: 0, dataDate: 1, domestic: Object.freeze([4, 7, 10, 13]), realBillingNumerator: Object.freeze([10, 11, 12, 13, 14, 15]), totalRegisteredBilled: 16 }),
  carnf: Object.freeze({ date: 0, dataDate: 1, registeredUnbilled: 8, unregisteredUnbilled: 12 }),
  aforos: Object.freeze({ date: 0, dataDate: 1, unregisteredBilled: 4, unregisteredUnbilled: 5, meteringInaccuracy: 7, minimumTechnicalLosses: 8 }),
  population: Object.freeze({ year: 0, name: 1, inhabitants: 2, code: 3 }),
  legacyDistributionLosses: Object.freeze({ year: 0, dailyLosses: 1 }),
});
const number = (value) => Number(value || 0);
const sum = (values) => values.reduce((total, value) => total + number(value), 0);
export function createHydraulicCalculator({
  typeAccumulated,
  subtypeAccumulated,
  origin1Accumulated,
  origin2Accumulated,
  acuconAccumulated = null,
  externalColumnsAccumulated = null,
  carnfAccumulated = null,
  aforosAccumulated = null,
  populationAccumulated = null,
  legacyDistributionLossesDaily = null,
}) {
  const required = {
    typeAccumulated,
    subtypeAccumulated,
    origin1Accumulated,
    origin2Accumulated,
  };
  for (const [name, fn] of Object.entries(required)) {
    if (typeof fn !== "function") {
      throw new TypeError(`${name} debe ser una función`);
    }
  }
  function externalAccumulated(sourceName, fn, column, year, month) {
    if (typeof fn !== "function") {
      throw new TypeError(
        `${sourceName} no está configurado en createHydraulicCalculator`,
      );
    }
    return number(fn(column, year, month));
  }
  function externalColumnsAccumulatedValue(
    sourceName,
    fn,
    columnIndexes,
    year,
    month,
  ) {
    if (typeof fn !== "function") {
      throw new TypeError(
        `${sourceName} no está configurado en createHydraulicCalculator`,
      );
    }
    return number(fn(sourceName, columnIndexes, year, month));
  }
  function populationValue(column, consultationYear, options = {}) {
    if (typeof populationAccumulated !== "function") {
      throw new TypeError(
        "populationAccumulated no está configurado en createHydraulicCalculator",
      );
    }
    return number(populationAccumulated(column, consultationYear - 1, options));
  }
  function daysThroughMonth(year, month) {
    return Math.round(
      (Date.UTC(year, month, 1) - Date.UTC(year, 0, 1)) / 86400000,
    );
  }
  const capturedComponents = (year, month) => ({
    minilla: origin1Accumulated("Minilla", year, month),
    gergal:
      origin2Accumulated("Salida Gergal", year, month) -
      origin2Accumulated("Entrada Gergal", year, month),
    melonares: origin2Accumulated("Melonares", year, month),
    calaElRonquillo: origin2Accumulated("Cala El Ronquillo", year, month),
    emergenciaElPintado: origin2Accumulated("Emergencias (El Pintado)", year, month),
    emergenciaRio: origin2Accumulated("Emergencias (Río)", year, month),
    pozos: origin1Accumulated("Pozos", year, month),
  });
  function captured(year, month) {
    return sum(Object.values(capturedComponents(year, month)));
  }
  function conveyed(year, month) {
    return typeAccumulated("AGUA ADUCIDA", year, month);
  }
  function conveyanceOperations(year, month) {
    return origin1Accumulated("AGUA OPERACIONES DE ADUCCIÓN", year, month);
  }
  function conveyanceLosses(year, month) {
    return captured(year, month) - conveyanceOperations(year, month) - conveyed(year, month);
  }
  function rawExported(year, month) {
    return sum([
      origin2Accumulated("Toma Guillena", year, month),
      origin2Accumulated("Toma Panajosas", year, month),
      origin2Accumulated("Toma Aljarafesa", year, month),
    ]);
  }
  function etapInput(year, month) {
    return subtypeAccumulated("AGUA ENTRADA ETAP", year, month);
  }
  function etapProduced(year, month) {
    return subtypeAccumulated("AGUA PRODUCIDA ETAP", year, month);
  }
  function treatmentOperations(year, month) {
    return origin1Accumulated("AGUA OPERACIONES DE TRATAMIENTO", year, month);
  }
  function treatmentLosses(year, month) {
    return etapInput(year, month) - treatmentOperations(year, month) - etapProduced(year, month);
  }
  function treatedImported(year, month) {
    return subtypeAccumulated("AGUA TRATADA IMPORTADA", year, month);
  }
  function reservoirBalance(year, month) {
    return subtypeAccumulated("BALANCE DEPÓSITOS", year, month);
  }
  function supplied(year, month) {
    return treatedImported(year, month) + etapProduced(year, month) - reservoirBalance(year, month);
  }
  function treatedExported(year, month) {
    return sum([
      origin2Accumulated("Huesna", year, month),
      origin2Accumulated("Aljarafesa (Gelves)", year, month),
      origin2Accumulated("Burguillos", year, month),
    ]);
  }
  function distributed(year, month) {
    return supplied(year, month) - treatedExported(year, month);
  }
  function registeredBilledConsumption(year, month) {
    return externalAccumulated("acuconAccumulated", acuconAccumulated, HYDRAULIC_COLUMN_INDEXES.acucon.totalRegisteredBilled, year, month);
  }
  function registeredUnbilledConsumption(year, month) {
    return externalAccumulated(
      "carnfAccumulated",
      carnfAccumulated,
      HYDRAULIC_COLUMN_INDEXES.carnf.registeredUnbilled,
      year,
      month,
    );
  }
  function unregisteredBilledConsumption(year, month) {
    return externalAccumulated(
      "aforosAccumulated",
      aforosAccumulated,
      HYDRAULIC_COLUMN_INDEXES.aforos.unregisteredBilled,
      year,
      month,
    );
  }
  function unregisteredUnbilledConsumption(year, month) {
    return (
      externalAccumulated(
        "carnfAccumulated",
        carnfAccumulated,
        HYDRAULIC_COLUMN_INDEXES.carnf.unregisteredUnbilled,
        year,
        month,
      ) +
      externalAccumulated(
        "aforosAccumulated",
        aforosAccumulated,
        HYDRAULIC_COLUMN_INDEXES.aforos.unregisteredUnbilled,
        year,
        month,
      )
    );
  }
  function meteringInaccuracy(year, month) {
    return externalAccumulated(
      "aforosAccumulated",
      aforosAccumulated,
      HYDRAULIC_COLUMN_INDEXES.aforos.meteringInaccuracy,
      year,
      month,
    );
  }
  function minimumTechnicalLosses(year, month) {
    return externalAccumulated(
      "aforosAccumulated",
      aforosAccumulated,
      HYDRAULIC_COLUMN_INDEXES.aforos.minimumTechnicalLosses,
      year,
      month,
    );
  }
  function fraudAndAvoidableLosses(year, month) {
    return (
      distributed(year, month) -
      registeredBilledConsumption(year, month) -
      registeredUnbilledConsumption(year, month) -
      unregisteredBilledConsumption(year, month) -
      unregisteredUnbilledConsumption(year, month) -
      meteringInaccuracy(year, month) -
      minimumTechnicalLosses(year, month)
    );
  }
  function distributionSubsystemLosses(year, month) {
    return (
      fraudAndAvoidableLosses(year, month) +
      meteringInaccuracy(year, month) +
      minimumTechnicalLosses(year, month)
    );
  }
  function registeredWater(year, month) {
    return registeredBilledConsumption(year, month) + registeredUnbilledConsumption(year, month);
  }
  function unregisteredWater(year, month) {
    return (
      unregisteredBilledConsumption(year, month) +
      unregisteredUnbilledConsumption(year, month) +
      distributionSubsystemLosses(year, month)
    );
  }
  function authorizedBilledConsumption(year, month) {
    return (
      registeredBilledConsumption(year, month) +
      unregisteredBilledConsumption(year, month) +
      treatedExported(year, month)
    );
  }
  function nonRevenueWater(year, month) {
    return supplied(year, month) - authorizedBilledConsumption(year, month);
  }
  function conveyancePopulation(year) {
    return populationValue(1, year);
  }
  function emasesaPopulation(year) {
    return populationValue(0, year);
  }
  function allocationVolume(year, month) {
    return captured(year, month) + treatedImported(year, month) - treatedExported(year, month);
  }
  function allocationForPeriod(volume, days, population) {
    if (days <= 0 || population <= 0) return 0;
    return (number(volume) * 1000) / days / population;
  }
  function allocation(year, month) {
    const totalDays = daysThroughMonth(year, month);
    if (year !== 2023) {
      return allocationForPeriod(
        allocationVolume(year, month),
        totalDays,
        conveyancePopulation(year),
      );
    }
    const populationWithoutBurguillos = populationValue(
      1,
      year,
      { excludePopulation: "Burguillos" },
    );
    if (month <= 4) {
      return allocationForPeriod(
        allocationVolume(year, month),
        totalDays,
        populationWithoutBurguillos,
      );
    }
    const daysBeforeBurguillos = 120;
    const daysWithBurguillos = totalDays - daysBeforeBurguillos;
    const volumeBeforeBurguillos = allocationVolume(year, 4);
    const volumeWithBurguillos = allocationVolume(year, month) - volumeBeforeBurguillos;
    const allocationBefore = allocationForPeriod(
      volumeBeforeBurguillos,
      daysBeforeBurguillos,
      populationWithoutBurguillos,
    );
    const allocationAfter = allocationForPeriod(
      volumeWithBurguillos,
      daysWithBurguillos,
      conveyancePopulation(year),
    );
    return (
      allocationBefore * daysBeforeBurguillos +
      allocationAfter * daysWithBurguillos
    ) / totalDays;
  }
  function unitConsumption(value, year, month) {
    const population = emasesaPopulation(year);
    const days = daysThroughMonth(year, month);
    if (population <= 0 || days <= 0) return 0;

    /*
     * Los consumos de ACUCON están expresados en m³.
     * Se convierten a litros antes de obtener l/hab/día.
     */
    return (number(value) * 1000) / population / days;
  }
  function totalUnitConsumption(year, month) {
    return unitConsumption(registeredBilledConsumption(year, month), year, month);
  }
  function domesticUnitConsumption(year, month) {
    /*
     * BD_Datos_ACUCON usa índices de columna base cero:
     * E = 4, H = 7, K = 10 y N = 13.
     * No se utilizan los textos de los encabezados.
     */
    const domesticConsumption = externalColumnsAccumulatedValue(
      "acucon",
      externalColumnsAccumulated,
      [4, 7, 10, 13],
      year,
      month,
    );
    return unitConsumption(domesticConsumption, year, month);
  }
  function realBilling(year, month) {
    /*
     * FACTURACIÓN REAL DEL MES:
     *   numerador   = K + L + M + N + O + P (índices 10 a 15)
     *   denominador = Q (índice 16, TOTAL AC+CP)
     *
     * Los callbacks ACUCON devuelven acumulados. Para obtener el valor
     * exclusivo de cada mes se resta el acumulado del mes anterior.
     */
    const numeratorAccumulated = externalColumnsAccumulatedValue(
      "acucon",
      externalColumnsAccumulated,
      HYDRAULIC_COLUMN_INDEXES.acucon.realBillingNumerator,
      year,
      month,
    );
    const denominatorAccumulated = registeredBilledConsumption(year, month);

    const previousNumerator =
      month > 1
        ? externalColumnsAccumulatedValue(
            "acucon",
            externalColumnsAccumulated,
            HYDRAULIC_COLUMN_INDEXES.acucon.realBillingNumerator,
            year,
            month - 1,
          )
        : 0;
    const previousDenominator =
      month > 1
        ? registeredBilledConsumption(year, month - 1)
        : 0;

    const monthlyNumerator = numeratorAccumulated - previousNumerator;
    const monthlyDenominator = denominatorAccumulated - previousDenominator;

    return safeRatio(monthlyNumerator, monthlyDenominator);
  }
  function systemInputVolume(year, month) {
    return captured(year, month) + treatedImported(year, month);
  }
  function systemHydraulicEfficiency(year, month) {
    const controlledOutputs =
      systemInputVolume(year, month) -
      conveyanceLosses(year, month) -
      treatmentLosses(year, month) -
      distributionSubsystemLosses(year, month);
    return safeRatio(controlledOutputs, systemInputVolume(year, month));
  }
  function safeRatio(numerator, denominator) {
    const validDenominator = number(denominator);
    if (validDenominator === 0) return 0;
    return number(numerator) / validDenominator;
  }
  function conveyanceSubsystemEfficiency(year, month) {
    return safeRatio(
      etapInput(year, month) +
        rawExported(year, month) +
        conveyanceOperations(year, month),
      captured(year, month),
    );
  }
  function treatmentSubsystemEfficiency(year, month) {
    return safeRatio(
      etapProduced(year, month) + treatmentOperations(year, month),
      etapInput(year, month),
    );
  }
  function distributionSubsystemEfficiency(year, month) {
    return safeRatio(
      registeredWater(year, month) +
        unregisteredBilledConsumption(year, month) +
        unregisteredUnbilledConsumption(year, month) +
        treatedExported(year, month),
      supplied(year, month),
    );
  }
  function distributionLossPercentage(year, month) 
  {
    const distributionLosses =
      year <= 2016
        ? historicalDistributionLosses(year, month)
        : distributionSubsystemLosses(year, month);

    return safeRatio(
      distributionLosses,
      distributed(year, month),
    );
  }
  function historicalDistributionLosses(year, month) {
    if (typeof legacyDistributionLossesDaily !== "function") {
      throw new TypeError(
        "legacyDistributionLossesDaily no está configurado en createHydraulicCalculator",
      );
    }

    /*
     * BD_PDistribucion_Antiguo está expresada en dam³/día.
     * Se convierte a m³/día multiplicando por 1.000 y después
     * se acumula por los días transcurridos del periodo.
     */
    return (
      number(legacyDistributionLossesDaily(year)) *
      1000 *
      daysThroughMonth(year, month)
    );
  }
  function distributionLossIndex(year, month) {
    const distributionLosses =
      year > 2016
        ? distributionSubsystemLosses(year, month)
        : historicalDistributionLosses(year, month);

    return safeRatio(
      distributionLosses,
      minimumTechnicalLosses(year, month),
    );
  }
  const calculators = Object.freeze({
    captured,
    conveyed,
    conveyanceOperations,
    conveyanceLosses,
    rawExported,
    etapInput,
    etapProduced,
    treatmentOperations,
    treatmentLosses,
    treatedImported,
    supplied,
    treatedExported,
    distributed,
    registeredBilledConsumption,
    registeredUnbilledConsumption,
    unregisteredBilledConsumption,
    unregisteredUnbilledConsumption,
    meteringInaccuracy,
    minimumTechnicalLosses,
    fraudAndAvoidableLosses,
    distributionSubsystemLosses,
    registeredWater,
    unregisteredWater,
    authorizedBilledConsumption,
    nonRevenueWater,
    conveyancePopulation,
    emasesaPopulation,
    allocation,
    totalUnitConsumption,
    domesticUnitConsumption,
    conveyanceSubsystemEfficiency,
    treatmentSubsystemEfficiency,
    distributionSubsystemEfficiency,
    distributionLossIndex,
    distributionLossPercentage,
    realBilling,
    reservoirBalance,
    systemInputVolume,
    systemHydraulicEfficiency,
  });
  function accumulated(concept, year, month) {
    const fn = calculators[concept];
    if (!fn) throw new Error(`Concepto hidráulico desconocido: ${concept}`);
    return number(fn(year, month));
  }
  return Object.freeze({ accumulated, calculators, capturedComponents });
}
