// PDF «Схема подключения»: листы со схемой + лист с таблицей подключений.
import React from 'react';
import { Document, Page, View, Text, Image, Svg, Path, Circle, Rect, G, StyleSheet } from '@react-pdf/renderer';
import { WiringModel, LineKind } from '../wiring/model';
import { LayoutResult, LSheet, LBox, PAGE_W, PAGE_H, REF_FONT, REF_TITLE_FONT } from '../wiring/layout';
import { LINE_STYLE, KIND_ORDER, MOUNTING_TIPS } from '../wiring/styles';

const GOLD = '#F5A800';
const DARK = '#3A3F47';
const GRAY = '#7A808A';

const s = StyleSheet.create({
  page: { fontFamily: 'Roboto', fontSize: 7, color: DARK, position: 'relative' },
  header: { position: 'absolute', left: 24, right: 24, top: 18, height: 34, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', borderBottomWidth: 1.5, borderBottomColor: GOLD, paddingBottom: 5 },
  logo: { fontSize: 17, fontWeight: 'bold' },
  title: { fontSize: 10, fontWeight: 'bold', color: DARK, marginLeft: 12, marginBottom: 2 },
  subtitle: { fontSize: 8, color: GRAY, marginLeft: 8, marginBottom: 2.5 },
  hRight: { alignItems: 'flex-end' },
  order: { fontSize: 9, fontWeight: 'bold' },
  small: { fontSize: 7, color: GRAY },
  legend: { position: 'absolute', left: 24, right: 24, bottom: 14, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', borderTopWidth: 0.5, borderTopColor: '#D5D9DE', paddingTop: 5 },
  legendItem: { flexDirection: 'row', alignItems: 'center', marginRight: 12, marginBottom: 2 },
  legendText: { fontSize: 6.5, color: DARK, marginLeft: 3 },
  box: { position: 'absolute', borderRadius: 5, borderWidth: 0.8, paddingHorizontal: 3, paddingTop: 3, justifyContent: 'flex-start', alignItems: 'center' },
  art: { fontSize: 5.2, color: GRAY, fontWeight: 'bold' },
  name: { fontSize: 6.3, fontWeight: 'bold', textAlign: 'center', color: DARK },
  sub: { fontSize: 5.4, color: GRAY, textAlign: 'center' },
  ref: { fontSize: 5.6, color: '#C77F00', fontWeight: 'bold', textAlign: 'center' },
  tab: { position: 'absolute', height: 7, borderRadius: 2, backgroundColor: '#E3E6EA', borderWidth: 0.5, borderColor: '#AEB4BC', justifyContent: 'center', alignItems: 'center' },
  tabText: { fontSize: 4.6, color: DARK },
  lbl: { position: 'absolute', fontSize: 5, textAlign: 'center' },
  // таблица
  tPage: { fontFamily: 'Roboto', fontSize: 7, color: DARK, paddingTop: 62, paddingBottom: 30, paddingHorizontal: 24 },
  h2: { fontSize: 10, fontWeight: 'bold', marginBottom: 5, marginTop: 8 },
  tr: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: '#D5D9DE', minHeight: 13, alignItems: 'center' },
  th: { backgroundColor: '#FFF4DA', fontWeight: 'bold' },
  td: { paddingHorizontal: 3, paddingVertical: 2 },
  tip: { flexDirection: 'row', marginBottom: 2.5 },
});

// На схеме подпись короче, чем в таблице: «4 жилы 0,5 мм²» → «4×0,5 мм²».
const shortCable = (c: string) => c.replace(/(\d+) жил[аы]?\s*/g, '$1×');

const LineSample: React.FC<{ kind: LineKind }> = ({ kind }) => {
  const st = LINE_STYLE[kind];
  return (
    <Svg width={22} height={6}>
      <Path d="M 1 3 L 21 3" stroke={st.color} strokeWidth={st.width} strokeDasharray={st.dash} />
    </Svg>
  );
};

const Header: React.FC<{ title: string; order: string; sheet: number; total: number }> = ({ title, order, sheet, total }) => (
  <View style={s.header} fixed>
    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
      <Text style={s.logo}><Text style={{ color: GOLD }}>ecto</Text><Text style={{ color: DARK }}>Control</Text></Text>
      <Text style={s.title}>Схема подключения оборудования</Text>
      <Text style={s.subtitle}>{title}</Text>
    </View>
    <View style={s.hRight}>
      <Text style={s.order}>Комплект № {order}</Text>
      <Text style={s.small}>{new Date().toLocaleDateString('ru-RU')} · Лист {sheet} из {total}</Text>
    </View>
  </View>
);

// Три дуги «излучения». dir = -1: дуги смотрят вниз (источник над линией), +1: вверх.
const Waves: React.FC<{ x: number; y: number; color: string; dir: 1 | -1 }> = ({ x, y, color, dir }) => (
  <G>
    {[3, 5.5, 8].map(r => (
      <Path key={r} d={`M ${x - r * 0.8} ${y - dir * r * 0.6} A ${r} ${r} 0 0 ${dir === 1 ? 1 : 0} ${x + r * 0.8} ${y - dir * r * 0.6}`}
        stroke={color} strokeWidth={0.8} fill="none" />
    ))}
  </G>
);

const boxColors = (b: LBox) => {
  const k = b.node.kind;
  if (k === 'load') return { backgroundColor: '#FFFFFF', borderColor: '#9AA0A8', borderStyle: 'dashed' as const };
  if (k === 'expander' || b.isSheetRoot) return { backgroundColor: '#EEF2F7', borderColor: '#9FB0C6' };
  return { backgroundColor: '#F7F8FA', borderColor: '#B9C0C8' };
};

const offTitle = (b: LBox) => [b.node.productId, b.node.title, b.node.subtitle].filter(Boolean).join(' ');

// «→ лист N»: стрелка рисуется векторно (в шрифте Roboto из сборки нет символа «→»).
const SheetRef: React.FC<{ n?: number; size?: number; align?: 'flex-start' | 'center' | 'flex-end' }> = ({ n, size = REF_FONT, align = 'center' }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: align }}>
    <Svg width={size * 1.15} height={size * 0.8} viewBox="0 0 10 7">
      <Path d="M 0 3.5 L 6 3.5" stroke="#C77F00" strokeWidth={1.3} />
      <Path d="M 5 0.5 L 10 3.5 L 5 6.5 Z" fill="#C77F00" />
    </Svg>
    <Text style={{ fontSize: size, color: '#C77F00', fontWeight: 'bold', marginLeft: size * 0.25 }}>лист {n ?? '?'}</Text>
  </View>
);

