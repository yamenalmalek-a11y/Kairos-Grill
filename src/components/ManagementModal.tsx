import { FormEvent, useState } from 'react';
import {
  CheckCircle2,
  Lock,
  MessageSquareWarning,
  Send,
  Tablet,
  X,
} from 'lucide-react';
import { ComplaintCategory, createComplaint } from '@/src/services/kairosFirebase';

interface ManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'ar' | 'de';
  onOpenAdminDashboard: () => void;
}

const COMPLAINT_CATEGORIES: { id: ComplaintCategory; ar: string; de: string }[] = [
  { id: 'delivery_delay', ar: 'تأخير في التوصيل', de: 'Lieferverzögerung' },
  { id: 'food_quality', ar: 'ملاحظة على جودة الطعام', de: 'Qualität des Essens' },
  { id: 'missing_item', ar: 'نقص أو خطأ في الطلب', de: 'Fehlender / falscher Artikel' },
  { id: 'service', ar: 'تعامل الخدمة أو التوصيل', de: 'Service & Lieferung' },
  { id: 'other', ar: 'ملاحظة أو شكوى أخرى', de: 'Sonstiges Anliegen' },
];

export function ManagementModal({
  isOpen,
  onClose,
  lang,
  onOpenAdminDashboard,
}: ManagementModalProps) {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderNumber, setOrderNumber] = useState('');
  const [category, setCategory] = useState<ComplaintCategory>('food_quality');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submittedNumber, setSubmittedNumber] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleComplaintSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (customerName.trim().length < 1 || message.trim().length < 3) {
      setSubmitError(
        lang === 'ar'
          ? 'يرجى إدخال الاسم وتفاصيل الشكوى (3 أحرف على الأقل).'
          : 'Bitte Name und Anliegen (mind. 3 Zeichen) eingeben.'
      );
      return;
    }

    setSubmitting(true);
    try {
      const result = await createComplaint({
        customerName,
        customerPhone,
        orderNumber,
        category,
        message,
      });
      setSubmittedNumber(result.complaintNumber);
      setCustomerName('');
      setCustomerPhone('');
      setOrderNumber('');
      setMessage('');
    } catch {
      setSubmitError(
        lang === 'ar'
          ? 'تعذر إرسال الشكوى حالياً، يرجى المحاولة مرة أخرى.'
          : 'Senden fehlgeschlagen. Bitte erneut versuchen.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="management-modal-title"
    >
      <div className="w-full max-w-lg max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] bg-[#14171A] rounded-[16px] shadow-2xl border border-[#262B31] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#262B31] flex items-center justify-between gap-3 bg-[#1C2024]/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[10px] bg-[#FF8000]/15 text-[#FF8000] flex items-center justify-center shrink-0">
              <MessageSquareWarning className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="management-modal-title"
                className="font-display text-[17px] font-extrabold text-[#F4F5F6]"
              >
                {lang === 'ar' ? 'الإدارة والشكاوي' : 'Verwaltung & Beschwerden'}
              </h2>
              <p className="text-[12px] text-[#A3ACB3]">
                {lang === 'ar'
                  ? 'صوتك يصل مباشرة إلى إدارة مطعم Kairos Grill'
                  : 'Direkt an die Geschäftsleitung von Kairos Grill'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[#A3ACB3] hover:bg-[#23282D] hover:text-[#F4F5F6]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5 flex-1 overflow-y-auto">
          {/* Complaints Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-[15px] font-bold text-[#F4F5F6]">
                {lang === 'ar' ? 'قسم الشكاوي والملاحظات' : 'Beschwerde & Feedback einreichen'}
              </h3>
            </div>

            {submittedNumber ? (
              <div className="p-4 rounded-[12px] bg-[#22C55E]/15 border border-[#22C55E]/35 text-[#F4F5F6] space-y-2">
                <div className="flex items-center gap-2 text-[#4ADE80] font-bold text-[14px]">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span>
                    {lang === 'ar'
                      ? `تم استلام شكواك بنجاح (#${submittedNumber})`
                      : `Vielen Dank! Ihre Meldung (#${submittedNumber}) ist eingegangen.`}
                  </span>
                </div>
                <p className="text-[12px] text-[#A3ACB3]">
                  {lang === 'ar'
                    ? 'ستقوم الإدارة بمراجعة ملاحظتك ومعالجتها في أقرب وقت.'
                    : 'Unsere Leitung wird sich schnellstmöglich darum kümmern.'}
                </p>
                <button
                  type="button"
                  onClick={() => setSubmittedNumber(null)}
                  className="mt-1 text-[12px] font-bold text-[#FF8000] hover:underline"
                >
                  {lang === 'ar' ? 'إرسال ملاحظة أخرى' : 'Weitere Meldung senden'}
                </button>
              </div>
            ) : (
              <form onSubmit={handleComplaintSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-bold text-[#F4F5F6] mb-1">
                      {lang === 'ar' ? 'الاسم *' : 'Name *'}
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={80}
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder={lang === 'ar' ? 'الاسم الكريم' : 'Ihr Name'}
                      className="w-full h-10 px-3 rounded-[10px] bg-[#1C2024] border border-[#262B31] text-[13px] text-[#F4F5F6] placeholder:text-[#A3ACB3]/60 focus:outline-none focus:border-[#FF8000]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold text-[#F4F5F6] mb-1">
                      {lang === 'ar' ? 'رقم الهاتف (اختياري)' : 'Telefonnummer (optional)'}
                    </label>
                    <input
                      type="tel"
                      maxLength={32}
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="0176..."
                      dir="ltr"
                      className="w-full h-10 px-3 rounded-[10px] bg-[#1C2024] border border-[#262B31] text-[13px] text-[#F4F5F6] placeholder:text-[#A3ACB3]/60 focus:outline-none focus:border-[#FF8000]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-bold text-[#F4F5F6] mb-1">
                      {lang === 'ar' ? 'نوع الشكوى' : 'Kategorie'}
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
                      className="w-full h-10 px-3 rounded-[10px] bg-[#1C2024] border border-[#262B31] text-[13px] text-[#F4F5F6] focus:outline-none focus:border-[#FF8000]"
                    >
                      {COMPLAINT_CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {lang === 'ar' ? cat.ar : cat.de}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold text-[#F4F5F6] mb-1">
                      {lang === 'ar' ? 'رقم الطلب (اختياري)' : 'Bestellnummer (optional)'}
                    </label>
                    <input
                      type="text"
                      maxLength={32}
                      value={orderNumber}
                      onChange={(e) => setOrderNumber(e.target.value)}
                      placeholder="KG-..."
                      dir="ltr"
                      className="w-full h-10 px-3 rounded-[10px] bg-[#1C2024] border border-[#262B31] text-[13px] text-[#F4F5F6] placeholder:text-[#A3ACB3]/60 focus:outline-none focus:border-[#FF8000]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-[#F4F5F6] mb-1">
                    {lang === 'ar' ? 'تفاصيل الشكوى أو الملاحظة *' : 'Ihre Nachricht *'}
                  </label>
                  <textarea
                    required
                    minLength={3}
                    maxLength={600}
                    rows={3}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={
                      lang === 'ar'
                        ? 'اكتب تفاصيل شكواك أو ملاحظتك ليتم متابعتها من الإدارة...'
                        : 'Beschreiben Sie Ihr Anliegen...'
                    }
                    className="w-full p-3 rounded-[10px] bg-[#1C2024] border border-[#262B31] text-[13px] text-[#F4F5F6] placeholder:text-[#A3ACB3]/60 focus:outline-none focus:border-[#FF8000] resize-none"
                  />
                </div>

                {submitError && (
                  <p className="text-[12px] font-semibold text-red-400">{submitError}</p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-11 rounded-[12px] bg-[#FF8000] hover:bg-[#E67300] disabled:opacity-60 text-white font-display font-bold text-[13px] flex items-center justify-center gap-2 transition-colors"
                >
                  <Send className="w-4 h-4" />
                  <span>
                    {submitting
                      ? lang === 'ar'
                        ? 'جاري الإرسال...'
                        : 'Wird gesendet...'
                      : lang === 'ar'
                        ? 'إرسال الشكوى للإدارة'
                        : 'An Verwaltung senden'}
                  </span>
                </button>
              </form>
            )}
          </section>

          {/* Direct Entry to PIN-Protected Restaurant Tablet Dashboard */}
          <div className="pt-4 border-t border-[#262B31]">
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAdminDashboard();
              }}
              className="w-full h-11 px-4 rounded-[12px] bg-[#1C2024] hover:bg-[#23282D] border border-[#262B31] text-[#F4F5F6] text-[13px] font-bold flex items-center justify-between transition-colors"
            >
              <span className="inline-flex items-center gap-2">
                <Tablet className="w-4 h-4 text-[#FF8000]" />
                <span>
                  {lang === 'ar'
                    ? 'دخول تابلت إدارة الطلبات (برقم سري)'
                    : 'Bestell-Tablet / Admin öffnen (mit PIN)'}
                </span>
              </span>
              <Lock className="w-3.5 h-3.5 text-[#A3ACB3]" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
