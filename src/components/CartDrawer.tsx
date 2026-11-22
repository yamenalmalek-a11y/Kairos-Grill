import { FormEvent, useEffect, useRef, useState } from 'react';
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
  CheckCircle2,
  CreditCard,
  ExternalLink,
  ShoppingBag,
  Receipt,
  Send,
  Loader2,
} from 'lucide-react';
import {
  CartEntry,
  CartTotals,
  KAIROS_INFO,
  buildWhatsAppOrderText,
  buildWhatsAppUrl,
  calculateCartTotals,
  formatEuro,
  getEntryUnitPrice,
} from '@/src/data/kairosData';
import { CroppedPhoto } from '@/src/components/CroppedPhoto';
import { createLiveOrder, prefetchKitchenPublicKey } from '@/src/services/kairosFirebase';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cart: CartEntry[];
  onUpdateQty: (entryKey: string, delta: number) => void;
  onClearCart: () => void;
  onOrderCreated: (orderId: string) => void;
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

interface AddressSuggestion {
  label: string;
  lat: number;
  lng: number;
}

const ROSTOCK_BOUNDS = {
  minLat: 54.01,
  maxLat: 54.22,
  minLon: 11.96,
  maxLon: 12.26,
};

function isInsideRostockArea(lat: number, lng: number): boolean {
  return (
    lat >= ROSTOCK_BOUNDS.minLat &&
    lat <= ROSTOCK_BOUNDS.maxLat &&
    lng >= ROSTOCK_BOUNDS.minLon &&
    lng <= ROSTOCK_BOUNDS.maxLon
  );
}