// Группа на другом листе: вместо коробки — горизонтальная подпись у стрелки.
const OffPageLabel: React.FC<{ b: LBox }> = ({ b }) => {
  const o = b.offPage!;
  const color = LINE_STYLE[o.kind].color;
  const title = <Text style={{ fontSize: REF_TITLE_FONT, color: DARK }}>{offTitle(b)}</Text>;
  if (o.side && o.sideX !== undefined) {
    const W = 220; const R = o.side === 'R'; const al = R ? 'flex-end' : 'flex-start';
    return (
      <View style={{ position: 'absolute', left: R ? o.sideX - W : o.sideX, top: o.below ? o.startY + 1.5 : o.startY - 17.5, width: W, alignItems: al }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {o.port ? <Text style={{ fontSize: REF_TITLE_FONT, color, marginRight: 3 }}>{o.port}</Text> : null}
          <SheetRef n={b.refSheet} />
        </View>
        {title}
      </View>
    );
  }
  if (o.edgeY !== undefined) {
    const W = 220; const x = b.x + b.w / 2; const left = o.labelLeft;
    return (
      <View style={{ position: 'absolute', left: left ? x - 4 - W : x + 4, top: o.edgeY - 16.5, width: W, alignItems: left ? 'flex-end' : 'flex-start' }}>
        <SheetRef n={b.refSheet} align={left ? 'flex-end' : 'flex-start'} />
        {title}
      </View>
    );
  }
  return (
    <View style={{ position: 'absolute', left: b.x - 10, top: o.startY + 12, width: b.w + 20, alignItems: 'center' }}>
      <SheetRef n={b.refSheet} />
      <Text style={{ fontSize: REF_TITLE_FONT, color: DARK, textAlign: 'center' }}>{offTitle(b)}</Text>
    </View>
  );
};

const BoxView: React.FC<{ b: LBox }> = ({ b }) => b.offPage ? <OffPageLabel b={b} /> : (
  <>
    <View style={[s.box, boxColors(b), { left: b.x, top: b.y, width: b.w, height: b.h }]}>
      {b.node.productId && b.node.kind !== 'load' ? <Text style={s.art}>{b.node.productId}</Text> : null}
      <Text style={s.name}>{b.node.title}</Text>
      {b.node.subtitle ? <Text style={s.sub}>{b.node.subtitle}</Text> : null}
      {b.node.reserve ? <Text style={s.sub}>резерв</Text> : null}
      {b.refSheet ? <SheetRef n={b.refSheet} size={6} /> : null}
    </View>
    {b.inTab ? (
      <View style={[s.tab, { left: b.x + b.w / 2 - 11, top: b.y - 7, width: 22 }]}><Text style={s.tabText}>{b.inTab}</Text></View>
    ) : null}
    {b.outTabs.map((t, i) => {
      const w = t.w;
      return (
        <View key={i} style={[s.tab, { left: t.x - w / 2, top: b.y + b.h, width: w }, t.used === false ? { backgroundColor: '#FFFFFF', borderColor: '#D5D9DE' } : {}]}><Text style={[s.tabText, t.used === false ? { color: '#B0B5BC' } : {}]}>{t.label}</Text></View>
      );
    })}
  </>
);

const SheetPage: React.FC<{ sh: LSheet; order: string; total: number }> = ({ sh, order, total }) => (
  <Page size="A4" orientation="landscape" style={s.page}>
    <View style={{ position: 'absolute', left: 0, top: 0, width: PAGE_W, height: PAGE_H - 2 }} wrap={false}>
    <Header title={sh.title} order={order} sheet={sh.number} total={total} />
    {sh.image ? <Image src={sh.image.src} style={{ position: 'absolute', left: sh.image.x, top: sh.image.y, width: sh.image.w, height: sh.image.h }} /> : null}

    <Svg style={{ position: 'absolute', left: 0, top: 0 }} width={PAGE_W} height={PAGE_H - 4}>
      {sh.lines.map((l, i) => {
        const st = LINE_STYLE[l.kind];
        return <Path key={i} d={l.d} stroke={st.color} strokeWidth={st.width} strokeDasharray={st.dash} fill="none" strokeLinecap="round" strokeLinejoin="round" />;
      })}
      {sh.portDots.map((p, i) => <Circle key={`d${i}`} cx={p.x} cy={p.y} r={1.9} fill={LINE_STYLE[p.kind].color} />)}
      {sh.wirelessPort ? (() => {
        const w = sh.wirelessPort; const st = LINE_STYLE[w.kind];
        // от антенны: волны, затем пунктир вправо за рендер и вниз до начала веера
        const sx = w.ax + 15;
        return (
          <G>
            <G transform={`rotate(-90 ${w.ax + 3} ${w.ay})`}><Waves x={w.ax + 3} y={w.ay} color={st.color} dir={-1} /></G>
            <Path d={`M ${sx} ${w.ay} L ${w.x - 4} ${w.ay} Q ${w.x} ${w.ay} ${w.x} ${w.ay + 4} L ${w.x} ${w.y}`} stroke={st.color} strokeWidth={st.width} strokeDasharray={st.dash} fill="none" />
          </G>
        );
      })() : null}
      {sh.lines.filter(l => l.kind === 'radio' || l.kind === 'lora').map((l, i) => (
        <Waves key={`w${i}`} x={l.end[0]} y={l.end[1] - 2} color={LINE_STYLE[l.kind].color} dir={1} />
      ))}
      {sh.lines.some(l => l.wavesStart) ? (
        // источник радио — коробка-адаптер: волны у её нижней грани
        <G>{Array.from(new Set<string>(sh.lines.filter(l => l.wavesStart).map(l => `${l.start[0]}|${l.start[1]}|${l.kind}`))).map((k, i) => {
          const [x, y, kind] = k.split('|');
          return <Waves key={`ws${i}`} x={+x} y={+y + 4} color={LINE_STYLE[kind as LineKind].color} dir={-1} />;
        })}</G>
      ) : null}
      {sh.boxes.filter(b => b.offPage).map((b, i) => {
        const o = b.offPage!; const st = LINE_STYLE[o.kind]; const x = b.x + b.w / 2;
        if (o.side && o.sideX !== undefined) {
          const X = o.sideX; const Y = o.startY; const d = o.side === 'R' ? -5 : 5;
          return <Path key={`o${i}`} d={`M ${X + d} ${Y - 3} L ${X + d} ${Y + 3} L ${X} ${Y} Z`} fill={st.color} />;
        }
        const end = o.edgeY ?? o.startY + 10;
        return (
          <G key={`o${i}`}>
            <Path d={`M ${x} ${o.startY} L ${x} ${end - 4}`} stroke={st.color} strokeWidth={st.width} strokeDasharray={st.dash} fill="none" />
            <Path d={`M ${x - 3} ${end - 5} L ${x + 3} ${end - 5} L ${x} ${end} Z`} fill={st.color} />
          </G>
        );
      })}
      {sh.lines.filter(l => l.incoming).map((l, i) => (
        <Path key={`in${i}`} d={`M ${l.start[0] - 3} ${l.start[1]} L ${l.start[0] + 3} ${l.start[1]} L ${l.start[0]} ${l.start[1] + 5} Z`} fill={LINE_STYLE[l.kind].color} />
      ))}
      <Rect x={0} y={0} width={0.1} height={0.1} fill="#fff" />
    </Svg>

    {sh.wirelessPort ? (
      <Text style={[s.lbl, { left: sh.wirelessPort.ax + 16, top: sh.wirelessPort.ay - 9, width: 80, textAlign: 'left', color: LINE_STYLE[sh.wirelessPort.kind].color }]}>{sh.wirelessPort.label}</Text>
    ) : null}

    {sh.boxes.map((b, i) => <BoxView key={i} b={b} />)}

    {/* подписи линий: слева от линии — порт, справа — кабель; текст вдоль линии */}
    {sh.lines.map((l, i) => {
      const len = 110; // без переноса: короткие подписи центрируются на отрезке
      const color = LINE_STYLE[l.kind].color;
      const mk = (text: string, dx: number) => (
        <Text style={[s.lbl, { color, left: l.labelX + dx - len / 2, top: l.labelY - 3, width: len, transform: 'rotate(-90deg)' }]}>{text}</Text>
      );
      return (
        <React.Fragment key={`l${i}`}>
          {l.portName && l.kind !== 'radio' && l.kind !== 'lora' ? mk(l.portName, -4.2) : null}
          {l.cable ? mk(shortCable(l.cable), 4.2) : null}
        </React.Fragment>
      );
    })}

    <View style={s.legend} fixed>
      {KIND_ORDER.filter(k => sh.kinds.has(k)).map(k => (
        <View key={k} style={s.legendItem}><LineSample kind={k} /><Text style={s.legendText}>{LINE_STYLE[k].name}</Text></View>
      ))}
      <View style={s.legendItem}><Text style={[s.legendText, { color: GRAY }]}>Пунктирная рамка — нагрузка (не входит в комплект ectoControl)</Text></View>
    </View>
    </View>
  </Page>
);

const COLS = [
  { k: 'n', title: '№', w: '4%' }, { k: 'sheet', title: 'Лист', w: '5%' }, { k: 'from', title: 'Откуда', w: '22%' },
  { k: 'port', title: 'Клемма / выход', w: '14%' }, { k: 'article', title: 'Артикул', w: '8%' },
  { k: 'to', title: 'Куда (устройство)', w: '27%' }, { k: 'cable', title: 'Линия', w: '20%' },
] as const;

export const WiringLayout = ({ model, layout, orderNumber }: { model: WiringModel; layout: LayoutResult; orderNumber: string }) => {
  const total = layout.sheets.length + 1;
  return (
    <Document title={`Схема подключения ectoControl № ${orderNumber}`}>
      {layout.sheets.map(sh => <SheetPage key={sh.number} sh={sh} order={orderNumber} total={total} />)}

      <Page size="A4" orientation="landscape" style={s.tPage}>
        <Header title="Таблица подключений" order={orderNumber} sheet={total} total={total} />
        <Text style={s.h2}>Таблица подключений</Text>
        <View style={[s.tr, s.th]} fixed>
          {COLS.map(c => <Text key={c.k} style={[s.td, { width: c.w }]}>{c.title}</Text>)}
        </View>
        {layout.rows.map((r, i) => (
          <View key={i} style={s.tr} wrap={false}>
            <Text style={[s.td, { width: COLS[0].w }]}>{i + 1}</Text>
            <Text style={[s.td, { width: COLS[1].w }]}>{r.sheet}</Text>
            <Text style={[s.td, { width: COLS[2].w }]}>{r.from}</Text>
            <Text style={[s.td, { width: COLS[3].w }]}>{r.port}</Text>
            <Text style={[s.td, { width: COLS[4].w }]}>{r.article}</Text>
            <Text style={[s.td, { width: COLS[5].w }]}>{r.to}</Text>
            <View style={[s.td, { width: COLS[6].w, flexDirection: 'row', alignItems: 'center' }]}>
              <LineSample kind={r.kind} /><Text style={{ marginLeft: 3, flex: 1 }}>{r.cable}</Text>
            </View>
          </View>
        ))}

        {model.unconnected.length ? (
          <View wrap={false}>
            <Text style={s.h2}>Не подключено, добавлено вручную</Text>
            {model.unconnected.map((u, i) => (
              <View key={i} style={s.tip}><Text>• {u.productId} {u.name} × {u.qty}: {u.reason}</Text></View>
            ))}
          </View>
        ) : null}

        <View wrap={false}>
          <Text style={s.h2}>Обозначения</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
            {KIND_ORDER.map(k => (
              <View key={k} style={[s.legendItem, { width: '33%' }]}><LineSample kind={k} /><Text style={s.legendText}>{LINE_STYLE[k].name}</Text></View>
            ))}
          </View>
        </View>

        <View wrap={false}>
          <Text style={s.h2}>Рекомендации по монтажу</Text>
          {[...MOUNTING_TIPS, ...model.notes].map((t, i) => <View key={i} style={s.tip}><Text>• {t}</Text></View>)}
          <Text style={[s.small, { marginTop: 6 }]}>
            Схема составлена автоматическим конфигуратором на сайте ectoControl.ru по выбранному комплекту и носит рекомендательный характер. Перед монтажом сверьтесь с паспортами устройств и проконсультируйтесь с инженерами ectoControl.
          </Text>
        </View>
      </Page>
    </Document>
  );
};
