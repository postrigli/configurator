import React, { useMemo } from 'react';
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer';
import { CartItem } from '../types';
import { OPTIONAL_ITEMS } from '../constants';

// Register Cyrillic fonts with a dynamic fallback mechanism:
// We prioritize loading from the local server,
// but fall back to cdnjs (Cloudflare) if the local server is unreachable.
const registerFonts = async () => {
  const regularPrimary = '/download/images_resized/fonts/Roboto-Regular.ttf';
  const regularFallback = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Regular.ttf';
  const mediumPrimary = '/download/images_resized/fonts/Roboto-Medium.ttf';
  const mediumFallback = 'https://cdnjs.cloudflare.com/ajax/libs/pdfmake/0.2.7/fonts/Roboto/Roboto-Medium.ttf';

  let regularSrc = regularPrimary;
  let mediumSrc = mediumPrimary;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2 seconds timeout for check
    const res = await fetch(regularPrimary, { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeoutId);
    if (!res.ok) {
      regularSrc = regularFallback;
      mediumSrc = mediumFallback;
    }
  } catch (e) {
    console.warn('ectoControl local font file is unavailable, falling back to CDN:', e);
    regularSrc = regularFallback;
    mediumSrc = mediumFallback;
  }

  Font.register({
    family: 'Roboto',
    fonts: [
      { src: regularSrc, fontWeight: 'normal' },
      { src: mediumSrc, fontWeight: 'bold' }
    ]
  });
};

registerFonts();

const styles = StyleSheet.create({
  page: { padding: 30, fontFamily: 'Roboto', fontSize: 10, color: '#51555c' },
  header: { flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 2, borderBottomColor: '#fbba00', paddingBottom: 10, marginBottom: 20 },
  logo: { height: 35, width: 'auto', objectFit: 'contain', marginBottom: 5, alignSelf: 'flex-start' },
  headerTitle: { fontSize: 11, fontWeight: 'bold', color: '#4b5563' },
  headerRight: { textAlign: 'right', alignItems: 'flex-end' },
  orderNumber: { fontSize: 16, fontWeight: 'bold', color: '#374151', marginBottom: 2, textAlign: 'right' },
  date: { fontSize: 9, color: '#6b7280', textAlign: 'right', alignSelf: 'flex-end' },
  table: { width: '100%', borderStyle: 'solid', borderWidth: 1, borderColor: '#d1d5db', marginBottom: 15 },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#d1d5db', alignItems: 'stretch', minHeight: 25 },
  tableHeader: { backgroundColor: '#fff6e0', fontWeight: 'bold', minHeight: 30 },
  col1: { width: '4%', padding: 5, textAlign: 'center', borderRightWidth: 1, borderRightColor: '#d1d5db', justifyContent: 'center' },
  col2: { width: '12%', padding: 5, textAlign: 'center', borderRightWidth: 1, borderRightColor: '#d1d5db', justifyContent: 'center' },
  col3: { width: '10%', padding: 5, textAlign: 'center', borderRightWidth: 1, borderRightColor: '#d1d5db', justifyContent: 'center' },
  col4: { width: '40%', padding: 5, borderRightWidth: 1, borderRightColor: '#d1d5db', justifyContent: 'center' },
  col5: { width: '8%', padding: 5, textAlign: 'center', borderRightWidth: 1, borderRightColor: '#d1d5db', justifyContent: 'center' },
  col6: { width: '12%', padding: 5, textAlign: 'right', borderRightWidth: 1, borderRightColor: '#d1d5db', justifyContent: 'center' },
  col7: { width: '14%', padding: 5, textAlign: 'right', justifyContent: 'center' },
  itemImage: { width: 35, height: 35, objectFit: 'contain', marginHorizontal: 'auto' },
  itemName: { fontWeight: 'bold', fontSize: 10 },
  itemTag: { color: '#9ca3af', fontSize: 8, marginTop: 1 },
  totalsRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#d1d5db', minHeight: 40, alignItems: 'center' },
  totalsLabel: { width: '80%', textAlign: 'right', fontWeight: 'bold', fontSize: 14, paddingRight: 15, color: '#374151' },
  totalsValue: { width: '20%', textAlign: 'right', fontWeight: 'bold', fontSize: 14, paddingRight: 10, color: '#374151' },
  modulesRow: { flexDirection: 'row', padding: 8, justifyContent: 'center', alignItems: 'center' },
  modulesText: { fontSize: 10, fontWeight: 'bold', color: '#4b5563' },
  footerContainer: { marginTop: 10 },
  footerInfo: { borderWidth: 1, borderColor: '#fbba00', padding: 12, textAlign: 'center', fontSize: 10, fontWeight: 'bold', borderRadius: 4, marginBottom: 20, color: '#374151' },
  qrSection: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  qrItem: { alignItems: 'center', width: 100 },
  qrImage: { width: 70, height: 70, marginBottom: 5 },
  qrText: { fontSize: 9, fontWeight: 'bold', color: '#4b5563' },
  bottomLogoContainer: { position: 'absolute', bottom: 30, left: 0, right: 0, alignItems: 'center', zIndex: -1 },
  bottomLogo: { height: 30, opacity: 0.15 }
});

