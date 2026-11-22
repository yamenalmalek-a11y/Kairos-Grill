import { useEffect, useRef, useState } from 'react';
import { Bell, CheckCircle2, Clock, Flame, Truck, X, ChefHat } from 'lucide-react';
import { formatEuro } from '@/src/data/kairosData';
import {
  OrderStatus,
  OrderTrackingRecord,
  subscribeOrderTracking,
} from '@/src/services/kairosFirebase';
import { playCustomerNotificationChime } from '@/src/utils/soundAlert';

interface CustomerOrderTrackerProps {
  orderId: string;
  lang: 'ar' | 'de';
  onDismiss: () => void;
}

const STEPS: Array<{
  key: OrderStatus;
  labelAr: string;
  labelDe: string;
}> = [
  { key: 'pending', labelAr: 'تم الإرسال', labelDe: 'Gesendet' },
  { key: 'accepted', labelAr: 'تم الاستلام', labelDe: 'Bestätigt' },
  { key: 'preparing', labelAr: 'قيد التحضير', labelDe: 'In Zubereitung' },
  { key: 'delivering', labelAr: 'في الطريق', labelDe: 'Unterwegs' },
  { key: 'completed', labelAr: 'تم التسليم', labelDe: 'Geliefert' },
];

export function CustomerOrderTracker({
  orderId,
  lang,
  onDismiss,
}: CustomerOrderTrackerProps) {
  const [tracking, setTracking] = useState<OrderTrackingRecord | null>(null);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'denied'
  );
  const prevStatusRef = useRef<OrderStatus | null>(null);

  useEffect(() => {
    const unsub = subscribeOrderTracking(
      orderId,
      (data) => {
        if (!data) return;
        if (prevStatusRef.current && prevStatusRef.current !== data.status) {
          playCustomerNotificationChime();
          if (
            typeof window !== 'undefined' &&
            'Notification' in window &&
            Notification.permission === 'granted'
          ) {
            try {
              new Notification(`Kairos Grill · #${data.orderNumber}`, {
                body: lang === 'ar' ? data.statusMessageAr : data.statusMessageDe,
                icon: '/pwa-192x192.png',
              });
            } catch {
              // Some mobile browsers disallow direct new Notification outside SW
            }
          }
        }
        prevStatusRef.current = data.status;
        setTracking(data);
      },
      () => {
        // Ignore transient disconnect
      }
    );
    return () => unsub();
  }, [orderId, lang]);

  const handleRequestNotifications = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    try {
      const res = await Notification.requestPermission();
      setNotifPermission(res);
    } catch {
      // Ignore permission rejection
    }
  };

  if (!tracking) return null;

  const currentIdx = STEPS.findIndex((s) => s.key === tracking.status);
  const isCancelled = tracking.status === 'cancelled';

  return (
    <section
      aria-live="polite"
      className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-5"
    >
      <div
        className={`rounded-[14px] border p-4 sm:p-5 bg-[#14171A] shadow-[0_8px_24px_rgba(0,0,0,0.4)] ${
          tracking.status === 'accepted' || tracking.status === 'preparing'
            ? 'border-[#22C55E]/45'
            : isCancelled
              ? 'border-red-500/45'
              : 'border-[#FF8000]/45'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-[12px] flex items-center justify-center shrink-0 ${
                tracking.status === 'pending'
                  ? 'bg-[#FF8000]/15 text-[#FF8000]'
                  : isCancelled
                    ? 'bg-red-500/15 text-red-400'
                    : 'bg-[#22C55E]/15 text-[#4ADE80]'
              }`}
            >
              {tracking.status === 'pending' ? (
                <Clock className="w-5 h-5" />
              ) : tracking.status === 'preparing' ? (
                <ChefHat className="w-5 h-5" />
              ) : tracking.status === 'delivering' ? (
                <Truck className="w-5 h-5" />
              ) : tracking.status === 'accepted' || tracking.status === 'completed' ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <Flame className="w-5 h-5" />
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 text-[12px] font-bold text-[#A3ACB3] tabular-nums">
                <span className="text-[#FF8000]">#{tracking.orderNumber}</span>
                <span aria-hidden="true">·</span>
                <span>{formatEuro(tracking.total)}</span>
              </div>
              <h2 className="font-display text-[16px] sm:text-[18px] font-extrabold text-[#F4F5F6] mt-0.5">
                {lang === 'ar' ? tracking.statusMessageAr : tracking.statusMessageDe}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {notifPermission === 'default' && (
              <button
                type="button"
                onClick={handleRequestNotifications}
                className="h-9 px-3 rounded-[10px] bg-[#FF8000]/15 hover:bg-[#FF8000] text-[#FF8000] hover:text-white border border-[#FF8000]/30 text-[12px] font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
              >
                <Bell className="w-3.5 h-3.5" />
                <span>
                  {lang === 'ar' ? 'تفعيل تنبيه الهاتف' : 'Benachrichtigung aktivieren'}
                </span>
              </button>
            )}

            {(tracking.status === 'completed' || isCancelled) && (
              <button
                type="button"
                onClick={onDismiss}
                aria-label="Dismiss order tracker"
                className="w-9 h-9 rounded-[10px] bg-[#1C2024] hover:bg-[#262B31] text-[#A3ACB3] hover:text-[#F4F5F6] flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Clean Step Progress Bar */}
        {!isCancelled && (
          <div className="mt-4 grid grid-cols-5 gap-1.5 sm:gap-2">
            {STEPS.map((step, idx) => {
              const reached = currentIdx >= idx;
              return (
                <div key={step.key} className="space-y-1.5">
                  <div
                    className={`h-1.5 rounded-full transition-colors ${
                      reached ? 'bg-[#22C55E]' : 'bg-[#262B31]'
                    }`}
                  />
                  <p
                    className={`text-[11px] font-bold truncate ${
                      reached ? 'text-[#F4F5F6]' : 'text-[#A3ACB3]/70'
                    }`}
                  >
                    {lang === 'ar' ? step.labelAr : step.labelDe}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
