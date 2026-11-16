import { FormEvent, useState } from 'react';
import { CreditCard, X, Check } from 'lucide-react';

interface PaymentLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentLink: string;
  onSaveLink: (url: string) => void;
  lang: 'ar' | 'de';
}

export function PaymentLinkModal({
  isOpen,
  onClose,
  currentLink,
  onSaveLink,
  lang,
}: PaymentLinkModalProps) {
  const [value, setValue] = useState(currentLink);

  if (!isOpen) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    onSaveLink(value.trim());
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#242E30]/55 backdrop-blur-xs p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-link-title"
    >
      <div className="w-full max-w-md bg-white rounded-[16px] p-6 shadow-2xl border border-[#EAE5DF]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-[12px] bg-[#FFF3E6] text-[#FF8000] flex items-center justify-center shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h3 id="payment-link-title" className="font-display text-[17px] font-bold text-[#242E30]">
                {lang === 'ar' ? 'إعداد رابط الدفع الإلكتروني' : 'Zahlungslink konfigurieren'}
              </h3>
              <p className="text-[12px] text-[#5A6568]">
                {lang === 'ar'
                  ? 'يُضاف تلقائياً إلى رسائل طلبات الواتساب وصفحة تأكيد الدفع'
                  : 'Wird automatisch in WhatsApp-Bestellungen und im Checkout angezeigt'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="min-h-[40px] min-w-[40px] rounded-[12px] flex items-center justify-center text-[#5A6568] hover:bg-[#F8F5F2]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-[12px] font-semibold text-[#242E30] mb-1.5">
              {lang === 'ar'
                ? 'رابط الدفع (PayPal.me / Stripe / SumUp / Klarna)'
                : 'Zahlungslink-URL (PayPal.me / Stripe / SumUp)'}
            </label>
            <input
              type="url"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="https://paypal.me/kairosgrill"
              dir="ltr"
              className="w-full h-11 px-3.5 rounded-[12px] bg-[#F8F5F2] border border-[#EAE5DF] focus:border-[#FF8000] focus:bg-white focus:outline-none text-[13px]"
            />
            <p className="mt-1.5 text-[11px] text-[#5A6568]">
              {lang === 'ar'
                ? 'يمكنك لصق الرابط هنا في أي وقت وسيُحفظ تلقائياً على المتصفح.'
                : 'Link jederzeit hier einfügen oder aktualisieren.'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-11 rounded-[12px] bg-[#F8F5F2] hover:bg-[#EAE5DF] text-[#242E30] text-[13px] font-semibold transition-colors"
            >
              {lang === 'ar' ? 'إلغاء' : 'Abbrechen'}
            </button>
            <button
              type="submit"
              className="flex-[2] h-11 rounded-[12px] bg-[#FF8000] hover:bg-[#E67300] text-white text-[13px] font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Check className="w-4 h-4" />
              <span>{lang === 'ar' ? 'حفظ رابط الدفع' : 'Link speichern'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
