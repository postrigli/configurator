import { AppState, CartItem, ConnectionType, Product } from './types';
import { PRODUCTS, OPTIONAL_ITEMS } from './constants';

const findProduct = (id: string): Product => {
  const p = PRODUCTS.find((p) => p.id === id);
  if (!p) throw new Error(`Product ${id} not found`);
  return p;
};

interface PortUsage {
  RELAY: number;
  CONTACT: number;
  TC: number;
  DOP: number;
  RADIO: number;
  LORA: number;
  MIXER: number;
  TS: number;
  PORT123: number;
  DigitalBus: number;
}

export const calculateCart = (state: AppState): CartItem[] => {
  const cart: Map<string, CartItem> = new Map();
  
  const addItem = (id: string, qty: number = 1, isManual = false) => {
    if (qty <= 0) return;
    if (!isManual && OPTIONAL_ITEMS.includes(id) && state.hiddenItems?.includes(id)) return;
    const product = findProduct(id);
    const current = cart.get(id);
    if (current) current.quantity += qty;
    else cart.set(id, { ...product, quantity: qty, isManual });
  };

  const baseUnitId = state.baseUnitId || 'ec01v40';
  const isStart = baseUnitId === 'ec01105';

  const usage: PortUsage = { RELAY: 0, CONTACT: 0, TC: 0, DOP: 0, RADIO: 0, LORA: 0, MIXER: 0, TS: 0, PORT123: 0, DigitalBus: 0 };
  const available: PortUsage = isStart
    ? { RELAY: 1, CONTACT: 1, TC: 2, DOP: 1, RADIO: 0, LORA: 32, MIXER: 0, TS: 0, PORT123: 0, DigitalBus: 1 }
    : { RELAY: 3, CONTACT: 5, TC: 3, DOP: 1, RADIO: 32, LORA: 0, MIXER: 0, TS: 0, PORT123: 2, DigitalBus: 0 };

  // Initial unit added first to Map to maintain top position
  addItem(baseUnitId, 1);

  // Filter boilers: ec01105 only supports 1 boiler
  const boilersToProcess = isStart ? state.boilers.slice(0, 1) : state.boilers;
  const boilerCount = boilersToProcess.filter(b => b.brand).length;

  boilersToProcess.forEach((b, idx) => {
    const type = (b as any).type as ConnectionType;
    if (!type) return;

    if (isStart) {
      const isBaxi = b.brand?.toLowerCase() === 'baxi';
      
      // 1. DigitalBus connection types: OpenTherm, eBus, Navien, Rinnai, BSB
      if ([
        ConnectionType.OPENTHERM,
        ConnectionType.EBUS,
        ConnectionType.NAVIEN,
        ConnectionType.RINNAI,
        ConnectionType.BSB
      ].includes(type)) {
        usage.DigitalBus += 1;
        // 4. Baxi logic: if brand is Baxi and ConnectionType is OPENTHERM, add ec01124
        if (isBaxi && type === ConnectionType.OPENTHERM) {
          addItem('ec01124', 1);
        }
      } 
      // 2. RELAY or CONTACTOR: consumes one RELAY port
      else if (type === ConnectionType.RELAY || type === ConnectionType.CONTACTOR) {
        usage.RELAY += 1;
        addItem('ec01011', 1);
      } 
      // 3. Adapter connection types: EMS+, Kiturami, Arderia, 0-10В, Lemax
      else if ([
        ConnectionType.EMS_PLUS,
        ConnectionType.KITURAMI,
        ConnectionType.ARDERIA,
        ConnectionType.V0_10,
        ConnectionType.LEMAX
      ].includes(type)) {
        usage.DOP += 1;
        if (type === ConnectionType.EMS_PLUS) addItem('ec01125', 1);
        if (type === ConnectionType.KITURAMI) addItem('ec01108', 1);
        if (type === ConnectionType.ARDERIA) addItem('ec01093', 1);
        if (type === ConnectionType.V0_10) addItem('ec01098', 1);
        if (type === ConnectionType.LEMAX) addItem('ec01092', 1);
      }
    } else {
      // ec01v40 base unit: no DigitalBus port, uses standard connectors/adapters
      if (type === ConnectionType.RELAY || type === ConnectionType.CONTACTOR) {
        usage.RELAY += 1;
        addItem('ec01011', 1);
      } else if (type) {
        usage.DOP += 1;
        if (type === ConnectionType.OPENTHERM) addItem('ec01057', 1);
        if (type === ConnectionType.EBUS) addItem('ec01045', 1);
        if (type === ConnectionType.NAVIEN) addItem('ec01058', 1);
        if (type === ConnectionType.ARDERIA) addItem('ec01093', 1);
        if (type === ConnectionType.BSB) addItem('ec01095', 1);
        if (type === ConnectionType.RINNAI) addItem('ec01094', 1);
        if (type === ConnectionType.LEMAX) addItem('ec01092', 1);
        if (type === ConnectionType.V0_10) addItem('ec01098', 1);
        if (type === ConnectionType.KITURAMI) addItem('ec01108', 1);
        if (type === ConnectionType.EMS_PLUS) addItem('ec01125', 1);
      }
    }
  });

  // Start v.1.0 backup boiler option
  if (isStart && state.backupBoiler) {
    usage.RELAY += 1;
    addItem('ec01011', 1);
  }

  // Logic fix: Any number of additional boilers adds exactly 1 sensor ec01003
  if (boilerCount > 1) {
      usage.TC += 1;
      addItem('ec01003', 1);
  }

  if (state.outdoorSensor) { usage.TC += 1; addItem('ec01003', 1); }
  usage.RELAY += state.heatingPumps;
  if (state.boilerPump) { usage.RELAY += 1; usage.TC += 1; addItem('ec01003', 1); }
  if (state.recirculationPump) usage.RELAY += 1;
  usage.MIXER += state.mixingValves;
  usage.TS += state.mixingValves; 
  addItem('ec01003', state.mixingValves);

  addItem('ec01099', state.manifoldServos);
  usage.RELAY += state.zones;
  usage.RELAY += state.zonesWithTwoSources;
  
  // Air temperature sensors
  usage.TC += state.wiredSensors; addItem('ec01001', state.wiredSensors);
  
  // Rule 2.5: No RADIO ports on ec01105
  const wirelessRadioSensors = isStart ? 0 : state.wirelessRadioSensors;
  usage.RADIO += wirelessRadioSensors; addItem('ec01005', wirelessRadioSensors); 
  
  usage.LORA += state.wirelessSensors; addItem('ec01041', state.wirelessSensors);
  
  // Thermostats
  usage.DOP += state.wiredThermostats; addItem('ec01091', state.wiredThermostats);
  
  // Rule 2.2: thermostat ec01080 can be connected <= 1
  const wirelessThermostats = isStart ? Math.min(1, state.wirelessThermostats) : state.wirelessThermostats;
  usage.LORA += wirelessThermostats; addItem('ec01080', wirelessThermostats);
  
  usage.CONTACT += state.ownThermostats; // Dry contact thermostats consumes CONTACT ports

  usage.DOP += state.floorSensors; addItem('ec01004', state.floorSensors);
  addItem('ec01114', isStart ? 0 : state.ntcFloorSensors);

  const gasSensors = isStart ? 0 : state.gasSensors;
  usage.CONTACT += gasSensors; addItem('ec01008', gasSensors);
  
  // Rule 2.5: No RADIO ports
  const coSensors = isStart ? 0 : state.coSensors;
  usage.RADIO += coSensors; addItem('ec01068', coSensors);
  
  usage.CONTACT += state.pressureSensors * 2; addItem('ec01010', state.pressureSensors);
  usage.CONTACT += state.wiredSmokeSensors; addItem('ec01015', state.wiredSmokeSensors);
  
  // Rule 2.5: No RADIO ports
  const wirelessSmokeSensors = isStart ? 0 : state.wirelessSmokeSensors;
  usage.RADIO += wirelessSmokeSensors; addItem('ec01017', wirelessSmokeSensors);
  
  usage.CONTACT += state.wiredLeakSensors; addItem('ec01006', state.wiredLeakSensors);
  
  // Rule 2.5: No RADIO ports
  const wirelessLeakSensors = isStart ? 0 : state.wirelessLeakSensors;
  usage.RADIO += wirelessLeakSensors; addItem('ec01007', wirelessLeakSensors);
  
  // Rule 2.2: Cannot connect leak sensors ec01056
  const wirelessLeakSensorsLora = isStart ? 0 : state.wirelessLeakSensorsLora;
  usage.LORA += wirelessLeakSensorsLora; addItem('ec01056', wirelessLeakSensorsLora);

  // Security
  usage.CONTACT += state.wiredMotionSensors; addItem('ec01013', state.wiredMotionSensors);
  
  // Rule 2.5: No RADIO ports
  const wirelessMotionSensors = isStart ? 0 : state.wirelessMotionSensors;
  usage.RADIO += wirelessMotionSensors; addItem('ec01014', wirelessMotionSensors);
  
  usage.PORT123 += state.wiredSirens; addItem('ec01016', state.wiredSirens);
  usage.PORT123 += state.combinedSirens; addItem('ec01016-1', state.combinedSirens);
  
  // Rule 2.5: No RADIO ports
  const wirelessKeyfobs = isStart ? 0 : state.wirelessKeyfobs;
  usage.RADIO += wirelessKeyfobs; addItem('ec01019', wirelessKeyfobs);

  // Neptun actuators: all of them are connected to a single relay.
  // The first actuator consumes 1 RELAY port, the second and third do not consume any.
  const neptunCount = state.neptun12 + state.neptun34 + state.neptun1;
  if (neptunCount > 0) {
    usage.RELAY += 1;
  }
  addItem('ec01065', state.neptun12);
  addItem('ec01066', state.neptun34);
  addItem('ec01067', state.neptun1);

  state.manualItems.forEach(item => {
    if (isStart) {
      const prod = findProduct(item.productId);
      if (prod.consumesPort?.type === 'RADIO') return; // skip RADIO devices
      if (['ec01101', 'ec01060', 'ec01025'].includes(item.productId)) return; // Rule 2.3
      if (item.productId === 'ec01056') return; // Rule 2.2: No ec01056 leak sensors
      if (item.productId === 'ec01096') return; // Rule 2.2: No ec01096 LoRa adapter
    }
    addItem(item.productId, item.quantity, true);
  });

  // Central unit scaling logic (applies only to ec01v40)
  const logicSum = Math.max(state.mixingValves, state.heatingPumps) + boilerCount + (state.boilerPump ? 1 : 0) + state.zones + state.zonesWithTwoSources;
  let finalBaseQty = logicSum >= 39 ? 3 : (logicSum >= 20 ? 2 : 1);
  if (usage.RADIO > finalBaseQty * 32) finalBaseQty = Math.ceil(usage.RADIO / 32);
  if (usage.PORT123 > finalBaseQty * 2) finalBaseQty = Math.max(finalBaseQty, Math.ceil(usage.PORT123 / 2));

  // Force ec01001 to ec01002 if finalBaseQty >= 2
  if (finalBaseQty >= 2 && !isStart) {
    const item001 = cart.get('ec01001');
    if (item001) {
      const qty = item001.quantity;
      cart.delete('ec01001');
      addItem('ec01002', qty);
      usage.TC -= qty;
      usage.DOP += qty;
    }
  }

  // Resolve adapters and blocks
  // Rule 2.2: Cannot add ec01096 adapter to increase LORA ports on ec01105
  if (usage.LORA > available.LORA && !isStart) {
    const adapters = Math.ceil((usage.LORA - available.LORA) / 32);
    available.LORA += adapters * 32; usage.DOP += adapters; addItem('ec01096', adapters);
  }
  
  // Rule 2.3: Cannot connect ec01060 on ec01105
  if (usage.TS > available.TS && !isStart) {
    const blocks = Math.ceil((usage.TS - available.TS) / 4);
    available.TS += blocks * 4; available.MIXER += blocks * 4; usage.DOP += blocks; addItem('ec01060', blocks);
  }
  
  // Rule 2.3: Cannot connect ec01025 on ec01105
  if (!isStart) {
    while (usage.RELAY > available.RELAY) { addItem('ec01025', 1); available.RELAY += 10; usage.DOP += 1; }
  } else {
    // Under Start, if RELAY is exceeded, use the LoRa Wireless Relay (ec01079) which adds 1 RELAY and consumes 1 LORA
    while (usage.RELAY > available.RELAY) { addItem('ec01079', 1); available.RELAY += 1; usage.LORA += 1; }
  }
  
  // Rule 2.3: Splitter ec01055 can be <= 1 on ec01105
  if (isStart) {
    if (usage.CONTACT > available.CONTACT) {
      addItem('ec01055', 1);
      available.CONTACT += 8;
      usage.DOP += 1;
    }
  } else {
    while (usage.CONTACT > available.CONTACT) { addItem('ec01055', 1); available.CONTACT += 8; usage.DOP += 1; }
  }
  
  // Swap TC for DOP if ports are full
  if (usage.TC > available.TC) {
    let excess = usage.TC - available.TC;
    
    // Priority 1: Move ec01001 to ec01002 (RS485)
    const item001 = cart.get('ec01001');
    if (item001 && item001.quantity > 0 && excess > 0) {
      const swap = Math.min(item001.quantity, excess);
      item001.quantity -= swap; if(item001.quantity === 0) cart.delete('ec01001');
      addItem('ec01002', swap); usage.TC -= swap; usage.DOP += swap; excess -= swap;
    }

    // Priority 2: Move ec01003 to ec01004 (RS485)
    const item003 = cart.get('ec01003');
    if (item003 && item003.quantity > state.mixingValves && excess > 0) {
      const swap = Math.min(item003.quantity - state.mixingValves, excess);
      item003.quantity -= swap; if(item003.quantity === 0) cart.delete('ec01003');
      addItem('ec01004', swap); usage.TC -= swap; usage.DOP += swap;
    }
  }
  while (usage.DOP > available.DOP) { addItem('ec01033', 1); available.DOP += 8; usage.DOP += 1; }

  const baseItem = cart.get(baseUnitId);
  if (baseItem) baseItem.quantity = isStart ? 1 : finalBaseQty;

  // PSU logic
  return Array.from(cart.values());
};