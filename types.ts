export enum ConnectionType {
  RELAY = 'РЕЛЕ',
  OPENTHERM = 'Opentherm',
  EBUS = 'E-BUS',
  ARDERIA = 'Arderia',
  BSB = 'BSB',
  NAVIEN = 'Navien',
  RINNAI = 'RINNAI',
  LEMAX = 'Lemax',
  CONTACTOR = 'КОНТАКТОР',
  V0_10 = '0-10В',
  KITURAMI = 'Kiturami',
  EMS_PLUS = 'EMS+'
}

export interface BoilerModel {
  name: string;
  connectionType: ConnectionType;
}

export interface BoilerBrand {
  name: string;
  models: BoilerModel[];
}

export interface Product {
  id: string;
  name: string;
  price: number;
  category: 'base' | 'sensor' | 'adapter' | 'expansion' | 'other';
  image?: string;
  dinModules?: number;
  cartId?: string;
  // Logical properties
  consumesPort?: {
    type: 'TC' | 'DOP' | 'RADIO' | 'RELAY' | 'CONTACT' | 'LORA' | 'JACK' | 'SMA' | '123' | 'MIXER' | 'TS';
    amount: number;
  };
  providesPort?: {
    type: 'TC' | 'DOP' | 'RADIO' | 'RELAY' | 'CONTACT' | 'LORA' | 'MIXER' | 'TS';
    amount: number;
  }[];
}

export interface CartItem extends Product {
  quantity: number;
  isManual: boolean;
  isBase?: boolean; // To identify the main unit
}

export interface AppState {
  baseUnitId?: 'ec01v40' | 'ec01105';
  backupBoiler?: boolean;
  boilers: { brand: string; model: string; id: string }[];
  outdoorSensor: boolean;
  heatingPumps: number;
  boilerPump: boolean;
  recirculationPump: boolean;
  mixingValves: number; // Servo on 3-way valves
  
  // Zoning
  manifoldServos: number; // Informational, affects product count but no logic ports
  zones: number;
  zonesWithTwoSources: number;
  
  // Sensors per zone
  wiredSensors: number;
  wirelessRadioSensors: number;
  wirelessSensors: number;
  wiredThermostats: number;
  wirelessThermostats: number;
  ownThermostats: number;
  floorSensors: number;
  ntcFloorSensors: number;
  
  // Safety
  gasSensors: number;
  coSensors: number;
  pressureSensors: number;
  wiredSmokeSensors: number;
  wirelessSmokeSensors: number;
  wiredMotionSensors: number;
  wirelessMotionSensors: number;
  wiredSirens: number;
  combinedSirens: number;
  wirelessKeyfobs: number;
  wiredLeakSensors: number;
  wirelessLeakSensors: number;
  wirelessLeakSensorsLora: number;
  
  // Valves
  neptun12: number;
  neptun34: number;
  neptun1: number;

  manualItems: { productId: string; quantity: number }[];
  hiddenItems: string[];
  customOrderNumber?: string;
}