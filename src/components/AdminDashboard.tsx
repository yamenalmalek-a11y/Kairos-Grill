import { FormEvent, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Bell,
  BellOff,
  Check,
  ChefHat,
  ExternalLink,
  KeyRound,
  Lock,
  LogOut,
  MapPin,
  MessageCircle,
  MessageSquareWarning,
  Phone,
  Printer,
  ShieldCheck,
  Trash2,
  Truck,
  XCircle,
} from 'lucide-react';
import { KAIROS_ASSETS, formatEuro } from '@/src/data/kairosData';
import {
  ComplaintCategory,
  ComplaintRecord,
  ComplaintStatus,
  OrderRecord,
  OrderStatus,
  deleteOrderRecord,
  fetchKitchenVault,
  initializeKitchenVault,
  rotateKitchenPin,
  subscribeAdminComplaints,
  subscribeAdminOrders,
  updateComplaintStatus,
  updateOrderStatus,
  verifyAndUnlockKitchenVault,
} from '@/src/services/kairosFirebase';
import {
  UnlockedKitchenCredentials,
  importCredentialsFromJwk,
} from '@/src/utils/kitchenCrypto';
import { playNewOrderBell, unlockTabletAudio } from '@/src/utils/soundAlert';

interface AdminDashboardProps {
  lang: 'ar' | 'de';
  onChangeLang: (lang: 'ar' | 'de') => void;
  onExitAdmin: () => void;
}

const STORAGE_KEY = 'kairos_tablet_creds_v1';

const STATUS_LABELS: Record<OrderStatus, { ar: string; de: string; tone: string }> = {
  pending: {
    ar: 'طلب جديد — بانتظار الاستلام',
    de: 'Neu — Warten auf Annahme',
    tone: 'text-[#FF8000] bg-[#FF8000]/15',
  },
  accepted: {
    ar: 'تم استلام الطلب',
    de: 'Angenommen',
    tone: 'text-[#4ADE80] bg-[#22C55E]/15',
  },
  preparing: {
    ar: 'جاري التحضير',
    de: 'In Zubereitung',
    tone: 'text-[#60A5FA] bg-[#2563EB]/20',
  },
  delivering: {
    ar: 'خرج للتوصيل',
    de: 'Unterwegs',
    tone: 'text-[#C084FC] bg-[#7C3AED]/20',
  },
  completed: {
    ar: 'تم التسليم',
    de: 'Abgeschlossen',
    tone: 'text-[#A3ACB3] bg-[#1C2024]',
  },
  cancelled: {
    ar: 'ملغي',
    de: 'Storniert',
    tone: 'text-red-400 bg-red-500/15',
  },
};

const COMPLAINT_STATUS_LABELS: Record<ComplaintStatus, { ar: string; de: string; tone: string }> = {
  new: {
    ar: 'شكوى جديدة',
    de: 'Neu',
    tone: 'text-[#FF8000] bg-[#FF8000]/15',
  },
  reviewed: {
    ar: 'قيد المراجعة',
    de: 'In Bearbeitung',
    tone: 'text-[#60A5FA] bg-[#2563EB]/20',
  },
  resolved: {
    ar: 'تمت المعالجة',
    de: 'Gelöst',
    tone: 'text-[#4ADE80] bg-[#22C55E]/15',
  },
};

const COMPLAINT_CATEGORY_LABELS: Record<ComplaintCategory, { ar: string; de: string }> = {
  delivery_delay: { ar: 'تأخير في التوصيل', de: 'Lieferverzögerung' },
  food_quality: { ar: 'جودة الطعام', de: 'Qualität des Essens' },
  missing_item: { ar: 'نقص أو خطأ في الطلب', de: 'Fehlender / falscher Artikel' },
  service: { ar: 'الخدمة والتوصيل', de: 'Service & Lieferung' },
  other: { ar: 'ملاحظة عامة', de: 'Sonstiges' },
};

function formatCustomerWhatsAppReply(
  phone: string,
  orderNumber: string,
  status: OrderStatus
): string {
  const digits = phone.replace(/[^\d]/g, '');
  let intl = digits;
  if (digits.startsWith('00')) {
    intl = digits.slice(2);
  } else if (digits.startsWith('0')) {
    intl = `49${digits.slice(1)}`;
  }
  const msg =
    status === 'accepted' || status === 'preparing'
      ? `مرحباً من مطعم Kairos Grill 🍽️\nتم استلام طلبكم رقم *#${orderNumber}* بنجاح وجاري تحضيره الآن!`
      : status === 'delivering'
        ? `مرحباً من مطعم Kairos Grill 🚗\nطلبكم رقم *#${orderNumber}* خرج للتوصيل الآن وهو في الطريق إليكم!`
        : `مرحباً من مطعم Kairos Grill\nبخصوص طلبكم رقم *#${orderNumber}*`;
  return `https://wa.me/${intl}?text=${encodeURIComponent(msg)}`;
}

