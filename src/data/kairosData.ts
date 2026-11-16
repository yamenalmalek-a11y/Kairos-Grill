export type MenuCategoryId = 'all' | 'grill' | 'bakery' | 'torten' | 'catering';

export interface KairosDish {
  id: string;
  category: Exclude<MenuCategoryId, 'all'>;
  nameDe: string;
  nameAr: string;
  descDe: string;
  descAr: string;
  price: number;
  unitDe: string;
  unitAr: string;
  image: string;
  cropPosition: string;
  cropScale?: number;
  highlightDe?: string;
  highlightAr?: string;
}

export const KAIROS_INFO = {
  brandName: 'Kairos Grill',
  taglineDe: 'Echt. Frisch. 100% Hausgemacht.',
  taglineAr: 'أصالة النكهة الشرقية · طازج ومُحضّر منزلياً ١٠٠٪',
  phoneDisplay: '017656963431',
  whatsappInternational: '4917656963431',
  address: 'Schiffbauerring 59, 18109 Rostock',
  hoursWeekdayDe: 'Montag – Freitag: 11:00 – 21:45 Uhr',
  hoursWeekdayAr: 'الإثنين – الجمعة: 11:00 – 21:45',
  hoursWeekendDe: 'Samstag & Sonntag: 12:00 – 21:45 Uhr',
  hoursWeekendAr: 'السبت والأحد: 12:00 – 21:45',
  deliveryFee: 2.0,
  freeDeliveryThreshold: 25.0,
  minOrder: 10.0,
  defaultPaymentLink: '', // Can be set anytime in Payment Link Settings or hardcoded here later
};

export const KAIROS_ASSETS = {
  logoBanner: '/assets/aistudio/Screenshot_________-_______17d68f8c.png',
  contactCard: '/assets/aistudio/Screenshot_________-_______bc0a979d.png',
  collageGrill: '/assets/aistudio/Screenshot_________-_______38f90f4a.png',
  cateringHero: '/assets/aistudio/Screenshot_________-_______28c6755e.png',
  buffetInterior: '/assets/aistudio/Screenshot_________-_______3377619f.png',
};

export const MENU_CATEGORIES: Array<{
  id: MenuCategoryId;
  labelDe: string;
  labelAr: string;
}> = [
  { id: 'all', labelDe: 'Alle Spezialitäten', labelAr: 'كل الأصناف' },
  { id: 'grill', labelDe: 'Grill & Orient', labelAr: 'المشاوي والأطباق' },
  { id: 'bakery', labelDe: 'Manakish & Pide', labelAr: 'مناقيش وفطائر' },
  { id: 'torten', labelDe: 'Torten & Desserts', labelAr: 'تورتات وحلويات' },
  { id: 'catering', labelDe: 'Catering & Feiern', labelAr: 'بوفيه ومناسبات' },
];

