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
const DROP = 50;        // минимальная длина последнего вертикального отрезка (под подписи)
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
  /** Группа на другом листе: коробки нет, линия кончается стрелкой (у края листа, если путь вниз свободен). */
  offPage?: { kind: LineKind; startY: number; edgeY?: number };
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
      if (floor.some(shown)) return null;
      for (let R = 2; R <= rowLimit; R++) {
        const per = Math.ceil(floor.length / R);
        const rws: WNode[][] = [];
        for (let i = 0; i < floor.length; i += per) rws.push(floor.slice(i, i + per));
        const nB = rws.slice(1).flat().reduce((a, x) => a + (pm.has(x) ? Math.max(1, pm.get(x)!.l.portKeys.length) : 0), 0);
        const cap = Math.floor((CONTENT_W - BYPASS_PAD - LEVEL_STEP * nB + GAP_X) / (BOX_W + GAP_X));
        if (per <= cap) return { rows: rws, nB };
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
    interface Seg { l: WLink; s: [number, number]; t: [number, number]; level: number; level2: number; gBase: number; subBase: number; track?: number }
    let boxes = new Map<WNode, LBox>();
    let segsAll: Seg[] = [];
    let bottom = 0;
    const build = () => {
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
        const lay = rowsFor(floor, pm);
        const rowsOf = lay ? lay.rows : [floor];
        const nB = lay ? lay.nB : 0;
        // если не помещается даже так — коробки сужаются
        const w = lay ? BOX_W : Math.max(30, (CONTENT_W + GAP_X) / floor.length - GAP_X);
        const S = w + GAP_X;
        const rightLimit = nB ? PAGE_W - MARGIN - BYPASS_PAD - LEVEL_STEP * nB : PAGE_W - MARGIN;
        const cxOf = new Map<WNode, number>();
        rowsOf.forEach(row => {
          const desired = row.map(n => { const ps = srcPts(n); return ps.length ? ps.reduce((a, q) => a + q[0], 0) / ps.length : PAGE_W / 2; });
          placeRow(desired, w, S, rightLimit).forEach((c, i) => cxOf.set(row[i], c));
        });
        const maxRight = Math.max(...floor.map(n => cxOf.get(n)! + w / 2));
        const trackStart = maxRight + BYPASS_PAD / 2 + 2;
        const segs: (Seg & { row: number })[] = [];
        let bi = 0;
        rowsOf.forEach((row, r) => row.forEach(n => {
          const ps = srcPts(n); const pl = pm.get(n);
          ps.forEach((s0, k) => {
            const m = ps.length; const c = cxOf.get(n)!;
            const tx = m === 1 ? c : c - w / 2 + w * (k + 1) / (m + 1);
            segs.push({ l: pl!.l, s: s0, t: [tx, 0], level: 0, level2: 0, gBase: prevBottom, subBase: 0, row: r, track: r ? trackStart + LEVEL_STEP * bi++ : undefined });
          });
        }));
        // промежуток над этажом: все линии, в т.ч. обходящие (до своей вертикали обхода)
        const proxG = segs.map(g => ({ s: g.s, t: [g.track ?? g.t[0], 0] as [number, number], level: 0 }));
        const lvG = assignLevels(proxG);
        proxG.forEach((p, i) => { segs[i].level = p.level; });
        const rowY: number[] = [];
        rowY[0] = (!job.unit && fi === 0) ? CONT_ROOT_Y : prevBottom + FIRST_GAP + LEVEL_STEP * (lvG - 1) + DROP + TAB_H;
        for (let r = 1; r < rowsOf.length; r++) {
          const sub = segs.filter(g => g.row === r);
          const base = rowY[r - 1] + BOX_H;
          const prox = sub.map(g => ({ s: [g.track!, 0] as [number, number], t: g.t, level: 0 }));
          const lv = assignLevels(prox);
          prox.forEach((p, i) => { sub[i].level2 = p.level; sub[i].subBase = base; });
          rowY[r] = base + FIRST_GAP + LEVEL_STEP * (lv - 1) + DROP + TAB_H;
        }
        segs.forEach(g => { g.t[1] = rowY[g.row] - ((g.l.to.inTab && g.l.portKeys.length === 1) ? TAB_H : 0); });
        segsAll.push(...segs);
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
    for (;;) {
      build();
      if (bottom <= CONTENT_BOTTOM) break;
      const F = floors();
      let picked: WNode | undefined;
      for (let f = F.length - 2; f >= 0 && !picked; f--) {
        picked = F[f].filter(canCollapse).sort((a, b) => descendants(b) - descendants(a))[0];
      }
      if (!picked) {
        // группировать больше некуда: меньше рядов, коробки уже
        if (rowLimit > 1) { rowLimit--; continue; }
        break;
      }
      expanded.delete(picked);
    }

    // ---- коробки
    const collapsedHere: WNode[] = [];
    floors().forEach(row => row.forEach(n => {
      sheet.boxes.push(boxes.get(n)!);
      if (!shown(n) && n.children.length) collapsedHere.push(n);
    }));

    // ---- линии
    const parentName = job.unit ? `${job.unit.root.title}${model.units.length > 1 ? ` (блок ${job.unit.index})` : ''}` : '';
    const polys: [number, number][][] = [];
    segsAll.forEach(g => {
      const [sx, sy] = g.s; const [tx, ty] = g.t;
      const py = Math.max(sy, g.gBase) + FIRST_GAP + LEVEL_STEP * g.level;
      let pts: [number, number][]; let labelTop: number;
      if (g.track !== undefined) {
        const py2 = g.subBase + FIRST_GAP + LEVEL_STEP * g.level2;
        pts = [[sx, sy], [sx, py], [g.track, py], [g.track, py2], [tx, py2], [tx, ty]];
        labelTop = py2;
      } else if (Math.abs(tx - sx) < 0.5) {
        pts = [[sx, sy], [tx, ty]]; labelTop = Math.max(sy + 6, ty - DROP);
      } else {
        pts = [[sx, sy], [sx, py], [tx, py], [tx, ty]]; labelTop = py;
      }
      polys.push(pts);
      sheet.lines.push({
        kind: g.l.kind, d: roundedPath(pts), start: [sx, sy], end: [tx, ty], portName: g.l.portName, cable: g.l.cable,
        labelX: tx, labelY: (labelTop + ty) / 2, labelLen: ty - labelTop, wavesStart: isWireless(g.l.kind),
      });
      sheet.kinds.add(g.l.kind);
    });

    // ---- уход на другой лист: если ниже по вертикали свободно — линия идёт до нижнего края листа
    collapsedHere.forEach(n => {
      const b = boxes.get(n)!;
      const g = segsAll.find(x => x.l.to === n);
      if (!g) return;
      const x = g.t[0]; const y0 = g.t[1];
      const free = (EDGE_BOTTOM - y0 >= 70)
        && sheet.boxes.every(o => o === b || o.y + o.h + TAB_H < y0 || o.x - 3 > x || o.x + o.w + 3 < x)
        && polys.every(pl => pl.every((p, i) => {
          if (!i) return true;
          const [ax, ay] = pl[i - 1]; const [bx, by] = p;
          const minX = Math.min(ax, bx) - 3; const maxX = Math.max(ax, bx) + 3;
          const minY = Math.min(ay, by); const maxY = Math.max(ay, by);
          return maxX < x || minX > x || maxY <= y0 + 0.5 || minY > EDGE_BOTTOM;
        }));
      b.offPage = { kind: g.l.kind, startY: y0, edgeY: free ? EDGE_BOTTOM : undefined };
      if (free) polys.push([[x, y0], [x, EDGE_BOTTOM]]);
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
const setTabs = (n: WNode, b: LBox) => {
  const labels = tabLabels(n, b.w);
  const used = new Set(n.children.flatMap(l => l.tabs));
  b.outTabs = labels.map((label, i) => ({ label, x: b.x + b.w * (i + 0.5) / labels.length, used: used.has(label) }));
};
const tabPoint = (b: LBox, label: string): [number, number] => {
  const t = b.outTabs.find(x => x.label === label) || b.outTabs[0];
  return [t ? t.x : b.x + b.w / 2, b.y + b.h + TAB_H];
};

// Ряд коробок в исходном порядке как можно ближе к желаемым x (изотоническая регрессия, PAV),
// с шагом не меньше S и в пределах полей листа. Возвращает центры.
const placeRow = (desired: number[], w: number, S: number, right = PAGE_W - MARGIN): number[] => {
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
  const lo = MARGIN + w / 2; const hi = Math.max(lo, right - w / 2 - (n - 1) * S);
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
