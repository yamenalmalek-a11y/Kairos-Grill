import { FormEvent, useState } from 'react';
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
  paymentLink: string;
  onOpenPaymentConfig: () => void;
}

export function CartDrawer({
  isOpen,
  onClose,
  cart,
  onUpdateQty,
  onClearCart,
  lang,
  paymentLink,
  onOpenPaymentConfig,
}: CartDrawerProps) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderMode, setOrderMode] = useState<'delivery' | 'pickup'>('delivery');
  const [address, setAddress] = useState('');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'payment_link'>('cash');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const [dispatchedOrder, setDispatchedOrder] = useState<{
    orderNumber: string;
    messageText: string;
    whatsappUrl: string;
    total: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const subtotal = cart.reduce((sum, item) => sum + item.dish.price * item.quantity, 0);
  const deliveryFee =
    orderMode === 'pickup' || subtotal === 0 || subtotal >= KAIROS_INFO.freeDeliveryThreshold
      ? 0
      : KAIROS_INFO.deliveryFee;
  const total = subtotal + deliveryFee;

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      setGpsStatus(
        lang === 'ar'
          ? 'المتصفح لا يدعم تحديد الموقع التلقائي، يرجى كتابة العنوان.'
          : 'GPS wird nicht unterstützt. Bitte Adresse manuell eingeben.'
      );
      return;
    }
    setGpsStatus(lang === 'ar' ? 'جاري تحديد موقعك…' : 'Standort wird ermittelt…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setGpsCoords(coords);
        if (!address.trim()) {
          setAddress(
            `GPS: ${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)} (Rostock)`
          );
        }
        setGpsStatus(
          lang === 'ar'
            ? 'تم إرفاق رابط موقعك على خرائط Google بالطلب'
            : 'Google Maps Standort wird mit der Bestellung gesendet'
        );
      },
      () => {
        setGpsStatus(
          lang === 'ar'
            ? 'تعذّر الوصول للموقع — اكتب الشارع ورقم المنزل يدوياً'
            : 'Standortzugriff verweigert – bitte Straße & Hausnummer eingeben'
        );
      },
      { timeout: 6000 }
    );
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (cart.length === 0) return;
    if (!customerName.trim()) {
      setFormError(lang === 'ar' ? 'يرجى إدخال الاسم الكامل' : 'Bitte geben Sie Ihren Namen ein.');
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
          ? 'يرجى إدخال عنوان التوصيل أو استخدام GPS'
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
      total,
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
              <ShoppingBag className="w-4 h-4" strokeWidth={2.2} />
            </div>
            <div>
              <h2 className="font-display text-[17px] font-bold text-[#242E30]">
                {dispatchedOrder
                  ? lang === 'ar'
                    ? 'الطلب جاهز للإرسال'
                    : 'Bestellung bereit'
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

        {/* Post-Order Confirmation View */}
        {dispatchedOrder ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="p-4 rounded-[12px] bg-[#FFF3E6] border border-[#FF8000]/30">
              <p className="font-display text-[15px] font-bold text-[#242E30]">
                {lang === 'ar'
                  ? `تم تجهيز الطلب #${dispatchedOrder.orderNumber}`
                  : `Bestellung #${dispatchedOrder.orderNumber} vorbereitet`}
              </p>
              <p className="text-[13px] text-[#5A6568] mt-1 leading-relaxed">
                {lang === 'ar'
                  ? `اضغط على الزر أدناه لفتح واتساب وإرسال تفاصيل الطلب مباشرة إلى Kairos Grill (${KAIROS_INFO.phoneDisplay}).`
                  : `Tippen Sie unten auf den Button, um Ihre Bestellung direkt per WhatsApp an Kairos Grill (${KAIROS_INFO.phoneDisplay}) zu senden.`}
              </p>
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
                  ? `إرسال عبر واتساب (${formatEuro(dispatchedOrder.total)})`
                  : `Jetzt per WhatsApp senden (${formatEuro(dispatchedOrder.total)})`}
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
                  {lang === 'ar' ? 'نص رسالة واتساب:' : 'WhatsApp Nachrichtenvorschau:'}
                </span>
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#FF8000] hover:text-[#E67300]"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? (lang === 'ar' ? 'تم النسخ' : 'Kopiert') : lang === 'ar' ? 'نسخ' : 'Kopieren'}</span>
                </button>
              </div>
              <pre
                dir="auto"
                className="whitespace-pre-wrap text-[12px] text-[#242E30] font-sans leading-relaxed"
              >
                {dispatchedOrder.messageText}
              </pre>
            </div>

            <div className="pt-2 flex items-center gap-2">
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
                    {lang === 'ar' ? 'الاسم الكامل *' : 'Ihr Name *'}
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder={lang === 'ar' ? 'مثال: أحمد محمد' : 'z. B. Max Mustermann'}
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
                        <span>{lang === 'ar' ? 'تحديد موقعي GPS' : 'GPS Standort'}</span>
                      </button>
                    </div>
                    <div className="relative">
                      <MapPin className="w-4 h-4 text-[#FF8000] absolute top-3.5 left-3 pointer-events-none" />
                      <input
                        type="text"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder={
                          lang === 'ar'
                            ? 'الشارع، رقم البناء، الرمز البريدي'
                            : 'Straße, Hausnummer, PLZ Rostock'
                        }
                        className="w-full h-11 pl-9 pr-3.5 rounded-[12px] bg-[#F8F5F2] border border-[#EAE5DF] focus:border-[#FF8000] focus:bg-white focus:outline-none text-[13px]"
                      />
                    </div>
                    {gpsStatus && (
                      <p className="mt-1 text-[11px] text-[#5A6568]">{gpsStatus}</p>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-[12px] bg-[#F8F5F2] text-[12px] text-[#242E30]">
                    <strong>{lang === 'ar' ? 'عنوان الاستلام:' : 'Abholadresse:'}</strong>{' '}
                    {KAIROS_INFO.address}
                  </div>
                )}

                {/* Payment Method */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-[12px] font-semibold text-[#242E30]">
                      {lang === 'ar' ? 'طريقة الدفع' : 'Zahlungsart'}
                    </label>
                    <button
                      type="button"
                      onClick={onOpenPaymentConfig}
                      className="text-[11px] font-semibold text-[#FF8000] hover:underline"
                    >
                      {paymentLink
                        ? lang === 'ar'
                          ? 'تعديل رابط الدفع'
                          : 'Zahlungslink ändern'
                        : lang === 'ar'
                          ? '+ إضافة رابط دفع'
                          : '+ Zahlungslink hinterlegen'}
                    </button>
                  </div>
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
            </div>

            {/* Footer Totals & WhatsApp Submit */}
            <div className="p-5 border-t border-[#EAE5DF] bg-white space-y-2 shrink-0">
              <div className="flex justify-between text-[13px] text-[#5A6568] tabular-nums">
                <span>{lang === 'ar' ? 'المجموع الفرعي' : 'Zwischensumme'}</span>
                <span>{formatEuro(subtotal)}</span>
              </div>
              <div className="flex justify-between text-[13px] text-[#5A6568] tabular-nums">
                <span>{lang === 'ar' ? 'رسوم التوصيل' : 'Liefergebühr'}</span>
                <span>
                  {deliveryFee === 0
                    ? lang === 'ar'
                      ? 'مجاني'
                      : 'Kostenlos'
                    : formatEuro(deliveryFee)}
                </span>
              </div>
              {orderMode === 'delivery' && subtotal < KAIROS_INFO.freeDeliveryThreshold && (
                <p className="text-[11px] text-[#5A6568]">
                  {lang === 'ar'
                    ? `توصيل مجاني للطلبات فوق ${formatEuro(KAIROS_INFO.freeDeliveryThreshold)}`
                    : `Kostenlose Lieferung ab ${formatEuro(KAIROS_INFO.freeDeliveryThreshold)}`}
                </p>
              )}
              <div className="flex justify-between text-[16px] font-extrabold text-[#242E30] pt-1.5 border-t border-[#EAE5DF] tabular-nums">
                <span>{lang === 'ar' ? 'الإجمالي' : 'Gesamtbetrag'}</span>
                <span className="text-[#FF8000]">{formatEuro(total)}</span>
              </div>

              <button
                type="submit"
                className="mt-2 w-full h-12 rounded-[12px] bg-[#FF8000] hover:bg-[#E67300] text-white font-display font-bold text-[14px] flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(255,128,0,0.3)] transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>
                  {lang === 'ar'
                    ? 'تأكيد وإرسال عبر واتساب'
                    : 'Bestellung per WhatsApp absenden'}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
