import { FormEvent, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import {
  CheckCircle2,
  Download,
  ExternalLink,
  Lock,
  LogOut,
  MessageSquareWarning,
  Send,
  ShieldAlert,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  ADMIN_EMAIL,
  AUTHORIZED_ADMIN_FALLBACK_URL,
  auth,
  formatFirebaseAuthError,
  googleProvider,
  isNativeAuthHost,
  isUnauthorizedDomainError,
} from '@/src/firebase';
import { ComplaintCategory, createComplaint } from '@/src/services/kairosFirebase';
import { PWAInstallButton } from '@/src/components/PWAInstallButton';

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

  const [showAdminDownloadGate, setShowAdminDownloadGate] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isDomainError, setIsDomainError] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsub();
  }, []);

  if (!isOpen) return null;

  const isAuthorizedAdmin =
    Boolean(user?.emailVerified) &&
    user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

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

  const handleGoogleSignIn = async () => {
    setAuthError(null);
    setIsDomainError(false);
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setIsDomainError(isUnauthorizedDomainError(err));
      setAuthError(formatFirebaseAuthError(err, lang));
    } finally {
      setSigningIn(false);
    }
  };

  const handleClickAdminAppOption = async () => {
    setShowAdminDownloadGate(true);
    if (!user && isNativeAuthHost()) {
      await handleGoogleSignIn();
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setAuthError(null);
    setIsDomainError(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#242E30]/60 backdrop-blur-xs p-3 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="management-modal-title"
    >
      <div className="w-full max-w-lg max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] bg-white rounded-[16px] shadow-2xl border border-[#EAE5DF] overflow-hidden flex flex-col">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-[#EAE5DF] flex items-center justify-between gap-3 bg-[#F8F5F2]/70 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-[10px] bg-[#FFF3E6] text-[#FF8000] flex items-center justify-center shrink-0">
              <MessageSquareWarning className="w-5 h-5" />
            </div>
            <div>
              <h2
                id="management-modal-title"
                className="font-display text-[17px] font-extrabold text-[#242E30]"
              >
                {lang === 'ar' ? 'الإدارة والشكاوي' : 'Verwaltung & Beschwerden'}
              </h2>
              <p className="text-[12px] text-[#5A6568]">
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
            className="w-9 h-9 rounded-[10px] flex items-center justify-center text-[#5A6568] hover:bg-[#EAE5DF]/70 hover:text-[#242E30]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-5 flex-1 overflow-y-auto">
          {/* Complaints Section */}
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-display text-[15px] font-bold text-[#242E30]">
                {lang === 'ar' ? 'قسم الشكاوي والملاحظات' : 'Beschwerde & Feedback einreichen'}
              </h3>
            </div>

            {submittedNumber ? (
              <div className="p-4 rounded-[12px] bg-[#ECFDF3] border border-[#16A34A]/30 text-[#242E30] space-y-2">
                <div className="flex items-center gap-2 text-[#16A34A] font-bold text-[14px]">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  <span>
                    {lang === 'ar'
                      ? `تم استلام شكواك بنجاح (#${submittedNumber})`
                      : `Vielen Dank! Ihre Meldung (#${submittedNumber}) ist eingegangen.`}
                  </span>
                </div>
                <p className="text-[12px] text-[#5A6568]">
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
                    <label className="block text-[12px] font-bold text-[#242E30] mb-1">
                      {lang === 'ar' ? 'الاسم *' : 'Name *'}
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={80}
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder={lang === 'ar' ? 'الاسم الكريم' : 'Ihr Name'}
                      className="w-full h-10 px-3 rounded-[10px] bg-[#F8F5F2] border border-[#EAE5DF] text-[13px] text-[#242E30] focus:outline-none focus:border-[#FF8000]"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold text-[#242E30] mb-1">
                      {lang === 'ar' ? 'رقم الهاتف (اختياري)' : 'Telefonnummer (optional)'}
                    </label>
                    <input
                      type="tel"
                      maxLength={32}
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      placeholder="0176..."
                      dir="ltr"
                      className="w-full h-10 px-3 rounded-[10px] bg-[#F8F5F2] border border-[#EAE5DF] text-[13px] text-[#242E30] focus:outline-none focus:border-[#FF8000]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[12px] font-bold text-[#242E30] mb-1">
                      {lang === 'ar' ? 'نوع الشكوى' : 'Kategorie'}
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value as ComplaintCategory)}
                      className="w-full h-10 px-3 rounded-[10px] bg-[#F8F5F2] border border-[#EAE5DF] text-[13px] text-[#242E30] focus:outline-none focus:border-[#FF8000]"
                    >
                      {COMPLAINT_CATEGORIES.map((cat) => (
                        <option key={cat.id} value={cat.id}>
                          {lang === 'ar' ? cat.ar : cat.de}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[12px] font-bold text-[#242E30] mb-1">
                      {lang === 'ar' ? 'رقم الطلب (اختياري)' : 'Bestellnummer (optional)'}
                    </label>
                    <input
                      type="text"
                      maxLength={32}
                      value={orderNumber}
                      onChange={(e) => setOrderNumber(e.target.value)}
                      placeholder="KG-..."
                      dir="ltr"
                      className="w-full h-10 px-3 rounded-[10px] bg-[#F8F5F2] border border-[#EAE5DF] text-[13px] text-[#242E30] focus:outline-none focus:border-[#FF8000]"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[12px] font-bold text-[#242E30] mb-1">
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
                    className="w-full p-3 rounded-[10px] bg-[#F8F5F2] border border-[#EAE5DF] text-[13px] text-[#242E30] focus:outline-none focus:border-[#FF8000] resize-none"
                  />
                </div>

                {submitError && (
                  <p className="text-[12px] font-semibold text-red-600">{submitError}</p>
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

          {/* Small Admin App Download Option Right Under Complaints Section */}
          <div className="pt-4 border-t border-[#EAE5DF]">
            {!showAdminDownloadGate ? (
              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleClickAdminAppOption}
                  className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#5A6568] hover:text-[#FF8000] transition-colors"
                >
                  <Lock className="w-3.5 h-3.5 shrink-0" />
                  <Download className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    {lang === 'ar' ? 'تنزيل تطبيق للإدارة' : 'Admin-App herunterladen'}
                  </span>
                </button>
              </div>
            ) : (
              <div className="p-4 rounded-[12px] bg-[#F8F5F2] border border-[#EAE5DF] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#FF8000] shrink-0" />
                    <span className="font-display text-[13px] font-bold text-[#242E30]">
                      {lang === 'ar' ? 'تطبيق الإدارة (محمي)' : 'Verwaltungs-App (Geschützt)'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAdminDownloadGate(false)}
                    className="text-[11px] font-semibold text-[#5A6568] hover:text-[#242E30]"
                  >
                    {lang === 'ar' ? 'إغلاق' : 'Schließen'}
                  </button>
                </div>

                {!user ? (
                  !isNativeAuthHost() ? (
                    <div className="space-y-2.5">
                      <p className="text-[12px] text-[#5A6568] leading-relaxed">
                        {lang === 'ar'
                          ? 'لتسجيل الدخول بحساب الإدارة وتنزيل التطبيق بأمان، يتم التحقق عبر البوابة الرسمية المعتمدة (مربوطة فوراً بنفس قاعدة بيانات الطلبات والشكاوي).'
                          : 'Für den geschützten Admin-Login und App-Download nutzen Sie bitte das autorisierte Verwaltungs-Portal (direkt mit derselben Bestell-Datenbank verbunden).'}
                      </p>
                      <a
                        href={AUTHORIZED_ADMIN_FALLBACK_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full h-10 px-4 rounded-[10px] bg-[#FF8000] hover:bg-[#E67300] text-white text-[12px] font-bold inline-flex items-center justify-center gap-2 transition-colors"
                      >
                        <span>
                          {lang === 'ar'
                            ? 'تسجيل الدخول وتنزيل تطبيق الإدارة'
                            : 'Admin-Login & App-Download öffnen'}
                        </span>
                        <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      </a>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <p className="text-[12px] text-[#5A6568]">
                        {lang === 'ar'
                          ? 'لتنزيل تطبيق الإدارة أو فتح لوحة الطلبات، يجب تسجيل الدخول بحساب مالك المطعم المعتمد أولاً.'
                          : 'Um die Admin-App zu installieren oder zu öffnen, melden Sie sich mit dem autorisierten Inhaber-Konto an.'}
                      </p>
                      <button
                        type="button"
                        disabled={signingIn}
                        onClick={handleGoogleSignIn}
                        className="w-full h-10 rounded-[10px] bg-[#242E30] hover:bg-[#354245] disabled:opacity-60 text-white text-[12px] font-bold transition-colors"
                      >
                        {signingIn
                          ? lang === 'ar'
                            ? 'جاري تسجيل الدخول...'
                            : 'Anmeldung...'
                          : lang === 'ar'
                            ? 'تسجيل الدخول بحساب الإدارة (Google)'
                            : 'Mit Google Admin-Konto anmelden'}
                      </button>
                      {authError && (
                        <div className="p-3 rounded-[10px] bg-red-50 border border-red-200 space-y-2 text-start">
                          <p className="text-[11px] font-semibold text-red-700 leading-relaxed">
                            {authError}
                          </p>
                          {isDomainError && (
                            <a
                              href={AUTHORIZED_ADMIN_FALLBACK_URL}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="h-9 px-3 rounded-[8px] bg-[#FF8000] hover:bg-[#E67300] text-white text-[11px] font-bold inline-flex items-center justify-center gap-1.5 w-full"
                            >
                              <span>
                                {lang === 'ar'
                                  ? 'الدخول وتنزيل تطبيق الإدارة من البوابة المعتمدة'
                                  : 'Über autorisiertes Portal anmelden'}
                              </span>
                              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                            </a>
                          )}
                        </div>
                      )}
                    </div>
                  )
                ) : !isAuthorizedAdmin ? (
                  <div className="p-3 rounded-[10px] bg-red-50 border border-red-200 text-red-700 space-y-2">
                    <div className="flex items-center gap-1.5 text-[12px] font-bold">
                      <ShieldAlert className="w-4 h-4 shrink-0" />
                      <span>
                        {lang === 'ar'
                          ? 'عذراً، هذا الحساب غير مصرح له بتنزيل تطبيق الإدارة'
                          : 'Dieses Konto hat keinen Admin-Zugriff'}
                      </span>
                    </div>
                    <p className="text-[11px]">{user.email}</p>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="h-9 px-3 rounded-[8px] bg-white border border-red-300 text-red-700 text-[11px] font-bold inline-flex items-center gap-1.5"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>
                        {lang === 'ar' ? 'تسجيل الخروج وتبديل الحساب' : 'Abmelden & wechseln'}
                      </span>
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2 text-[12px] text-[#16A34A] font-bold">
                      <span>
                        {lang === 'ar'
                          ? 'تطبيق الإدارة جاهز للتنزيل والدخول'
                          : 'Verwaltungs-App freigeschaltet'}
                      </span>
                      <button
                        type="button"
                        onClick={handleSignOut}
                        className="text-[11px] text-[#5A6568] hover:text-red-600 font-semibold"
                      >
                        {lang === 'ar' ? 'تسجيل الخروج' : 'Abmelden'}
                      </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <PWAInstallButton lang={lang} variant="primary" />
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenAdminDashboard();
                        }}
                        className="flex-1 min-w-[160px] h-[46px] px-4 rounded-[12px] bg-[#FF8000] hover:bg-[#E67300] text-white font-display font-bold text-[13px] transition-colors"
                      >
                        {lang === 'ar'
                          ? 'فتح لوحة إدارة الطلبات والشكاوي'
                          : 'Admin-Dashboard öffnen'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
