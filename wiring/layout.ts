// Раскладка листов схемы: где стоит каждое устройство и как идут линии.
// Принципы (см. план):
//  - устройства стоят слева направо в том же порядке, что и клеммы, поэтому линии не пересекаются;
//  - раскладка «деревом»: родитель стоит над своей группой, группы не перекрываются;
//  - линия: вниз от клеммы → горизонтальная полка → вниз к устройству; чем дальше устройство
//    от клеммы, тем выше полка (вложенный веер); углы скруглены радиусом CORNER;
//  - если не помещается, самая глубокая большая группа уходит на лист-продолжение.
import { LineKind, UnitTree, WLink, WiringModel, WNode } from './model';
import { PANEL_START, PANEL_V40 } from './panelImages';

export const PAGE_W = 841.89;
export const PAGE_H = 595.28;
const MARGIN = 24;
const CONTENT_BOTTOM = 546;
const MAX_SLOTS = 14;
const MAX_SLOT_W = 128;
const BOX_H = 42;
const TAB_H = 7;
const LEVEL_STEP = 5;   // шаг между полками, пт
const FIRST_GAP = 12;   // от клеммы до первой полки
const DROP = 64;        // минимальная длина последнего вертикального отрезка (под подписи)
export const CORNER = 4;

export interface PanelSpec { src: string; srcW: number; srcH: number; ports: Record<string, [number, number]>; antenna: [number, number] }

export const PANELS: Record<'ec01v40' | 'ec01105', PanelSpec> = {
  ec01v40: {
    src: PANEL_V40, srcW: 1600, srcH: 441,
    ports: {
      DOP: [228, 357], D1: [326, 357], D2: [425, 357], D3: [522, 357], D4: [620, 357], D5: [718, 357],
      T1: [816, 357], T2: [913, 357], T3: [1011, 357],
      R1: [1094, 357], R2: [1154, 357], R3: [1235, 357], S2: [1284, 357], S1: [1304, 357],
    },
    antenna: [1238, 10],
  },
  ec01105: {
    src: PANEL_START, srcW: 1600, srcH: 544,
    ports: { CSH: [397, 525], PU: [449, 525], R1: [513, 525], T1: [664, 525], T2: [792, 525], D1: [920, 525], DOP: [1047, 525] },
    antenna: [1185, 10],
  },
};

export interface LBox {
  node: WNode;
  x: number; y: number; w: number; h: number;
  outTabs: { label: string; x: number; used?: boolean }[];
  inTab?: string;
  refSheet?: number;      // группа продолжается на листе N
  isSheetRoot?: boolean;
  fromNote?: string;      // «от листа 1, ДОП»
}

export interface LLine {
  kind: LineKind;
  d: string;              // svg path
  start: [number, number];
  end: [number, number];
  portName: string;
  cable: string;
  labelX: number; labelY: number; // центр последнего вертикального отрезка
  labelLen: number;
  wavesStart: boolean;
}

export interface LSheet {
  number: number;
  title: string;
  image?: { src: string; x: number; y: number; w: number; h: number };
  /** Радиоканал блока: волны у антенны и пунктир от антенны вниз за правый край рендера. */
  wirelessPort?: { ax: number; ay: number; x: number; y: number; kind: LineKind; label: string };
  portDots: { x: number; y: number; kind: LineKind }[];
  boxes: LBox[];
  lines: LLine[];
  kinds: Set<LineKind>;
}

export interface TableRow { sheet: number; from: string; port: string; to: string; article: string; cable: string; kind: LineKind }

export interface LayoutResult { sheets: LSheet[]; rows: TableRow[] }

// ---------------------------------------------------------------------------

interface Pending { unit?: UnitTree; roots?: WNode[] }

const nodeLabel = (n: WNode) => [n.productId && n.kind !== 'unit' ? n.productId : '', n.title, n.subtitle].filter(Boolean).join(' ');

const isWireless = (k: LineKind) => k === 'radio' || k === 'lora';

