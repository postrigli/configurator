// Расчёт схемы подключения: какое устройство к какой клемме какого блока подключено.
// Работает поверх готовой корзины (calculateCart) и не меняет её.
import { AppState, CartItem, ConnectionType, Product } from '../types';
import { PRODUCTS } from '../constants';

export type LineKind = 'power230' | 'boiler' | 'rs485' | 'temp' | 'contact' | 'low12' | 'radio' | 'lora';
export type NodeKind = 'unit' | 'expander' | 'device' | 'load' | 'group';

export interface WLink {
  /** Ключи портов родителя. У манометра их два. */
  portKeys: string[];
  /** Короткая подпись порта на «язычке» родителя-коробки: «3», «Т2». */
  tabs: string[];
  /** Полное имя порта для подписей и таблицы: «Д1», «Реле 2 (D–F)», «Выход 3». */
  portName: string;
  kind: LineKind;
  /** Тип кабеля без имени порта. */
  cable: string;
  label: string;
  to: WNode;
}

export interface WNode {
  id: string;
  productId?: string;
  title: string;
  subtitle?: string;
  kind: NodeKind;
  /** Подпись входного «язычка» на верхней грани. */
  inTab?: string;
  /** Все выходы устройства (для отрисовки свободных «язычков»). */
  outs?: string[];
  qty?: number;
  reserve?: boolean;
  children: WLink[];
}

export interface UnitTree {
  root: WNode;
  model: 'ec01v40' | 'ec01105';
  index: number; // 1..N
}

export interface Unconnected { productId: string; name: string; qty: number; reason: string }

export interface WiringModel {
  units: UnitTree[];
  unconnected: Unconnected[];
  notes: string[];
}

// ---------------------------------------------------------------------------
// Подписи линий. Меняйте тексты здесь: схема и таблица берут их отсюда.
export const CABLE = {
  rs485: 'RS485, 4 жилы 0,5 мм²',
  temp: '3 жилы 0,5 мм²',
  contact: '4 жилы 0,5 мм²',
  power230: '~230 В, 3×0,75 мм²',
  boilerRelay: 'сухой контакт, 2×0,5 мм²',
  boilerBus: '2×0,75 мм²',
  neptun: '12 В, приводы Neptun',
  siren: '12 В, 2 жилы 0,5 мм²',
  mixer: '~230 В, 3×0,75 мм²',
  radio: '868 МГц',
  lora: 'LoRa',
};

const SHORT_NAMES: Record<string, string> = {
  ec01v40: 'ectoControl v.4.0', ec01105: 'ectoControl Start',
  ec01001: 'Датчик t° воздуха', ec01002: 'Датчик t° воздуха RS485', ec01003: 'Датчик t° в гильзе',
  ec01004: 'Датчик t° в гильзе RS485', ec01005: 'Беспр. датчик t°', ec01041: 'Датчик t° LoRa',
  ec01064: 'Датчик t° с гильзой LoRa', ec01006: 'Датчик протечки', ec01007: 'Беспр. датчик протечки',
  ec01056: 'Датчик протечки LoRa', ec01008: 'Датчик газа', ec01010: 'Манометр', ec01012: 'Датчик открытия',
  ec01013: 'Датчик движения', ec01014: 'Беспр. датчик движения', ec01015: 'Датчик дыма',
  ec01017: 'Беспр. датчик дыма', ec01068: 'Датчик CO', ec01016: 'Сирена', 'ec01016-1': 'Сирена комбинир.',
  ec01019: 'Брелок охраны', ec01091: 'Термостат RS485', ec01080: 'Термостат LoRa', ec01114: 'Датчик пола NTC',
  ec01025: 'Блок 10 реле', ec01033: 'Разветвитель RS485', ec01107: 'Разветвитель RS485 DIN',
  ec01055: 'Разветвитель контактов', ec01060: 'Блок смесит. контуров', ec01096: 'Адаптер LoRa',
  ec01079: 'Беспр. реле LoRa', ec01030: 'Датчик влажности RS485', ec01026: 'Датчик сети 220В',
  ec01029: 'Датчик уровня', ec01054: 'Беспр. датчик влажности', ec01043: 'Беспр. датчик открытия',
  ec01042: 'Адаптер OpenTherm', ec01057: 'Адаптер OpenTherm', ec01045: 'Адаптер E-Bus', ec01058: 'Адаптер Navien',
  ec01095: 'Адаптер BSB', ec01094: 'Адаптер Rinnai', ec01093: 'Адаптер Arderia', ec01092: 'Адаптер Lemax',
  ec01108: 'Адаптер Kiturami', ec01125: 'Адаптер EMS+', ec01098: 'Адаптер 0-10В', ec01097: 'Адаптер ШИМ',
};

