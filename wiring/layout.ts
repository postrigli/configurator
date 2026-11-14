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
const CONTENT_BOTTOM = 550;
const CONTENT_W = PAGE_W - 2 * MARGIN;
const BOX_W = 72;       // ширина коробки устройства
const GAP_X = 7;        // минимальный зазор между коробками
const ROW_CAP = Math.floor((CONTENT_W + GAP_X) / (BOX_W + GAP_X)); // коробок в этаже
const BOX_H = 38;
const MAX_ROWS = 3;
const CONT_ROOT_Y = 140;  // корни листа-продолжения: линия входит сверху, от линии шапки
const EDGE_TOP = 62;
const EDGE_BOTTOM = 546;      // рядов в одном этаже (конечные устройства)
const BYPASS_PAD = 10;  // отступ вертикалей обхода от коробок
const TAB_H = 7;
const LEVEL_STEP = 5;   // шаг между полками, пт
const FIRST_GAP = 10;   // от клеммы до первой полки
const WAVE_FIRST_GAP = 26; // то же под волнами радио у адаптера
const WAVE_GAP_START = 17; // волны у адаптера занимают ~12 пт вниз
const WAVE_GAP_END = 15;   // волны у датчика занимают ~10 пт вверх
const DROP = 50;        // минимальная длина последнего вертикального отрезка (под подписи)
// плотный вариант листа: включается, только если иначе часть устройств ушла бы на продолжение
const DROP_TIGHT = 47;
const FIRST_GAP_TIGHT = 7;
const CONT_ROOT_Y_TIGHT = 124;
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
  outTabs: { label: string; x: number; w: number; used?: boolean }[];
  inTab?: string;
  refSheet?: number;      // группа продолжается на листе N
  isSheetRoot?: boolean;
  fromNote?: string;      // «от листа 1, ДОП»
  /** Группа на другом листе: коробки нет, линия кончается стрелкой (у края листа, если путь вниз свободен). */
  offPage?: { kind: LineKind; startY: number; edgeY?: number; side?: 'L' | 'R'; sideX?: number; port?: string; below?: boolean; labelLeft?: boolean };
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
  /** Линия входит с края листа-продолжения; подпись «от листа N» заполняется в конце. */
  incoming?: WNode;
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
  const linkTo = new Map<WNode, WLink>();     // входящая линия каждого узла
  const indexLinks = (n: WNode) => n.children.forEach(l => { linkTo.set(l.to, l); indexLinks(l.to); });
  model.units.forEach(u => indexLinks(u.root));

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
      const w = job.unit.model === 'ec01v40' ? 260 : 230;
      const h = w * spec.srcH / spec.srcW;
      const x = (PAGE_W - w) / 2; const y = 60;
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
    const descendants = (n: WNode): number => n.children.reduce((s2, l) => s2 + 1 + descendants(l.to), 0);
    // Этажи: этаж 0 — всё, что подключено к блоку (или корни листа-продолжения), этаж 1 — к ним и т.д.
    // Внутри этажа порядок «в глубину», поэтому линии соседних этажей идут в том же порядке, что и выходы.
    const floors = (): WNode[][] => {
      const F: WNode[][] = [];
      const rec = (n: WNode, d: number) => {
        if (!shown(n)) return;
        n.children.forEach(l => { (F[d] = F[d] || []).push(l.to); rec(l.to, d + 1); });
      };
      rec(job.root, 0);
      return F;
    };
    const canCollapse = (n: WNode) => n !== job.root && !pinned.has(n) && shown(n);
    // Родитель каждого узла этажа и точки, откуда к нему идут линии.
    const parentMap = (F: WNode[][], fi: number) => {
      const m = new Map<WNode, { p: WNode; l: WLink }>();
      (fi === 0 ? [job.root] : F[fi - 1]).forEach(p => { if (shown(p)) p.children.forEach(l => m.set(l.to, { p, l })); });
      return m;
    };
    // Как разложить этаж: одним рядом или (если все устройства этажа — конечные) несколькими рядами;
    // линии к нижним рядам обходят верхние ряды справа. null — не помещается.
    let rowLimit = MAX_ROWS;
    const rowsFor = (floor: WNode[], pm: Map<WNode, { p: WNode; l: WLink }>): { rows: WNode[][]; nB: number } | null => {
      if (floor.length <= ROW_CAP) return { rows: [floor], nB: 0 };
      // устройства со своими подключениями (термостат с датчиком пола и т.п.) — только в нижнем ряду,
      // чтобы их линии вниз не пересекали другие ряды
      const firstShown = floor.findIndex(shown);
      for (let R = 2; R <= rowLimit; R++) {
        const per = Math.ceil(floor.length / R);
        let lastStart = per * (R - 1);
        if (lastStart >= floor.length) lastStart = floor.length - 1;
        if (firstShown >= 0 && firstShown < lastStart) lastStart = firstShown;
        const upper = floor.slice(0, lastStart);
        const uPer = R > 1 ? Math.ceil(upper.length / (R - 1)) : 0;
        if (!uPer) continue;
        const rws: WNode[][] = [];
        for (let i = 0; i < upper.length; i += uPer) rws.push(upper.slice(i, i + uPer));
        rws.push(floor.slice(lastStart));
        const maxPer = Math.max(...rws.map(r => r.length));
        const nB = rws.slice(1).flat().reduce((a, x) => a + (pm.has(x) ? Math.max(1, pm.get(x)!.l.portKeys.length) : 0), 0);
        const cap = Math.floor((CONTENT_W - BYPASS_PAD - LEVEL_STEP * nB + GAP_X) / (BOX_W + GAP_X));
        if (maxPer <= cap) return { rows: rws, nB };
      }
      return null;
    };
    // 1) этаж не помещается по ширине → самая большая группа уровнем выше уходит на лист-продолжение
    for (;;) {
      const F = floors();
      const f = F.findIndex((row, fi) => !rowsFor(row, parentMap(F, fi)));
      if (f < 0) break;
      let cands = f >= 1 ? F[f - 1].filter(canCollapse) : [];
      if (!cands.length) cands = F[f].filter(canCollapse);
      if (!cands.length) break;
      cands.sort((a, b) => (b.children.length - a.children.length) || (descendants(b) - descendants(a)));
      expanded.delete(cands[0]);
    }

    // ---- геометрия этажей: x по источникам линий, y по числу полок в промежутках
    interface Seg { l: WLink; s: [number, number]; t: [number, number]; level: number; level2: number; gBase: number; subBase: number; track?: number; fg: number; wStart: boolean; side?: 'L' | 'R' }
    let boxes = new Map<WNode, LBox>();
    let segsAll: Seg[] = [];
    let bottom = 0;
    let tight = false;
    // группы на другом листе, линия к которым уходит к боковому краю: коробки в ряду не занимают
    const sideOff = new Map<WNode, 'L' | 'R'>();
    const deep = new Set<WNode>();
    const build = () => {
      const drop = tight ? DROP_TIGHT : DROP; const gap0 = tight ? FIRST_GAP_TIGHT : FIRST_GAP;
      boxes = new Map(); segsAll = []; bottom = 0;
      const F = floors();
      let prevBottom = fanBase;
      F.forEach((floor, fi) => {
        const pm = parentMap(F, fi);
        const srcPts = (n: WNode): [number, number][] => {
          const pl = pm.get(n);
          if (!pl) return [];
          const { p, l } = pl;
          if (p === job.root) return job.unit ? l.portKeys.map(k => rootPorts[k] || [PAGE_W / 2, srcY]) : [];
          const pb = boxes.get(p)!;
          return l.portKeys.map((_, k) => tabPoint(pb, l.tabs[k] ?? l.tabs[0]));
        };
        const placed = floor.filter(n => !sideOff.has(n));
        const lay = rowsFor(placed, pm);
        const rowsOf = lay ? lay.rows : [placed];
        const nB = lay ? lay.nB : 0;
        // если не помещается даже так — коробки сужаются
        const w = lay ? BOX_W : Math.max(30, (CONTENT_W + GAP_X) / Math.max(1, placed.length) - GAP_X);
        const S = w + GAP_X;
        let rightLimit = nB ? PAGE_W - MARGIN - BYPASS_PAD - LEVEL_STEP * nB : PAGE_W - MARGIN;
        // путь к боковому краю и подпись у него: коробки этажа не заходят в эту полосу (если ряд всё равно помещается)
        let leftLimit = MARGIN;
        floor.filter(n => sideOff.has(n)).forEach(n => {
          const ps = srcPts(n); if (!ps.length) return;
          const lw = sideLabelW(n, linkTo.get(n)?.portName);
          if (sideOff.get(n) === 'L') leftLimit = Math.max(leftLimit, Math.max(ps[0][0], MARGIN + lw) + 6);
          else rightLimit = Math.min(rightLimit, Math.min(ps[0][0], PAGE_W - MARGIN - lw) - 6);
        });
        const widest = Math.max(0, ...rowsOf.map(r => r.length));
        if (rightLimit - leftLimit < widest * S - GAP_X) { leftLimit = MARGIN; rightLimit = nB ? PAGE_W - MARGIN - BYPASS_PAD - LEVEL_STEP * nB : PAGE_W - MARGIN; }
        const cxOf = new Map<WNode, number>();
        rowsOf.forEach(row => {
          const desired = row.map(n => { const ps = srcPts(n); return ps.length ? ps.reduce((a, q) => a + q[0], 0) / ps.length : PAGE_W / 2; });
          placeRow(desired, w, S, rightLimit, leftLimit).forEach((c, i) => cxOf.set(row[i], c));
        });
        const maxRight = Math.max(MARGIN, ...placed.map(n => cxOf.get(n)! + w / 2));
        const trackStart = maxRight + BYPASS_PAD / 2 + 2;
        const segs: (Seg & { row: number })[] = [];
        let bi = 0;
        rowsOf.forEach((row, r) => row.forEach(n => {
          const ps = srcPts(n); const pl = pm.get(n);
          ps.forEach((s0, k) => {
            const m = ps.length; const c = cxOf.get(n)!;
            const tx = m === 1 ? c : c - w / 2 + w * (k + 1) / (m + 1);
            segs.push({ l: pl!.l, s: s0, t: [tx, 0], level: 0, level2: 0, gBase: prevBottom, subBase: 0, row: r, track: r ? trackStart + LEVEL_STEP * bi++ : undefined, fg: FIRST_GAP, wStart: isWireless(pl!.l.kind) && pl!.p !== job.root });
          });
        }));
        // линии к боковому краю листа: встают среди линий в порядке выходов
        floor.filter(n => sideOff.has(n)).forEach(n => {
          const pl = pm.get(n); const ps = srcPts(n);
          if (!pl || !ps.length) return;
          const side = sideOff.get(n)!;
          const g = { l: pl.l, s: ps[0], t: [side === 'R' ? PAGE_W - MARGIN : MARGIN, 0] as [number, number], level: 0, level2: 0, gBase: prevBottom, subBase: 0, row: 0, fg: FIRST_GAP, wStart: false, side };
          let at = segs.findIndex(x => x.s[0] > g.s[0]);
          if (at < 0) at = segs.length;
          segs.splice(at, 0, g);
        });
        // промежуток над этажом: все линии, в т.ч. обходящие (до своей вертикали обхода)
        const proxG = segs.map(g => ({ s: g.s, t: [g.track ?? g.t[0], 0] as [number, number], level: 0 }));
        const lvG = assignLevels(proxG);
        // радио от коробки-адаптера: под волнами нужен отступ до первой полки
        const fg = segs.some(g => g.wStart) ? WAVE_FIRST_GAP : gap0;
        segs.forEach(g => { g.fg = fg; });
        proxG.forEach((p, i) => { segs[i].level = p.level; });
        const rowY: number[] = [];
        rowY[0] = (!job.unit && fi === 0) ? (tight ? CONT_ROOT_Y_TIGHT : CONT_ROOT_Y) : prevBottom + fg + LEVEL_STEP * (lvG - 1) + drop + TAB_H;
        for (let r = 1; r < rowsOf.length; r++) {
          const sub = segs.filter(g => g.row === r);
          const base = rowY[r - 1] + BOX_H;
          const prox = sub.map(g => ({ s: [g.track!, 0] as [number, number], t: g.t, level: 0 }));
          const lv = assignLevels(prox);
          prox.forEach((p, i) => { sub[i].level2 = p.level; sub[i].subBase = base; });
          rowY[r] = base + gap0 + LEVEL_STEP * (lv - 1) + drop + TAB_H;
        }
        segs.forEach(g => { g.t[1] = g.side ? rowY[0] - TAB_H - 14 : rowY[g.row] - ((g.l.to.inTab && g.l.portKeys.length === 1) ? TAB_H : 0); });
        segsAll.push(...segs);
        floor.filter(n => sideOff.has(n)).forEach(n => boxes.set(n, { node: n, x: sideOff.get(n) === 'R' ? PAGE_W - MARGIN : MARGIN, y: 0, w: 0, h: 0, outTabs: [], inTab: n.inTab }));
        rowsOf.forEach((row, r) => row.forEach(n => {
          const c = cxOf.get(n)!;
          const b: LBox = { node: n, x: c - w / 2, y: rowY[r], w, h: BOX_H, outTabs: [], inTab: n.inTab, isSheetRoot: pinned.has(n) };
          if (shown(n)) setTabs(n, b);
          boxes.set(n, b);
        }));
        const lastY = rowY[rowY.length - 1];
        prevBottom = lastY + BOX_H + (floor.some(shown) ? TAB_H : 0);
        bottom = lastY + BOX_H;
      });
    };
    // 2) этажи не помещаются по высоте → по одной самой большой группе с нижнего уровня уходят на продолжение
    const fitHeight = () => { for (;;) {
      // сначала обычные отступы; если не влезает — плотные (меньше зазоры), и только потом перенос на продолжение
      tight = false; build();
      if (bottom <= CONTENT_BOTTOM) break;
      tight = true; build();
      if (bottom <= CONTENT_BOTTOM) break;
      tight = false;
      const F = floors();
      let picked: WNode | undefined;
      for (let f = F.length - 2; f >= 0 && !picked; f--) {
        picked = F[f].filter(canCollapse).sort((a, b) => descendants(b) - descendants(a))[0];
      }
      if (!picked) {
        // группировать больше некуда: меньше рядов, коробки уже
        if (rowLimit > 1) { rowLimit--; continue; }
        build();
        break;
      }
      expanded.delete(picked);
    } };
    fitHeight();

    // ---- группы на другом листе: линии к ним — с крайних выходов разветвителя
    const isOff = (n: WNode) => !shown(n) && n.children.length > 0;
    const sideOf = new Map<WNode, 'L' | 'R'>();
    // свернутые дети одного разветвителя, от крайнего выхода к внутреннему
    let offGroups: WNode[][] = [];
    const reorder = () => {
      let moved = false; offGroups = [];
      const parents = [job.root, ...floors().flat()].filter(shown);
      parents.forEach(p => {
        const offKids = p.children.filter(l => isOff(l.to));
        if (!offKids.length) return;
        const pb = boxes.get(p);
        const cx = pb ? pb.x + pb.w / 2 : PAGE_W / 2;
        if (!SPLITTER_IDS.includes(p.productId || '')) {
          offKids.forEach(l => { const b = boxes.get(l.to); sideOf.set(l.to, (b ? b.x + b.w / 2 : cx) < PAGE_W / 2 ? 'L' : 'R'); });
          return;
        }
        const num = (l: WLink) => (l.portKeys.length === 1 && /^\d+$/.test(l.portKeys[0])) ? +l.portKeys[0] : NaN;
        const outs = p.children.filter(l => !isNaN(num(l))).sort((a, b) => num(a) - num(b));
        // следующий разветвитель цепочки остаётся на своём (последнем) выходе
        const chain = outs.filter(l => SPLITTER_IDS.includes(l.to.productId || ''));
        const movable = outs.filter(l => !chain.includes(l));
        const side: 'L' | 'R' = chain.some(l => isOff(l.to)) || cx >= PAGE_W / 2 ? 'R' : 'L';
        chain.forEach(l => { if (isOff(l.to)) sideOf.set(l.to, 'R'); });
        const off = movable.filter(l => isOff(l.to));
        off.forEach(l => sideOf.set(l.to, side));
        const keep = movable.filter(l => !isOff(l.to));
        const order = side === 'R' ? [...keep, ...off] : [...off, ...keep];
        const ports = movable.map(num);
        order.forEach((l, i) => {
          const k = ports[i];
          if (num(l) === k) return;
          moved = true;
          l.portKeys = [String(k)]; l.tabs = [String(k)]; l.portName = `Выход ${k}`;
        });
        p.children.sort((a, b) => (isNaN(num(a)) ? 1e3 : num(a)) - (isNaN(num(b)) ? 1e3 : num(b)));
        const grp = p.children.filter(l => isOff(l.to) && sideOf.get(l.to) === side).map(l => l.to);
        offGroups.push(side === 'R' ? grp.reverse() : grp);
      });
      return moved;
    };
    for (let i = 0; i < 4 && reorder(); i++) { build(); if (bottom > CONTENT_BOTTOM) fitHeight(); }

    // ---- линии
    const drawLines = () => {
      const lines: LLine[] = []; const polys: [number, number][][] = [];
      const side = new Map<WNode, { py: number; sx: number; poly: [number, number][] }>();
      segsAll.forEach(g => {
        const [sx, sy] = g.s; const [tx, ty] = g.t;
        const py = Math.max(sy, g.gBase) + g.fg + LEVEL_STEP * g.level;
        let pts: [number, number][]; let labelTop: number;
        if (g.side) {
          // к краю: по верхней полке или (если там тесно) низко, над коробками следующего этажа
          const ex = g.side === 'R' ? PAGE_W - MARGIN - 5 : MARGIN + 5;
          const y = deep.has(g.l.to) ? Math.max(py, ty) : py;
          pts = [[sx, sy], [sx, y], [ex, y]];
          polys.push(pts); side.set(g.l.to, { py: y, sx, poly: pts });
          lines.push({ kind: g.l.kind, d: roundedPath(pts), start: [sx, sy], end: [ex, y], portName: '', cable: '', labelX: ex, labelY: y, labelLen: 0, wavesStart: false });
          return;
        }
        if (g.track !== undefined) {
          const py2 = g.subBase + (tight ? FIRST_GAP_TIGHT : FIRST_GAP) + LEVEL_STEP * g.level2;
          pts = [[sx, sy], [sx, py], [g.track, py], [g.track, py2], [tx, py2], [tx, ty]];
          labelTop = py2;
        } else if (Math.abs(tx - sx) < 0.5) {
          pts = [[sx, sy], [tx, ty]]; labelTop = Math.max(sy + 6, ty - (tight ? DROP_TIGHT : DROP));
        } else {
          pts = [[sx, sy], [sx, py], [tx, py], [tx, ty]]; labelTop = py;
        }
        polys.push(pts);
        if (isWireless(g.l.kind)) {
          // пунктир не заходит на волны: ))) - - - (((
          pts = pts.map(p => [p[0], p[1]] as [number, number]);
          if (g.wStart) pts[0][1] = Math.min(pts[0][1] + WAVE_GAP_START, pts[1][1] - 2);
          const e = pts[pts.length - 1]; e[1] = Math.max(e[1] - WAVE_GAP_END, pts[pts.length - 2][1] + 2);
        }
        lines.push({
          kind: g.l.kind, d: roundedPath(pts), start: [sx, sy], end: [tx, ty], portName: g.l.portName, cable: g.l.cable,
          labelX: tx, labelY: (labelTop + ty) / 2, labelLen: ty - labelTop, wavesStart: g.wStart,
        });
      });
      return { lines, polys, side };
    };
    const allBoxes = () => floors().flat().map(n => boxes.get(n)!).filter(Boolean);
    const over = (ax1: number, ay1: number, ax2: number, ay2: number, bx1: number, by1: number, bx2: number, by2: number) =>
      Math.max(Math.min(ax1, ax2), Math.min(bx1, bx2)) <= Math.min(Math.max(ax1, ax2), Math.max(bx1, bx2))
      && Math.max(Math.min(ay1, ay2), Math.min(by1, by2)) <= Math.min(Math.max(ay1, ay2), Math.max(by1, by2));
    /** Прямоугольник свободен от линий (кроме своей) и коробок (кроме своей)? */
    const clearOf = (polys: [number, number][][], own?: WNode, ownPoly?: [number, number][]) => {
      const segs: [number, number, number, number][] = [];
      polys.forEach(pl => { if (pl !== ownPoly) for (let i = 1; i < pl.length; i++) segs.push([pl[i - 1][0], pl[i - 1][1], pl[i][0], pl[i][1]]); });
      const rects = allBoxes().filter(o => o.node !== own && !sideOff.has(o.node)).map(o => [o.x - 1, o.y - TAB_H, o.x + o.w + 1, o.y + o.h + TAB_H] as const);
      return (rx1: number, ry1: number, rx2: number, ry2: number) => {
        const bs = segs.filter(q => over(q[0], q[1], q[2], q[3], rx1, ry1, rx2, ry2)); const br = rects.filter(q => over(q[0], q[1], q[2], q[3], rx1, ry1, rx2, ry2));
        return !bs.length && !br.length;
      };
    };
    // путь вниз от группы свободен до нижнего края листа и есть место для подписи справа или слева от стрелки?
    const downFit = (n: WNode, polys: [number, number][][]): 'r' | 'l' | null => {
      const g = segsAll.find(x => x.l.to === n);
      if (!g || g.side) return null;
      const x = g.t[0]; const y0 = g.t[1];
      if (EDGE_BOTTOM - y0 < 40) return null;
      const ownPoly = polys.find(pl => { const e = pl[pl.length - 1]; return Math.abs(e[0] - x) < 0.5 && Math.abs(e[1] - y0) < 0.5; });
      const clear = clearOf(polys, n, ownPoly);
      if (!clear(x - 2.5, y0 + 1, x + 2.5, EDGE_BOTTOM)) return null;
      const lw = bottomLabelW(n);
      if (clear(x + 4, EDGE_BOTTOM - BOTTOM_LABEL_H, x + 4 + lw, EDGE_BOTTOM) && x + 4 + lw <= PAGE_W - MARGIN / 2) return 'r';
      if (clear(x - 4 - lw, EDGE_BOTTOM - BOTTOM_LABEL_H, x - 4, EDGE_BOTTOM) && x - 4 - lw >= MARGIN / 2) return 'l';
      return null;
    };
    // горизонталь к боковому краю ничего не пересекает, а подписи есть место над ней или под ней?
    const sideFit = (n: WNode, L: ReturnType<typeof drawLines>): 'above' | 'below' | null => {
      const si = L.side.get(n); if (!si) return null;
      const sd = sideOff.get(n)!;
      const ex = sd === 'R' ? PAGE_W - MARGIN : MARGIN;
      const x1 = Math.min(si.sx, ex) + 0.5; const x2 = Math.max(si.sx, ex) - 0.5; const y = si.py;
      const lw = sideLabelW(n, linkTo.get(n)?.portName);
      const lx1 = sd === 'R' ? ex - lw : ex; const lx2 = sd === 'R' ? ex : ex + lw;
      const clear = clearOf(L.polys, n, si.poly);
      if (!clear(x1, y - 1.5, x2, y + 1.5)) return null;
      // своя вертикаль от выхода вниз к полке тоже не должна проходить через подпись
      const [[vx, vy0], [, vy1]] = si.poly;
      const ownClear = (rx1: number, ry1: number, rx2: number, ry2: number) => !over(vx, vy0, vx, vy1, rx1, ry1, rx2, ry2);
      if (clear(lx1, y - SIDE_LABEL_H - 1.5, lx2, y - 1.5) && ownClear(lx1, y - SIDE_LABEL_H - 1.5, lx2, y - 1.5)) return 'above';
      if (clear(lx1, y + 1.5, lx2, y + SIDE_LABEL_H + 1.5)) return 'below';
      return null;
    };
    let L = drawLines();
    {
      const offs = floors().flat().filter(isOff);
      const want = offs.filter(n => !downFit(n, L.polys));
      const need = new Set(want);
      // линия вниз с внешнего выхода перегородила бы путь к краю: внешние тоже уходят вбок
      offGroups.forEach(g => {
        const k = Math.max(-1, ...g.map((n, i) => want.includes(n) ? i : -1));
        for (let i = 0; i < k; i++) if (!want.includes(g[i])) want.push(g[i]);
      });
      if (want.length) {
        want.forEach(n => sideOff.set(n, sideOf.get(n) || 'R'));
        build(); L = drawLines();
        for (let it = 0; it < 6 && sideOff.size; it++) {
          let bad = [...sideOff.keys()].filter(n => !sideFit(n, L));
          const retry = bad.filter(n => !deep.has(n));
          if (retry.length) { retry.forEach(n => deep.add(n)); L = drawLines(); bad = [...sideOff.keys()].filter(n => !sideFit(n, L)); }
          if (!bad.length && bottom <= CONTENT_BOTTOM) break;
          (bad.length ? bad : [...sideOff.keys()]).forEach(n => sideOff.delete(n));
          build(); L = drawLines();
        }
        // внешние ушли вбок «за компанию», а тем, кому было нужно, не помогло — пусть идут вниз, как раньше
        const revert = offGroups.flatMap(g => g.some(n => need.has(n) && sideOff.has(n)) ? [] : g.filter(n => sideOff.has(n) && !need.has(n)));
        if (revert.length) { revert.forEach(n => { sideOff.delete(n); deep.delete(n); }); build(); L = drawLines(); }
      }
    }

    // ---- коробки
    const collapsedHere: WNode[] = [];
    floors().forEach(row => row.forEach(n => {
      sheet.boxes.push(boxes.get(n)!);
      if (isOff(n)) collapsedHere.push(n);
    }));
    const parentName = job.unit ? `${job.unit.root.title}${model.units.length > 1 ? ` (блок ${job.unit.index})` : ''}` : '';
    L.lines.forEach(l => { sheet.lines.push(l); sheet.kinds.add(l.kind); });
    const polys = L.polys;

    // ---- уход на другой лист: вниз до края листа, к боковому краю или стрелка на месте
    collapsedHere.forEach(n => {
      const b = boxes.get(n)!;
      const l = linkTo.get(n);
      const si = L.side.get(n);
      if (si && sideOff.has(n)) {
        b.offPage = { kind: l ? l.kind : 'rs485', startY: si.py, side: sideOff.get(n), sideX: sideOff.get(n) === 'R' ? PAGE_W - MARGIN : MARGIN, port: l?.portName, below: sideFit(n, L) === 'below' };
        return;
      }
      const g = segsAll.find(x => x.l.to === n);
      if (!g) return;
      const x = g.t[0]; const y0 = g.t[1];
      const fit = downFit(n, polys);
      const free = !!fit;
      b.offPage = { kind: g.l.kind, startY: y0, edgeY: free ? EDGE_BOTTOM : undefined, labelLeft: fit === 'l' };
      if (free) {
        polys.push([[x, y0], [x, EDGE_BOTTOM]]);
        const lw = bottomLabelW(n); const x1 = fit === 'l' ? x - 4 - lw : x + 4; const x2 = x1 + lw; const y1 = EDGE_BOTTOM - BOTTOM_LABEL_H;
        polys.push([[x1, y1], [x2, y1], [x2, EDGE_BOTTOM], [x1, EDGE_BOTTOM], [x1, y1]]);
      }
    });

    // ---- лист-продолжение: линия к каждому корню входит от верхнего края
    if (!job.unit) sheet.boxes.filter(b => b.isSheetRoot).forEach(b => {
      const l = linkTo.get(b.node);
      const x = b.x + b.w / 2; const y1 = b.y - (b.inTab ? TAB_H : 0);
      sheet.lines.push({
        kind: l ? l.kind : 'rs485', d: `M ${x} ${EDGE_TOP} L ${x} ${y1}`, start: [x, EDGE_TOP], end: [x, y1],
        portName: '', cable: l ? l.cable : '', labelX: x, labelY: (EDGE_TOP + 4 + y1) / 2, labelLen: y1 - EDGE_TOP - 4,
        wavesStart: false, incoming: b.node,
      });
      if (l) sheet.kinds.add(l.kind);
    });
    const addRows = (parent: WNode, pName: string) => parent.children.forEach(l => rows.push({
      sheet: number, from: pName, port: l.portName, to: [l.to.title, l.to.subtitle].filter(Boolean).join(', '),
      article: l.to.productId || '', cable: l.cable || (l.kind === 'radio' ? 'радио 868 МГц' : l.kind === 'lora' ? 'радио LoRa' : ''), kind: l.kind,
    }));

    if (job.unit) {
      const wirelessKey = job.unit.model === 'ec01v40' ? 'RADIO' : 'LORA';
      addRows(job.root, parentName);
      job.root.children.forEach(l => {
        if (isWireless(l.kind)) return;
        l.portKeys.forEach(k => { const p = rootPorts[k]; if (p) sheet.portDots.push({ x: p[0], y: p[1], kind: l.kind }); });
      });
      if (job.root.children.some(l => isWireless(l.kind))) {
        const p = rootPorts[wirelessKey];
        sheet.wirelessPort = { ax: antennaAt[0], ay: antennaAt[1], x: p[0], y: p[1], kind: job.unit.model === 'ec01v40' ? 'radio' : 'lora', label: job.unit.model === 'ec01v40' ? 'Радио 868 МГц' : 'LoRa' };
      }
    }
    floors().forEach(row => row.forEach(n => { if (shown(n)) addRows(n, nodeLabel(n)); }));
    // свернутые группы → листы-продолжения; маленькие группы собираются на один лист
    let chunk: WNode[] = []; let used = 0;
    collapsedHere.forEach(n => {
      const c = Math.min(2 * ROW_CAP - 2, Math.max(1, n.children.length));
      if (chunk.length && (used + c > 2 * ROW_CAP - 2 || chunk.length >= ROW_CAP)) { queue.push({ roots: chunk }); chunk = []; used = 0; }
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
      const ln = sh.lines.find(l => l.incoming === b.node);
      if (ln) ln.portName = b.fromNote;
    }
  }));

  return { sheets, rows };
};