interface PrintLayoutProps {
  items: CartItem[];
  customOrderNumber?: string;
}

export const PrintLayout: React.FC<PrintLayoutProps> = ({ items, customOrderNumber }) => {
  const totalPrice = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalModules = items.reduce((sum, item) => sum + (item.dinModules ? item.dinModules * item.quantity : 0), 0);
  
  const randomOrderNumber = useMemo(() => Math.floor(Math.random() * 9000) + 1000, []);
  const orderNumber = customOrderNumber && customOrderNumber.trim() !== '' ? customOrderNumber : randomOrderNumber;

  // Use local PNG logo directly to avoid third-party image proxy dependencies
  const logoUrl = '/download/images_resized/ectoControl-logo_color_708x190.png';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Image src={logoUrl} style={styles.logo} />
            <Text style={styles.headerTitle}>Делаем сложные вещи простыми</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={styles.orderNumber}>Комплект оборудования № {orderNumber}</Text>
            <Text style={styles.date}>{new Date().toLocaleDateString()}</Text>
          </View>
        </View>

        {/* Table */}
        <View style={styles.table}>
          <View style={[styles.tableRow, styles.tableHeader]}>
            <View style={styles.col1}><Text>№</Text></View>
            <View style={styles.col2}><Text>Артикул</Text></View>
            <View style={styles.col3}><Text>Фото</Text></View>
            <View style={styles.col4}><Text>Наименование оборудования</Text></View>
            <View style={styles.col5}><Text>Кол-во</Text></View>
            <View style={styles.col6}><Text>Цена/ед.</Text></View>
            <View style={styles.col7}><Text>Стоимость</Text></View>
          </View>
          
          {items.map((item, idx) => (
            <View style={styles.tableRow} key={idx}>
              <View style={styles.col1}><Text>{idx + 1}</Text></View>
              <View style={styles.col2}><Text style={{ color: '#4b5563' }}>{item.id}</Text></View>
              <View style={styles.col3}>
                 {item.image && <Image src={item.image} style={styles.itemImage} />}
              </View>
              <View style={styles.col4}>
                 <Text style={styles.itemName}>{item.name}</Text>
                 {OPTIONAL_ITEMS.includes(item.id) && <Text style={styles.itemTag}>(рекомендуется)</Text>}
                 {item.isManual && <Text style={styles.itemTag}>+ добавлено вручную</Text>}
              </View>
              <View style={styles.col5}><Text>{item.quantity}</Text></View>
              <View style={styles.col6}><Text>{item.price.toLocaleString('ru-RU')}</Text></View>
              <View style={styles.col7}><Text style={{ fontWeight: 'bold' }}>{(item.price * item.quantity).toLocaleString('ru-RU')} ₽</Text></View>
            </View>
          ))}

          {/* Totals */}
          <View style={styles.totalsRow}>
             <Text style={styles.totalsLabel}>Стоимость комплекта оборудования*:</Text>
             <Text style={styles.totalsValue}>{totalPrice.toLocaleString('ru-RU')} ₽</Text>
          </View>
          <View style={styles.modulesRow}>
             <Text style={styles.modulesText}>
               Ориентировочное количество занимаемых модулей на DIN-рейке*: {Math.ceil(totalModules)}
             </Text>
          </View>
        </View>

        {/* Footer Section (prevent wrapping) */}
        <View style={styles.footerContainer} wrap={false}>
          {/* Footer Info */}
          <View style={styles.footerInfo}>
            <Text>*Данный комплект составлен автоматическим конфигуратором на сайте ectoControl.ru. Перед покупкой оборудования проконсультируйтесь с менеджером отдела продаж или инженерами монтажа.</Text>
          </View>

          {/* Footer QR */}
          <View style={styles.qrSection}>
             <View style={styles.qrItem}>
                <Image src="/download/images_resized/ectoControl_qr.png" style={styles.qrImage} />
                <Text style={styles.qrText}>ectocontrol.ru</Text>
             </View>
             
             <View style={styles.qrItem}>
                <Image src="/download/images_resized/rutube_qr.png" style={styles.qrImage} />
                <Text style={styles.qrText}>RuTube</Text>
             </View>
          </View>
        </View>

        {/* Background Logo */}
        <View style={styles.bottomLogoContainer}>
          <Image src={logoUrl} style={styles.bottomLogo} />
        </View>
      </Page>
    </Document>
  );
};