export const layoutWiring = (model: WiringModel): LayoutResult => {
  const sheets: LSheet[] = [];
  const rows: TableRow[] = [];
  const queue: Pending[] = model.units.map(u => ({ unit: u }));
  const sheetOf = new Map<WNode, number>(); // для перекрёстных ссылок

  while (queue.length) {
    const pend = queue.shift()!;
    const number = sheets.length + 1;
    // Лист-продолжение может содержать несколько групп: их корни стоят рядом вверху листа.
    const pinned = new Set<WNode>(pend.roots || []);
    const job = {
      unit: pend.unit,
      root: pend.unit ? pend.unit.root : ({ id: 'virt', kind: 'group', title: '', children: (pend.roots || []).map(r => ({ to: r, portKeys: [], tabs: [], portName: '', kind: 'rs485', cable: '', label: '' })) } as WNode),
    };
    pinned.forEach(r => sheetOf.set(r, number));
    const collapsedHere: WNode[] = [];
    const sheet: LSheet = {
      number, title: '', portDots: [], boxes: [], lines: [], kinds: new Set(),
    };
    sheets.push(sheet);

    // ---- корень
    let srcY = 0;
    let antennaAt: [number, number] = [0, 0];
    let fanBase = 0; // ниже этой линии начинаются горизонтальные полки (под рендером блока)
    const rootPorts: Record<string, [number, number]> = {};
    if (job.unit) {
      const spec = PANELS[job.unit.model];
      const w = job.unit.model === 'ec01v40' ? 600 : 500;
      const h = w * spec.srcH / spec.srcW;
      const x = (PAGE_W - w) / 2; const y = 64;
      sheet.image = { src: spec.src, x, y, w, h };
      Object.entries(spec.ports).forEach(([k, [px, py]]) => { rootPorts[k] = [x + px * w / spec.srcW, y + py * h / spec.srcH]; });
      srcY = Math.max(...Object.values(rootPorts).map(p => p[1]));
      fanBase = y + h - 4;
      // радиоканал: от правой антенны вправо за рендер и вниз
      const wk = job.unit.model === 'ec01v40' ? 'RADIO' : 'LORA';
      rootPorts[wk] = [x + w + 16, fanBase];
      antennaAt = [x + spec.antenna[0] * w / spec.srcW, y + spec.antenna[1] * h / spec.srcH];
      sheet.title = `${job.unit.root.title}${job.unit.root.subtitle ? ', ' + job.unit.root.subtitle : ''}`;
    } else {
      srcY = 60; fanBase = 60;
      const roots = [...pinned];
      sheet.title = roots.length === 1
        ? 'продолжение: ' + [roots[0].productId, roots[0].title, roots[0].subtitle].filter(Boolean).join(' ')
        : 'продолжение: ' + roots.map(r => r.productId).filter(Boolean).join(', ');
      if (sheet.title.length > 60) sheet.title = sheet.title.slice(0, 58) + '…';
    }

    // ---- что раскрываем на этом листе
    const expanded = new Set<WNode>([job.root]);
    const depthOf = new Map<WNode, number>([[job.root, 0]]);
    const walk = (n: WNode, d: number) => {
      n.children.forEach(l => { depthOf.set(l.to, d + 1); if (l.to.children.length) expanded.add(l.to); walk(l.to, d + 1); });
    };
    walk(job.root, 0);
    const shown = (n: WNode): boolean => expanded.has(n) && n.children.length > 0;
    const leaves = (n: WNode): number => shown(n) ? n.children.reduce((s, l) => s + leaves(l.to), 0) : 1;
    const visibleDepth = (n: WNode, d = 0): number => shown(n) ? Math.max(...n.children.map(l => visibleDepth(l.to, d + 1))) : d;
    const collapse = (maxDepth: number) => {
      // глубже maxDepth не раскрываем
      expanded.forEach(n => { if (n !== job.root && !pinned.has(n) && (depthOf.get(n) || 0) >= maxDepth) expanded.delete(n); });
    };
    while (leaves(job.root) > MAX_SLOTS) {
      const cands = [...expanded].filter(n => n !== job.root && !pinned.has(n) && shown(n));
      if (!cands.length) break;
      cands.sort((a, b) => (depthOf.get(b)! - depthOf.get(a)!) || (leaves(b) - leaves(a)));
      const pick = cands.find(c => leaves(c) > 1) || cands[0];
      expanded.delete(pick);
    }

    // ---- горизонталь: дерево, листья по слотам, родитель над серединой своей группы
    let sw = 0; let boxW = 0;
    const cxOf = new Map<WNode, number>();
    const computeX = () => {
      cxOf.clear();
      const slots = leaves(job.root);
      sw = Math.min(MAX_SLOT_W, (PAGE_W - 2 * MARGIN) / Math.max(1, slots));
      boxW = Math.min(sw - 8, 118);
      const left = (PAGE_W - sw * slots) / 2;
      let slot = 0;
      const px = (n: WNode): number => {
        let cx: number;
        if (shown(n)) { const cs = n.children.map(l => px(l.to)); cx = (cs[0] + cs[cs.length - 1]) / 2; }
        else { cx = left + sw * (slot + 0.5); slot++; }
        cxOf.set(n, cx);
        return cx;
      };
      job.root.children.forEach(l => px(l.to));
    };
    // источники линий родителя (x), чтобы точно посчитать число полок
    const srcXs = (n: WNode): number[] => {
      if (n === job.root) return n.children.flatMap(l => l.portKeys.map(k => (rootPorts[k] || [PAGE_W / 2])[0]));
      const bx = cxOf.get(n)! - boxW / 2;
      const bw = boxW;
      const labels = tabLabels(n, bw);
      return n.children.flatMap(l => l.portKeys.map((_, k) => bx + bw * (labels.indexOf(l.tabs[k] ?? l.tabs[0]) + 0.5) / labels.length));
    };
    const tgtXs = (n: WNode): number[] => n.children.flatMap(l => l.portKeys.map((_, k) => {
      const c = cxOf.get(l.to)!; const m = l.portKeys.length;
      return m === 1 ? c : c - boxW / 2 + boxW * (k + 1) / (m + 1);
    }));
    const fanLevels = (n: WNode) => {
      const s = srcXs(n); const t = tgtXs(n);
      let L = 0; let R = 0;
      s.forEach((x, i) => { if (t[i] < x - 0.5) L++; else if (t[i] > x + 0.5) R++; });
      return Math.max(1, L, R);
    };
    const levelYs = (): number[] => {
      const ys: number[] = [];
      let prevBottom = fanBase;
      const D = visibleDepth(job.root);
      for (let d = 1; d <= D; d++) {
        const parents = [...expanded].filter(n => (depthOf.get(n) || 0) === d - 1 && shown(n));
        if (!job.unit && d === 1) { ys.push(80); prevBottom = 80 + BOX_H; continue; }
        const lv = Math.max(1, ...parents.map(fanLevels));
        const y = prevBottom + (d === 1 ? 0 : TAB_H) + FIRST_GAP + LEVEL_STEP * (lv - 1) + DROP + TAB_H;
        ys.push(y);
        prevBottom = y + BOX_H;
      }
      return ys;
    };
    let ys: number[] = [];
    for (let D = 3; D >= 1; D--) {
      collapse(D);
      computeX();
      ys = levelYs();
      if (!ys.length || ys[ys.length - 1] + BOX_H <= CONTENT_BOTTOM) break;
    }

    // ---- коробки
    const boxes = new Map<WNode, LBox>();
    const place = (n: WNode, d: number) => {
      const cx = cxOf.get(n)!;
      const b: LBox = { node: n, x: cx - boxW / 2, y: ys[d - 1], w: boxW, h: BOX_H, outTabs: [], inTab: n.inTab, isSheetRoot: pinned.has(n) };
      boxes.set(n, b);
      sheet.boxes.push(b);
      if (shown(n)) n.children.forEach(l => place(l.to, d + 1));
      else if (n.children.length) collapsedHere.push(n);
    };
    job.root.children.forEach(l => place(l.to, 1));

    // ---- линии
    const parentName = job.unit ? `${job.unit.root.title}${model.units.length > 1 ? ` (блок ${job.unit.index})` : ''}` : '';
    const drawFan = (parent: WNode, srcOf: (l: WLink, k: number) => [number, number], pName: string, base = 0) => {
      type Seg = { l: WLink; s: [number, number]; t: [number, number] };
      const segs: Seg[] = [];
      parent.children.forEach(l => {
        const b = boxes.get(l.to)!;
        l.portKeys.forEach((_, k) => {
          const n = l.portKeys.length;
          const tx = n === 1 ? b.x + b.w / 2 : b.x + b.w * (k + 1) / (n + 1);
          segs.push({ l, s: srcOf(l, k), t: [tx, b.y - (b.inTab && n === 1 ? TAB_H : 0)] });
        });
      });
      // уровни полок: левые — по возрастанию, правые — по убыванию индекса
      const level = new Array(segs.length).fill(0);
      let li = 0;
      segs.forEach((g, i) => { if (g.t[0] < g.s[0] - 0.5) level[i] = li++; });
      let ri = 0;
      for (let i = segs.length - 1; i >= 0; i--) if (segs[i].t[0] > segs[i].s[0] + 0.5) level[i] = ri++;
      segs.forEach((g, i) => {
        const [sx, sy] = g.s; const [tx, ty] = g.t;
        const py = Math.max(sy, base) + FIRST_GAP + LEVEL_STEP * level[i];
        const dx = tx - sx;
        let d: string; let labelTop: number;
        if (Math.abs(dx) < 0.5) {
          d = `M ${sx} ${sy} L ${tx} ${ty}`; labelTop = Math.max(sy + 6, ty - DROP);
        } else {
          const r = Math.min(CORNER, Math.abs(dx) / 2, (py - sy) / 1.5);
          const sg = Math.sign(dx);
          d = `M ${sx} ${sy} L ${sx} ${py - r} Q ${sx} ${py} ${sx + sg * r} ${py} L ${tx - sg * r} ${py} Q ${tx} ${py} ${tx} ${py + r} L ${tx} ${ty}`;
          labelTop = py;
        }
        sheet.lines.push({
          kind: g.l.kind, d, start: [sx, sy], end: [tx, ty], portName: g.l.portName, cable: g.l.cable,
          labelX: tx, labelY: (labelTop + ty) / 2, labelLen: ty - labelTop, wavesStart: isWireless(g.l.kind),
        });
        sheet.kinds.add(g.l.kind);
      });
      parent.children.forEach(l => rows.push({
        sheet: number, from: pName, port: l.portName, to: [l.to.title, l.to.subtitle].filter(Boolean).join(', '),
        article: l.to.productId || '', cable: l.cable || (l.kind === 'radio' ? 'радио 868 МГц' : l.kind === 'lora' ? 'радио LoRa' : ''), kind: l.kind,
      }));
    };

    // от корня
    if (job.unit) {
      const wirelessKey = job.unit.model === 'ec01v40' ? 'RADIO' : 'LORA';
      drawFan(job.root, (l, k) => rootPorts[l.portKeys[k]] || [PAGE_W / 2, srcY], parentName, fanBase);
      job.root.children.forEach(l => {
        if (isWireless(l.kind)) return;
        l.portKeys.forEach(k => { const p = rootPorts[k]; if (p) sheet.portDots.push({ x: p[0], y: p[1], kind: l.kind }); });
      });
      if (job.root.children.some(l => isWireless(l.kind))) {
        const p = rootPorts[wirelessKey];
        sheet.wirelessPort = { ax: antennaAt[0], ay: antennaAt[1], x: p[0], y: p[1], kind: job.unit.model === 'ec01v40' ? 'radio' : 'lora', label: job.unit.model === 'ec01v40' ? 'Радио 868 МГц' : 'LoRa' };
      }
    }
    // от раскрытых коробок
    boxes.forEach((b, n) => {
      if (!shown(n)) return;
      setTabs(n, b);
      drawFan(n, (l, k) => tabPoint(b, l.tabs[k] ?? l.tabs[0]), nodeLabel(n));
    });

    // свернутые группы → листы-продолжения; маленькие группы собираются на один лист
    const fullLeaves = (n: WNode, d = 0): number => (d < 2 && n.children.length) ? n.children.reduce((s2, l) => s2 + fullLeaves(l.to, d + 1), 0) : 1;
    let chunk: WNode[] = []; let used = 0;
    collapsedHere.forEach(n => {
      const c = Math.min(MAX_SLOTS, fullLeaves(n));
      if (chunk.length && used + c > MAX_SLOTS) { queue.push({ roots: chunk }); chunk = []; used = 0; }
      chunk.push(n); used += c;
    });
    if (chunk.length) queue.push({ roots: chunk });
  }

  // ---- перекрёстные ссылки между листами
  sheets.forEach(sh => sh.boxes.forEach(b => {
    if (b.isSheetRoot) return;
    const target = sheetOf.get(b.node);
    if (target && target !== sh.number && b.node.children.length) b.refSheet = target;
  }));
  sheets.forEach(sh => sh.boxes.forEach(b => {
    if (!b.isSheetRoot) return;
    const from = sheets.find(s => s.boxes.some(x => !x.isSheetRoot && x.node === b.node));
    if (from) {
      const row = rows.find(r => r.sheet === from.number && r.article === b.node.productId && r.to === [b.node.title, b.node.subtitle].filter(Boolean).join(', '));
      b.fromNote = `от листа ${from.number}${row ? `, ${row.port}` : ''}`;
    }
  }));

  return { sheets, rows };
};

// Выходные «язычки» коробки: по одному на каждый уникальный порт детей, равномерно по нижней грани.
export const tabLabels = (n: WNode, w: number): string[] => {
  if (n.outs && w / n.outs.length >= 9) return n.outs;
  const labels: string[] = [];
  n.children.forEach(l => l.tabs.forEach(t => { if (!labels.includes(t)) labels.push(t); }));
  return labels;
};
const setTabs = (n: WNode, b: LBox) => {
  const labels = tabLabels(n, b.w);
  const used = new Set(n.children.flatMap(l => l.tabs));
  b.outTabs = labels.map((label, i) => ({ label, x: b.x + b.w * (i + 0.5) / labels.length, used: used.has(label) }));
};
const tabPoint = (b: LBox, label: string): [number, number] => {
  const t = b.outTabs.find(x => x.label === label) || b.outTabs[0];
  return [t ? t.x : b.x + b.w / 2, b.y + b.h + TAB_H];
};