export function AdminDashboard({
  lang,
  onChangeLang,
  onExitAdmin,
}: AdminDashboardProps) {
  const [vaultChecking, setVaultChecking] = useState(true);
  const [vaultExists, setVaultExists] = useState(false);
  const [credentials, setCredentials] = useState<UnlockedKitchenCredentials | null>(null);

  const [pinInput, setPinInput] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [rememberTablet, setRememberTablet] = useState(true);
  const [pinError, setPinError] = useState<string | null>(null);
  const [submittingPin, setSubmittingPin] = useState(false);

  const [showPinRotate, setShowPinRotate] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const [pinRotateStatus, setPinRotateStatus] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);
  const [isRotatingPin, setIsRotatingPin] = useState(false);

  const [activeTab, setActiveTab] = useState<'orders' | 'complaints'>('orders');
  const [orderFilter, setOrderFilter] = useState<'all' | OrderStatus>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [repeatRingPending, setRepeatRingPending] = useState(true);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [complaints, setComplaints] = useState<ComplaintRecord[]>([]);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);
  const [updatingComplaintId, setUpdatingComplaintId] = useState<string | null>(null);
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});
  const [printOrder, setPrintOrder] = useState<OrderRecord | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [confirmDeleteOrderId, setConfirmDeleteOrderId] = useState<string | null>(null);

  const initialOrdersLoadedRef = useRef(false);
  const seenOrderIdsRef = useRef<Set<string>>(new Set());
  const soundEnabledRef = useRef(soundEnabled);
  const langRef = useRef(lang);

  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  useEffect(() => {
    langRef.current = lang;
  }, [lang]);

  // Restore saved tablet session & check vault status
  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        const storedRaw =
          localStorage.getItem(STORAGE_KEY) || sessionStorage.getItem(STORAGE_KEY);
        const vault = await fetchKitchenVault();
        if (cancelled) return;
        setVaultExists(Boolean(vault));

        if (vault && storedRaw) {
          try {
            const parsed = JSON.parse(storedRaw) as {
              privateKeyJwk: JsonWebKey;
              adminWriteSecret: string;
            };
            if (parsed.privateKeyJwk && parsed.adminWriteSecret) {
              const creds = await importCredentialsFromJwk(
                parsed.privateKeyJwk,
                parsed.adminWriteSecret
              );
              if (!cancelled) {
                setCredentials(creds);
              }
            }
          } catch {
            localStorage.removeItem(STORAGE_KEY);
            sessionStorage.removeItem(STORAGE_KEY);
          }
        }
      } finally {
        if (!cancelled) {
          setVaultChecking(false);
        }
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep shop tablet screen awake while AdminDashboard is unlocked
  useEffect(() => {
    if (!credentials || typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
      return;
    }
    let sentinel: { release: () => Promise<void> } | null = null;
    const req = async () => {
      try {
        const nav = navigator as unknown as {
          wakeLock?: { request: (type: string) => Promise<{ release: () => Promise<void> }> };
        };
        if (nav.wakeLock) {
          sentinel = await nav.wakeLock.request('screen');
        }
      } catch {
        // Ignore if battery saver / unsupported
      }
    };
    void req();
    return () => {
      if (sentinel) {
        void sentinel.release().catch(() => {});
      }
    };
  }, [credentials]);

  // Real-time Firestore subscriptions once unlocked
  useEffect(() => {
    if (!credentials) return;
    setSyncError(null);

    const unsubOrders = subscribeAdminOrders(
      credentials.privateKey,
      (incomingOrders) => {
        setSyncError(null);
        const currentLang = langRef.current;
        const isSoundOn = soundEnabledRef.current;
        if (!initialOrdersLoadedRef.current) {
          incomingOrders.forEach((o) => seenOrderIdsRef.current.add(o.id));
          initialOrdersLoadedRef.current = true;
        } else {
          const hasBrandNewPending = incomingOrders.some(
            (o) => o.status === 'pending' && !seenOrderIdsRef.current.has(o.id)
          );
          incomingOrders.forEach((o) => seenOrderIdsRef.current.add(o.id));
          if (hasBrandNewPending && isSoundOn) {
            playNewOrderBell();
            if (
              typeof window !== 'undefined' &&
              'Notification' in window &&
              Notification.permission === 'granted'
            ) {
              try {
                new Notification('Kairos Grill · Neue Bestellung!', {
                  body:
                    currentLang === 'ar'
                      ? 'وصل طلب جديد إلى شاشة المطعم الآن'
                      : 'Eine neue Bestellung ist soeben eingegangen.',
                  icon: '/pwa-192x192.png',
                });
              } catch {
                // Ignore mobile notification fallback
              }
            }
          }
        }
        setOrders(incomingOrders);
      },
      (err) => {
        setSyncError(err.message);
      }
    );

    const unsubComplaints = subscribeAdminComplaints(
      credentials.privateKey,
      (incomingComplaints) => {
        setComplaints(incomingComplaints);
      },
      (err) => {
        setSyncError((prev) => prev ?? err.message);
      }
    );

    return () => {
      unsubOrders();
      unsubComplaints();
    };
  }, [credentials]);

  // Continuous chime every 8 seconds while any order is unaccepted ('pending')
  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  useEffect(() => {
    if (!credentials || !soundEnabled || !repeatRingPending || pendingCount === 0) {
      return;
    }
    const timer = window.setInterval(() => {
      playNewOrderBell();
    }, 8000);
    return () => window.clearInterval(timer);
  }, [credentials, soundEnabled, repeatRingPending, pendingCount]);

  const persistCredentials = (creds: UnlockedKitchenCredentials, persistLongTerm: boolean) => {
    const serialized = JSON.stringify({
      privateKeyJwk: creds.privateKeyJwk,
      adminWriteSecret: creds.adminWriteSecret,
    });
    if (persistLongTerm) {
      localStorage.setItem(STORAGE_KEY, serialized);
      sessionStorage.removeItem(STORAGE_KEY);
    } else {
      sessionStorage.setItem(STORAGE_KEY, serialized);
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const handlePinSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setPinError(null);
    unlockTabletAudio();

    const cleanPin = pinInput.trim();
    if (cleanPin.length < 4) {
      setPinError(
        lang === 'ar'
          ? 'يرجى إدخال رقم سري من 4 أرقام أو أحرف على الأقل.'
          : 'Bitte mindestens 4 Zeichen/Ziffern als PIN eingeben.'
      );
      return;
    }

    if (!vaultExists && cleanPin !== pinConfirm.trim()) {
      setPinError(
        lang === 'ar'
          ? 'الرقمان السريان غير متطابقين.'
          : 'Die beiden PIN-Eingaben stimmen nicht überein.'
      );
      return;
    }

    setSubmittingPin(true);
    try {
      const creds = vaultExists
        ? await verifyAndUnlockKitchenVault(cleanPin)
        : await initializeKitchenVault(cleanPin);

      setVaultExists(true);
      persistCredentials(creds, rememberTablet);
      setCredentials(creds);
      setPinInput('');
      setPinConfirm('');
      playNewOrderBell();

      if (
        typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'default'
      ) {
        void Notification.requestPermission().catch(() => {});
      }
    } catch {
      setPinError(
        vaultExists
          ? lang === 'ar'
            ? 'الرقم السري غير صحيح، حاول مرة أخرى.'
            : 'Falsche Admin-PIN. Bitte erneut versuchen.'
          : lang === 'ar'
            ? 'تعذر حفظ الرقم السري الآن، تحقق من الاتصال بالإنترنت.'
            : 'Einrichtung fehlgeschlagen. Bitte Internetverbindung prüfen.'
      );
    } finally {
      setSubmittingPin(false);
    }
  };

  const handleRotatePin = async (e: FormEvent) => {
    e.preventDefault();
    if (!credentials || isRotatingPin) return;
    setPinRotateStatus(null);

    if (newPin.trim().length < 4) {
      setPinRotateStatus({
        text:
          lang === 'ar'
            ? 'الرقم الجديد يجب أن يكون 4 خانات على الأقل'
            : 'Mindestens 4 Zeichen',
        isError: true,
      });
      return;
    }
    if (newPin.trim() !== newPinConfirm.trim()) {
      setPinRotateStatus({
        text: lang === 'ar' ? 'الرقمان غير متطابقين' : 'PINs stimmen nicht überein',
        isError: true,
      });
      return;
    }

    setIsRotatingPin(true);
    try {
      await rotateKitchenPin(credentials, newPin.trim());
      setPinRotateStatus({
        text:
          lang === 'ar'
            ? 'تم تغيير الرقم السري بنجاح! استخدم الرقم الجديد في المرات القادمة.'
            : 'Admin-PIN erfolgreich geändert!',
        isError: false,
      });
      setNewPin('');
      setNewPinConfirm('');
      setTimeout(() => {
        setShowPinRotate(false);
        setPinRotateStatus(null);
      }, 1600);
    } catch {
      setPinRotateStatus({
        text:
          lang === 'ar'
            ? 'تعذر تحديث الرقم السري، تحقق من الاتصال بالإنترنت.'
            : 'PIN konnte nicht geändert werden.',
        isError: true,
      });
    } finally {
      setIsRotatingPin(false);
    }
  };

  const handleLockTablet = () => {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    setCredentials(null);
    initialOrdersLoadedRef.current = false;
    seenOrderIdsRef.current.clear();
  };

  const handleOrderStatusChange = async (order: OrderRecord, nextStatus: OrderStatus) => {
    if (!credentials) return;
    setSyncError(null);
    setActionNotice(null);
    setConfirmDeleteOrderId(null);
    setUpdatingOrderId(order.id);
    try {
      await updateOrderStatus(order.id, nextStatus, credentials.adminWriteSecret);
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'UPDATE_FAILED');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleDeleteOrderFromList = async (order: OrderRecord) => {
    if (!credentials) return;
    setSyncError(null);
    setActionNotice(null);
    setConfirmDeleteOrderId(null);
    setUpdatingOrderId(order.id);
    try {
      await deleteOrderRecord(order, credentials.adminWriteSecret);
      seenOrderIdsRef.current.delete(order.id);
      setActionNotice(
        lang === 'ar'
          ? `تم حذف الطلب #${order.orderNumber} من قائمة الطلبات.`
          : `Bestellung #${order.orderNumber} wurde aus der Liste gelöscht.`
      );
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'DELETE_FAILED');
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleComplaintStatusChange = async (
    complaint: ComplaintRecord,
    nextStatus: ComplaintStatus
  ) => {
    if (!credentials) return;
    setSyncError(null);
    setUpdatingComplaintId(complaint.id);
    try {
      const note = noteDrafts[complaint.id] ?? complaint.adminNote ?? '';
      await updateComplaintStatus(
        complaint.id,
        nextStatus,
        note,
        credentials.adminWriteSecret
      );
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'UPDATE_FAILED');
    } finally {
      setUpdatingComplaintId(null);
    }
  };

  const handlePrintOrder = (order: OrderRecord) => {
    setPrintOrder(order);
    setTimeout(() => {
      window.print();
    }, 80);
  };

  const newComplaintsCount = complaints.filter((c) => c.status === 'new').length;
  const filteredOrders =
    orderFilter === 'all' ? orders : orders.filter((o) => o.status === orderFilter);

  if (vaultChecking) {
    return (
      <div className="min-h-screen bg-[#0B0D0F] flex items-center justify-center p-6">
        <p className="text-[14px] font-bold text-[#A3ACB3]">
          {lang === 'ar' ? 'جاري تجهيز لوحة التابلت...' : 'Tablet-Empfang wird geladen...'}
        </p>
      </div>
    );
  }

  // PIN Lock / First-Time PIN Setup Screen (Works 100% Free on Vercel / Tablet PWA)
  if (!credentials) {
    return (
      <div className="min-h-screen bg-[#0B0D0F] text-[#F4F5F6] flex flex-col">
        <header className="bg-[#14171A] border-b border-[#262B31]">
          <div className="max-w-[1100px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
            <div className="bg-white rounded-[10px] px-2.5 py-1 inline-flex items-center">
              <img
                src={KAIROS_ASSETS.logoBanner}
                alt="Kairos Grill Admin"
                className="h-9 w-auto object-contain"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => onChangeLang(lang === 'ar' ? 'de' : 'ar')}
                className="h-10 px-3 rounded-[12px] bg-[#1C2024] hover:bg-[#23282D] border border-[#262B31] text-[12px] font-bold text-[#F4F5F6] transition-colors"
              >
                {lang === 'ar' ? 'DE' : 'AR'}
              </button>
              <button
                type="button"
                onClick={onExitAdmin}
                className="h-10 px-4 rounded-[12px] bg-[#1C2024] hover:bg-[#23282D] border border-[#262B31] text-[13px] font-bold text-[#F4F5F6] inline-flex items-center gap-1.5 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>{lang === 'ar' ? 'العودة للمنيو' : 'Zur Speisekarte'}</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-[#14171A] rounded-[16px] border border-[#262B31] shadow-[0_12px_32px_rgba(0,0,0,0.45)] p-6 sm:p-8 space-y-5">
            <div className="text-center space-y-2">
              <img
                src="/pwa-192x192.png"
                alt="Kairos Grill Tablet"
                className="w-20 h-20 mx-auto object-contain"
              />
              <h1 className="font-display text-[22px] font-extrabold text-[#F4F5F6]">
                {vaultExists
                  ? lang === 'ar'
                    ? 'استقبال طلبات المطعم (التابلت)'
                    : 'Kairos Grill Tablet-Empfang'
                  : lang === 'ar'
                    ? 'إعداد الرقم السري للتابلت (أول مرة)'
                    : 'Erste Einrichtung: Admin-PIN wählen'}
              </h1>
              <p className="text-[13px] text-[#A3ACB3] leading-relaxed">
                {vaultExists
                  ? lang === 'ar'
                    ? 'أدخل الرقم السري الخاص بصاحب المطعم لفتح شاشة استقبال الطلبات المباشرة على التابلت.'
                    : 'Geben Sie Ihre geheime Admin-PIN ein, um Live-Bestellungen auf diesem Tablet zu empfangen.'
                  : lang === 'ar'
                    ? 'اختر رقماً سرياً خاصاً بك لحماية شاشة استقبال الطلبات والشكاوي. لن يتمكن أي زبون من الدخول دون هذا الرقم.'
                    : 'Legen Sie jetzt Ihre persönliche geheime PIN fest, um Bestellungen & Beschwerden exklusiv für das Restaurant zu schützen.'}
              </p>
            </div>

            <form onSubmit={handlePinSubmit} className="space-y-3.5">
              <div>
                <label className="block text-[12px] font-bold text-[#F4F5F6] mb-1">
                  {vaultExists
                    ? lang === 'ar'
                      ? 'الرقم السري (PIN)'
                      : 'Geheime Admin-PIN'
                    : lang === 'ar'
                      ? 'الرقم السري الجديد (4 خانات على الأقل)'
                      : 'Neue Admin-PIN (mind. 4 Zeichen)'}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[#FF8000] absolute top-3.5 left-3.5 pointer-events-none" />
                  <input
                    type="password"
                    inputMode="numeric"
                    autoComplete="off"
                    value={pinInput}
                    onChange={(e) => setPinInput(e.target.value)}
                    placeholder="••••••"
                    dir="ltr"
                    className="w-full h-11 pl-10 pr-4 rounded-[12px] bg-[#1C2024] border border-[#262B31] text-[#F4F5F6] placeholder:text-[#A3ACB3]/60 focus:border-[#FF8000] focus:bg-[#23282D] focus:outline-none text-[16px] font-bold tracking-widest"
                  />
                </div>
              </div>

              {!vaultExists && (
                <div>
                  <label className="block text-[12px] font-bold text-[#F4F5F6] mb-1">
                    {lang === 'ar' ? 'تأكيد الرقم السري' : 'Admin-PIN bestätigen'}
                  </label>
                  <div className="relative">
                    <ShieldCheck className="w-4 h-4 text-[#4ADE80] absolute top-3.5 left-3.5 pointer-events-none" />
                    <input
                      type="password"
                      inputMode="numeric"
                      autoComplete="off"
                      value={pinConfirm}
                      onChange={(e) => setPinConfirm(e.target.value)}
                      placeholder="••••••"
                      dir="ltr"
                      className="w-full h-11 pl-10 pr-4 rounded-[12px] bg-[#1C2024] border border-[#262B31] text-[#F4F5F6] placeholder:text-[#A3ACB3]/60 focus:border-[#FF8000] focus:bg-[#23282D] focus:outline-none text-[16px] font-bold tracking-widest"
                    />
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2 text-[12px] text-[#A3ACB3] cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberTablet}
                  onChange={(e) => setRememberTablet(e.target.checked)}
                  className="w-4 h-4 accent-[#FF8000] rounded"
                />
                <span>
                  {lang === 'ar'
                    ? 'إبقاء شاشة التابلت مفتوحة على هذا الجهاز'
                    : 'Auf diesem Tablet angemeldet bleiben'}
                </span>
              </label>

              {pinError && (
                <p className="p-3 rounded-[10px] bg-red-500/15 border border-red-500/35 text-[12px] font-semibold text-red-400">
                  {pinError}
                </p>
              )}

              <button
                type="submit"
                disabled={submittingPin}
                className="w-full h-12 rounded-[12px] bg-[#FF8000] hover:bg-[#E67300] disabled:opacity-60 text-white font-display font-bold text-[14px] shadow-[0_8px_20px_rgba(255,128,0,0.28)] transition-colors"
              >
                {submittingPin
                  ? lang === 'ar'
                    ? 'جاري التحقق...'
                    : 'Wird entsperrt...'
                  : vaultExists
                    ? lang === 'ar'
                      ? 'فتح شاشة الطلبات'
                      : 'Bestell-Empfang öffnen'
                    : lang === 'ar'
                      ? 'حفظ الرقم السري وفتح التابلت'
                      : 'PIN speichern & Tablet starten'}
              </button>
            </form>
          </div>
        </main>
      </div>
    );
  }

  // Unlocked Shop Tablet Live Orders & Complaints Dashboard
  return (
    <div className="min-h-screen bg-[#0B0D0F] text-[#F4F5F6] flex flex-col">
      {/* Print-Only Kitchen Ticket */}
      {printOrder && (
        <div className="hidden print:block p-6 bg-white text-black font-sans text-[13px] max-w-md mx-auto">
          <h2 className="text-[20px] font-extrabold border-b-2 border-black pb-2 mb-3">
            Kairos Grill · #{printOrder.orderNumber}
          </h2>
          <p className="font-bold">{printOrder.customerName}</p>
          <p>{printOrder.customerPhone}</p>
          <p className="mb-3">{printOrder.address}</p>
          <div className="border-y border-black py-2 my-2 space-y-1">
            {printOrder.items.map((item, idx) => (
              <div key={idx} className="flex justify-between">
                <span>
                  {item.qty}x {item.itemNumber ? `#${item.itemNumber} ` : ''}
                  {item.nameDe} {item.variantLabel ? `(${item.variantLabel})` : ''}
                </span>
                <span>{formatEuro(item.unitPrice * item.qty)}</span>
              </div>
            ))}
          </div>
          {printOrder.notes && <p className="font-bold mb-2">Hinweis: {printOrder.notes}</p>}
          <p>Netto: {formatEuro(printOrder.subtotal)}</p>
          {printOrder.foodTax > 0 && <p>MwSt 7%: +{formatEuro(printOrder.foodTax)}</p>}
          {printOrder.drinksTax > 0 && <p>MwSt 19%: +{formatEuro(printOrder.drinksTax)}</p>}
          <p>Lieferung: {formatEuro(printOrder.deliveryFee)}</p>
          <p className="text-[18px] font-extrabold mt-2">
            Gesamt: {formatEuro(printOrder.total)} ({printOrder.paymentMethod === 'cash' ? 'Bar' : 'Online'})
          </p>
        </div>
      )}

      {/* Top Tablet Header */}
      <header className="sticky top-0 z-40 bg-[#14171A] border-b border-[#262B31] print:hidden">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <img
              src="/pwa-192x192.png"
              alt="Kairos Grill Tablet"
              className="w-10 h-10 object-contain shrink-0"
            />
            <div>
              <h1 className="font-display text-[16px] sm:text-[18px] font-extrabold text-[#F4F5F6]">
                {lang === 'ar' ? 'تابلت استقبال طلبات Kairos Grill' : 'Kairos Grill Bestell-Tablet'}
              </h1>
              <p className="text-[11px] text-[#A3ACB3] tabular-nums">
                {pendingCount > 0
                  ? lang === 'ar'
                    ? `${pendingCount} طلب جديد بانتظار القبول`
                    : `${pendingCount} neue Bestellung(en) warten`
                  : lang === 'ar'
                    ? 'متصل لحظياً بالطلبات'
                    : 'Live mit Bestellungen verbunden'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Sound Alert Toggle */}
            <button
              type="button"
              onClick={() => {
                unlockTabletAudio();
                const next = !soundEnabled;
                setSoundEnabled(next);
                if (next) playNewOrderBell();
              }}
              className={`h-10 px-3.5 rounded-[12px] text-[12px] font-bold inline-flex items-center gap-1.5 border transition-colors ${
                soundEnabled
                  ? 'bg-[#22C55E]/15 border-[#22C55E]/35 text-[#4ADE80]'
                  : 'bg-[#1C2024] border-[#262B31] text-[#A3ACB3]'
              }`}
            >
              {soundEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
              <span>
                {soundEnabled
                  ? lang === 'ar'
                    ? 'جرس التنبيه مفعل'
                    : 'Signalton an'
                  : lang === 'ar'
                    ? 'صامت'
                    : 'Stumm'}
              </span>
            </button>

            {soundEnabled && (
              <button
                type="button"
                onClick={() => setRepeatRingPending((v) => !v)}
                className={`h-10 px-3 rounded-[12px] text-[12px] font-bold border transition-colors ${
                  repeatRingPending
                    ? 'bg-[#FF8000]/15 border-[#FF8000]/40 text-[#FF8000]'
                    : 'bg-[#1C2024] border-[#262B31] text-[#A3ACB3]'
                }`}
              >
                {repeatRingPending
                  ? lang === 'ar'
                    ? 'رنين متكرر'
                    : 'Dauerton an'
                  : lang === 'ar'
                    ? 'رنة واحدة'
                    : 'Einzelton'}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setShowPinRotate((v) => !v);
                setPinRotateStatus(null);
              }}
              className={`h-10 px-3 rounded-[12px] border text-[12px] font-bold inline-flex items-center gap-1.5 transition-colors ${
                showPinRotate
                  ? 'bg-[#FF8000]/15 border-[#FF8000]/40 text-[#FF8000]'
                  : 'bg-[#1C2024] hover:bg-[#23282D] border-[#262B31] text-[#F4F5F6]'
              }`}
            >
              <KeyRound className="w-3.5 h-3.5 text-[#FF8000]" />
              <span>{lang === 'ar' ? 'تغيير الرقم السري' : 'PIN ändern'}</span>
            </button>

            <button
              type="button"
              onClick={onExitAdmin}
              className="h-10 px-3.5 rounded-[12px] bg-[#1C2024] hover:bg-[#23282D] border border-[#262B31] text-[12px] font-bold text-[#F4F5F6] transition-colors"
            >
              {lang === 'ar' ? 'عرض المنيو' : 'Speisekarte'}
            </button>

            <button
              type="button"
              onClick={() => onChangeLang(lang === 'ar' ? 'de' : 'ar')}
              className="h-10 px-3 rounded-[12px] bg-[#1C2024] hover:bg-[#23282D] border border-[#262B31] text-[12px] font-bold text-[#F4F5F6] transition-colors"
            >
              {lang === 'ar' ? 'DE' : 'AR'}
            </button>

            <button
              type="button"
              onClick={handleLockTablet}
              aria-label="Lock tablet"
              className="h-10 px-3 rounded-[12px] bg-[#1C2024] hover:bg-red-500/15 border border-[#262B31] hover:border-red-500/35 text-[12px] font-bold text-[#A3ACB3] hover:text-red-400 inline-flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">{lang === 'ar' ? 'قفل' : 'Sperren'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-[1280px] w-full mx-auto px-4 sm:px-6 py-6 space-y-5 print:hidden">
        {/* Optional PIN Change Inline Bar */}
        {showPinRotate && (
          <form
            onSubmit={handleRotatePin}
            className="bg-[#14171A] rounded-[16px] border border-[#FF8000]/40 p-4 flex flex-wrap items-end gap-3"
          >
            <div className="flex-1 min-w-[160px]">
              <label className="block text-[11px] font-bold text-[#F4F5F6] mb-1">
                {lang === 'ar' ? 'الرقم السري الجديد' : 'Neue Admin-PIN'}
              </label>
              <input
                type="password"
                inputMode="numeric"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                placeholder="••••••"
                dir="ltr"
                className="w-full h-10 px-3 rounded-[10px] bg-[#1C2024] border border-[#262B31] text-[13px] text-[#F4F5F6] placeholder:text-[#A3ACB3]/60 focus:outline-none focus:border-[#FF8000]"
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <label className="block text-[11px] font-bold text-[#F4F5F6] mb-1">
                {lang === 'ar' ? 'تأكيد الرقم الجديد' : 'Neue PIN bestätigen'}
              </label>
              <input
                type="password"
                inputMode="numeric"
                value={newPinConfirm}
                onChange={(e) => setNewPinConfirm(e.target.value)}
                placeholder="••••••"
                dir="ltr"
                className="w-full h-10 px-3 rounded-[10px] bg-[#1C2024] border border-[#262B31] text-[13px] text-[#F4F5F6] placeholder:text-[#A3ACB3]/60 focus:outline-none focus:border-[#FF8000]"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                type="submit"
                disabled={isRotatingPin}
                className="h-10 px-4 rounded-[10px] bg-[#FF8000] hover:bg-[#E67300] disabled:opacity-60 text-white text-[12px] font-bold transition-colors"
              >
                {isRotatingPin
                  ? lang === 'ar'
                    ? 'جاري الحفظ...'
                    : 'Speichern...'
                  : lang === 'ar'
                    ? 'حفظ الرقم الجديد'
                    : 'PIN speichern'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPinRotate(false);
                  setPinRotateStatus(null);
                }}
                className="h-10 px-3 rounded-[10px] bg-[#1C2024] hover:bg-[#23282D] border border-[#262B31] text-[#F4F5F6] text-[12px] font-bold transition-colors"
              >
                {lang === 'ar' ? 'إغلاق' : 'Schließen'}
              </button>
            </div>
            {pinRotateStatus && (
              <p
                className={`w-full text-[12px] font-bold ${
                  pinRotateStatus.isError ? 'text-red-400' : 'text-[#4ADE80]'
                }`}
              >
                {pinRotateStatus.text}
              </p>
            )}
          </form>
        )}

        {syncError && (
          <div className="p-4 rounded-[12px] bg-red-500/15 border border-red-500/35 text-red-400 text-[13px] font-semibold">
            {lang === 'ar'
              ? 'تعذر الاتصال بقائمة الطلبات حالياً. تحقق من الاتصال بالإنترنت وأعد تحميل الصفحة.'
              : 'Verbindung zur Bestellliste fehlgeschlagen. Bitte Internetverbindung prüfen und neu laden.'}
          </div>
        )}

        {actionNotice && (
          <div className="p-3.5 rounded-[12px] bg-[#22C55E]/15 border border-[#22C55E]/35 text-[#4ADE80] text-[13px] font-bold flex items-center justify-between gap-2">
            <span>{actionNotice}</span>
            <button
              type="button"
              onClick={() => setActionNotice(null)}
              className="text-[12px] underline shrink-0"
            >
              {lang === 'ar' ? 'إغلاق' : 'Schließen'}
            </button>
          </div>
        )}

        {/* Primary Section Switcher: Orders vs Complaints */}
        <div className="flex flex-wrap items-center gap-2.5 border-b border-[#262B31] pb-4">
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`h-11 px-5 rounded-[12px] font-display text-[13px] font-bold inline-flex items-center gap-2 transition-colors ${
              activeTab === 'orders'
                ? 'bg-[#FF8000] text-white shadow-[0_6px_16px_rgba(255,128,0,0.25)]'
                : 'bg-[#14171A] border border-[#262B31] text-[#F4F5F6] hover:bg-[#1C2024]'
            }`}
          >
            <ChefHat className="w-4 h-4" />
            <span>
              {lang === 'ar' ? `الطلبات المباشرة (${orders.length})` : `Bestellungen (${orders.length})`}
            </span>
            {pendingCount > 0 && (
              <span className="px-2 py-0.5 rounded-[8px] text-[11px] font-extrabold bg-[#0B0D0F] text-[#FF8000] tabular-nums">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('complaints')}
            className={`h-11 px-5 rounded-[12px] font-display text-[13px] font-bold inline-flex items-center gap-2 transition-colors ${
              activeTab === 'complaints'
                ? 'bg-[#262B31] text-[#F4F5F6] border border-[#FF8000]/40'
                : 'bg-[#14171A] border border-[#262B31] text-[#F4F5F6] hover:bg-[#1C2024]'
            }`}
          >
            <MessageSquareWarning className="w-4 h-4" />
            <span>
              {lang === 'ar' ? `الشكاوي الواردة (${complaints.length})` : `Beschwerden (${complaints.length})`}
            </span>
            {newComplaintsCount > 0 && (
              <span className="px-2 py-0.5 rounded-[8px] text-[11px] font-extrabold bg-[#FF8000] text-white tabular-nums">
                {newComplaintsCount}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'orders' ? (
          <>
            {/* Order Status Filters */}
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              {(
                [
                  { id: 'all', ar: `الكل (${orders.length})`, de: `Alle (${orders.length})` },
                  { id: 'pending', ar: `بانتظار الاستلام (${pendingCount})`, de: `Neu (${pendingCount})` },
                  { id: 'accepted', ar: 'تم الاستلام', de: 'Angenommen' },
                  { id: 'preparing', ar: 'جاري التحضير', de: 'In Zubereitung' },
                  { id: 'delivering', ar: 'في التوصيل', de: 'Unterwegs' },
                  { id: 'completed', ar: 'تم التسليم', de: 'Fertig' },
                  { id: 'cancelled', ar: 'ملغاة', de: 'Storniert' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setOrderFilter(tab.id)}
                  className={`h-10 px-4 rounded-[12px] text-[12px] font-bold whitespace-nowrap shrink-0 transition-colors ${
                    orderFilter === tab.id
                      ? 'bg-[#FF8000] text-white'
                      : 'bg-[#14171A] border border-[#262B31] text-[#A3ACB3] hover:text-[#F4F5F6] hover:bg-[#1C2024]'
                  }`}
                >
                  {lang === 'ar' ? tab.ar : tab.de}
                </button>
              ))}
            </div>

            {filteredOrders.length === 0 ? (
              <div className="bg-[#14171A] rounded-[16px] border border-[#262B31] p-10 text-center space-y-2">
                <ChefHat className="w-9 h-9 text-[#FF8000] mx-auto" />
                <p className="font-display text-[17px] font-bold text-[#F4F5F6]">
                  {lang === 'ar' ? 'لا توجد طلبات في هذا القسم حالياً' : 'Keine Bestellungen vorhanden'}
                </p>
                <p className="text-[13px] text-[#A3ACB3]">
                  {lang === 'ar'
                    ? 'بمجرد أن يطلب أي زبون من الموقع سيصل الطلب والفاتورة على هذا التابلت فوراً مع جرس تنبيه.'
                    : 'Sobald ein Kunde bestellt, erscheint die Bestellung hier sofort mit akustischem Signal.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {filteredOrders.map((order) => {
                  const statusMeta = STATUS_LABELS[order.status];
                  const isUpdating = updatingOrderId === order.id;
                  const createdStr = order.createdAt?.toDate
                    ? order.createdAt.toDate().toLocaleString(lang === 'ar' ? 'ar-EG' : 'de-DE', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit',
                      })
                    : '';

                  return (
                    <article
                      key={order.id}
                      className={`bg-[#14171A] rounded-[16px] border p-5 shadow-[0_8px_24px_rgba(0,0,0,0.35)] flex flex-col justify-between gap-4 ${
                        order.status === 'pending' ? 'border-[#FF8000] ring-2 ring-[#FF8000]/25' : 'border-[#262B31]'
                      }`}
                    >
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-[#262B31]">
                          <div>
                            <div className="flex items-center gap-2 text-[12px] text-[#A3ACB3] tabular-nums">
                              <span className="font-extrabold text-[#F4F5F6] text-[16px]">
                                #{order.orderNumber}
                              </span>
                              {createdStr && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span>{createdStr}</span>
                                </>
                              )}
                            </div>
                            <p
                              className={`inline-block mt-1.5 px-2.5 py-0.5 rounded-[8px] text-[11px] font-bold ${statusMeta.tone}`}
                            >
                              {lang === 'ar' ? statusMeta.ar : statusMeta.de}
                            </p>
                          </div>

                          <div className="text-end">
                            <p className="font-display text-[20px] font-extrabold text-[#FF8000] tabular-nums">
                              {formatEuro(order.total)}
                            </p>
                            <p className="text-[11px] font-semibold text-[#A3ACB3]">
                              {order.paymentMethod === 'payment_link'
                                ? lang === 'ar'
                                  ? 'رابط دفع إلكتروني'
                                  : 'Online-Zahlung'
                                : lang === 'ar'
                                  ? 'نقداً عند الاستلام'
                                  : 'Barzahlung'}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px] bg-[#1C2024] border border-[#262B31] rounded-[12px] p-3.5">
                          <div className="space-y-1">
                            <p className="font-bold text-[#F4F5F6]">{order.customerName}</p>
                            <a
                              href={`tel:${order.customerPhone}`}
                              className="inline-flex items-center gap-1.5 text-[#FF8000] font-bold tabular-nums hover:underline"
                            >
                              <Phone className="w-3.5 h-3.5" />
                              <span>{order.customerPhone}</span>
                            </a>
                          </div>

                          <div className="space-y-1">
                            <p className="font-semibold text-[#F4F5F6] flex items-start gap-1.5">
                              <MapPin className="w-4 h-4 text-[#FF8000] shrink-0 mt-0.5" />
                              <span>{order.address}</span>
                            </p>
                            {order.orderMode === 'delivery' && (order.gpsText || order.address) && (
                              <a
                                href={
                                  order.gpsText
                                    ? `https://maps.google.com/?q=${order.gpsText}`
                                    : `https://maps.google.com/?q=${encodeURIComponent(`${order.address}, Rostock`)}`
                                }
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] font-bold text-[#60A5FA] hover:underline"
                              >
                                <span>
                                  {order.gpsText
                                    ? lang === 'ar'
                                      ? 'فتح الإحداثيات على Google Maps'
                                      : 'GPS-Standort in Google Maps'
                                    : lang === 'ar'
                                      ? 'فتح العنوان على Google Maps'
                                      : 'Adresse in Google Maps suchen'}
                                </span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          {order.items.map((item, idx) => (
                            <div
                              key={`${order.id}-item-${idx}`}
                              className="flex items-start justify-between gap-2 text-[13px]"
                            >
                              <span className="text-[#F4F5F6] font-medium">
                                <strong className="text-[#FF8000] tabular-nums">{item.qty}×</strong>{' '}
                                {item.itemNumber ? `#${item.itemNumber} ` : ''}
                                {lang === 'ar' ? item.nameAr : item.nameDe}
                                {item.variantLabel ? ` (${item.variantLabel})` : ''}
                              </span>
                              <span className="font-bold text-[#F4F5F6] tabular-nums shrink-0">
                                {formatEuro(item.unitPrice * item.qty)}
                              </span>
                            </div>
                          ))}

                          {order.notes && (
                            <p className="mt-2 pt-2 border-t border-[#262B31] text-[12px] font-semibold text-[#FF8000]">
                              {lang === 'ar' ? 'ملاحظات الزبون:' : 'Hinweis:'} {order.notes}
                            </p>
                          )}

                          <div className="pt-2 border-t border-[#262B31] flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#A3ACB3] tabular-nums">
                            <span>{lang === 'ar' ? 'صافي:' : 'Netto:'} {formatEuro(order.subtotal)}</span>
                            {order.foodTax > 0 && <span>7%: +{formatEuro(order.foodTax)}</span>}
                            {order.drinksTax > 0 && <span>19%: +{formatEuro(order.drinksTax)}</span>}
                            <span>{lang === 'ar' ? 'توصيل:' : 'Lieferung:'} {formatEuro(order.deliveryFee)}</span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-[#262B31] flex flex-wrap gap-2">
                        {order.status === 'pending' && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleOrderStatusChange(order, 'accepted')}
                            className="flex-1 min-w-[160px] h-11 px-4 rounded-[12px] bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-60 text-white font-display font-bold text-[13px] inline-flex items-center justify-center gap-2 transition-colors"
                          >
                            <Check className="w-4 h-4" />
                            <span>
                              {lang === 'ar' ? 'تم استلام الطلب' : 'Bestellung annehmen'}
                            </span>
                          </button>
                        )}

                        {(order.status === 'pending' || order.status === 'accepted') && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleOrderStatusChange(order, 'preparing')}
                            className="h-11 px-4 rounded-[12px] bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white text-[12px] font-bold inline-flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <ChefHat className="w-4 h-4" />
                            <span>{lang === 'ar' ? 'جاري التحضير' : 'Zubereiten'}</span>
                          </button>
                        )}

                        {(order.status === 'accepted' || order.status === 'preparing') && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleOrderStatusChange(order, 'delivering')}
                            className="h-11 px-4 rounded-[12px] bg-[#7C3AED] hover:bg-[#6D28D9] disabled:opacity-60 text-white text-[12px] font-bold inline-flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Truck className="w-4 h-4" />
                            <span>{lang === 'ar' ? 'خرج للتوصيل' : 'Unterwegs'}</span>
                          </button>
                        )}

                        {order.status !== 'completed' && order.status !== 'cancelled' && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleOrderStatusChange(order, 'completed')}
                            className="h-11 px-4 rounded-[12px] bg-[#262B31] hover:bg-[#323840] disabled:opacity-60 text-[#F4F5F6] text-[12px] font-bold inline-flex items-center justify-center gap-1.5 transition-colors"
                          >
                            <Check className="w-4 h-4" />
                            <span>{lang === 'ar' ? 'تم التسليم' : 'Fertig'}</span>
                          </button>
                        )}

                        {order.status === 'pending' && (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleOrderStatusChange(order, 'cancelled')}
                            className="h-11 px-3.5 rounded-[12px] bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/35 text-[12px] font-bold inline-flex items-center gap-1.5 transition-colors"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>{lang === 'ar' ? 'إلغاء' : 'Stornieren'}</span>
                          </button>
                        )}

                        {(order.status === 'completed' || order.status === 'cancelled') ? (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleDeleteOrderFromList(order)}
                            className="h-11 px-3.5 rounded-[12px] bg-red-500/15 hover:bg-red-500/25 disabled:opacity-60 text-red-400 border border-red-500/35 text-[12px] font-bold inline-flex items-center gap-1.5 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>{lang === 'ar' ? 'حذف من القائمة' : 'Aus Liste löschen'}</span>
                          </button>
                        ) : confirmDeleteOrderId === order.id ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => handleDeleteOrderFromList(order)}
                              className="h-11 px-3.5 rounded-[12px] bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-[12px] font-bold inline-flex items-center gap-1.5 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                              <span>{lang === 'ar' ? 'تأكيد الحذف' : 'Löschen bestätigen'}</span>
                            </button>
                            <button
                              type="button"
                              disabled={isUpdating}
                              onClick={() => setConfirmDeleteOrderId(null)}
                              className="h-11 px-3 rounded-[12px] bg-[#1C2024] hover:bg-[#23282D] text-[#F4F5F6] border border-[#262B31] text-[12px] font-bold transition-colors"
                            >
                              {lang === 'ar' ? 'تراجع' : 'Abbrechen'}
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => setConfirmDeleteOrderId(order.id)}
                            className="h-11 px-3.5 rounded-[12px] bg-red-500/15 hover:bg-red-500/25 disabled:opacity-60 text-red-400 border border-red-500/35 text-[12px] font-bold inline-flex items-center gap-1.5 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                            <span>{lang === 'ar' ? 'حذف من القائمة' : 'Aus Liste löschen'}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handlePrintOrder(order)}
                          className="h-11 px-3.5 rounded-[12px] bg-[#1C2024] hover:bg-[#23282D] text-[#F4F5F6] border border-[#262B31] text-[12px] font-bold inline-flex items-center gap-1.5 transition-colors"
                        >
                          <Printer className="w-4 h-4" />
                          <span>{lang === 'ar' ? 'طباعة' : 'Drucken'}</span>
                        </button>

                        <a
                          href={formatCustomerWhatsAppReply(
                            order.customerPhone,
                            order.orderNumber,
                            order.status
                          )}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="h-11 px-3.5 rounded-[12px] bg-[#22C55E]/15 hover:bg-[#22C55E]/25 text-[#4ADE80] border border-[#22C55E]/35 text-[12px] font-bold inline-flex items-center gap-1.5 transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                          <span>{lang === 'ar' ? 'واتساب للزبون' : 'WhatsApp'}</span>
                        </a>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          /* Complaints Management Section */
          <div className="space-y-4">
            {complaints.length === 0 ? (
              <div className="bg-[#14171A] rounded-[16px] border border-[#262B31] p-10 text-center space-y-2">
                <MessageSquareWarning className="w-9 h-9 text-[#FF8000] mx-auto" />
                <p className="font-display text-[17px] font-bold text-[#F4F5F6]">
                  {lang === 'ar' ? 'لا توجد شكاوي أو ملاحظات حالياً' : 'Keine Beschwerden vorhanden'}
                </p>
                <p className="text-[13px] text-[#A3ACB3]">
                  {lang === 'ar'
                    ? 'أي شكوى يرسلها الزبون من قسم «الإدارة» ستظهر هنا فوراً للمتابعة.'
                    : 'Sobald ein Kunde eine Meldung einreicht, erscheint sie hier.'}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {complaints.map((c) => {
                  const statusMeta = COMPLAINT_STATUS_LABELS[c.status];
                  const catLabel = COMPLAINT_CATEGORY_LABELS[c.category];
                  const isUpdating = updatingComplaintId === c.id;
                  const createdStr = c.createdAt?.toDate
                    ? c.createdAt.toDate().toLocaleString(lang === 'ar' ? 'ar-EG' : 'de-DE', {
                        hour: '2-digit',
                        minute: '2-digit',
                        day: '2-digit',
                        month: '2-digit',
                      })
                    : '';

                  return (
                    <article
                      key={c.id}
                      className={`bg-[#14171A] rounded-[16px] border p-5 space-y-3.5 ${
                        c.status === 'new' ? 'border-[#FF8000]' : 'border-[#262B31]'
                      }`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2 pb-3 border-b border-[#262B31]">
                        <div>
                          <div className="flex items-center gap-2 text-[12px] text-[#A3ACB3] tabular-nums">
                            <span className="font-extrabold text-[#F4F5F6] text-[15px]">
                              #{c.complaintNumber}
                            </span>
                            {createdStr && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{createdStr}</span>
                              </>
                            )}
                          </div>
                          <p className="text-[12px] font-bold text-[#FF8000] mt-1">
                            {lang === 'ar' ? catLabel.ar : catLabel.de}
                          </p>
                        </div>

                        <span
                          className={`px-2.5 py-1 rounded-[8px] text-[11px] font-bold ${statusMeta.tone}`}
                        >
                          {lang === 'ar' ? statusMeta.ar : statusMeta.de}
                        </span>
                      </div>

                      <div className="bg-[#1C2024] border border-[#262B31] rounded-[12px] p-3.5 space-y-1 text-[13px]">
                        <p className="font-bold text-[#F4F5F6]">{c.customerName}</p>
                        {c.customerPhone && (
                          <a
                            href={`tel:${c.customerPhone}`}
                            className="inline-flex items-center gap-1.5 text-[#FF8000] font-bold tabular-nums hover:underline"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>{c.customerPhone}</span>
                          </a>
                        )}
                        {c.orderNumber && (
                          <p className="text-[12px] text-[#A3ACB3]">
                            {lang === 'ar' ? 'رقم الطلب:' : 'Bestell-Nr.:'} #{c.orderNumber}
                          </p>
                        )}
                      </div>

                      <p className="text-[13px] text-[#F4F5F6] leading-relaxed bg-[#1C2024] border border-[#262B31] rounded-[10px] p-3">
                        {c.message}
                      </p>

                      <div className="space-y-2">
                        <input
                          type="text"
                          maxLength={300}
                          value={noteDrafts[c.id] ?? c.adminNote ?? ''}
                          onChange={(e) =>
                            setNoteDrafts((prev) => ({ ...prev, [c.id]: e.target.value }))
                          }
                          placeholder={
                            lang === 'ar'
                              ? 'ملاحظة الإدارة الداخلية (اختياري)...'
                              : 'Interne Notiz (optional)...'
                          }
                          className="w-full h-10 px-3 rounded-[10px] bg-[#1C2024] border border-[#262B31] text-[12px] text-[#F4F5F6] placeholder:text-[#A3ACB3]/60 focus:outline-none focus:border-[#FF8000]"
                        />

                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleComplaintStatusChange(c, 'reviewed')}
                            className="h-10 px-3.5 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] disabled:opacity-60 text-white text-[12px] font-bold transition-colors"
                          >
                            {lang === 'ar' ? 'قيد المراجعة' : 'In Prüfung'}
                          </button>
                          <button
                            type="button"
                            disabled={isUpdating}
                            onClick={() => handleComplaintStatusChange(c, 'resolved')}
                            className="h-10 px-3.5 rounded-[10px] bg-[#16A34A] hover:bg-[#15803D] disabled:opacity-60 text-white text-[12px] font-bold transition-colors inline-flex items-center gap-1.5"
                          >
                            <Check className="w-4 h-4" />
                            <span>{lang === 'ar' ? 'تم الحل' : 'Gelöst'}</span>
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
