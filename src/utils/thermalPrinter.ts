import { KAIROS_INFO, formatEuro } from '@/src/data/kairosData';
import { OrderRecord } from '@/src/services/kairosFirebase';

export type ReceiptPaperWidth = '58mm' | '80mm';

const CP858_MAP: Record<string, number> = {
  ä: 0x84,
  ö: 0x94,
  ü: 0x81,
  Ä: 0x8e,
  Ö: 0x99,
  Ü: 0x9a,
  ß: 0xe1,
  '€': 0xd5,
  '°': 0xf8,
  '·': 0xfa,
  '–': 0x2d,
  '—': 0x2d,
  '×': 0x78,
};

function encodeCp858(text: string): number[] {
  const bytes: number[] = [];
  for (const ch of text) {
    if (ch in CP858_MAP) {
      bytes.push(CP858_MAP[ch]);
      continue;
    }
    const code = ch.charCodeAt(0);
    if (code >= 0x0a && code <= 0x7e) {
      bytes.push(code);
    } else if (code === 0x0d) {
      bytes.push(0x0d);
    } else {
      // Non-CP858 glyph fallback so thermal printer never prints corrupted symbols
      bytes.push(0x20);
    }
  }
  return bytes;
}

function padColumns(left: string, right: string, totalCols: number): string {
  const cleanLeft = left.replace(/\s+/g, ' ').trim();
  const cleanRight = right.trim();
  const maxLeft = Math.max(8, totalCols - cleanRight.length - 1);
  if (cleanLeft.length <= maxLeft) {
    const spaces = Math.max(1, totalCols - cleanLeft.length - cleanRight.length);
    return `${cleanLeft}${' '.repeat(spaces)}${cleanRight}`;
  }
  // Wrap first part onto first line, remainder + right price on second line
  const firstLine = cleanLeft.slice(0, totalCols);
  const rest = `  ${cleanLeft.slice(totalCols).trim()}`;
  const restTrunc = rest.slice(0, maxLeft);
  const spaces = Math.max(1, totalCols - restTrunc.length - cleanRight.length);
  return `${firstLine}\n${restTrunc}${' '.repeat(spaces)}${cleanRight}`;
}

