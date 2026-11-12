// Расчёт схемы подключения: какое устройство к какой клемме какого блока подключено.
// v4.0: общий расчёт для корзины и схемы (buildV40). Start: схема строится по готовой корзине.
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
  ec01055: 'Адресный разветвитель', ec01060: 'Блок смесит. контуров', ec01096: 'Адаптер LoRa',
  ec01079: 'Беспр. реле LoRa', ec01039: 'Адаптер питания', ec01030: 'Датчик влажности RS485', ec01026: 'Датчик сети 220В',
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

const buildStart = (state: AppState, items: CartItem[]): WiringModel => {
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
  const splitters = splitterIds.map((id, i) => dev(id, splitterIds.length > 1 ? `№${i + 1}` : undefined, { kind: 'expander', inTab: 'ДОП', outs: Array.from({ length: SPLITTER_OUTS }, (_, k) => String(k + 1)) }));
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
      const isLastOut = out === SPLITTER_OUTS;
      if (isLastOut && si + 1 < splitters.length) {
        link(sp, splitters[si + 1], 'rs485', `Выход ${out}`, [String(out)], [String(out)], rsLabel);
        si++; out = 1; continue;
      }
      const d = queue.shift()!;
      link(sp, d, 'rs485', `Выход ${out}`, [String(out)], [String(out)], rsLabel);
      out++;
      if (out > SPLITTER_OUTS) { si++; out = 1; }
    }
    queue.forEach(d => miss(d.productId || 'ec01033', 1, 'не хватает выходов разветвителей RS485'));
    // разветвители, до которых не дошли устройства
    for (let k = si + 1; k < splitters.length; k++) if (!splitters[k].children.length) splitters[k].reserve = true;
  }
  attachPsuFromCart(splitters, contactExp, qty('ec01039'));

  // Порядок детей у блока = порядок клемм слева направо (это исключает пересечения линий).
  const order = isStart ? START_PORT_ORDER : V40_PORT_ORDER;
  units.forEach(u => u.root.children.sort((a, b) => order.indexOf(a.portKeys[0]) - order.indexOf(b.portKeys[0])));

  return { units, unconnected, notes };
};

// Разветвитель RS485 (ec01033 / ec01107): 10 гнёзд, одно — вход, 9 выходов; последний может вести к следующему разветвителю.
const SPLITTER_OUTS = 9;

export const V40_PORT_ORDER = ['DOP', 'D1', 'D2', 'D3', 'D4', 'D5', 'T1', 'T2', 'T3', 'R1', 'R2', 'R3', 'S2', 'S1', 'RADIO'];
export const START_PORT_ORDER = ['CSH', 'PU', 'R1', 'T1', 'T2', 'D1', 'DOP', 'LORA'];

// ===========================================================================
// ectoControl v4.0: единый расчёт для корзины и для схемы.
// Корзина (logic.ts) вызывает buildWiring и берёт отсюда количество расширителей и датчиков
// из PLANNED_IDS, поэтому корзина и схема не расходятся.
//
// Правила распределения по блокам (Иван, 2026-11-12):
//  - блок 1 «котельная»: котлы, насосы отопления/ГВС/рециркуляции, смесительные контуры,
//    датчики котельной (каскад, уличный, бойлер ГВС), краны Neptun;
//  - блоки 2…N «зоны»: зоны отопления (и их 2-й контур), комнатные датчики температуры
//    (проводные, радио, LoRa), термостаты, датчики пола;
//  - датчики безопасности: сначала блок 1, потом блок 2…, потом адресный разветвитель ec01055;
//  - у каждого блока своя шина ДОП, свои разветвители и своё питание ec01039.
export const PLANNED_IDS = ['ec01025', 'ec01060', 'ec01055', 'ec01096', 'ec01033', 'ec01039', 'ec01001', 'ec01002', 'ec01003', 'ec01004'];
export const UNIT_CIRCUITS = 19; // контуров управления на один блок (20 и больше → второй блок)
const MAX_SPLITTERS_PER_LINE = 6;
const MAX_EC01055 = 5;
const LORA_PER_UNIT = 32;
const RADIO_PER_UNIT = 32;

