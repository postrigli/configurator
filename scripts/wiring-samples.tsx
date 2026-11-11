// Генерация тестовых PDF-схем в Node (без браузера): npx tsx scripts/wiring-samples.tsx <папка> [шрифт.ttf] [жирный.ttf]
// Нужен для проверки раскладки на типовых и крайних комплектах. В сборку не попадает.
import React from 'react';
import fs from 'fs';
import path from 'path';
import { Font, renderToFile } from '@react-pdf/renderer';
import { AppState, ConnectionType } from '../types';
import { calculateCart } from '../logic';
import { buildWiring } from '../wiring/model';
import { layoutWiring } from '../wiring/layout';
import { WiringLayout } from '../components/WiringLayout';

const [outDir = 'wiring-samples', regular, bold] = process.argv.slice(2);
Font.register({
  family: 'Roboto',
  fonts: [
    { src: regular || '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', fontWeight: 'normal' },
    { src: bold || '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', fontWeight: 'bold' },
  ],
});
Font.registerHyphenationCallback(w => [w]);

const base: AppState = {
  baseUnitId: 'ec01v40', backupBoiler: false, boilers: [], outdoorSensor: false, heatingPumps: 0, boilerPump: false,
  recirculationPump: false, mixingValves: 0, manifoldServos: 0, zones: 0, zonesWithTwoSources: 0, wiredSensors: 0,
  wirelessRadioSensors: 0, wirelessSensors: 0, wiredThermostats: 0, wirelessThermostats: 0, ownThermostats: 0,
  floorSensors: 0, ntcFloorSensors: 0, gasSensors: 0, coSensors: 0, pressureSensors: 0, wiredSmokeSensors: 0,
  wirelessSmokeSensors: 0, wiredLeakSensors: 0, wirelessLeakSensors: 0, wirelessLeakSensorsLora: 0, wiredMotionSensors: 0,
  wirelessMotionSensors: 0, wiredSirens: 0, combinedSirens: 0, wirelessKeyfobs: 0, neptun12: 0, neptun34: 0, neptun1: 0,
  manualItems: [], hiddenItems: [], customOrderNumber: '',
};
const boiler = (brand: string, model: string, type: ConnectionType, id = brand + model) => ({ brand, model, id, type } as any);

export const SAMPLES: Record<string, AppState> = {
  'A_v40_opentherm': { ...base, boilers: [boiler('Baxi', 'Luna 3', ConnectionType.OPENTHERM)], heatingPumps: 2, outdoorSensor: true, wiredSensors: 2 },
  'B_v40_relay_zones_mixers': { ...base, boilers: [boiler('Protherm', 'Скат', ConnectionType.RELAY)], boilerPump: true, outdoorSensor: true, zones: 6, zonesWithTwoSources: 2, mixingValves: 3, wiredSensors: 4 },
  'C_v40_cascade_lora_contacts': { ...base, boilers: [boiler('Baxi', 'Luna 3', ConnectionType.OPENTHERM, 'b1'), boiler('Vaillant', 'ecoTEC', ConnectionType.EBUS, 'b2')], wirelessSensors: 40, wiredLeakSensors: 10, pressureSensors: 2 },
  'D_start_baxi': { ...base, baseUnitId: 'ec01105', boilers: [boiler('Baxi', 'Luna 3', ConnectionType.OPENTHERM)], backupBoiler: true, boilerPump: true, neptun12: 2, wiredLeakSensors: 3, wiredSensors: 1 },
  'E_v40_big_2_units': { ...base, boilers: [boiler('Buderus', 'GB172', ConnectionType.EMS_PLUS)], heatingPumps: 6, boilerPump: true, recirculationPump: true, zones: 12, zonesWithTwoSources: 3, mixingValves: 6, wiredSensors: 3, wirelessRadioSensors: 4, wiredThermostats: 3, ntcFloorSensors: 2, floorSensors: 2, gasSensors: 1, wiredSmokeSensors: 2, wiredLeakSensors: 4, coSensors: 1, neptun12: 3, wirelessSensors: 5, outdoorSensor: true },
  'G_ivan_psu_example': { ...base, boilers: [boiler('Baxi', 'Luna 3', ConnectionType.OPENTHERM)], wiredSensors: 13, wiredLeakSensors: 11 },
  'H_v40_3_units_zones': { ...base, boilers: [boiler('Protherm', 'Скат', ConnectionType.RELAY)], heatingPumps: 2, boilerPump: true, zones: 20, zonesWithTwoSources: 18, mixingValves: 2, wiredSensors: 8, wirelessSensors: 40, wiredLeakSensors: 14, outdoorSensor: true },
  'F_v40_small_relay': { ...base, boilers: [boiler('Navien', 'Deluxe', ConnectionType.RELAY)], heatingPumps: 1, wiredLeakSensors: 2, neptun34: 1, wirelessRadioSensors: 2, wiredSirens: 1 },
};

fs.mkdirSync(outDir, { recursive: true });
const only = process.env.ONLY;
(async () => {
  for (const [name, state] of Object.entries(SAMPLES)) {
    if (only && !name.startsWith(only)) continue;
    const items = calculateCart(state);
    const model = buildWiring(state, items);
    const layout = layoutWiring(model);
    const file = path.join(outDir, `${name}.pdf`);
    await renderToFile(<WiringLayout model={model} layout={layout} orderNumber="TEST" />, file);
    console.log('  cart:', items.filter(i => i.quantity).map(i => `${i.id}×${i.quantity}`).join(' '));
    console.log(name, '| sheets:', layout.sheets.length, '| links:', layout.rows.length, '| unconnected:', model.unconnected.map(u => `${u.productId}×${u.qty} (${u.reason})`).join('; ') || '-');
  }
})();