export function getReceiptOrderDate(order: OrderRecord): string {
  const dateObj = order.createdAt?.toDate ? order.createdAt.toDate() : new Date();
  return dateObj.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getReceiptQrTarget(order: OrderRecord): string {
  if (order.orderMode === 'delivery') {
    if (order.gpsText && order.gpsText.trim().length > 0) {
      return `https://maps.google.com/?q=${encodeURIComponent(order.gpsText.trim())}`;
    }
    if (order.address) {
      return `https://maps.google.com/?q=${encodeURIComponent(`${order.address}, Rostock`)}`;
    }
  }
  const phoneDigits = order.customerPhone.replace(/[^\d]/g, '');
  if (phoneDigits) {
    return `tel:${order.customerPhone}`;
  }
  return `https://maps.google.com/?q=${encodeURIComponent('Kairos Grill, Schiffbauerring 59, 18109 Rostock')}`;
}

export function buildThermalReceiptText(
  order: OrderRecord,
  paperWidth: ReceiptPaperWidth = '58mm'
): string {
  const cols = paperWidth === '58mm' ? 32 : 46;
  const line = '-'.repeat(cols);
  const dblLine = '='.repeat(cols);
  const isPaid = order.paymentMethod === 'payment_link';
  const payBadge = isPaid ? 'BEZAHLT (ONLINE)' : 'BARZAHLUNG BEI ERHALT';
  const modeBadge =
    order.orderMode === 'pickup' ? 'ABHOLUNG IM RESTAURANT' : 'LIEFERUNG';

  const out: string[] = [
    KAIROS_INFO.brandName.toUpperCase(),
    KAIROS_INFO.address,
    `Tel: ${KAIROS_INFO.phoneDisplay}`,
    dblLine,
    `BESTELLUNG #${order.orderNumber}`,
    `Datum: ${getReceiptOrderDate(order)}`,
    `Typ:   ${modeBadge}`,
    `Zahl.: ${payBadge}`,
    line,
    `Kunde: ${order.customerName}`,
    `Tel:   ${order.customerPhone}`,
    `Adr:   ${order.address}`,
    line,
  ];

  for (const item of order.items) {
    const label = `${item.qty}x ${item.itemNumber ? `#${item.itemNumber} ` : ''}${item.nameDe}`;
    const price = formatEuro(item.unitPrice * item.qty);
    out.push(padColumns(label, price, cols));
    if (item.variantLabel) {
      out.push(`   (${item.variantLabel})`);
    }
  }

  if (order.notes && order.notes.trim().length > 0) {
    out.push(line);
    out.push(`HINWEIS: ${order.notes.trim()}`);
  }

  out.push(line);
  out.push(padColumns('Zwischensumme (Netto)', formatEuro(order.subtotal), cols));
  if (order.foodTax > 0) {
    out.push(padColumns('MwSt 7% (Speisen)', `+${formatEuro(order.foodTax)}`, cols));
  }
  if (order.drinksTax > 0) {
    out.push(padColumns('MwSt 19% (Getränke)', `+${formatEuro(order.drinksTax)}`, cols));
  }
  out.push(padColumns('Liefergebühr', formatEuro(order.deliveryFee), cols));
  out.push(dblLine);
  out.push(padColumns('GESAMT', formatEuro(order.total), cols));
  out.push(dblLine);
  out.push('Vielen Dank für Ihre Bestellung!');
  out.push(`${KAIROS_INFO.brandName} · Rostock`);

  return out.join('\n');
}

export function buildRawBtEscPosUri(
  order: OrderRecord,
  paperWidth: ReceiptPaperWidth = '58mm'
): string {
  const cols = paperWidth === '58mm' ? 32 : 46;
  const line = `${'-'.repeat(cols)}\n`;
  const dblLine = `${'='.repeat(cols)}\n`;
  const isPaid = order.paymentMethod === 'payment_link';
  const payText = isPaid ? 'BEZAHLT (ONLINE)' : 'BARZAHLUNG';
  const modeText = order.orderMode === 'pickup' ? 'ABHOLUNG' : 'LIEFERUNG';

  const bytes: number[] = [];
  const pushRaw = (...vals: number[]) => bytes.push(...vals);
  const pushText = (txt: string) => bytes.push(...encodeCp858(txt));

  // ESC @ (Init), ESC t 19 (CP858 West European / € umlauts)
  pushRaw(0x1b, 0x40, 0x1b, 0x74, 0x13);

  // Center & Double Size Title: KAIROS GRILL
  pushRaw(0x1b, 0x61, 0x01, 0x1b, 0x45, 0x01, 0x1d, 0x21, 0x11);
  pushText('KAIROS GRILL\n');
  pushRaw(0x1d, 0x21, 0x00, 0x1b, 0x45, 0x00);
  pushText(`${KAIROS_INFO.address}\n`);
  pushText(`Tel: ${KAIROS_INFO.phoneDisplay}\n`);
  pushText(dblLine);

  // Order Number & Status Inverted Bar (like Sunmi delivery bon)
  pushRaw(0x1b, 0x45, 0x01, 0x1d, 0x21, 0x11);
  pushText(`#${order.orderNumber}\n`);
  pushRaw(0x1d, 0x21, 0x00);
  pushText(`${getReceiptOrderDate(order)}\n\n`);

  // Reverse black/white highlight bar: GS B 1
  pushRaw(0x1d, 0x42, 0x01);
  pushText(`  ${payText} · ${modeText}  \n`);
  pushRaw(0x1d, 0x42, 0x00, 0x1b, 0x45, 0x00);

  // Switch back to left-aligned customer & item block
  pushRaw(0x1b, 0x61, 0x00);
  pushText(line);
  pushRaw(0x1b, 0x45, 0x01);
  pushText(`${order.customerName}\n`);
  pushRaw(0x1b, 0x45, 0x00);
  pushText(`Tel: ${order.customerPhone}\n`);
  pushText(`${order.address}\n`);
  pushText(line);

  // Items
  for (const item of order.items) {
    const left = `${item.qty}x ${item.itemNumber ? `#${item.itemNumber} ` : ''}${item.nameDe}`;
    const right = formatEuro(item.unitPrice * item.qty);
    pushRaw(0x1b, 0x45, 0x01);
    pushText(`${padColumns(left, right, cols)}\n`);
    pushRaw(0x1b, 0x45, 0x00);
    if (item.variantLabel) {
      pushText(`   (${item.variantLabel})\n`);
    }
  }

  if (order.notes && order.notes.trim().length > 0) {
    pushText(line);
    pushRaw(0x1b, 0x45, 0x01);
    pushText(`HINWEIS: ${order.notes.trim()}\n`);
    pushRaw(0x1b, 0x45, 0x00);
  }

  // Totals
  pushText(line);
  pushText(`${padColumns('Netto', formatEuro(order.subtotal), cols)}\n`);
  if (order.foodTax > 0) {
    pushText(`${padColumns('MwSt 7%', `+${formatEuro(order.foodTax)}`, cols)}\n`);
  }
  if (order.drinksTax > 0) {
    pushText(`${padColumns('MwSt 19%', `+${formatEuro(order.drinksTax)}`, cols)}\n`);
  }
  pushText(`${padColumns('Lieferung', formatEuro(order.deliveryFee), cols)}\n`);
  pushText(dblLine);

  // Large bold GESAMT
  pushRaw(0x1b, 0x45, 0x01, 0x1d, 0x21, 0x01);
  pushText(`${padColumns('GESAMT', formatEuro(order.total), cols)}\n`);
  pushRaw(0x1d, 0x21, 0x00, 0x1b, 0x45, 0x00);
  pushText(dblLine);

  // Footer centered + Feed & Cut
  pushRaw(0x1b, 0x61, 0x01);
  pushText('Vielen Dank für Ihre Bestellung!\n');
  pushText('Kairos Grill · Rostock\n\n\n\n');
  // GS V 66 0 (partial cut / feed if cutter exists)
  pushRaw(0x1d, 0x56, 0x42, 0x00);

  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return `rawbt:base64,${base64}`;
}
