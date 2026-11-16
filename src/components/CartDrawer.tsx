import { FormEvent, useRef, useState } from 'react';
import {
  X,
  Plus,
  Minus,
  Trash2,
  MapPin,
  LocateFixed,
  MessageCircle,
  Copy,
  Check,
  CreditCard,
  ExternalLink,
  ShoppingBag,
  Receipt,
} from 'lucide-react';
import {
  KAIROS_INFO,
  KairosDish,
  buildWhatsAppOrderText,
  buildWhatsAppUrl,
  formatEuro,
} from '@/src/data/kairosData';
import { CroppedPhoto } from '@/src/components/CroppedPhoto';

export interface CartEntry {
  dish: KairosDish;
  quantity: number;
}

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartEntry[];
  onUpdateQty: (dishId: string, delta: number) => void;
  onClearCart: () => void;
  lang: 'ar' | 'de';
}

const ROSTOCK_AREAS = [
  'Groß Klein, 18109 Rostock',
  'Lütten Klein, 18107 Rostock',
  'Lichtenhagen, 18109 Rostock',
  'Warnemünde, 18119 Rostock',
  'Stadtmitte, 18055 Rostock',
  'KTV, 18057 Rostock',
];

export function CartDrawer({
  isOpen,
  onClose,
  cart,
  onUpdateQty,
  onClearCart,
  lang,
}: CartDrawerProps) {
  const paymentLink = KAIROS_INFO.defaultPaymentLink;
  const addressInputRef = useRef<HTMLInputElement>(null);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderMode, setOrderMode] = useState<'delivery' | 'pickup'>('delivery');
  const [address, setAddress] = useState('');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<{
    tone: 'loading' | 'success' | 'fallback';
    text: string;
  } | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'payment_link'>('cash');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [dispatchedOrder, setDispatchedOrder] = useState<{
    orderNumber: string;
    messageText: string;
    whatsappUrl: string;
    items: CartEntry[];
    subtotal: number;
    deliveryFee: number;
    total: number;
    customerName: string;
    locationLabel: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const subtotal = cart.reduce((sum, item) => sum + item.dish.price * item.quantity, 0);
  const deliveryFee =
    orderMode === 'pickup' || subtotal === 0 || subtotal >= KAIROS_INFO.freeDeliveryThreshold
      ? 0
      : KAIROS_INFO.deliveryFee;
  const total = subtotal + deliveryFee;

  const reverseGeocode = async (lat: number, lng: number) => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=de`,
        { headers: { Accept: 'application/json' } }
      );
      if (!res.ok) return null;
      const data = await res.json();
      const a = data.address;
      if (!a) return null;
      const street = [a.road, a.house_number].filter(Boolean).join(' ');
      const city = [a.postcode, a.city || a.town || a.village || a.suburb].filter(Boolean).join(' ');
      const formatted = [street, city].filter(Boolean).join(', ');
      return formatted || null;
    } catch {
      return null;
    }
  };

  const handleLocateMe = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatus({
        tone: 'fallback',
        text:
          lang === 'ar'
            ? 'اختر منطقتك في روستوك أدناه وأضف اسم الشارع ورقم المنزل.'
            : 'Wählen Sie unten Ihren Stadtteil und ergänzen Sie Straße & Hausnummer.',
      });
      return;
    }

    setGpsStatus({
      tone: 'loading',
      text: lang === 'ar' ? 'جاري تحديد موقعك الحالي…' : 'Standort wird ermittelt…',
    });

    const onGeoSuccess = async (pos: GeolocationPosition) => {
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setGpsCoords(coords);
      const coordFallback = `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`;
      setAddress((prev) => prev.trim() || coordFallback);

      const resolvedStreet = await reverseGeocode(coords.lat, coords.lng);
      if (resolvedStreet) {
        setAddress(resolvedStreet);
      }

      setGpsStatus({
        tone: 'success',
        text:
          lang === 'ar'
            ? 'تم تحديد موقعك وإرفاق رابط خرائط Google بالطلب'
            : 'Standort erkannt & Google Maps Link angehängt',
      });
    };

    const onGeoError = (err: GeolocationPositionError) => {
      // If high-accuracy timed out, try coarse network location once before showing manual picker
      if (err.code === 3) {
        navigator.geolocation.getCurrentPosition(
          onGeoSuccess,
          () => {
            setGpsStatus({
              tone: 'fallback',
              text:
                lang === 'ar'
                  ? 'لم يتمكن المتصفح من تحديد GPS تلقائياً. اختر منطقتك أدناه واكتب اسم الشارع.'
                  : 'Automatische Ortung nicht verfügbar. Bitte Stadtteil unten wählen & Straße eingeben.',
            });
          },
          { enableHighAccuracy: false, timeout: 7000, maximumAge: 120000 }
        );
        return;
      }

      const inIframe = window.self !== window.top;
      setGpsStatus({
        tone: 'fallback',
        text: inIframe
          ? lang === 'ar'
            ? 'نافذة المعاينة تمنع الوصول للـ GPS تلقائياً (يعمل مباشرة بعد تثبيت التطبيق أو فتحه بالمتصفح). اختر الحي أدناه أو اكتب عنوانك.'
            : 'GPS ist im Vorschaufenster blockiert (funktioniert in der installierten App). Stadtteil unten wählen oder Adresse eingeben.'
          : lang === 'ar'
            ? 'يرجى السماح بالوصول للموقع أو اختيار الحي أدناه وكتابة اسم الشارع.'
            : 'Bitte Standortfreigabe erlauben oder Stadtteil unten wählen.',
      });
    };

    navigator.geolocation.getCurrentPosition(onGeoSuccess, onGeoError, {
      enableHighAccuracy: true,
      timeout: 6000,
      maximumAge: 30000,
    });
  };

  const handleSelectArea = (area: string) => {
    setAddress(`${area} — `);
    setGpsStatus(null);
    setTimeout(() => addressInputRef.current?.focus(), 40);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (cart.length === 0) return;
    if (!customerName.trim()) {
      setFormError(lang === 'ar' ? 'يرجى كتابة الاسم' : 'Bitte geben Sie Ihren Namen ein.');
      return;
    }
    if (!customerPhone.trim()) {
      setFormError(
        lang === 'ar' ? 'يرجى إدخال رقم الهاتف للتواصل' : 'Bitte geben Sie Ihre Telefonnummer ein.'
      );
      return;
    }
    if (orderMode === 'delivery' && !address.trim()) {
      setFormError(
        lang === 'ar'
          ? 'يرجى كتابة عنوان التوصيل أو اختيار المنطقة'
          : 'Bitte geben Sie Ihre Lieferadresse ein.'
      );
      return;
    }

    const orderNumber = `KG-${Math.floor(1000 + Math.random() * 8999)}`;
    const messageText = buildWhatsAppOrderText({
      orderNumber,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      orderMode,
      address: address.trim(),
      gpsCoords,
      paymentMethod,
      paymentLink,
      notes,
      items: cart,
      subtotal,
      deliveryFee,
      total,
      lang,
    });
    const whatsappUrl = buildWhatsAppUrl(messageText);

    setDispatchedOrder({
      orderNumber,
      messageText,
      whatsappUrl,
      items: [...cart],
      subtotal,
      deliveryFee,
      total,
      customerName: customerName.trim(),
      locationLabel: orderMode === 'pickup' ? KAIROS_INFO.address : address.trim(),
    });
  };

  const handleCopyMessage = async () => {
    if (!dispatchedOrder) return;
    try {
      await navigator.clipboard.writeText(dispatchedOrder.messageText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const handleNewOrder = () => {
    setDispatchedOrder(null);
    onClearCart();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#242E30]/55 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label={lang === 'ar' ? 'سلة الطلبات' : 'Warenkorb'}
    >
      <div className="w-full max-w-md bg-white h-full flex flex-col shadow-2xl">
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-[#EAE5DF] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[12px] bg-[#FFF3E6] text-[#FF8000] flex items-center justify-center">
              {dispatchedOrder ? (
                <Receipt className="w-4 h-4" strokeWidth={2.2} />
              ) : (
                <ShoppingBag className="w-4 h-4" strokeWidth={2.2} />
              )}
            </div>
            <div>
              <h2 className="font-display text-[17px] font-bold text-[#242E30]">
                {dispatchedOrder
                  ? lang === 'ar'
                    ? `فاتورة الطلب #${dispatchedOrder.orderNumber}`
                    : `Rechnung #${dispatchedOrder.orderNumber}`
                  : lang === 'ar'
                    ? 'سلة الطلبات'
                    : 'Ihr Warenkorb'}
              </h2>
              <p className="text-[12px] text-[#5A6568]">
                Kairos Grill · WhatsApp {KAIROS_INFO.phoneDisplay}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="min-h-[42px] min-w-[42px] rounded-[12px] flex items-center justify-center text-[#5A6568] hover:bg-[#F8F5F2] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Post-Order Confirmation & Detailed Invoice View */}
        {dispatchedOrder ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Detailed Receipt Card */}
            <div className="rounded-[12px] bg-white border border-[#EAE5DF] shadow-xs overflow-hidden">
              <div className="px-4 py-3 bg-[#F8F5F2] border-b border-[#EAE5DF] flex items-center justify-between">
                <span className="font-display text-[13px] font-bold text-[#242E30]">
                  {lang === 'ar' ? 'الفاتورة التفصيلية' : 'Detaillierte Rechnung'}
                </span>
                <span className="text-[12px] font-semibold text-[#FF8000] tabular-nums">
                  #{dispatchedOrder.orderNumber}
                </span>
              </div>

              <div className="px-4 py-2.5 border-b border-[#EAE5DF] text-[12px] text-[#5A6568] space-y-0.5">
                <p>
                  <strong className="text-[#242E30]">{lang === 'ar' ? 'الاسم:' : 'Name:'}</strong>{' '}
                  {dispatchedOrder.customerName}
                </p>
                <p className="truncate">
                  <strong className="text-[#242E30]">{lang === 'ar' ? 'الموقع:' : 'Adresse:'}</strong>{' '}
                  {dispatchedOrder.locationLabel}
                </p>
              </div>

              <div className="divide-y divide-[#EAE5DF]/80 px-4">
                {dispatchedOrder.items.map(({ dish, quantity }) => (
                  <div key={dish.id} className="py-2.5 flex items-start justify-between gap-3 text-[13px]">
                    <div className="min-w-0">
                      <p className="font-semibold text-[#242E30]">
                        {lang === 'ar' ? dish.nameAr : dish.nameDe}
                      </p>
                      <p className="text-[11px] text-[#5A6568] tabular-nums">
                        {quantity} × {formatEuro(dish.price)}
                      </p>
                    </div>
                    <span className="font-bold text-[#242E30] tabular-nums shrink-0">
                      {formatEuro(dish.price * quantity)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="px-4 py-3 bg-[#F8F5F2]/70 border-t border-[#EAE5DF] space-y-1.5 text-[13px]">
                <div className="flex justify-between text-[#5A6568] tabular-nums">
                  <span>{lang === 'ar' ? 'المجموع الفرعي' : 'Zwischensumme'}</span>
                  <span>{formatEuro(dispatchedOrder.subtotal)}</span>
                </div>
                <div className="flex justify-between text-[#5A6568] tabular-nums">
                  <span>{lang === 'ar' ? 'رسوم التوصيل' : 'Liefergebühr'}</span>
                  <span>
                    {dispatchedOrder.deliveryFee === 0
                      ? lang === 'ar'
                        ? 'مجاني (0,00 €)'
                        : 'Kostenlos (0,00 €)'
                      : formatEuro(dispatchedOrder.deliveryFee)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-[#EAE5DF] font-display text-[16px] font-extrabold text-[#242E30] tabular-nums">
                  <span>{lang === 'ar' ? 'المجموع النهائي' : 'Gesamtbetrag'}</span>
                  <span className="text-[#FF8000]">{formatEuro(dispatchedOrder.total)}</span>
                </div>
              </div>
            </div>

            <a
              href={dispatchedOrder.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full h-12 rounded-[12px] bg-[#16A34A] hover:bg-[#15803D] text-white font-display font-bold text-[14px] flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(22,163,74,0.28)] transition-colors"
            >
              <MessageCircle className="w-5 h-5" />
              <span>
                {lang === 'ar'
                  ? `إرسال الفاتورة عبر واتساب (${formatEuro(dispatchedOrder.total)})`
                  : `Rechnung per WhatsApp senden (${formatEuro(dispatchedOrder.total)})`}
              </span>
              <ExternalLink className="w-4 h-4 opacity-80" />
            </a>

            {paymentLink.trim() && (
              <a
                href={paymentLink.trim()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full h-12 rounded-[12px] bg-[#FF8000] hover:bg-[#E67300] text-white font-display font-bold text-[14px] flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(255,128,0,0.28)] transition-colors"
              >
                <CreditCard className="w-5 h-5" />
                <span>
                  {lang === 'ar'
                    ? 'إتمام الدفع الإلكتروني عبر الرابط'
                    : 'Jetzt online bezahlen (Zahlungslink)'}
                </span>
                <ExternalLink className="w-4 h-4 opacity-80" />
              </a>
            )}

            <div className="bg-[#F8F5F2] rounded-[12px] p-3.5 border border-[#EAE5DF]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-bold text-[#242E30]">
                  {lang === 'ar' ? 'معاينة رسالة واتساب:' : 'WhatsApp Nachrichtenvorschau:'}
                </span>
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#FF8000] hover:text-[#E67300]"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>
                    {copied
                      ? lang === 'ar'
                        ? 'تم النسخ'
                        : 'Kopiert'
                      : lang === 'ar'
                        ? 'نسخ'
                        : 'Kopieren'}
                  </span>
                </button>
              </div>
              <pre
                dir="auto"
                className="whitespace-pre-wrap text-[12px] text-[#242E30] font-sans leading-relaxed"
              >
                {dispatchedOrder.messageText}
              </pre>
            </div>

            <div className="pt-1 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDispatchedOrder(null)}
                className="flex-1 h-11 rounded-[12px] bg-[#F8F5F2] hover:bg-[#EAE5DF] text-[#242E30] text-[13px] font-semibold transition-colors"
              >
                {lang === 'ar' ? 'تعديل الطلب' : 'Bearbeiten'}
              </button>
              <button
                type="button"
                onClick={handleNewOrder}
                className="flex-1 h-11 rounded-[12px] bg-[#242E30] hover:bg-[#354245] text-white text-[13px] font-semibold transition-colors"
              >
                {lang === 'ar' ? 'طلب جديد' : 'Fertig & Leeren'}
              </button>
            </div>
          </div>
        ) : cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-14 h-14 rounded-[16px] bg-[#F8F5F2] text-[#FF8000] flex items-center justify-center mb-3">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <p className="font-display text-[16px] font-bold text-[#242E30]">
              {lang === 'ar' ? 'سلتك فارغة حالياً' : 'Ihr Warenkorb ist leer'}
            </p>
            <p className="text-[13px] text-[#5A6568] mt-1 max-w-xs">
              {lang === 'ar'
                ? 'اختر وجباتك المفضلة من المشاوي والمناقيش والتورتات المنزلية لإرسال طلبك عبر واتساب.'
                : 'Wählen Sie frische Grillgerichte, Manakish oder hausgemachte Torten aus unserer Speisekarte.'}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 px-5 py-2.5 rounded-[12px] bg-[#FF8000] hover:bg-[#E67300] text-white text-[13px] font-bold transition-colors"
            >
              {lang === 'ar' ? 'تصفح القائمة' : 'Speisekarte ansehen'}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {/* Items */}
              <div className="divide-y divide-[#EAE5DF]">
                {cart.map(({ dish, quantity }) => (
                  <div key={dish.id} className="py-3 first:pt-0 flex items-center gap-3">
                    <CroppedPhoto
                      src={dish.image}
                      alt={lang === 'ar' ? dish.nameAr : dish.nameDe}
                      cropPosition={dish.cropPosition}
                      cropScale={dish.cropScale}
                      className="w-14 h-14 rounded-[12px] shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-display text-[13px] font-bold text-[#242E30] truncate">
                        {lang === 'ar' ? dish.nameAr : dish.nameDe}
                      </p>
                      <p className="text-[12px] text-[#5A6568] tabular-nums">
                        {formatEuro(dish.price)} × {quantity} ={' '}
                        <strong className="text-[#242E30]">
                          {formatEuro(dish.price * quantity)}
                        </strong>
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onUpdateQty(dish.id, -1)}
                        aria-label="Decrease quantity"
                        className="w-8 h-8 rounded-[10px] bg-[#F8F5F2] hover:bg-[#EAE5DF] text-[#242E30] flex items-center justify-center"
                      >
                        {quantity === 1 ? (
                          <Trash2 className="w-3.5 h-3.5 text-[#5A6568]" />
                        ) : (
                          <Minus className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <span className="w-6 text-center text-[13px] font-bold tabular-nums">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => onUpdateQty(dish.id, 1)}
                        aria-label="Increase quantity"
                        className="w-8 h-8 rounded-[10px] bg-[#FFF3E6] hover:bg-[#FF8000] text-[#FF8000] hover:text-white flex items-center justify-center transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Delivery vs Pickup */}
              <div className="p-1 bg-[#F8F5F2] rounded-[12px] grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setOrderMode('delivery')}
                  className={`py-2 px-3 rounded-[10px] text-[12px] font-bold transition-colors ${
                    orderMode === 'delivery'
                      ? 'bg-white text-[#242E30] shadow-xs'
                      : 'text-[#5A6568]'
                  }`}
                >
                  {lang === 'ar' ? 'توصيل للعنوان' : 'Lieferservice'}
                </button>
                <button
                  type="button"
                  onClick={() => setOrderMode('pickup')}
                  className={`py-2 px-3 rounded-[10px] text-[12px] font-bold transition-colors ${
                    orderMode === 'pickup'
                      ? 'bg-white text-[#242E30] shadow-xs'
                      : 'text-[#5A6568]'
                  }`}
                >
                  {lang === 'ar' ? 'استلام من المطعم' : 'Abholung vor Ort'}
                </button>
              </div>

              {/* Customer Inputs */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[12px] font-semibold text-[#242E30] mb-1">
                    {lang === 'ar' ? 'الاسم *' : 'Name *'}
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder={lang === 'ar' ? 'مثال: أحمد' : 'z. B. Max'}
                    className="w-full h-11 px-3.5 rounded-[12px] bg-[#F8F5F2] border border-[#EAE5DF] focus:border-[#FF8000] focus:bg-white focus:outline-none text-[13px]"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-[#242E30] mb-1">
                    {lang === 'ar' ? 'رقم الهاتف / واتساب *' : 'Telefonnummer *'}
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="0176 ..."
                    className="w-full h-11 px-3.5 rounded-[12px] bg-[#F8F5F2] border border-[#EAE5DF] focus:border-[#FF8000] focus:bg-white focus:outline-none text-[13px] tabular-nums"
                  />
                </div>

                {orderMode === 'delivery' ? (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[12px] font-semibold text-[#242E30]">
                        {lang === 'ar' ? 'عنوان التوصيل والموقع *' : 'Lieferadresse in Rostock *'}
                      </label>
                      <button
                        type="button"
                        onClick={handleLocateMe}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#FF8000] hover:text-[#E67300]"
                      >
                        <LocateFixed className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'تحديد موقعي تلقائياً' : 'Standort erkennen'}</span>
                      </button>
                    </div>

                    <div className="relative">
                      <MapPin className="w-4 h-4 text-[#FF8000] absolute top-3.5 left-3 pointer-events-none" />
                      <input
                        ref={addressInputRef}
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder={
                          lang === 'ar'
                            ? 'الشارع ورقم المنزل (مثال: Schiffbauerring 59)'
                            : 'Straße & Hausnummer in Rostock'
                        }
                        className="w-full h-11 pl-9 pr-3.5 rounded-[12px] bg-[#F8F5F2] border border-[#EAE5DF] focus:border-[#FF8000] focus:bg-white focus:outline-none text-[13px]"
                      />
                    </div>

                    {gpsStatus && (
                      <p
                        className={`mt-1.5 text-[11px] leading-snug ${
                          gpsStatus.tone === 'success'
                            ? 'text-[#16A34A] font-medium'
                            : 'text-[#5A6568]'
                        }`}
                      >
                        {gpsStatus.text}
                      </p>
                    )}

                    {/* Quick Rostock Area Shortcuts */}
                    <div className="mt-2">
                      <p className="text-[11px] text-[#5A6568] mb-1.5">
                        {lang === 'ar' ? 'أو اختر منطقتك في روستوك:' : 'Stadtteil schnell wählen:'}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {ROSTOCK_AREAS.map((area) => (
                          <button
                            key={area}
                            type="button"
                            onClick={() => handleSelectArea(area)}
                            className="px-2.5 py-1 rounded-[8px] bg-[#F8F5F2] hover:bg-[#FFF3E6] border border-[#EAE5DF] text-[11px] font-medium text-[#242E30] transition-colors"
                          >
                            {area.split(',')[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-[12px] bg-[#F8F5F2] text-[12px] text-[#242E30]">
                    <strong>{lang === 'ar' ? 'عنوان الاستلام:' : 'Abholadresse:'}</strong>{' '}
                    {KAIROS_INFO.address}
                  </div>
                )}

                {/* Payment Method */}
                <div>
                  <label className="block text-[12px] font-semibold text-[#242E30] mb-1.5">
                    {lang === 'ar' ? 'طريقة الدفع' : 'Zahlungsart'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash')}
                      className={`py-2.5 px-3 rounded-[12px] border text-[12px] font-semibold transition-colors ${
                        paymentMethod === 'cash'
                          ? 'border-[#FF8000] bg-[#FFF3E6] text-[#242E30]'
                          : 'border-[#EAE5DF] bg-white text-[#5A6568]'
                      }`}
                    >
                      {lang === 'ar' ? 'نقداً عند الاستلام' : 'Barzahlung'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('payment_link')}
                      className={`py-2.5 px-3 rounded-[12px] border text-[12px] font-semibold transition-colors ${
                        paymentMethod === 'payment_link'
                          ? 'border-[#FF8000] bg-[#FFF3E6] text-[#242E30]'
                          : 'border-[#EAE5DF] bg-white text-[#5A6568]'
                      }`}
                    >
                      {lang === 'ar' ? 'الدفع عبر الرابط' : 'Online-Zahlungslink'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-[#242E30] mb-1">
                    {lang === 'ar' ? 'ملاحظات إضافية (اختياري)' : 'Hinweise zur Bestellung'}
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={
                      lang === 'ar'
                        ? 'مثال: الطابق الثالث، بدون بصل...'
                        : 'z. B. 3. OG, ohne Zwiebeln...'
                    }
                    className="w-full h-10 px-3.5 rounded-[12px] bg-[#F8F5F2] border border-[#EAE5DF] focus:border-[#FF8000] focus:bg-white focus:outline-none text-[13px]"
                  />
                </div>
              </div>

              {formError && (
                <div className="p-3 rounded-[12px] bg-red-50 border border-red-200 text-[12px] font-semibold text-red-700">
                  {formError}
                </div>
              )}

              {/* Live Detailed Invoice Preview */}
              <div className="rounded-[12px] bg-[#F8F5F2] border border-[#EAE5DF] p-3.5 space-y-2">
                <p className="font-display text-[12px] font-bold text-[#242E30]">
                  {lang === 'ar' ? 'ملخص الفاتورة التفصيلية' : 'Rechnungsübersicht'}
                </p>
                <div className="space-y-1 text-[12px]">
                  {cart.map(({ dish, quantity }) => (
                    <div key={dish.id} className="flex justify-between text-[#5A6568] tabular-nums">
                      <span className="truncate pe-2">
                        {quantity} × {lang === 'ar' ? dish.nameAr : dish.nameDe} (
                        {formatEuro(dish.price)})
                      </span>
                      <span className="font-semibold text-[#242E30] shrink-0">
                        {formatEuro(dish.price * quantity)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="pt-2 border-t border-[#EAE5DF] space-y-1 text-[12px] tabular-nums">
                  <div className="flex justify-between text-[#5A6568]">
                    <span>{lang === 'ar' ? 'المجموع الفرعي' : 'Zwischensumme'}</span>
                    <span>{formatEuro(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-[#5A6568]">
                    <span>{lang === 'ar' ? 'رسوم التوصيل' : 'Liefergebühr'}</span>
                    <span>
                      {deliveryFee === 0
                        ? lang === 'ar'
                          ? 'مجاني (0,00 €)'
                          : 'Kostenlos (0,00 €)'
                        : formatEuro(deliveryFee)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Totals & WhatsApp Submit */}
            <div className="p-5 border-t border-[#EAE5DF] bg-white space-y-2 shrink-0">
              {orderMode === 'delivery' && subtotal < KAIROS_INFO.freeDeliveryThreshold && (
                <p className="text-[11px] text-[#5A6568]">
                  {lang === 'ar'
                    ? `توصيل مجاني للطلبات فوق ${formatEuro(KAIROS_INFO.freeDeliveryThreshold)}`
                    : `Kostenlose Lieferung ab ${formatEuro(KAIROS_INFO.freeDeliveryThreshold)}`}
                </p>
              )}
              <div className="flex justify-between text-[17px] font-extrabold text-[#242E30] tabular-nums">
                <span>{lang === 'ar' ? 'المجموع النهائي' : 'Gesamtbetrag'}</span>
                <span className="text-[#FF8000]">{formatEuro(total)}</span>
              </div>

              <button
                type="submit"
                className="mt-1 w-full h-12 rounded-[12px] bg-[#FF8000] hover:bg-[#E67300] text-white font-display font-bold text-[14px] flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(255,128,0,0.3)] transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>
                  {lang === 'ar'
                    ? `عرض الفاتورة وإرسال عبر واتساب (${formatEuro(total)})`
                    : `Rechnung & WhatsApp Bestellung (${formatEuro(total)})`}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