const product = (id: string): Product | undefined => PRODUCTS.find(p => p.id === id);
export const shortName = (id: string): string => {
  if (SHORT_NAMES[id]) return SHORT_NAMES[id];
  const n = product(id)?.name || id;
  return n.length > 34 ? n.slice(0, 32) + '…' : n;
};

const BOILER_ADAPTER: Partial<Record<ConnectionType, string>> = {
  [ConnectionType.OPENTHERM]: 'ec01057', [ConnectionType.EBUS]: 'ec01045', [ConnectionType.NAVIEN]: 'ec01058',
  [ConnectionType.ARDERIA]: 'ec01093', [ConnectionType.BSB]: 'ec01095', [ConnectionType.RINNAI]: 'ec01094',
  [ConnectionType.LEMAX]: 'ec01092', [ConnectionType.V0_10]: 'ec01098', [ConnectionType.KITURAMI]: 'ec01108',
  [ConnectionType.EMS_PLUS]: 'ec01125',
};
const BUS_NAME: Partial<Record<ConnectionType, string>> = {
  [ConnectionType.OPENTHERM]: 'OpenTherm', [ConnectionType.EBUS]: 'eBus', [ConnectionType.NAVIEN]: 'Navien',
  [ConnectionType.ARDERIA]: 'Arderia', [ConnectionType.BSB]: 'BSB', [ConnectionType.RINNAI]: 'Rinnai',
  [ConnectionType.LEMAX]: 'Lemax', [ConnectionType.V0_10]: '0-10 В', [ConnectionType.KITURAMI]: 'Kiturami',
  [ConnectionType.EMS_PLUS]: 'EMS+',
};
const START_DIGITAL = [ConnectionType.OPENTHERM, ConnectionType.EBUS, ConnectionType.NAVIEN, ConnectionType.RINNAI, ConnectionType.BSB];

const V40_RELAY_LETTERS = ['A–C', 'D–F', 'G–I'];

// ---------------------------------------------------------------------------

let uid = 0;
const node = (kind: NodeKind, title: string, extra: Partial<WNode> = {}): WNode =>
  ({ id: `n${++uid}`, kind, title, children: [], ...extra });

const dev = (productId: string, subtitle?: string, extra: Partial<WNode> = {}): WNode =>
  node('device', shortName(productId), { productId, subtitle, ...extra });

const link = (parent: WNode, to: WNode, kind: LineKind, portName: string, portKeys: string[], tabs: string[], cable: string) => {
  parent.children.push({ to, kind, portName, portKeys, tabs, cable, label: cable ? `${portName} · ${cable}` : portName });
};