export interface PlannedWiring extends WiringModel { counts: Record<string, number> }

/** Адаптеры питания ec01039 на одной линии ДОП: max(каждый второй разветвитель, ec01055 с 5+ датчиками). */
export const attachPsu = (splitters: WNode[], contactExps: WNode[], count: (id: string, n?: number) => void) => {
  const big = contactExps.filter(e => e.children.length >= 5);
  const need = Math.max(Math.floor(splitters.length / 2), big.length);
  const targets: WNode[] = [...big];
  // остальные — в каждый второй разветвитель, начиная с самого дальнего
  const even = splitters.filter((_, i) => i % 2 === 1).reverse();
  while (targets.length < need && even.length) targets.push(even.shift()!);
  targets.forEach(t => {
    t.outs = [...(t.outs || []), 'ПИТ'];
    link(t, dev('ec01039', '14 В, 2 А'), 'low12', 'Питание', ['PSU'], ['ПИТ'], '14 В');
    count('ec01039');
  });
};

const buildV40 = (state: AppState, items: CartItem[]): PlannedWiring => {
  uid = 0;
  const qty = (id: string) => items.filter(i => i.id === id).reduce((s, i) => s + i.quantity, 0);
  const manualQty = (id: string) => state.manualItems.filter(m => m.productId === id).reduce((s, m) => s + m.quantity, 0);
  const N = Math.max(1, qty('ec01v40'));
  const counts: Record<string, number> = {};
  const count = (id: string, n = 1) => { counts[id] = (counts[id] || 0) + n; };
  const unconnected: Unconnected[] = [];
  const notes: string[] = [];
  const miss = (productId: string, q: number, reason: string) => {
    if (q <= 0) return;
    const ex = unconnected.find(u => u.productId === productId && u.reason === reason);
    if (ex) ex.qty += q; else unconnected.push({ productId, name: product(productId)?.name || productId, qty: q, reason });
  };
  const manualByType = (type: string) => state.manualItems
    .map(m => ({ m, p: product(m.productId) }))
    .filter(x => x.p?.consumesPort?.type === type && !PLANNED_IDS.includes(x.m.productId))
    .flatMap(x => Array.from({ length: x.m.quantity }, () => x.m.productId));

  const units: UnitTree[] = [];
  for (let i = 1; i <= N; i++) {
    const role = N > 1 ? (i === 1 ? 'котельная' : 'зоны') : '';
    units.push({ model: 'ec01v40', index: i, root: node('unit', shortName('ec01v40'), { productId: 'ec01v40', subtitle: N > 1 ? `блок ${i} из ${N}, ${role}` : undefined }) });
  }
  const U = units.map(u => u.root);
  const U0 = U[0];
  const zoneUnits = N > 1 ? U.slice(1) : [U0];
  const zoneFirst = N > 1 ? [...U.slice(1), U0] : [U0];

  // Шина ДОП каждого блока: группы в порядке, в котором они встают на разветвитель.
  type Bus = { adapters: WNode[]; relays: WNode[]; contacts: WNode[]; mixers: WNode[]; lora: WNode[]; thermostats: WNode[]; temps: WNode[]; manual: WNode[] };
  const buses = new Map<WNode, Bus>(U.map(u => [u, { adapters: [], relays: [], contacts: [], mixers: [], lora: [], thermostats: [], temps: [], manual: [] }]));
  const bus = (u: WNode) => buses.get(u)!;
  const num = (n: number, total: number) => total > 1 ? `№${n}` : undefined;

  // ---------------------------------------------------------------- котлы
  const boilers = state.boilers.map(b => ({ b, type: (b as any).type as ConnectionType | undefined })).filter(x => x.b.brand && x.type);
  const boilerName = (b: { brand: string; model: string }) => `Котёл ${b.brand}${b.model ? ' ' + b.model : ''}`;
  const dryBoilers: WNode[] = [];
  boilers.forEach(({ b, type }, idx) => {
    const bn = node('load', boilerName(b), { subtitle: boilers.length > 1 ? `котёл ${idx + 1}` : undefined });
    if (type === ConnectionType.RELAY || type === ConnectionType.CONTACTOR) {
      if (type === ConnectionType.CONTACTOR) bn.subtitle = [bn.subtitle, 'через контактор'].filter(Boolean).join(', ');
      if (qty('ec01011')) bn.subtitle = [bn.subtitle, 'кабель ec01011'].filter(Boolean).join(', ');
      dryBoilers.push(bn);
    } else {
      const a = dev(BOILER_ADAPTER[type!]!, undefined, { kind: 'expander', inTab: 'ДОП' });
      link(a, bn, 'boiler', BUS_NAME[type!] || '', ['OUT'], ['Котёл'], CABLE.boilerBus);
      bus(U0).adapters.push(a);
    }
  });

  // ---------------------------------------------------------------- нагрузки 230 В
  type Load = { n: WNode; kind: LineKind; cable: string };
  const mk = (title: string, subtitle?: string, kind: LineKind = 'power230', cable = CABLE.power230): Load => ({ n: node('load', title, { subtitle }), kind, cable });
  const loads = new Map<WNode, Load[]>(U.map(u => [u, []]));
  const C = UNIT_CIRCUITS;
  const used = new Map<WNode, number>(U.map(u => [u, 0]));
  const roomOf = (u: WNode) => C - used.get(u)!;
  const mostRoom = () => [...zoneUnits].sort((a, b) => roomOf(b) - roomOf(a))[0];

  // Котельная перегружена (больше 19 контуров) → группами на блок зон: сначала насосы отопления, потом смесители.
  // Котлы и насос бойлера всегда остаются на блоке 1.
  const base1 = boilers.length + (state.boilerPump ? 1 : 0);
  let pumpsUnit = U0; let mixUnit = U0;
  const u1 = () => Math.max(pumpsUnit === U0 ? state.heatingPumps : 0, mixUnit === U0 ? state.mixingValves : 0) + base1;
  if (N > 1 && u1() > C && state.heatingPumps > 0) pumpsUnit = mostRoom();
  if (N > 1 && u1() > C && state.mixingValves > 0) mixUnit = pumpsUnit !== U0 ? pumpsUnit : mostRoom();
  used.set(U0, u1());
  if (pumpsUnit !== U0 || mixUnit !== U0) {
    const z = pumpsUnit !== U0 ? pumpsUnit : mixUnit;
    used.set(z, used.get(z)! + Math.max(pumpsUnit === z ? state.heatingPumps : 0, mixUnit === z ? state.mixingValves : 0));
  }

  const boilerLoads: Load[] = [];
  if (state.boilerPump) boilerLoads.push(mk('Насос бойлера ГВС'));
  if (state.recirculationPump) boilerLoads.push(mk('Насос рециркуляции'));
  const neptun = state.neptun12 + state.neptun34 + state.neptun1;
  if (neptun > 0) boilerLoads.push(mk(`Краны Neptun × ${neptun}`, [state.neptun12 && `1/2"×${state.neptun12}`, state.neptun34 && `3/4"×${state.neptun34}`, state.neptun1 && `1"×${state.neptun1}`].filter(Boolean).join(', '), 'low12', CABLE.neptun));
  manualByType('RELAY').forEach(id => boilerLoads.push({ n: dev(id, 'добавлено вручную', { kind: 'load' }), kind: 'power230', cable: CABLE.power230 }));
  const pumps: Load[] = [];
  for (let i = 1; i <= state.heatingPumps; i++) pumps.push(mk(`Насос отопления ${i}`));
  loads.get(pumpsUnit)!.push(...pumps);
  loads.get(U0)!.push(...boilerLoads);

  // Зоны: зона и её 2-й контур всегда на одном блоке. Блоки зон заполняются до 19 контуров,
  // остаток зон переходит на блок 1 одной группой (сколько там поместится), лишнее — на последний блок зон.
  const zoneSub = qty('ec01099') ? 'сервоприводы ec01099' : 'сервоприводы коллектора';
  const z2 = Math.min(state.zonesWithTwoSources, state.zones);
  const zoneGroups: Load[][] = [];
  for (let i = 1; i <= state.zones; i++) {
    const g = [mk(`Зона ${i}`, zoneSub)];
    if (i <= z2) g.push(mk(`Зона ${i}, 2-й контур`, 'тёплый пол / радиаторы'));
    zoneGroups.push(g);
  }
  const putZone = (u: WNode, g: Load[]) => { loads.get(u)!.push(...g); used.set(u, used.get(u)! + g.length); };
  const restZones: Load[][] = [];
  if (N === 1) zoneGroups.forEach(g => putZone(U0, g));
  else {
    let zi = 0;
    zoneGroups.forEach(g => {
      while (zi < zoneUnits.length && roomOf(zoneUnits[zi]) < g.length) zi++;
      if (zi < zoneUnits.length) putZone(zoneUnits[zi], g); else restZones.push(g);
    });
    restZones.forEach(g => {
      if (roomOf(U0) >= g.length) { putZone(U0, g); return; }
      // целиком не помещается нигде: зону и её 2-й контур можно развести по свободным местам
      g.forEach(l => putZone([U0, ...zoneUnits].find(u => roomOf(u) >= 1) || zoneUnits[zoneUnits.length - 1], [l]));
    });
  }
  const objects = Math.max(state.mixingValves, state.heatingPumps) + boilers.length + (state.boilerPump ? 1 : 0) + state.zones + state.zonesWithTwoSources;
  if (objects > 3 * C) notes.push(`Объектов управления больше ${3 * C} (${objects}): такую систему лучше проработать с инженером ectoControl.`);

  // ---------------------------------------------------------------- реле: сначала ec01025 блока, потом реле блока
  let manual025 = manualQty('ec01025');
  let n025 = 0;
  const total025 = () => n025;
  U.forEach((u, ui) => {
    const base = V40_RELAY_LETTERS.map((l, i) => ({ parent: u, portName: `Реле ${i + 1} (${l})`, key: `R${i + 1}`, tab: l }));
    const ls: Load[] = [];
    if (ui === 0) dryBoilers.forEach(bn => {
      const s = base.shift();
      if (s) link(s.parent, bn, 'boiler', s.portName, [s.key], [s.tab], CABLE.boilerRelay);
      else ls.push({ n: bn, kind: 'boiler', cable: CABLE.boilerRelay });
    });
    ls.push(...loads.get(u)!);
    const manualHere = ui === 0 ? manual025 : 0;
    const needNew = Math.max(0, Math.ceil((ls.length - base.length - manualHere * 10) / 10));
    const exps: WNode[] = [];
    for (let i = 0; i < manualHere + needNew; i++) exps.push(dev('ec01025', undefined, { kind: 'expander', inTab: 'ДОП', outs: Array.from({ length: 10 }, (_, k) => String(k + 1)) }));
    if (ui === 0) manual025 = 0;
    count('ec01025', exps.length); n025 += exps.length;
    const slots = [...exps.flatMap(e => Array.from({ length: 10 }, (_, k) => ({ parent: e, portName: `Реле ${k + 1}`, key: String(k + 1), tab: String(k + 1) }))), ...base];
    ls.forEach(l => {
      const s = slots.shift();
      if (!s) { miss(l.n.productId || 'ec01025', 1, `${l.n.title}: нет свободного реле`); return; }
      link(s.parent, l.n, l.kind, s.portName, [s.key], [s.tab], l.cable);
    });
    exps.forEach(e => { if (!e.children.length) e.reserve = true; });
    bus(u).relays.push(...exps);
  });
  // номера ec01025 по всей системе
  { let k = 0; U.forEach(u => bus(u).relays.forEach(e => { e.subtitle = num(++k, total025()); })); }

  // ---------------------------------------------------------------- смесительные контуры (блок 1)
  const mixAuto = Math.ceil(state.mixingValves / 4);
  const mixTotal = Math.max(mixAuto, 0) + manualQty('ec01060');
  const mixers: WNode[] = [];
  for (let i = 1; i <= mixTotal; i++) mixers.push(dev('ec01060', num(i, mixTotal), { kind: 'expander', inTab: 'ДОП', outs: ['Т1', 'M1', 'Т2', 'M2', 'Т3', 'M3', 'Т4', 'M4'] }));
  count('ec01060', mixTotal);
  for (let c = 1; c <= state.mixingValves; c++) {
    const b = mixers[Math.floor((c - 1) / 4)];
    const k = ((c - 1) % 4) + 1;
    link(b, dev('ec01003', `Смеситель ${c}`), 'temp', `Т${k}`, [`T${k}`], [`Т${k}`], CABLE.temp); count('ec01003');
    link(b, node('load', `Сервопривод смесителя ${c}`, { subtitle: '230 В, 3-точечный' }), 'power230', `M${k}`, [`M${k}`], [`M${k}`], CABLE.mixer);
  }
  mixers.forEach(e => { if (!e.children.length) e.reserve = true; });
  bus(mixUnit).mixers.push(...mixers);

  // ---------------------------------------------------------------- датчики температуры (Т)
  const tFree = new Map<WNode, number[]>(U.map(u => [u, [1, 2, 3]]));
  const linkT = (u: WNode, d: WNode) => {
    const t = tFree.get(u)!.shift()!;
    link(u, d, 'temp', t === 3 ? 'Т3/КЛ' : `Т${t}`, [`T${t}`], [`Т${t}`], CABLE.temp);
  };
  const roles: string[] = [];
  if (boilers.length > 1) roles.push('Каскад, гидрострелка');
  if (state.outdoorSensor) roles.push('Уличный');
  if (state.boilerPump) roles.push('Бойлер ГВС');
  roles.forEach(r => {
    if (tFree.get(U0)!.length) { linkT(U0, dev('ec01003', r)); count('ec01003'); }
    else { bus(U0).temps.push(dev('ec01004', r, { inTab: 'ДОП' })); count('ec01004'); }
  });
  for (let i = 0; i < manualQty('ec01003'); i++) {
    count('ec01003');
    if (tFree.get(U0)!.length) linkT(U0, dev('ec01003', 'добавлено вручную')); else miss('ec01003', 1, 'нет свободного входа Т');
  }
  // комнатные: Т-входы блоков зон, затем ec01002 на шину блока зон
  const room = state.wiredSensors + manualQty('ec01001');
  let rz = 0;
  for (let i = 1; i <= room; i++) {
    const u = zoneFirst.find(x => tFree.get(x)!.length);
    if (u) { linkT(u, dev('ec01001', `Комната ${i}`)); count('ec01001'); continue; }
    const zu2 = zoneUnits[rz++ % zoneUnits.length];
    bus(zu2).temps.push(dev('ec01002', `Комната ${i}`, { inTab: 'ДОП' })); count('ec01002');
  }
  for (let i = 0; i < manualQty('ec01002'); i++) { bus(zoneUnits[0]).temps.push(dev('ec01002', 'добавлено вручную', { inTab: 'ДОП' })); count('ec01002'); }
  for (let i = 1; i <= state.floorSensors; i++) { bus(zoneUnits[(i - 1) % zoneUnits.length]).temps.push(dev('ec01004', `Пол ${i}`, { inTab: 'ДОП' })); count('ec01004'); }
  for (let i = 0; i < manualQty('ec01004'); i++) { bus(U0).temps.push(dev('ec01004', 'добавлено вручную', { inTab: 'ДОП' })); count('ec01004'); }
  // термостаты RS485 (+ датчик пола NTC)
  const ntc = Math.min(qty('ec01114'), state.wiredThermostats);
  for (let i = 1; i <= qty('ec01091'); i++) {
    const t = dev('ec01091', num(i, qty('ec01091')), { inTab: 'ДОП' });
    if (i <= ntc) { t.kind = 'expander'; link(t, dev('ec01114', 'в стяжке'), 'temp', 'NTC', ['OUT'], ['NTC'], '2 жилы, кабель датчика'); }
    bus(zoneUnits[(i - 1) % zoneUnits.length]).thermostats.push(t);
  }

  // ---------------------------------------------------------------- контакты (Д)
  type CSlot = { parent: WNode; key: string; name: string; tab: string };
  const dFree = new Map<WNode, CSlot[]>(U.map(u => [u, [1, 2, 3, 4, 5].map(d => ({ parent: u, key: `D${d}`, name: `Д${d}`, tab: `Д${d}` }))]));
  const c055: WNode[] = [];
  const new055 = () => {
    const e = dev('ec01055', undefined, { kind: 'expander', inTab: 'ДОП', outs: Array.from({ length: 8 }, (_, k) => String(k + 1)) });
    c055.push(e);
    dFree.set(e, Array.from({ length: 8 }, (_, k) => ({ parent: e, key: String(k + 1), name: `Вход ${k + 1}`, tab: String(k + 1) })));
    return e;
  };
  for (let i = 0; i < manualQty('ec01055'); i++) new055();
  const placeContact = (n: WNode, ports: number, order: WNode[]) => {
    const tryIn = (g: WNode) => {
      const free = dFree.get(g)!;
      if (free.length < ports) return false;
      const run = free.splice(0, ports);
      link(run[0].parent, n, 'contact', run.map(r => r.name).join(' + '), run.map(r => r.key), run.map(r => r.tab), CABLE.contact);
      return true;
    };
    for (const g of [...order, ...c055]) if (tryIn(g)) return;
    if (c055.length < MAX_EC01055 && tryIn(new055())) return;
    miss(n.productId || 'ec01055', 1, 'нет свободного контактного входа');
  };
  for (let i = 1; i <= state.ownThermostats; i++) placeContact(node('device', 'Термостат', { subtitle: 'сухой контакт' }), 1, zoneFirst);
  const safety: { id: string; n: number; label?: (i: number) => string; ports?: number }[] = [
    { id: 'ec01008', n: state.gasSensors },
    { id: 'ec01010', n: state.pressureSensors, label: i => state.pressureSensors > 1 ? `№${i}, мин./макс.` : 'мин./макс.', ports: 2 },
    { id: 'ec01015', n: state.wiredSmokeSensors },
    { id: 'ec01006', n: state.wiredLeakSensors },
    { id: 'ec01013', n: state.wiredMotionSensors },
  ];
  safety.forEach(s => { for (let i = 1; i <= s.n; i++) placeContact(dev(s.id, s.label ? s.label(i) : num(i, s.n)), s.ports || 1, U); });
  manualByType('CONTACT').forEach(id => placeContact(dev(id, 'добавлено вручную'), product(id)?.consumesPort?.amount || 1, U));
  c055.forEach((e, i) => { e.subtitle = num(i + 1, c055.length); if (!e.children.length) e.reserve = true; });
  count('ec01055', c055.length);
  bus(U0).contacts.push(...c055);

  // ---------------------------------------------------------------- сирены (1-2-3)
  const sSlots = U.flatMap(u => [{ parent: u, key: 'S1', name: 'Клеммы 3 и 2', tab: '3,2' }, { parent: u, key: 'S2', name: 'Клеммы 1 и 2', tab: '1,2' }]);
  const sirens = [...Array(state.wiredSirens).fill('ec01016'), ...Array(state.combinedSirens).fill('ec01016-1'), ...manualByType('123')] as string[];
  sirens.forEach((id, i) => {
    const s = sSlots.shift();
    if (!s) { miss(id, 1, 'нет свободного выхода 1-2-3'); return; }
    link(s.parent, dev(id, num(i + 1, sirens.length)), 'low12', s.name, [s.key], [s.tab], CABLE.siren);
  });

  // ---------------------------------------------------------------- радио 868 МГц (на каждый блок до 32)
  const radioLeft = new Map<WNode, number>(U.map(u => [u, RADIO_PER_UNIT]));
  const radioGroups = new Map<WNode, Map<string, number>>(U.map(u => [u, new Map()]));
  const placeRadio = (id: string, n: number, order: WNode[]) => {
    let rest = n;
    for (const u of order) {
      const k = Math.min(rest, radioLeft.get(u)!);
      if (k > 0) { radioLeft.set(u, radioLeft.get(u)! - k); const g = radioGroups.get(u)!; g.set(id, (g.get(id) || 0) + k); rest -= k; }
      if (!rest) break;
    }
    if (rest > 0) miss(id, rest, `превышен лимит ${RADIO_PER_UNIT} радиоустройства на блок`);
  };
  placeRadio('ec01005', state.wirelessRadioSensors, zoneFirst);
  [['ec01068', state.coSensors], ['ec01017', state.wirelessSmokeSensors], ['ec01007', state.wirelessLeakSensors], ['ec01014', state.wirelessMotionSensors], ['ec01019', state.wirelessKeyfobs]]
    .forEach(([id, n]) => placeRadio(id as string, n as number, U));
  manualByType('RADIO').forEach(id => placeRadio(id, 1, U));
  radioGroups.forEach((g, u) => g.forEach((n, id) => link(u, dev(id, n > 1 ? `× ${n}` : undefined, { kind: 'group', qty: n }), 'radio', '868 МГц', ['RADIO'], ['868'], '')));

  // ---------------------------------------------------------------- LoRa (на каждый блок до 32, свой адаптер ec01096)
  const loraLeft = new Map<WNode, number>(U.map(u => [u, LORA_PER_UNIT]));
  const loraGroups = new Map<WNode, Map<string, number>>(U.map(u => [u, new Map()]));
  const placeLora = (id: string, n: number, order: WNode[]) => {
    let rest = n;
    for (const u of order) {
      const k = Math.min(rest, loraLeft.get(u)!);
      if (k > 0) { loraLeft.set(u, loraLeft.get(u)! - k); const g = loraGroups.get(u)!; g.set(id, (g.get(id) || 0) + k); rest -= k; }
      if (!rest) break;
    }
    if (rest > 0) miss(id, rest, `превышен лимит ${LORA_PER_UNIT} LoRa-устройства на блок`);
  };
  placeLora('ec01041', state.wirelessSensors, zoneFirst);
  placeLora('ec01080', state.wirelessThermostats, zoneFirst);
  placeLora('ec01056', state.wirelessLeakSensorsLora, U);
  manualByType('LORA').filter(id => id !== 'ec01079').forEach(id => placeLora(id, 1, U));
  let manual096 = manualQty('ec01096');
  let n096 = 0;
  const adapters: WNode[] = [];
  U.forEach(u => {
    const g = loraGroups.get(u)!;
    if (!g.size) return;
    const a = dev('ec01096', undefined, { kind: 'expander', inTab: 'ДОП' });
    if (u === U0 && manual096 > 0) manual096--;
    n096++;
    g.forEach((n, id) => link(a, dev(id, n > 1 ? `× ${n}` : undefined, { kind: 'group', qty: n }), 'lora', 'LoRa', ['LORA'], ['LoRa'], ''));
    bus(u).lora.push(a); adapters.push(a);
  });
  for (let i = 0; i < manual096; i++) { const a = dev('ec01096', undefined, { kind: 'expander', inTab: 'ДОП', reserve: true }); bus(U0).lora.push(a); adapters.push(a); }
  count('ec01096', adapters.length);
  adapters.forEach((a, i) => { a.subtitle = num(i + 1, adapters.length); });

  // ---------------------------------------------------------------- ручные устройства RS485
  manualByType('DOP')
    .filter(id => !['ec01091', 'ec01107', ...Object.values(BOILER_ADAPTER)].includes(id))
    .forEach(id => bus(U0).manual.push(dev(id, 'добавлено вручную', { inTab: 'ДОП' })));

  // ---------------------------------------------------------------- шина ДОП каждого блока: разветвители и питание
  const manualSplit = [...Array(manualQty('ec01033')).fill('ec01033'), ...Array(manualQty('ec01107')).fill('ec01107')] as string[];
  let splitNo = 0;
  const allSplitters: WNode[] = [];
  U.forEach((u, ui) => {
    const b = bus(u);
    const rs = [...b.adapters, ...b.relays, ...b.contacts, ...b.mixers, ...b.lora, ...b.thermostats, ...b.temps, ...b.manual];
    const ids = ui === 0 ? manualSplit : [];
    const needed = rs.length > 1 ? Math.ceil((rs.length - 1) / (SPLITTER_OUTS - 1)) : 0;
    const total = Math.max(needed, ids.length);
    const splitters = Array.from({ length: total }, (_, i) => dev(ids[i] || 'ec01033', undefined, { kind: 'expander', inTab: 'ДОП', outs: Array.from({ length: SPLITTER_OUTS }, (_, k) => String(k + 1)) }));
    count('ec01033', splitters.filter(s => s.productId === 'ec01033').length);
    allSplitters.push(...splitters);
    if (!splitters.length) { if (rs[0]) link(u, rs[0], 'rs485', 'ДОП', ['DOP'], ['ДОП'], CABLE.rs485); }
    else {
      link(u, splitters[0], 'rs485', 'ДОП', ['DOP'], ['ДОП'], CABLE.rs485);
      let si = 0; let out = 1;
      const q = [...rs];
      while (q.length && si < splitters.length) {
        const sp = splitters[si];
        if (out === SPLITTER_OUTS && si + 1 < splitters.length) {
          link(sp, splitters[si + 1], 'rs485', `Выход ${out}`, [String(out)], [String(out)], CABLE.rs485);
          si++; out = 1; continue;
        }
        link(sp, q.shift()!, 'rs485', `Выход ${out}`, [String(out)], [String(out)], CABLE.rs485);
        out++;
        if (out > SPLITTER_OUTS) { si++; out = 1; }
      }
      q.forEach(d => miss(d.productId || 'ec01033', 1, 'не хватает выходов разветвителей RS485'));
      splitters.forEach(s => { if (!s.children.length) s.reserve = true; });
      if (splitters.length > MAX_SPLITTERS_PER_LINE) notes.push(`${N > 1 ? `Блок ${ui + 1}: ` : ''}больше ${MAX_SPLITTERS_PER_LINE} разветвителей RS485 на одной линии ДОП.`);
    }
    attachPsu(splitters, ui === 0 ? c055 : [], count);
  });
  allSplitters.forEach(s => { s.subtitle = num(++splitNo, allSplitters.length); });

  // Порядок детей у блока = порядок клемм слева направо (это исключает пересечения линий).
  units.forEach(u => u.root.children.sort((a, b) => V40_PORT_ORDER.indexOf(a.portKeys[0]) - V40_PORT_ORDER.indexOf(b.portKeys[0])));
  return { units, unconnected, notes, counts };
};

export const buildWiring = (state: AppState, items: CartItem[]): PlannedWiring =>
  (state.baseUnitId || 'ec01v40') === 'ec01105' ? { ...buildStart(state, items), counts: {} } : buildV40(state, items);

// Start: адаптеров питания столько, сколько положила корзина; ставим их по тому же правилу.
const attachPsuFromCart = (splitters: WNode[], contactExps: WNode[], n: number) => {
  if (n <= 0) return;
  let left = n;
  attachPsu(splitters, contactExps, () => { left--; });
  if (left < 0) { /* корзина положила меньше — схема всё равно показывает, где нужно питание */ }
};