// Выходные «язычки» коробки: по одному на каждый уникальный порт детей, равномерно по нижней грани.
export const tabLabels = (n: WNode, w: number): string[] => {
  if (n.outs && w / n.outs.length >= 7) return n.outs;
  const labels: string[] = [];
  n.children.forEach(l => l.tabs.forEach(t => { if (!labels.includes(t)) labels.push(t); }));
  return labels;
};
const SPLITTER_IDS = ['ec01033', 'ec01107'];
/** Подпись у стрелки на другой лист (для оценки ширины). */
const offTitleOf = (n: WNode) => [n.productId, n.title, n.subtitle].filter(Boolean).join(' ');
// Подписи «→ лист N» у стрелок на другой лист: всегда горизонтальные (оценка размеров для проверки места)
export const REF_FONT = 7;      // «→ лист N»
export const REF_TITLE_FONT = 6; // название группы
const BOTTOM_LABEL_H = 17;
const SIDE_LABEL_H = 17;
const bottomLabelW = (n: WNode) => Math.max(34, offTitleOf(n).length * 3.15);
const sideLabelW = (n: WNode, port = '') => Math.max(34 + port.length * 3.15, offTitleOf(n).length * 3.15);

const setTabs = (n: WNode, b: LBox) => {
  const labels = tabLabels(n, b.w);
  const used = new Set(n.children.flatMap(l => l.tabs));
  // ширина язычка — по длине подписи («ПИТ» шире цифр); остаток ширины коробки делится поровну
  const need = labels.map(l => Math.max(5.5, l.length * 2.9 + 1.8));
  const slot = b.w / Math.max(1, labels.length);
  const extra = Math.max(0, b.w - need.reduce((a, x) => a + x + 1.2, 0)) / Math.max(1, labels.length);
  const ws = need.map(x => Math.min(20, Math.max(x, Math.min(slot - 1.2, x + extra))));
  const span = ws.reduce((a, x) => a + x + 1.2, 0);
  let cx = b.x + (b.w - span) / 2;
  b.outTabs = labels.map((label, i) => { const x = cx + 0.6 + ws[i] / 2; cx += ws[i] + 1.2; return { label, x, w: ws[i], used: used.has(label) }; });
};
const tabPoint = (b: LBox, label: string): [number, number] => {
  const t = b.outTabs.find(x => x.label === label) || b.outTabs[0];
  return [t ? t.x : b.x + b.w / 2, b.y + b.h + TAB_H];
};

