/* Adaptador común para conectar los índices ya construidos en cada app.js. */
import { createHydraulicCalculator } from "./hydraulic-calculations.js";

export function createCalculatorFromAppIndexes({
  typeAccumulated,
  subtypeAccumulated,
  redAccumulated,
}) {
  return createHydraulicCalculator({
    typeAccumulated,
    subtypeAccumulated,
    origin1Accumulated: (key, year, month) =>
      redAccumulated(key, year, month, 1),
    origin2Accumulated: (key, year, month) =>
      redAccumulated(key, year, month, 2),
  });
}