export const buildWiring = (state: AppState, items: CartItem[]): WiringModel => {
  uid = 0;
  const qty = (id: string) => items.filter(i => i.id === id).reduce((s, i) => s + i.quantity, 0);
  const isStart = (state.baseUnitId || 'ec01v40') === 'ec01105';
  const model: 'ec01v40' | 'ec01105' = isStart ? 'ec01105' : 'ec01v40';
  const unitCount = isStart ? 1 : Math.max(1, qty('ec01v40'));
  const unconnected: Unconnected[] = [];
  const notes: string[] = [];
  const miss = (productId: string, q: number, reason: string) => {
    if (q <= 0) return;
    const ex = unconnected.find(u => u.productId === productId && u.reason === reason);
    if (ex) ex.qty += q; else unconnected.push({ productId, name: product(productId)?.name || productId, qty: q, reason });
  };

  const units: UnitTree[] = [];
  for (let i = 1; i <= unitCount; i++) {
    units.push({
      model, index: i,
      root: node('unit', shortName(model), { productId: model, subtitle: unitCount > 1 ? `блок ${i} из ${unitCount}` : undefined }),
    });
  }
  const u1 = units[0].root;

  // Ручные позиции по типу порта (сколько добавлено вручную).
  const manualByType = (type: string) => state.manualItems
    .map(m => ({ m, p: product(m.productId) }))
    .filter(x => x.p?.consumesPort?.type === type)
    .flatMap(x => Array.from({ length: x.m.quantity }, () => x.m.productId));

  // ---------------------------------------------------------------- котлы
  const boilers = (isStart ? state.boilers.slice(0, 1) : state.boilers)
    .map(b => ({ b, type: (b as any).type as ConnectionType | undefined }))
    .filter(x => x.b.brand && x.type);
  const boilerName = (b: { brand: string; model: string }) => `Котёл ${b.brand}${b.model ? ' ' + b.model : ''}`;

  const relayBoilers: WNode[] = []; // сухой контакт: всегда на реле блока
  const busBoilers: { adapter: string; boiler: WNode; bus: string }[] = [];
  boilers.forEach(({ b, type }, idx) => {
    const bn = node('load', boilerName(b), { subtitle: boilers.length > 1 ? `котёл ${idx + 1}` : undefined });
    if (type === ConnectionType.RELAY || type === ConnectionType.CONTACTOR) {
      if (type === ConnectionType.CONTACTOR) bn.subtitle = [bn.subtitle, 'через контактор'].filter(Boolean).join(', ');
      relayBoilers.push(bn);
    } else if (isStart && START_DIGITAL.includes(type!)) {
      const baxi = qty('ec01124') > 0 && b.brand.toLowerCase() === 'baxi';
      if (baxi) bn.subtitle = [bn.subtitle, 'кабель ec01124'].filter(Boolean).join(', ');
      link(u1, bn, 'boiler', 'ЦШ', ['CSH'], ['ЦШ'], `${BUS_NAME[type!]}, ${CABLE.boilerBus}`);
    } else {
      busBoilers.push({ adapter: BOILER_ADAPTER[type!]!, boiler: bn, bus: BUS_NAME[type!] || '' });
    }
  });
  if (isStart && state.backupBoiler) relayBoilers.push(node('load', 'Резервный котёл', { subtitle: 'сухой контакт' }));

  // ---------------------------------------------------------------- реле
  type RelaySlot = { parent: WNode; portName: string; key: string; tab: string };
  const baseRelays: RelaySlot[] = [];
  units.forEach(u => {
    if (isStart) baseRelays.push({ parent: u.root, portName: 'Реле (B-A-C)', key: 'R1', tab: 'BAC' });
    else V40_RELAY_LETTERS.forEach((l, i) => baseRelays.push({ parent: u.root, portName: `Реле ${i + 1} (${l})`, key: `R${i + 1}`, tab: l }));
  });

  const loads: { n: WNode; kind: LineKind; cable: string }[] = [];
  const pushLoad = (title: string, subtitle?: string, kind: LineKind = 'power230', cable = CABLE.power230, productId?: string) =>
    loads.push({ n: node('load', title, { subtitle, productId }), kind, cable });
  if (state.boilerPump) pushLoad('Насос бойлера ГВС');
  for (let i = 1; i <= (isStart ? 0 : state.heatingPumps); i++) pushLoad(`Насос отопления ${i}`);
  if (state.recirculationPump && !isStart) pushLoad('Насос рециркуляции');
  for (let i = 1; i <= (isStart ? 0 : state.zones); i++) pushLoad(`Зона ${i}`, qty('ec01099') ? 'сервоприводы ec01099' : 'сервоприводы коллектора');
  for (let i = 1; i <= (isStart ? 0 : Math.min(state.zonesWithTwoSources, state.zones)); i++) pushLoad(`Зона ${i}, 2-й контур`, 'тёплый пол / радиаторы');
  const neptun = state.neptun12 + state.neptun34 + state.neptun1;
  if (neptun > 0) pushLoad(`Краны Neptun × ${neptun}`, [state.neptun12 && `1/2"×${state.neptun12}`, state.neptun34 && `3/4"×${state.neptun34}`, state.neptun1 && `1"×${state.neptun1}`].filter(Boolean).join(', '), 'low12', CABLE.neptun);
  manualByType('RELAY').forEach(id => loads.push({ n: dev(id, 'добавлено вручную', { kind: 'load' }), kind: 'power230', cable: CABLE.power230 }));

  // Котлы с сухим контактом: реле блоков по порядку (A–C первым).
  const freeBase = [...baseRelays];
  const boilerOverflow: WNode[] = [];
  relayBoilers.forEach(bn => {
    const s = freeBase.shift();
    if (!s) { boilerOverflow.push(bn); return; }
    if (qty('ec01011')) bn.subtitle = [bn.subtitle, 'кабель ec01011'].filter(Boolean).join(', ');
    link(s.parent, bn, 'boiler', s.portName, [s.key], [s.tab], CABLE.boilerRelay);
  });

  // Силовые нагрузки: сначала блоки реле (ec01025 / ec01079), потом реле блока.
  const relayExpanders: WNode[] = [];
  const bigRelaySlots: { parent: WNode; portName: string; tab: string; key: string }[] = [];
  if (!isStart) {
    for (let i = 1; i <= qty('ec01025'); i++) {
      const e = dev('ec01025', qty('ec01025') > 1 ? `№${i}` : undefined, { kind: 'expander', inTab: 'ДОП', outs: Array.from({ length: 10 }, (_, k) => String(k + 1)) });
      relayExpanders.push(e);
      for (let r = 1; r <= 10; r++) bigRelaySlots.push({ parent: e, portName: `Реле ${r}`, tab: String(r), key: String(r) });
    }
  }
  const wirelessRelays: WNode[] = [];
  if (isStart) {
    for (let i = 1; i <= qty('ec01079'); i++) {
      const e = dev('ec01079', qty('ec01079') > 1 ? `№${i}` : undefined, { kind: 'expander', inTab: 'LoRa' });
      wirelessRelays.push(e);
      bigRelaySlots.push({ parent: e, portName: 'Реле 10 А', tab: '10А', key: '1' });
    }
  }
  const relayOrder = [...boilerOverflow.map(n => ({ n, kind: 'boiler' as LineKind, cable: CABLE.boilerRelay })), ...loads];
  const slots = [...bigRelaySlots, ...freeBase.map(s => ({ parent: s.parent, portName: s.portName, tab: s.tab, key: s.key }))];
  relayOrder.forEach(l => {
    const s = slots.shift();
    if (!s) { miss(l.n.productId || 'ec01025', 1, `${l.n.title}: нет свободного реле`); return; }
    link(s.parent, l.n, l.kind, s.portName, [s.key], [s.tab], l.cable);
  });
  relayExpanders.forEach(e => { if (!e.children.length) e.reserve = true; });

  // ---------------------------------------------------------------- датчики температуры (Т)
  const tPorts: { parent: WNode; n: number }[] = [];
  units.forEach(u => { for (let t = 1; t <= (isStart ? 2 : 3); t++) tPorts.push({ parent: u.root, n: t }); });
  const tRoles: string[] = [];
  if (boilers.length > 1) tRoles.push('Каскад, гидрострелка');
  if (state.outdoorSensor) tRoles.push('Уличный');
  if (state.boilerPump) tRoles.push('Бойлер ГВС');
  const n003 = Math.max(0, qty('ec01003') - (isStart ? 0 : state.mixingValves));
  const n001 = qty('ec01001');
  const n002 = qty('ec01002');
  const n004 = qty('ec01004');
  const tDevices: WNode[] = [];
  tRoles.slice(0, n003).forEach(r => tDevices.push(dev('ec01003', r)));
  for (let i = tRoles.length; i < n003; i++) tDevices.push(dev('ec01003', 'добавлено вручную'));
  for (let i = 1; i <= n001; i++) tDevices.push(dev('ec01001', `Комната ${i}`));
  const rsTemp: WNode[] = [];
  tRoles.slice(n003).forEach(r => rsTemp.push(dev('ec01004', r)));
  for (let i = 1; i <= state.floorSensors; i++) rsTemp.push(dev('ec01004', isStart ? `В гильзе ${i}` : `Пол ${i}`));
  const extra004 = n004 - rsTemp.length;
  for (let i = 0; i < extra004; i++) rsTemp.push(dev('ec01004', 'добавлено вручную'));
  const airStart = n001 + 1;
  for (let i = 0; i < n002; i++) rsTemp.push(dev('ec01002', `Комната ${airStart + i}`));
  tDevices.forEach(d => {
    const p = tPorts.shift();
    if (!p) { miss(d.productId!, 1, 'нет свободного входа Т'); return; }
    const name = !isStart && p.n === 3 ? 'Т3/КЛ' : `Т${p.n}`;
    link(p.parent, d, 'temp', name, [`T${p.n}`], [`Т${p.n}`], CABLE.temp);
  });

  // ---------------------------------------------------------------- контакты (Д)
  type CSlot = { parent: WNode; key: string; name: string; tab: string; group: string };
  const cSlots: CSlot[] = [];
  units.forEach(u => { for (let d = 1; d <= (isStart ? 1 : 5); d++) cSlots.push({ parent: u.root, key: `D${d}`, name: `Д${d}`, tab: `Д${d}`, group: u.root.id }); });
  const contactExp: WNode[] = [];
  for (let i = 1; i <= qty('ec01055'); i++) {
    const e = dev('ec01055', qty('ec01055') > 1 ? `№${i}` : undefined, { kind: 'expander', inTab: 'ДОП', outs: Array.from({ length: 8 }, (_, k) => String(k + 1)) });
    contactExp.push(e);
    for (let k = 1; k <= 8; k++) cSlots.push({ parent: e, key: String(k), name: `Вход ${k}`, tab: String(k), group: e.id });
  }
  const contactDevs: { n: WNode; ports: number }[] = [];
  const addC = (id: string, count: number, label?: (i: number) => string, ports = 1) => {
    for (let i = 1; i <= count; i++) contactDevs.push({ n: dev(id, label ? label(i) : count > 1 ? `№${i}` : undefined), ports });
  };
  if (!isStart) addC('ec01008', state.gasSensors);
  addC('ec01010', state.pressureSensors, i => state.pressureSensors > 1 ? `№${i}, мин./макс.` : 'мин./макс.', 2);
  addC('ec01015', state.wiredSmokeSensors);
  addC('ec01006', state.wiredLeakSensors);
  addC('ec01013', state.wiredMotionSensors);
  for (let i = 1; i <= state.ownThermostats; i++) contactDevs.push({ n: node('device', 'Термостат', { subtitle: 'сухой контакт' }), ports: 1 });
  manualByType('CONTACT').forEach(id => contactDevs.push({ n: dev(id, 'добавлено вручную'), ports: product(id)?.consumesPort?.amount || 1 }));
  contactDevs.forEach(c => {
    let idx = 0;
    while (idx < cSlots.length) {
      const g = cSlots[idx].group;
      const run = cSlots.slice(idx, idx + c.ports);
      if (run.length === c.ports && run.every(s => s.group === g)) break;
      idx++;
    }
    const run = cSlots.slice(idx, idx + c.ports);
    if (run.length < c.ports) { miss(c.n.productId || 'ec01055', 1, 'нет свободного контактного входа'); return; }
    cSlots.splice(idx, c.ports);
    link(run[0].parent, c.n, 'contact', run.map(r => r.name).join(' + '), run.map(r => r.key), run.map(r => r.tab), CABLE.contact);
  });
  contactExp.forEach(e => { if (!e.children.length) e.reserve = true; });

  // ---------------------------------------------------------------- сирены (1-2-3)
  if (!isStart) {
    const sSlots: { parent: WNode; key: string; name: string; tab: string }[] = [];
    units.forEach(u => {
      sSlots.push({ parent: u.root, key: 'S1', name: 'Клеммы 3 и 2', tab: '3,2' });
      sSlots.push({ parent: u.root, key: 'S2', name: 'Клеммы 1 и 2', tab: '1,2' });
    });
    const sirens = [
      ...Array.from({ length: state.wiredSirens }, () => 'ec01016'),
      ...Array.from({ length: state.combinedSirens }, () => 'ec01016-1'),
      ...manualByType('123'),
    ];
    sirens.forEach((id, i) => {
      const s = sSlots.shift();
      if (!s) { miss(id, 1, 'нет свободного выхода 1-2-3'); return; }
      link(s.parent, dev(id, sirens.length > 1 ? `№${i + 1}` : undefined), 'low12', s.name, [s.key], [s.tab], CABLE.siren);
    });
  }

  // ---------------------------------------------------------------- смесительные контуры
  const mixerBlocks: WNode[] = [];
  if (!isStart) {
    for (let i = 1; i <= qty('ec01060'); i++) mixerBlocks.push(dev('ec01060', qty('ec01060') > 1 ? `№${i}` : undefined, { kind: 'expander', inTab: 'ДОП', outs: ['Т1', 'M1', 'Т2', 'M2', 'Т3', 'M3', 'Т4', 'M4'] }));
    for (let c = 1; c <= state.mixingValves; c++) {
      const b = mixerBlocks[Math.floor((c - 1) / 4)];
      if (!b) { miss('ec01003', 1, `смеситель ${c}: нет блока ec01060`); continue; }
      const k = ((c - 1) % 4) + 1;
      link(b, dev('ec01003', `Смеситель ${c}`), 'temp', `Т${k}`, [`T${k}`], [`Т${k}`], CABLE.temp);
      link(b, node('load', `Сервопривод смесителя ${c}`, { subtitle: '230 В, 3-точечный' }), 'power230', `M${k}`, [`M${k}`], [`M${k}`], CABLE.mixer);
    }
    mixerBlocks.forEach(e => { if (!e.children.length) e.reserve = true; });
  }

  // ---------------------------------------------------------------- LoRa
  const loraGroups: { id: string; count: number }[] = [];
  const addLora = (id: string, count: number) => { if (count > 0) { const g = loraGroups.find(x => x.id === id); if (g) g.count += count; else loraGroups.push({ id, count }); } };
  addLora('ec01041', state.wirelessSensors);
  addLora('ec01080', isStart ? Math.min(1, state.wirelessThermostats) : state.wirelessThermostats);
  if (!isStart) addLora('ec01056', state.wirelessLeakSensorsLora);
  manualByType('LORA').filter(id => id !== 'ec01079').forEach(id => addLora(id, 1));
  let loraLeft = 32 - wirelessRelays.length;
  const loraNodes: WNode[] = [];
  loraGroups.forEach(g => {
    const n = Math.min(g.count, Math.max(0, loraLeft));
    loraLeft -= n;
    if (n > 0) loraNodes.push(dev(g.id, n > 1 ? `× ${n}` : undefined, { kind: 'group', qty: n }));
    if (g.count > n) miss(g.id, g.count - n, 'превышен лимит 32 LoRa-устройства на систему');
  });
  const loraAdapters: WNode[] = [];
  if (isStart) {
    [...loraNodes, ...wirelessRelays].forEach(n => link(u1, n, 'lora', 'LoRa', ['LORA'], ['LoRa'], ''));
  } else {
    for (let i = 1; i <= qty('ec01096'); i++) loraAdapters.push(dev('ec01096', qty('ec01096') > 1 ? `№${i}` : undefined, { kind: 'expander', inTab: 'ДОП' }));
    if (loraNodes.length && !loraAdapters.length) loraNodes.forEach(n => miss(n.productId!, n.qty || 1, 'нет адаптера LoRa ec01096'));
    else loraNodes.forEach(n => link(loraAdapters[0], n, 'lora', 'LoRa', ['LORA'], ['LoRa'], ''));
    loraAdapters.slice(1).forEach(a => { a.reserve = true; });
    if (loraAdapters.length > 1) notes.push('LoRa: на систему не более 32 LoRa-устройств, сколько бы ни было адаптеров ec01096. Дополнительный адаптер используется только для зоны покрытия.');
  }

  // ---------------------------------------------------------------- радио 868 МГц (v4.0)
  if (!isStart) {
    const radio: { id: string; count: number }[] = [];
    const addR = (id: string, c: number) => { if (c > 0) { const g = radio.find(x => x.id === id); if (g) g.count += c; else radio.push({ id, count: c }); } };
    addR('ec01005', state.wirelessRadioSensors); addR('ec01068', state.coSensors); addR('ec01017', state.wirelessSmokeSensors);
    addR('ec01007', state.wirelessLeakSensors); addR('ec01014', state.wirelessMotionSensors); addR('ec01019', state.wirelessKeyfobs);
    manualByType('RADIO').forEach(id => addR(id, 1));
    let ui = 0; let left = 32;
    radio.forEach(g => {
      let rest = g.count;
      while (rest > 0 && ui < units.length) {
        const n = Math.min(rest, left);
        if (n > 0) link(units[ui].root, dev(g.id, n > 1 ? `× ${n}` : undefined, { kind: 'group', qty: n }), 'radio', '868 МГц', ['RADIO'], ['868'], '');
        rest -= n; left -= n;
        if (left === 0) { ui++; left = 32; }
      }
      if (rest > 0) miss(g.id, rest, 'превышен лимит 32 радиоустройства на блок');
    });
  }

  // ---------------------------------------------------------------- шина RS485 (ДОП)
  const rs: WNode[] = [];
  busBoilers.forEach(({ adapter, boiler, bus }) => {
    const a = dev(adapter, undefined, { kind: 'expander', inTab: 'ДОП' });
    link(a, boiler, 'boiler', bus, ['OUT'], ['Котёл'], CABLE.boilerBus);
    rs.push(a);
  });
  rs.push(...relayExpanders, ...contactExp, ...mixerBlocks, ...loraAdapters);
  const ntc = isStart ? 0 : Math.min(qty('ec01114'), state.wiredThermostats);
  for (let i = 1; i <= qty('ec01091'); i++) {
    const t = dev('ec01091', qty('ec01091') > 1 ? `№${i}` : undefined, { inTab: 'ДОП' });
    if (i <= ntc) { t.kind = 'expander'; link(t, dev('ec01114', 'в стяжке'), 'temp', 'NTC', ['OUT'], ['NTC'], '2 жилы, кабель датчика'); }
    rs.push(t);
  }
  rsTemp.forEach(d => { d.inTab = 'ДОП'; rs.push(d); });
  manualByType('DOP')
    .filter(id => !['ec01025', 'ec01055', 'ec01060', 'ec01096', 'ec01091', 'ec01004', 'ec01002', 'ec01033', 'ec01107', ...Object.values(BOILER_ADAPTER)].includes(id))
    .forEach(id => rs.push(dev(id, 'добавлено вручную', { inTab: 'ДОП' })));

  const splitterIds = [...Array(qty('ec01033')).fill('ec01033'), ...Array(qty('ec01107')).fill('ec01107')] as string[];
  const splitters = splitterIds.map((id, i) => dev(id, splitterIds.length > 1 ? `№${i + 1}` : undefined, { kind: 'expander', inTab: 'ДОП', outs: Array.from({ length: 8 }, (_, k) => String(k + 1)) }));
  const rsLabel = CABLE.rs485;
  if (!splitters.length) {
    rs.forEach((d, i) => {
      if (i === 0) link(u1, d, 'rs485', 'ДОП', ['DOP'], ['ДОП'], rsLabel);
      else miss(d.productId || 'ec01033', 1, 'порт ДОП занят: нужен разветвитель ec01033');
    });
  } else {
    link(u1, splitters[0], 'rs485', 'ДОП', ['DOP'], ['ДОП'], rsLabel);
    let si = 0; let out = 1;
    const queue = [...rs];
    while (queue.length && si < splitters.length) {
      const sp = splitters[si];
      const isLastOut = out === 8;
      if (isLastOut && si + 1 < splitters.length) {
        link(sp, splitters[si + 1], 'rs485', `Выход ${out}`, [String(out)], [String(out)], rsLabel);
        si++; out = 1; continue;
      }
      const d = queue.shift()!;
      link(sp, d, 'rs485', `Выход ${out}`, [String(out)], [String(out)], rsLabel);
      out++;
      if (out > 8) { si++; out = 1; }
    }
    queue.forEach(d => miss(d.productId || 'ec01033', 1, 'не хватает выходов разветвителей RS485'));
    // разветвители, до которых не дошли устройства
    for (let k = si + 1; k < splitters.length; k++) if (!splitters[k].children.length) splitters[k].reserve = true;
    if (splitters.length > 2) notes.push('Больше двух разветвителей RS485: подключите к ним дополнительное питание 12–14 В.');
  }

  // Порядок детей у блока = порядок клемм слева направо (это исключает пересечения линий).
  const order = isStart ? START_PORT_ORDER : V40_PORT_ORDER;
  units.forEach(u => u.root.children.sort((a, b) => order.indexOf(a.portKeys[0]) - order.indexOf(b.portKeys[0])));

  return { units, unconnected, notes };
};

export const V40_PORT_ORDER = ['DOP', 'D1', 'D2', 'D3', 'D4', 'D5', 'T1', 'T2', 'T3', 'R1', 'R2', 'R3', 'S2', 'S1', 'RADIO'];
export const START_PORT_ORDER = ['CSH', 'PU', 'R1', 'T1', 'T2', 'D1', 'DOP', 'LORA'];
