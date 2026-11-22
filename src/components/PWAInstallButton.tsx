import { useState } from 'react';
import { Download, Share, PlusSquare, X, Check } from 'lucide-react';
import { usePWAInstall } from '@/src/hooks/usePWAInstall';

interface PWAInstallButtonProps {
  lang: 'ar' | 'de';
  variant?: 'primary' | 'secondary';
}

export function PWAInstallButton({ lang, variant = 'primary' }: PWAInstallButtonProps) {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuideModal, setShowGuideModal] = useState(false);

  if (isInstalled) {
    return null;
  }

  const handleClick = async () => {
    if (isInstallable) {
      const accepted = await install();
      if (!accepted) {
        setShowGuideModal(true);
      }
      return;
    }
    setShowGuideModal(true);
  };

  const buttonText =
    lang === 'ar'
      ? 'تنزيل تطبيق استقبال الطلبات'
      : 'Bestell-Tablet App installieren';

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className={`inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-[12px] text-[13px] font-bold transition-colors whitespace-nowrap shrink-0 ${
          variant === 'primary'
            ? 'bg-[#242E30] hover:bg-[#354245] text-white shadow-[0_6px_18px_rgba(36,46,48,0.16)]'
            : 'bg-white hover:bg-[#FFF3E6] text-[#242E30] border border-[#EAE5DF]'
        }`}
      >
        <Download className="w-4 h-4 text-[#FF8000] shrink-0" strokeWidth={2.2} />
        <span>{buttonText}</span>
      </button>

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#242E30]/55 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
        >
          <div className="w-full max-w-md bg-white rounded-[16px] p-6 shadow-2xl border border-[#EAE5DF]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img
                  src="/pwa-192x192.png"
                  alt="Kairos Grill Admin App Icon"
                  className="w-12 h-12 object-contain shrink-0"
                />
                <div>
                  <h3 id="pwa-install-title" className="font-display text-[17px] font-bold text-[#242E30]">
                    {lang === 'ar' ? 'تثبيت تطبيق استقبال الطلبات' : 'Bestell-Tablet App installieren'}
                  </h3>
                  <p className="text-[12px] text-[#5A6568]">
                    {lang === 'ar'
                      ? 'يثبت صفحة استلام الطلبات فقط كتطبيق مستقل على التابلت أو الموبايل'
                      : 'Installiert nur den Bestell-Empfang als eigenständige App'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                aria-label="Close install instructions"
                className="min-h-[40px] min-w-[40px] rounded-[12px] flex items-center justify-center text-[#5A6568] hover:bg-[#F8F5F2]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-5 space-y-3.5">
              {/* iPhone / Safari Instructions */}
              <div
                className={`p-3.5 rounded-[12px] border ${
                  isIOS ? 'border-[#FF8000] bg-[#FFF3E6]/40' : 'border-[#EAE5DF] bg-[#F8F5F2]'
                }`}
              >
                <p className="font-display text-[13px] font-bold text-[#242E30] flex items-center justify-between">
                  <span>{lang === 'ar' ? 'على آيفون وآيباد (Safari)' : 'Für iPhone & iPad (Safari)'}</span>
                  {isIOS && (
                    <span className="text-[11px] font-semibold text-[#FF8000]">
                      {lang === 'ar' ? 'جهازك الحالي' : 'Ihr Gerät'}
                    </span>
                  )}
                </p>
                <ol className="mt-2 space-y-1.5 text-[13px] text-[#242E30]">
                  <li className="flex items-center gap-2">
                    <Share className="w-4 h-4 text-[#FF8000] shrink-0" />
                    <span>
                      {lang === 'ar'
                        ? '1. اضغط على زر المشاركة في أسفل متصفح Safari.'
                        : '1. Tippen Sie unten in Safari auf „Teilen“.'}
                    </span>
                  </li>
                  <li className="flex items-center gap-2">
                    <PlusSquare className="w-4 h-4 text-[#FF8000] shrink-0" />
                    <span>
                      {lang === 'ar'
                        ? '2. اختر «إضافة إلى الشاشة الرئيسية» ثم اضغط إضافة.'
                        : '2. Wählen Sie „Zum Home-Bildschirm“ und bestätigen Sie.'}
                    </span>
                  </li>
                </ol>
              </div>

              {/* Android / Chrome Instructions */}
              <div
                className={`p-3.5 rounded-[12px] border ${
                  !isIOS ? 'border-[#FF8000] bg-[#FFF3E6]/40' : 'border-[#EAE5DF] bg-[#F8F5F2]'
                }`}
              >
                <p className="font-display text-[13px] font-bold text-[#242E30]">
                  {lang === 'ar' ? 'على أندرويد (Google Chrome)' : 'Für Android (Chrome)'}
                </p>
                <p className="mt-1.5 text-[13px] text-[#242E30] leading-relaxed">
                  {lang === 'ar'
                    ? 'افتح قائمة المتصفح (⋮) واختر «تثبيت التطبيق» أو «الإضافة إلى الشاشة الرئيسية». إذا فتحت الرابط من داخل تطبيق آخر، اختر أولاً «الفتح في Chrome».'
                    : 'Öffnen Sie das Chrome-Menü (⋮) und tippen Sie auf „App installieren“ oder „Zum Startbildschirm hinzufügen“ (bei In-App-Browsern zuerst „In Chrome öffnen“ wählen).'}
                </p>
                {isInstallable && (
                  <button
                    type="button"
                    onClick={install}
                    className="mt-3 w-full h-10 rounded-[12px] bg-[#FF8000] hover:bg-[#E67300] text-white text-[13px] font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'تثبيت الآن بنقرة واحدة' : 'Jetzt direkt installieren'}</span>
                  </button>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-5 w-full h-11 rounded-[12px] bg-[#242E30] hover:bg-[#364447] text-white text-[13px] font-semibold transition-colors"
            >
              {lang === 'ar' ? 'حسناً، فهمت' : 'Schließen'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
