import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/src/hooks/useOnlineStatus';

export function OfflineIndicator({ lang }: { lang: 'ar' | 'de' }) {
  const isOnline = useOnlineStatus();

  if (isOnline) return null;

  return (
    <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-[12px] bg-[#242E30] px-3.5 py-2 text-[12px] font-semibold text-white shadow-lg border border-[#FF8000]">
      <WifiOff className="w-3.5 h-3.5 text-[#FF8000]" />
      <span>
        {lang === 'ar'
          ? 'وضع عدم الاتصال — يتم عرض القائمة المحفوظة'
          : 'Offline-Modus — Gespeicherte Speisekarte aktiv'}
      </span>
    </div>
  );
}