export const KAIROS_MENU: KairosDish[] = [
  {
    id: 'shish-tawook',
    category: 'grill',
    nameDe: 'Shish Tawook Teller',
    nameAr: 'وجبة شيش طاووق',
    descDe:
      'Zarte Hähnchenstücke, mariniert in orientalischen Gewürzen, serviert mit duftendem Reis, gegrilltem Gemüse & frischen Kräutern.',
    descAr:
      'قطع دجاج طرية متبلة بالبهارات الشرقية ومشوية بإتقان، تُقدّم مع الأرز المعطّر والخضار المشوية والأعشاب الطازجة.',
    price: 11.5,
    unitDe: 'Portion',
    unitAr: 'وجبة كاملة',
    image: '/assets/aistudio/Screenshot_________-_______13d642de.png',
    cropPosition: '50% 48%',
    cropScale: 1.48,
    highlightDe: 'Bestseller · Frisch gegrillt',
    highlightAr: 'الأكثر طلباً · مشوي طازج',
  },
  {
    id: 'halloumi-teller',
    category: 'grill',
    nameDe: 'Halloumi & Mezze Grillteller',
    nameAr: 'صحن حلوم ومقبّلات مشوية',
    descDe:
      'Gegrillter Halloumi, cremiger Hummus, knusprige Brotchips, goldene Bratkartoffeln, frischer Salat & Knoblauchdip.',
    descAr:
      'جبنة حلوم مشوية، حمص كريمي، خبز مقرمش، بطاطا مشوية مع الخضار، سلطة طازجة وصلصة ثوم.',
    price: 10.5,
    unitDe: 'Teller',
    unitAr: 'صحن متكامل',
    image: '/assets/aistudio/Screenshot_________-_______80ac7036.png',
    cropPosition: '50% 44%',
    cropScale: 1.5,
    highlightDe: 'Vegetarisch · Hausgemacht',
    highlightAr: 'نباتي · تحضير منزلي',
  },
  {
    id: 'halloumi-sandwich',
    category: 'grill',
    nameDe: 'Halloumi & Grillgemüse Tasche',
    nameAr: 'سندويش حلوم وخضار مشوية',
    descDe:
      'Knuspriges Fladenbrot gefüllt mit gegrilltem Halloumi, frischem Rucola, Tomaten & aromatischem Grillgemüse.',
    descAr:
      'خبز محمص محشو بجبنة الحلوم المشوية، الجرجير الطازج، الطماطم والخضار المشوية.',
    price: 7.5,
    unitDe: 'Stück',
    unitAr: 'سندويش',
    image: '/assets/aistudio/Screenshot_________-_______d6ed99cc.png',
    cropPosition: '50% 44%',
    cropScale: 1.5,
  },
  {
    id: 'manakish-box',
    category: 'bakery',
    nameDe: 'Hausgemachte Manakish & Fatayer Box',
    nameAr: 'صينية مناقيش وفطائر مشكلة',
    descDe:
      'Gemischte Platte mit Zaatar, würziger Muhammara, Hackfleisch-Sfiha, Pinienkernen & Käse-Sucuk – frisch gebacken.',
    descAr:
      'تشكيلة فاخرة من مناقيش الزعتر، المحمرة، صفيحة اللحم بالصنوبر وفطائر الجبنة والسجق المخبوزة طازجاً.',
    price: 16.0,
    unitDe: 'Box (12 Stück)',
    unitAr: 'بوكس (١٢ قطعة)',
    image: '/assets/aistudio/Screenshot_________-_______d6897e7a.png',
    cropPosition: '50% 52%',
    cropScale: 1.5,
    highlightDe: 'Zum Teilen · Ofenfrisch',
    highlightAr: 'للمشاركة · طازج من الفرن',
  },
  {
    id: 'steinofen-pide',
    category: 'bakery',
    nameDe: 'Leckere Steinofen Pide',
    nameAr: 'بيدا مخبوزة بالفرن الحجري',
    descDe:
      'Goldbraun gebackene Pide aus hauseigenem Teig mit würziger Füllung, schwarzen Oliven & geschmolzenem Käse.',
    descAr:
      'فطيرة بيدا ذهبية بعجينة منزلية طرية مع الحشوة المتبّلة والزيتون الأسود والجبن الذائب.',
    price: 9.5,
    unitDe: 'Stück',
    unitAr: 'قطعة',
    image: '/assets/aistudio/Screenshot_________-_______eaf0c098.png',
    cropPosition: '50% 43%',
    cropScale: 1.5,
  },
  {
    id: 'schoko-kirsch-torte',
    category: 'torten',
    nameDe: 'Schoko-Kirsch-Torte',
    nameAr: 'تورتة الشوكولاتة والكرز',
    descDe:
      '100% hausgemacht mit feinster Schokoladencreme, fruchtiger Kirschfüllung und lockerem Biskuitboden.',
    descAr:
      'مُحضّرة منزلياً ١٠٠٪ بكريمة الشوكولاتة الفاخرة وحشوة الكرز الطازج على طبقة كيك إسفنجي.',
    price: 4.0,
    unitDe: 'Stück',
    unitAr: 'قطعة',
    image: '/assets/aistudio/Screenshot_________-_______562cdf9c.png',
    cropPosition: '50% 44%',
    cropScale: 1.55,
    highlightDe: '4,00 € · 100% Hausgemacht',
    highlightAr: '4,00 € · تحضير منزلي',
  },
  {
    id: 'schwarzwaelder-kirsch',
    category: 'torten',
    nameDe: 'Schwarzwälder Kirsch Torte',
    nameAr: 'تورتة الغابة السوداء بالكرز',
    descDe:
      'Saftiger Schokoladenbiskuit, süße Kirschen, leichte Sahne und feine Schokoladenraspeln – ein Genussmoment.',
    descAr:
      'كيك الشوكولاتة الهش مع الكرز، الكريمة الطازجة وبرادة الشوكولاتة الفاخرة.',
    price: 3.5,
    unitDe: 'Stück',
    unitAr: 'قطعة',
    image: '/assets/aistudio/Screenshot_________-_______80ab5a6a.png',
    cropPosition: '50% 33%',
    cropScale: 1.65,
    highlightDe: '3,50 € · Klassiker',
    highlightAr: '3,50 € · كلاسيك',
  },
  {
    id: 'mango-kokos-cheesecake',
    category: 'torten',
    nameDe: 'Mango Kokos Cheesecake',
    nameAr: 'تشيز كيك المانجو وجوز الهند',
    descDe:
      'Fruchtig, cremig, einfach lecker: samtiger Cheesecake mit exotischer Mango-Glasur und Kokosraspeln.',
    descAr:
      'كريمي وغني بنكهة الفواكه: تشيز كيك ناعم مع طبقة المانجو الاستوائية وجوز الهند المبشور.',
    price: 3.5,
    unitDe: 'Stück',
    unitAr: 'قطعة',
    image: '/assets/aistudio/Screenshot_________-_______2aed21d1.png',
    cropPosition: '50% 46%',
    cropScale: 1.55,
    highlightDe: 'Nur 3,50 € · Fruchtig',
    highlightAr: 'فقط 3,50 € · فاكهي ومنعش',
  },
  {
    id: 'strawberry-cheesecake',
    category: 'torten',
    nameDe: 'Strawberry Cheesecake',
    nameAr: 'تشيز كيك الفراولة',
    descDe:
      'Samtige Cheesecake-Creme, fruchtige Erdbeeren mit Schokoglasur und ein knuspriger Boden.',
    descAr:
      'كريمة تشيز كيك مخملية مع صوص الفراولة الغني وحبات الفراولة المغطاة بالشوكولاتة.',
    price: 4.0,
    unitDe: 'Stück',
    unitAr: 'قطعة',
    image: '/assets/aistudio/Screenshot_________-_______64fd5813.png',
    cropPosition: '50% 42%',
    cropScale: 1.55,
    highlightDe: 'Handgemacht mit Liebe',
    highlightAr: 'مصنوعة يدوياً بحب',
  },
  {
    id: 'buttermilch-cupcakes',
    category: 'torten',
    nameDe: 'Buttermilch Cupcakes',
    nameAr: 'كب كيك بالماسكاربوني',
    descDe:
      'Besonders saftige Buttermilch-Cupcakes gekrönt mit feinem Mascarpone Frosting und Schokostreuseln.',
    descAr:
      'كب كيك طري ولذيذ مُزيّن بكريمة الماسكاربوني الفاخرة ورشّات الشوكولاتة.',
    price: 3.0,
    unitDe: 'Stück',
    unitAr: 'قطعة',
    image: '/assets/aistudio/Screenshot_________-_______93362a74.png',
    cropPosition: '50% 54%',
    cropScale: 1.45,
    highlightDe: '3,00 € · Mascarpone Frosting',
    highlightAr: '3,00 € · كريمة ماسكاربوني',
  },
  {
    id: 'catering-party-platte',
    category: 'catering',
    nameDe: 'Kairos Catering Festplatte (10 Pers.)',
    nameAr: 'باقة ضيافة وحفلات كايروس (١٠ أشخاص)',
    descDe:
      'Hausgemachte Kibbeh, frischer Taboulé-Salat, leckere Pide, Grillspieße & Mini-Manakish für Geburtstag, Hochzeit & Familienfeier.',
    descAr:
      'كبة مقرمشة، تبولة طازجة، بيدا، أسياخ مشاوي وميني مناقيش لأعياد الميلاد والأعراس والاجتماعات العائلية.',
    price: 69.0,
    unitDe: 'Platte',
    unitAr: 'بوفيه متكامل',
    image: '/assets/aistudio/Screenshot_________-_______28c6755e.png',
    cropPosition: '50% 43%',
    cropScale: 1.55,
    highlightDe: 'Geburtstag · Hochzeit · Feier',
    highlightAr: 'أعياد ميلاد · أعراس · مناسبات',
  },
  {
    id: 'buffet-dessert-table',
    category: 'catering',
    nameDe: 'Dessert- & Fingerfood Buffet (20 Pers.)',
    nameAr: 'طاولة حلويات ومقبلات للمناسبات (٢٠ شخص)',
    descDe:
      'Komplett arrangiertes Buffet mit Tiramisu, Torten, Mini-Gebäck & warmen Vorspeisen für Ihre Veranstaltung in Rostock.',
    descAr:
      'بوفيه منسّق بالكامل يضم التورتات، الحلويات المنزلية والفطائر لضيوفكم في روستوك.',
    price: 120.0,
    unitDe: 'Paket',
    unitAr: 'باقة كاملة',
    image: '/assets/aistudio/Screenshot_________-_______3377619f.png',
    cropPosition: '50% 43%',
    cropScale: 1.5,
  },
];