// Ряд коробок в исходном порядке как можно ближе к желаемым x (изотоническая регрессия, PAV),
// с шагом не меньше S и в пределах полей листа. Возвращает центры.
const placeRow = (desired: number[], w: number, S: number, right = PAGE_W - MARGIN, left = MARGIN): number[] => {
  const n = desired.length;
  const blocks: { sum: number; cnt: number }[] = [];
  desired.forEach((d, i) => {
    blocks.push({ sum: d - i * S, cnt: 1 });
    while (blocks.length > 1) {
      const a = blocks[blocks.length - 2]; const b = blocks[blocks.length - 1];
      if (a.sum / a.cnt <= b.sum / b.cnt) break;
      a.sum += b.sum; a.cnt += b.cnt; blocks.pop();
    }
  });
  const z: number[] = [];
  blocks.forEach(b => { for (let k = 0; k < b.cnt; k++) z.push(b.sum / b.cnt); });
  const lo = left + w / 2; const hi = Math.max(lo, right - w / 2 - (n - 1) * S);
  return z.map((v, i) => Math.min(Math.max(v, lo), hi) + i * S);
};

// Уровни полок в промежутке между этажами. Линии идут в том же порядке, что и выходы, поэтому
// пересечений нет, если: у линий «влево» полка ниже у более правой, у линий «вправо» — у более левой.
// Уровень повышается только там, где горизонтальные участки перекрываются. Возвращает число уровней.
const assignLevels = (segs: { s: [number, number]; t: [number, number]; level: number }[]): number => {
  const PAD = 4;
  let max = 0;
  const left = segs.filter(g => g.t[0] < g.s[0] - 0.5);
  left.forEach((g, j) => {
    let lv = 0;
    for (let i = 0; i < j; i++) if (left[i].s[0] > g.t[0] - PAD) lv = Math.max(lv, left[i].level + 1);
    g.level = lv; max = Math.max(max, lv + 1);
  });
  const right = segs.filter(g => g.t[0] > g.s[0] + 0.5);
  for (let j = right.length - 1; j >= 0; j--) {
    const g = right[j];
    let lv = 0;
    for (let i = j + 1; i < right.length; i++) if (right[i].s[0] < g.t[0] + PAD) lv = Math.max(lv, right[i].level + 1);
    g.level = lv; max = Math.max(max, lv + 1);
  }
  return Math.max(1, max);
};

// Ортогональная ломаная со скруглёнными углами (радиус CORNER, но не больше половины отрезка).
const roundedPath = (pts: [number, number][]): string => {
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const [ax, ay] = pts[i - 1]; const [bx, by] = pts[i]; const [cx, cy] = pts[i + 1];
    const l1 = Math.hypot(bx - ax, by - ay); const l2 = Math.hypot(cx - bx, cy - by);
    if (l1 < 0.01 || l2 < 0.01) continue;
    const r = Math.min(CORNER, l1 / 2, l2 / 2);
    d += ` L ${bx - (bx - ax) / l1 * r} ${by - (by - ay) / l1 * r} Q ${bx} ${by} ${bx + (cx - bx) / l2 * r} ${by + (cy - by) / l2 * r}`;
  }
  const z = pts[pts.length - 1];
  return d + ` L ${z[0]} ${z[1]}`;
};