export function CartDrawer({
  isOpen,
  onClose,
  cart,
  onUpdateQty,
  onClearCart,
  onOrderCreated,
  lang,
}: CartDrawerProps) {
  const paymentLink = KAIROS_INFO.defaultPaymentLink;
  const addressInputRef = useRef<HTMLInputElement>(null);
  const watchIdRef = useRef<number | null>(null);
  const watchTimerRef = useRef<number | null>(null);
  const skipNextAutocompleteRef = useRef(false);

  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderMode, setOrderMode] = useState<'delivery' | 'pickup'>('delivery');
  const [address, setAddress] = useState('');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gpsStatus, setGpsStatus] = useState<{
    tone: 'loading' | 'success' | 'warn' | 'fallback';
    text: string;
  } | null>(null);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'payment_link'>('cash');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [dispatchedOrder, setDispatchedOrder] = useState<{
    orderId: string | null;
    orderNumber: string;
    messageText: string;
    whatsappUrl: string;
    items: CartEntry[];
    totals: CartTotals;
    customerName: string;
    locationLabel: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const stopGpsWatch = () => {
    if (watchIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (watchTimerRef.current !== null) {
      window.clearTimeout(watchTimerRef.current);
      watchTimerRef.current = null;
    }
  };

  useEffect(() => {
    if (isOpen && cart.length > 0) {
      prefetchKitchenPublicKey();
    }
    if (!isOpen) {
      stopGpsWatch();
    }
    return () => {
      stopGpsWatch();
    };
  }, [isOpen, cart.length]);

  // Pre-resolve coordinates silently in background while customer finishes form
  useEffect(() => {
    if (!isOpen || orderMode !== 'delivery' || gpsCoords) return;
    const clean = address.trim();
    if (clean.length < 5 || /^\d+\.\d+,\s*\d+\.\d+$/.test(clean)) return;

    let cancelled = false;
    const timer = window.setTimeout(() => {
      void forwardGeocodeRostock(clean).then((coords) => {
        if (!cancelled && coords) {
          setGpsCoords((prev) => prev ?? coords);
        }
      });
    }, 650);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isOpen, orderMode, address, gpsCoords]);

  // Live Rostock street & house-number autocomplete (OpenStreetMap Photon bounded to Rostock)
  useEffect(() => {
    if (!isOpen || orderMode !== 'delivery') {
      setSuggestions([]);
      return;
    }
    if (skipNextAutocompleteRef.current) {
      skipNextAutocompleteRef.current = false;
      return;
    }
    const clean = address.trim();
    if (clean.length < 3 || /^\d+\.\d+,\s*\d+\.\d+$/.test(clean)) {
      setSuggestions([]);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const res = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(clean)}&lat=54.0924&lon=12.0991&limit=6&lang=de`,
          { signal: controller.signal }
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          features?: Array<{
            geometry?: { coordinates?: [number, number] };
            properties?: {
              street?: string;
              name?: string;
              housenumber?: string;
              postcode?: string;
              city?: string;
              district?: string;
            };
          }>;
        };
        const items: AddressSuggestion[] = [];
        const seen = new Set<string>();
        for (const f of data.features ?? []) {
          const coords = f.geometry?.coordinates;
          const p = f.properties;
          if (!coords || !p) continue;
          const [lng, lat] = coords;
          if (!isInsideRostockArea(lat, lng)) continue;
          const streetPart = p.street
            ? [p.street, p.housenumber].filter(Boolean).join(' ')
            : [p.name, p.housenumber].filter(Boolean).join(' ');
          const cityPart = [p.postcode, p.city || 'Rostock'].filter(Boolean).join(' ');
          const label = [streetPart, cityPart].filter(Boolean).join(', ');
          if (!label || seen.has(label)) continue;
          seen.add(label);
          items.push({ label, lat, lng });
          if (items.length >= 5) break;
        }
        setSuggestions(items);
      } catch {
        // Ignore aborted or offline autocomplete requests
      }
    }, 320);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [address, isOpen, orderMode]);

  if (!isOpen) return null;

  const totals = calculateCartTotals(cart, orderMode);

  const reverseGeocode = async (lat: number, lng: number): Promise<string | null> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&accept-language=de`,
        { headers: { Accept: 'application/json' } }
      );
      if (res.ok) {
        const data = await res.json();
        const a = data.address;
        if (a) {
          const street = [a.road || a.pedestrian || a.footway, a.house_number]
            .filter(Boolean)
            .join(' ');
          const city = [a.postcode, a.city || a.town || a.village || a.suburb]
            .filter(Boolean)
            .join(' ');
          const formatted = [street, city].filter(Boolean).join(', ');
          if (formatted) return formatted;
        }
      }
    } catch {
      // Fall through to Photon reverse geocoding
    }

    try {
      const res2 = await fetch(
        `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&lang=de`
      );
      if (!res2.ok) return null;
      const data2 = (await res2.json()) as {
        features?: Array<{
          properties?: {
            street?: string;
            name?: string;
            housenumber?: string;
            postcode?: string;
            city?: string;
          };
        }>;
      };
      const p = data2.features?.[0]?.properties;
      if (!p) return null;
      const street = [p.street || p.name, p.housenumber].filter(Boolean).join(' ');
      const city = [p.postcode, p.city || 'Rostock'].filter(Boolean).join(' ');
      const formatted = [street, city].filter(Boolean).join(', ');
      return formatted || null;
    } catch {
      return null;
    }
  };

  const forwardGeocodeRostock = async (
    queryText: string
  ): Promise<{ lat: number; lng: number } | null> => {
    const clean = queryText.trim();
    if (!clean) return null;
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 500);
    try {
      const qWithCity = clean.toLowerCase().includes('rostock') ? clean : `${clean}, Rostock`;
      const res = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(qWithCity)}&lat=54.0924&lon=12.0991&limit=3&lang=de`,
        { signal: controller.signal }
      );
      if (!res.ok) return null;
      const data = (await res.json()) as {
        features?: Array<{ geometry?: { coordinates?: [number, number] } }>;
      };
      for (const f of data.features ?? []) {
        const coords = f.geometry?.coordinates;
        if (!coords) continue;
        const [lng, lat] = coords;
        if (isInsideRostockArea(lat, lng)) {
          return { lat, lng };
        }
      }
      return null;
    } catch {
      return null;
    } finally {
      window.clearTimeout(timeoutId);
    }
  };

  const applyBestGeoPosition = async (pos: GeolocationPosition) => {
    const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    const accuracyMeters = Math.round(pos.coords.accuracy || 0);

    // Reject ultra-coarse cell/IP estimates (> 250m) from overwriting a real street address
    if (accuracyMeters > 250) {
      setGpsCoords(null);
      setGpsStatus({
        tone: 'warn',
        text:
          lang === 'ar'
            ? `إشارة GPS ضعيفة في هذا المكان (±${accuracyMeters} م) وقد لا تكون دقيقة. اكتب اسم الشارع ورقم المنزل واختره من الاقتراحات.`
            : `GPS-Signal ungenau (±${accuracyMeters} m). Bitte Straße & Hausnummer unten eingeben bzw. aus den Vorschlägen wählen.`,
      });
      return;
    }

    setGpsCoords(coords);
    const resolvedStreet = await reverseGeocode(coords.lat, coords.lng);
    if (resolvedStreet) {
      skipNextAutocompleteRef.current = true;
      setAddress(resolvedStreet);
      setSuggestions([]);
      setShowSuggestions(false);
    } else if (!address.trim()) {
      skipNextAutocompleteRef.current = true;
      setAddress(`${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`);
    }

    if (accuracyMeters <= 35) {
      setGpsStatus({
        tone: 'success',
        text:
          lang === 'ar'
            ? `تم تحديد موقعك بدقة عالية (±${accuracyMeters} م) — تأكد من رقم المنزل أدناه`
            : `Standort präzise erkannt (±${accuracyMeters} m) — bitte Hausnummer prüfen`,
      });
    } else {
      setGpsStatus({
        tone: 'warn',
        text:
          lang === 'ar'
            ? `تم تحديد الموقع بدقة متوسطة (±${accuracyMeters} م) — يُنصح بالتأكد من الشارع ورقم المنزل`
            : `Standort erkannt (±${accuracyMeters} m) — bitte Straße & Hausnummer ggf. korrigieren`,
      });
    }
  };

  const handleLocateMe = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatus({
        tone: 'fallback',
        text:
          lang === 'ar'
            ? 'اختر منطقتك في روستوك أو اكتب اسم الشارع ورقم المنزل.'
            : 'Bitte Straße & Hausnummer in Rostock eingeben.',
      });
      return;
    }

    stopGpsWatch();
    setGpsStatus({
      tone: 'loading',
      text:
        lang === 'ar'
          ? 'جاري التقاط أدق إشارة GPS لموقعك…'
          : 'Genauer GPS-Standort wird ermittelt…',
    });

    let bestPos: GeolocationPosition | null = null;
    let settled = false;

    const finalize = () => {
      if (settled) return;
      settled = true;
      stopGpsWatch();
      if (bestPos) {
        void applyBestGeoPosition(bestPos);
      }
    };

    const handleGeoError = (err: GeolocationPositionError) => {
      if (bestPos) {
        finalize();
        return;
      }
      settled = true;
      stopGpsWatch();
      const inIframe = window.self !== window.top;
      setGpsStatus({
        tone: 'fallback',
        text:
          err.code === 1 && inIframe
            ? lang === 'ar'
              ? 'نافذة المعاينة تمنع الوصول للـ GPS تلقائياً (يعمل في المتصفح). اكتب الشارع ورقم المنزل واختره من الاقتراحات.'
              : 'GPS ist im Vorschaufenster blockiert. Bitte Straße & Hausnummer eingeben.'
            : lang === 'ar'
              ? 'تعذر التقاط إشارة GPS دقيقة. اكتب اسم الشارع ورقم المنزل واختره من القائمة.'
              : 'Kein genaues GPS-Signal verfügbar. Bitte Straße & Hausnummer direkt eingeben.',
      });
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        if (!bestPos || pos.coords.accuracy < bestPos.coords.accuracy) {
          bestPos = pos;
        }
        // Stop early once we achieve true GPS accuracy (<= 25 meters)
        if (pos.coords.accuracy <= 25) {
          finalize();
        }
      },
      handleGeoError,
      {
        enableHighAccuracy: true,
        timeout: 9000,
        maximumAge: 0,
      }
    );

    watchTimerRef.current = window.setTimeout(() => {
      if (bestPos) {
        finalize();
      } else {
        stopGpsWatch();
        settled = true;
        setGpsStatus({
          tone: 'fallback',
          text:
            lang === 'ar'
              ? 'استغرق تحديد GPS وقتاً طويلاً. اكتب اسم الشارع ورقم المنزل في روستوك.'
              : 'GPS-Ortung dauert zu lange. Bitte Straße & Hausnummer eingeben.',
        });
      }
    }, 6500);
  };

  const handleSelectArea = (area: string) => {
    skipNextAutocompleteRef.current = false;
    setAddress(`${area} — `);
    setGpsCoords(null);
    setGpsStatus(null);
    setTimeout(() => addressInputRef.current?.focus(), 40);
  };

  const handleSelectSuggestion = (item: AddressSuggestion) => {
    skipNextAutocompleteRef.current = true;
    setAddress(item.label);
    setGpsCoords({ lat: item.lat, lng: item.lng });
    setSuggestions([]);
    setShowSuggestions(false);
    setGpsStatus({
      tone: 'success',
      text:
        lang === 'ar'
          ? 'تم تثبيت العنوان وإحداثياته الدقيقة على الخريطة'
          : 'Exakte Adresse & Kartenkoordinaten übernommen',
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (cart.length === 0) return;
    if (!customerName.trim()) {
      setFormError(lang === 'ar' ? 'يرجى كتابة الاسم' : 'Bitte geben Sie Ihren Namen ein.');
      return;
    }
    if (!customerPhone.trim() || customerPhone.trim().length < 4) {
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

    setSubmitting(true);
    let resolvedCoords = gpsCoords;
    if (orderMode === 'delivery' && !resolvedCoords) {
      resolvedCoords = await forwardGeocodeRostock(address);
    }

    const orderNumber = `KG-${Math.floor(1000 + Math.random() * 8999)}`;
    const messageText = buildWhatsAppOrderText({
      orderNumber,
      customerName: customerName.trim(),
      customerPhone: customerPhone.trim(),
      orderMode,
      address: address.trim(),
      gpsCoords: resolvedCoords,
      paymentMethod,
      paymentLink,
      notes,
      items: cart,
      totals,
      lang,
    });
    const whatsappUrl = buildWhatsAppUrl(messageText);

    let createdOrderId: string | null = null;
    try {
      createdOrderId = await createLiveOrder({
        orderNumber,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        orderMode,
        address: address.trim(),
        gpsCoords: resolvedCoords,
        paymentMethod,
        notes,
        items: cart,
        totals,
      });
      onOrderCreated(createdOrderId);
    } catch {
      // Even if offline/transient error occurs, still let user send the WhatsApp message
    } finally {
      setSubmitting(false);
    }

    setDispatchedOrder({
      orderId: createdOrderId,
      orderNumber,
      messageText,
      whatsappUrl,
      items: [...cart],
      totals,
      customerName: customerName.trim(),
      locationLabel: orderMode === 'pickup' ? KAIROS_INFO.address : address.trim(),
    });
    onClearCart();
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

  const handleTrackOrDone = () => {
    setDispatchedOrder(null);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/75 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-label={lang === 'ar' ? 'سلة الطلبات' : 'Warenkorb'}
    >
      <div className="w-full max-w-md bg-[#14171A] border-s border-[#262B31] h-full flex flex-col shadow-2xl text-[#F4F5F6]">
        {/* Drawer Header */}
        <div className="px-5 py-4 border-b border-[#262B31] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[12px] bg-[#FF8000]/15 text-[#FF8000] flex items-center justify-center">
              {dispatchedOrder ? (
                <Receipt className="w-4 h-4" strokeWidth={2.2} />
              ) : (
                <ShoppingBag className="w-4 h-4" strokeWidth={2.2} />
              )}
            </div>
            <div>
              <h2 className="font-display text-[17px] font-bold text-[#F4F5F6]">
                {dispatchedOrder
                  ? lang === 'ar'
                    ? `فاتورة الطلب #${dispatchedOrder.orderNumber}`
                    : `Rechnung #${dispatchedOrder.orderNumber}`
                  : lang === 'ar'
                    ? 'سلة الطلبات'
                    : 'Ihr Warenkorb'}
              </h2>
              <p className="text-[12px] text-[#A3ACB3]">
                Kairos Grill · WhatsApp {KAIROS_INFO.phoneDisplay}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close drawer"
            className="min-h-[42px] min-w-[42px] rounded-[12px] flex items-center justify-center text-[#A3ACB3] hover:bg-[#1C2024] hover:text-[#F4F5F6] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Post-Order Confirmation: Live Tablet Delivery + WhatsApp Invoice Dispatch */}
        {dispatchedOrder ? (
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            <div className="p-3.5 rounded-[12px] bg-[#22C55E]/15 border border-[#22C55E]/35 space-y-1">
              <div className="flex items-center gap-2 text-[13px] font-bold text-[#4ADE80]">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  {dispatchedOrder.orderId
                    ? lang === 'ar'
                      ? 'وصل طلبك مباشرة إلى تابلت المطعم! يمكنك أيضاً إرسال نسخة عبر واتساب أدناه:'
                      : 'Ihre Bestellung ist direkt auf dem Restaurant-Tablet eingegangen! Gerne zusätzlich per WhatsApp senden:'
                    : lang === 'ar'
                      ? 'تم تجهيز الفاتورة التفصيلية لطلبك! اضغط على الزر الأخضر لإرسالها عبر واتساب:'
                      : 'Ihre detaillierte Rechnung ist bereit! Tippen Sie unten, um per WhatsApp zu senden.'}
                </span>
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
                  ? `إرسال الفاتورة عبر واتساب (${formatEuro(dispatchedOrder.totals.total)})`
                  : `Rechnung per WhatsApp senden (${formatEuro(dispatchedOrder.totals.total)})`}
              </span>
              <ExternalLink className="w-4 h-4 opacity-80" />
            </a>

            {/* Detailed Receipt Card */}
            <div className="rounded-[12px] bg-[#1C2024] border border-[#262B31] shadow-xs overflow-hidden">
              <div className="px-4 py-3 bg-[#0B0D0F]/60 border-b border-[#262B31] flex items-center justify-between">
                <span className="font-display text-[13px] font-bold text-[#F4F5F6]">
                  {lang === 'ar' ? 'الفاتورة التفصيلية (شاملة الضريبة)' : 'Detaillierte Rechnung (inkl. MwSt.)'}
                </span>
                <span className="text-[12px] font-semibold text-[#FF8000] tabular-nums">
                  #{dispatchedOrder.orderNumber}
                </span>
              </div>

              <div className="px-4 py-2.5 border-b border-[#262B31] text-[12px] text-[#A3ACB3] space-y-0.5">
                <p>
                  <strong className="text-[#F4F5F6]">{lang === 'ar' ? 'الاسم:' : 'Name:'}</strong>{' '}
                  {dispatchedOrder.customerName}
                </p>
                <p className="truncate">
                  <strong className="text-[#F4F5F6]">{lang === 'ar' ? 'الموقع:' : 'Adresse:'}</strong>{' '}
                  {dispatchedOrder.locationLabel}
                </p>
              </div>

              <div className="divide-y divide-[#262B31] px-4">
                {dispatchedOrder.items.map((entry) => {
                  const unitPrice = getEntryUnitPrice(entry);
                  const { dish, variant, quantity } = entry;
                  return (
                    <div key={entry.key} className="py-2.5 flex items-start justify-between gap-3 text-[13px]">
                      <div className="min-w-0">
                        <p className="font-semibold text-[#F4F5F6]">
                          {dish.itemNumber ? `#${dish.itemNumber} ` : ''}
                          {lang === 'ar' ? dish.nameAr : dish.nameDe}
                          {variant ? ` (${lang === 'ar' ? variant.labelAr : variant.labelDe})` : ''}
                        </p>
                        <p className="text-[11px] text-[#A3ACB3] tabular-nums">
                          {quantity} × {formatEuro(unitPrice)} ·{' '}
                          {dish.taxRate === 0.19
                            ? lang === 'ar'
                              ? 'ضريبة 19%'
                              : '19% MwSt.'
                            : lang === 'ar'
                              ? 'ضريبة 7%'
                              : '7% MwSt.'}
                        </p>
                      </div>
                      <span className="font-bold text-[#F4F5F6] tabular-nums shrink-0">
                        {formatEuro(unitPrice * quantity)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="px-4 py-3 bg-[#0B0D0F]/60 border-t border-[#262B31] space-y-1.5 text-[13px]">
                <div className="flex justify-between text-[#A3ACB3] tabular-nums">
                  <span>{lang === 'ar' ? 'المجموع الفرعي (صافي)' : 'Zwischensumme (Netto)'}</span>
                  <span>{formatEuro(dispatchedOrder.totals.subtotal)}</span>
                </div>

                {dispatchedOrder.totals.foodTax > 0 && (
                  <div className="flex justify-between text-[#A3ACB3] tabular-nums">
                    <span>{lang === 'ar' ? 'ضريبة الأكل (7%)' : 'MwSt. Speisen (7%)'}</span>
                    <span>+{formatEuro(dispatchedOrder.totals.foodTax)}</span>
                  </div>
                )}

                {dispatchedOrder.totals.drinksTax > 0 && (
                  <div className="flex justify-between text-[#A3ACB3] tabular-nums">
                    <span>{lang === 'ar' ? 'ضريبة المشروبات (19%)' : 'MwSt. Getränke (19%)'}</span>
                    <span>+{formatEuro(dispatchedOrder.totals.drinksTax)}</span>
                  </div>
                )}

                <div className="flex justify-between text-[#A3ACB3] tabular-nums">
                  <span>{lang === 'ar' ? 'رسوم التوصيل' : 'Liefergebühr'}</span>
                  <span>
                    {dispatchedOrder.totals.deliveryFee === 0
                      ? lang === 'ar'
                        ? 'مجاني (0,00 €)'
                        : 'Kostenlos (0,00 €)'
                      : formatEuro(dispatchedOrder.totals.deliveryFee)}
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2 border-t border-[#262B31] font-display text-[16px] font-extrabold text-[#F4F5F6] tabular-nums">
                  <span>{lang === 'ar' ? 'المجموع النهائي' : 'Gesamtbetrag'}</span>
                  <span className="text-[#FF8000]">{formatEuro(dispatchedOrder.totals.total)}</span>
                </div>
              </div>
            </div>

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

            <div className="bg-[#1C2024] rounded-[12px] p-3.5 border border-[#262B31]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[12px] font-bold text-[#F4F5F6]">
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
                className="whitespace-pre-wrap text-[12px] text-[#F4F5F6] font-sans leading-relaxed"
              >
                {dispatchedOrder.messageText}
              </pre>
            </div>

            <button
              type="button"
              onClick={handleTrackOrDone}
              className="w-full h-11 rounded-[12px] bg-[#1C2024] hover:bg-[#23282D] border border-[#262B31] text-[#F4F5F6] text-[13px] font-bold transition-colors"
            >
              {dispatchedOrder.orderId
                ? lang === 'ar'
                  ? 'متابعة حالة الطلب المباشرة'
                  : 'Live-Bestellstatus ansehen'
                : lang === 'ar'
                  ? 'إغلاق / طلب جديد'
                  : 'Schließen / Neue Bestellung'}
            </button>
          </div>
        ) : cart.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-14 h-14 rounded-[16px] bg-[#1C2024] border border-[#262B31] text-[#FF8000] flex items-center justify-center mb-3">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <p className="font-display text-[16px] font-bold text-[#F4F5F6]">
              {lang === 'ar' ? 'سلتك فارغة حالياً' : 'Ihr Warenkorb ist leer'}
            </p>
            <p className="text-[13px] text-[#A3ACB3] mt-1 max-w-xs">
              {lang === 'ar'
                ? 'اختر وجباتك ومشروباتك المفضلة لإرسال طلبك مباشرة للمطعم وعبر واتساب.'
                : 'Wählen Sie Speisen und Getränke aus unserer Speisekarte.'}
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
              <div className="divide-y divide-[#262B31]">
                {cart.map((entry) => {
                  const unitPrice = getEntryUnitPrice(entry);
                  const { dish, variant, quantity } = entry;
                  return (
                    <div key={entry.key} className="py-3 first:pt-0 flex items-center gap-3">
                      <CroppedPhoto
                        src={dish.image}
                        alt={lang === 'ar' ? dish.nameAr : dish.nameDe}
                        cropPosition={dish.cropPosition}
                        cropScale={dish.cropScale}
                        className="w-14 h-14 rounded-[12px] shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-display text-[13px] font-bold text-[#F4F5F6] truncate">
                          {dish.itemNumber ? `#${dish.itemNumber} ` : ''}
                          {lang === 'ar' ? dish.nameAr : dish.nameDe}
                          {variant ? ` (${lang === 'ar' ? variant.labelAr : variant.labelDe})` : ''}
                        </p>
                        <p className="text-[12px] text-[#A3ACB3] tabular-nums">
                          {formatEuro(unitPrice)} × {quantity} ={' '}
                          <strong className="text-[#F4F5F6]">
                            {formatEuro(unitPrice * quantity)}
                          </strong>{' '}
                          <span className="text-[11px]">
                            ({dish.taxRate === 0.19 ? '19%' : '7%'})
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => onUpdateQty(entry.key, -1)}
                          aria-label="Decrease quantity"
                          className="w-8 h-8 rounded-[10px] bg-[#1C2024] hover:bg-[#23282D] border border-[#262B31] text-[#F4F5F6] flex items-center justify-center"
                        >
                          {quantity === 1 ? (
                            <Trash2 className="w-3.5 h-3.5 text-[#A3ACB3]" />
                          ) : (
                            <Minus className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <span className="w-6 text-center text-[13px] font-bold tabular-nums text-[#F4F5F6]">
                          {quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => onUpdateQty(entry.key, 1)}
                          aria-label="Increase quantity"
                          className="w-8 h-8 rounded-[10px] bg-[#FF8000]/15 hover:bg-[#FF8000] text-[#FF8000] hover:text-white border border-[#FF8000]/30 flex items-center justify-center transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Delivery vs Pickup */}
              <div className="p-1 bg-[#1C2024] border border-[#262B31] rounded-[12px] grid grid-cols-2 gap-1">
                <button
                  type="button"
                  onClick={() => setOrderMode('delivery')}
                  className={`py-2 px-3 rounded-[10px] text-[12px] font-bold transition-colors ${
                    orderMode === 'delivery'
                      ? 'bg-[#FF8000] text-white shadow-xs'
                      : 'text-[#A3ACB3] hover:text-[#F4F5F6]'
                  }`}
                >
                  {lang === 'ar' ? 'توصيل للعنوان' : 'Lieferservice'}
                </button>
                <button
                  type="button"
                  onClick={() => setOrderMode('pickup')}
                  className={`py-2 px-3 rounded-[10px] text-[12px] font-bold transition-colors ${
                    orderMode === 'pickup'
                      ? 'bg-[#FF8000] text-white shadow-xs'
                      : 'text-[#A3ACB3] hover:text-[#F4F5F6]'
                  }`}
                >
                  {lang === 'ar' ? 'استلام من المطعم' : 'Abholung vor Ort'}
                </button>
              </div>

              {/* Customer Inputs */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[12px] font-semibold text-[#F4F5F6] mb-1">
                    {lang === 'ar' ? 'الاسم *' : 'Name *'}
                  </label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder={lang === 'ar' ? 'مثال: أحمد' : 'z. B. Max'}
                    className="w-full h-11 px-3.5 rounded-[12px] bg-[#1C2024] border border-[#262B31] text-[#F4F5F6] placeholder:text-[#A3ACB3]/60 focus:border-[#FF8000] focus:outline-none text-[13px]"
                  />
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-[#F4F5F6] mb-1">
                    {lang === 'ar' ? 'رقم الهاتف / واتساب *' : 'Telefonnummer *'}
                  </label>
                  <input
                    type="tel"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="0176 ..."
                    dir="ltr"
                    className="w-full h-11 px-3.5 rounded-[12px] bg-[#1C2024] border border-[#262B31] text-[#F4F5F6] placeholder:text-[#A3ACB3]/60 focus:border-[#FF8000] focus:outline-none text-[13px] tabular-nums"
                  />
                </div>

                {orderMode === 'delivery' ? (
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[12px] font-semibold text-[#F4F5F6]">
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
                        onFocus={() => setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 160)}
                        onChange={(e) => {
                          setAddress(e.target.value);
                          setGpsCoords(null);
                          setShowSuggestions(true);
                        }}
                        placeholder={
                          lang === 'ar'
                            ? 'الشارع ورقم المنزل (مثال: Schiffbauerring 59)'
                            : 'Straße & Hausnummer in Rostock'
                        }
                        className="w-full h-11 pl-9 pr-3.5 rounded-[12px] bg-[#1C2024] border border-[#262B31] text-[#F4F5F6] placeholder:text-[#A3ACB3]/60 focus:border-[#FF8000] focus:outline-none text-[13px]"
                      />

                      {showSuggestions && suggestions.length > 0 && (
                        <ul className="absolute left-0 right-0 top-full mt-1 z-20 bg-[#1C2024] border border-[#262B31] rounded-[12px] shadow-2xl overflow-hidden divide-y divide-[#262B31]">
                          {suggestions.map((item) => (
                            <li key={item.label}>
                              <button
                                type="button"
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  handleSelectSuggestion(item);
                                }}
                                className="w-full text-start px-3.5 py-2.5 text-[12px] font-semibold text-[#F4F5F6] hover:bg-[#23282D] flex items-center gap-2 transition-colors"
                              >
                                <MapPin className="w-3.5 h-3.5 text-[#FF8000] shrink-0" />
                                <span className="truncate">{item.label}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {gpsStatus && (
                      <p
                        className={`mt-1.5 text-[11px] leading-snug ${
                          gpsStatus.tone === 'success'
                            ? 'text-[#4ADE80] font-medium'
                            : gpsStatus.tone === 'warn'
                              ? 'text-[#FBBF24] font-medium'
                              : 'text-[#A3ACB3]'
                        }`}
                      >
                        {gpsStatus.text}
                      </p>
                    )}

                    {gpsCoords && (
                      <a
                        href={`https://maps.google.com/?q=${gpsCoords.lat.toFixed(6)},${gpsCoords.lng.toFixed(6)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-[#60A5FA] hover:underline"
                      >
                        <span>
                          {lang === 'ar'
                            ? 'معاينة موقعي على الخريطة للتأكد'
                            : 'Punkt auf Google Maps prüfen'}
                        </span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}

                    {/* Quick Rostock Area Shortcuts */}
                    <div className="mt-2">
                      <p className="text-[11px] text-[#A3ACB3] mb-1.5">
                        {lang === 'ar' ? 'أو اختر منطقتك في روستوك:' : 'Stadtteil schnell wählen:'}
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {ROSTOCK_AREAS.map((area) => (
                          <button
                            key={area}
                            type="button"
                            onClick={() => handleSelectArea(area)}
                            className="px-2.5 py-1 rounded-[8px] bg-[#1C2024] hover:bg-[#23282D] border border-[#262B31] text-[11px] font-medium text-[#F4F5F6] transition-colors"
                          >
                            {area.split(',')[0]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 rounded-[12px] bg-[#1C2024] border border-[#262B31] text-[12px] text-[#F4F5F6]">
                    <strong>{lang === 'ar' ? 'عنوان الاستلام:' : 'Abholadresse:'}</strong>{' '}
                    {KAIROS_INFO.address}
                  </div>
                )}

                {/* Payment Method */}
                <div>
                  <label className="block text-[12px] font-semibold text-[#F4F5F6] mb-1.5">
                    {lang === 'ar' ? 'طريقة الدفع' : 'Zahlungsart'}
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash')}
                      className={`py-2.5 px-3 rounded-[12px] border text-[12px] font-semibold transition-colors ${
                        paymentMethod === 'cash'
                          ? 'border-[#FF8000] bg-[#FF8000]/15 text-[#F4F5F6]'
                          : 'border-[#262B31] bg-[#1C2024] text-[#A3ACB3]'
                      }`}
                    >
                      {lang === 'ar' ? 'نقداً عند الاستلام' : 'Barzahlung'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('payment_link')}
                      className={`py-2.5 px-3 rounded-[12px] border text-[12px] font-semibold transition-colors ${
                        paymentMethod === 'payment_link'
                          ? 'border-[#FF8000] bg-[#FF8000]/15 text-[#F4F5F6]'
                          : 'border-[#262B31] bg-[#1C2024] text-[#A3ACB3]'
                      }`}
                    >
                      {lang === 'ar' ? 'الدفع عبر الرابط' : 'Online-Zahlungslink'}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-semibold text-[#F4F5F6] mb-1">
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
                    className="w-full h-10 px-3.5 rounded-[12px] bg-[#1C2024] border border-[#262B31] text-[#F4F5F6] placeholder:text-[#A3ACB3]/60 focus:border-[#FF8000] focus:outline-none text-[13px]"
                  />
                </div>
              </div>

              {formError && (
                <div className="p-3 rounded-[12px] bg-red-500/15 border border-red-500/35 text-[12px] font-semibold text-red-400">
                  {formError}
                </div>
              )}

              {/* Live Detailed Invoice Preview with 7% & 19% VAT Breakdown */}
              <div className="rounded-[12px] bg-[#1C2024] border border-[#262B31] p-3.5 space-y-2">
                <p className="font-display text-[12px] font-bold text-[#F4F5F6]">
                  {lang === 'ar'
                    ? 'ملخص الفاتورة التفصيلية والضرائب'
                    : 'Rechnungsübersicht & MwSt.'}
                </p>
                <div className="space-y-1 text-[12px]">
                  {cart.map((entry) => {
                    const unitPrice = getEntryUnitPrice(entry);
                    const { dish, variant, quantity } = entry;
                    return (
                      <div key={entry.key} className="flex justify-between text-[#A3ACB3] tabular-nums">
                        <span className="truncate pe-2">
                          {quantity} × {dish.itemNumber ? `#${dish.itemNumber} ` : ''}
                          {lang === 'ar' ? dish.nameAr : dish.nameDe}
                          {variant ? ` (${lang === 'ar' ? variant.labelAr : variant.labelDe})` : ''} (
                          {formatEuro(unitPrice)})
                        </span>
                        <span className="font-semibold text-[#F4F5F6] shrink-0">
                          {formatEuro(unitPrice * quantity)}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div className="pt-2 border-t border-[#262B31] space-y-1 text-[12px] tabular-nums">
                  <div className="flex justify-between text-[#A3ACB3]">
                    <span>{lang === 'ar' ? 'المجموع الفرعي (صافي)' : 'Zwischensumme (Netto)'}</span>
                    <span>{formatEuro(totals.subtotal)}</span>
                  </div>
                  {totals.foodTax > 0 && (
                    <div className="flex justify-between text-[#A3ACB3]">
                      <span>{lang === 'ar' ? 'ضريبة الأكل (7%)' : 'MwSt. Speisen (7%)'}</span>
                      <span>+{formatEuro(totals.foodTax)}</span>
                    </div>
                  )}
                  {totals.drinksTax > 0 && (
                    <div className="flex justify-between text-[#A3ACB3]">
                      <span>{lang === 'ar' ? 'ضريبة المشروبات (19%)' : 'MwSt. Getränke (19%)'}</span>
                      <span>+{formatEuro(totals.drinksTax)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-[#A3ACB3]">
                    <span>{lang === 'ar' ? 'رسوم التوصيل' : 'Liefergebühr'}</span>
                    <span>
                      {totals.deliveryFee === 0
                        ? lang === 'ar'
                          ? 'مجاني (0,00 €)'
                          : 'Kostenlos (0,00 €)'
                        : formatEuro(totals.deliveryFee)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer Totals & Combined Tablet + WhatsApp Submit */}
            <div className="p-5 border-t border-[#262B31] bg-[#14171A] space-y-2 shrink-0">
              {orderMode === 'delivery' && totals.subtotal < KAIROS_INFO.freeDeliveryThreshold && (
                <p className="text-[11px] text-[#A3ACB3]">
                  {lang === 'ar'
                    ? `توصيل مجاني للطلبات فوق ${formatEuro(KAIROS_INFO.freeDeliveryThreshold)}`
                    : `Kostenlose Lieferung ab ${formatEuro(KAIROS_INFO.freeDeliveryThreshold)}`}
                </p>
              )}
              <div className="flex justify-between text-[17px] font-extrabold text-[#F4F5F6] tabular-nums">
                <span>
                  {lang === 'ar' ? 'المجموع النهائي (شامل الضريبة)' : 'Gesamtbetrag (inkl. MwSt.)'}
                </span>
                <span className="text-[#FF8000]">{formatEuro(totals.total)}</span>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="mt-1 w-full h-12 rounded-[12px] bg-[#FF8000] hover:bg-[#E67300] disabled:opacity-60 text-white font-display font-bold text-[14px] flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(255,128,0,0.3)] transition-colors"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
                <span>
                  {submitting
                    ? lang === 'ar'
                      ? 'جاري إرسال الطلب...'
                      : 'Bestellung wird gesendet...'
                    : lang === 'ar'
                      ? `تأكيد وإرسال الطلب (${formatEuro(totals.total)})`
                      : `Bestellung absenden (${formatEuro(totals.total)})`}
                </span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