export function formatEuro(amount: number): string {
  return `${amount.toFixed(2).replace('.', ',')} €`;
}

export interface WhatsAppOrderPayload {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  orderMode: 'delivery' | 'pickup';
  address: string;
  gpsCoords?: { lat: number; lng: number } | null;
  paymentMethod: 'cash' | 'payment_link';
  paymentLink?: string;
  notes?: string;
  items: Array<{ dish: KairosDish; quantity: number }>;
  subtotal: number;
  deliveryFee: number;
  total: number;
  lang: 'ar' | 'de';
}

export function buildWhatsAppOrderText(payload: WhatsAppOrderPayload): string {
  const itemLines = payload.items
    .map(
      ({ dish, quantity }) =>
        `• ${quantity}x ${dish.nameDe} (${dish.nameAr}) — ${formatEuro(dish.price * quantity)}`
    )
    .join('\n');

  const locationLine =
    payload.orderMode === 'pickup'
      ? `Abholung im Restaurant (${KAIROS_INFO.address})`
      : payload.address;

  const mapsLine = payload.gpsCoords
    ? `\n📍 GPS Standort: https://maps.google.com/?q=${payload.gpsCoords.lat.toFixed(6)},${payload.gpsCoords.lng.toFixed(6)}`
    : '';

  const paymentMethodLabel =
    payload.paymentMethod === 'payment_link'
      ? 'Online per Zahlungslink (الدفع عبر الرابط)'
      : 'Barzahlung bei Lieferung / Abholung (الدفع عند الاستلام)';

  const paymentLinkLine =
    payload.paymentLink && payload.paymentLink.trim()
      ? `\n💳 رابط الدفع / Zahlungslink:\n${payload.paymentLink.trim()}`
      : payload.paymentMethod === 'payment_link'
        ? '\n💳 رابط الدفع / Zahlungslink: (يرجى إرسال رابط الدفع للعميل)'
        : '';

  const notesLine = payload.notes?.trim() ? `\n📝 ملاحظات / Hinweise: ${payload.notes.trim()}` : '';

  return [
    `🍽️ *طلب جديد — Kairos Grill (${payload.orderNumber})*`,
    `━━━━━━━━━━━━━━━━━━━━`,
    `👤 *الاسم / Name:* ${payload.customerName}`,
    `📞 *الهاتف / Telefon:* ${payload.customerPhone}`,
    `📍 *الموقع / Adresse:* ${locationLine}${mapsLine}`,
    ``,
    `🛒 *الطلب / Bestellung:*`,
    itemLines,
    ``,
    `Subtotal: ${formatEuro(payload.subtotal)}`,
    `Liefergebühr: ${payload.deliveryFee === 0 ? 'Kostenlos (0,00 €)' : formatEuro(payload.deliveryFee)}`,
    `💰 *الإجمالي / Gesamtbetrag: ${formatEuro(payload.total)}*`,
    ``,
    `💳 *طريقة الدفع / Zahlung:* ${paymentMethodLabel}${paymentLinkLine}${notesLine}`,
  ].join('\n');
}

export function buildWhatsAppUrl(message: string): string {
  return `https://wa.me/${KAIROS_INFO.whatsappInternational}?text=${encodeURIComponent(message)}`;
}
