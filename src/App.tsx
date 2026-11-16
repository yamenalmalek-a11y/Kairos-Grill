import { useEffect, useState } from 'react';
import {
  MapPin,
  Phone,
  Clock,
  ShoppingBag,
  Plus,
  Minus,
  Search,
  MessageCircle,
  CreditCard,
  X,
  ArrowDown,
  Utensils,
} from 'lucide-react';
import {
  KAIROS_ASSETS,
  KAIROS_INFO,
  KAIROS_MENU,
  KairosDish,
  MENU_CATEGORIES,
  MenuCategoryId,
  buildWhatsAppUrl,
  formatEuro,
} from '@/src/data/kairosData';
import { CroppedPhoto } from '@/src/components/CroppedPhoto';
import { CartDrawer, CartEntry } from '@/src/components/CartDrawer';
import { PaymentLinkModal } from '@/src/components/PaymentLinkModal';
import { PWAInstallButton } from '@/src/components/PWAInstallButton';
import { OfflineIndicator } from '@/src/components/OfflineIndicator';

const STORAGE_PAYMENT_KEY = 'kairos_payment_link_v1';

export default function App() {
  const [lang, setLang] = useState<'ar' | 'de'>('ar');
  const [activeCategory, setActiveCategory] = useState<MenuCategoryId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentLink, setPaymentLink] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_PAYMENT_KEY) || KAIROS_INFO.defaultPaymentLink;
    } catch {
      return KAIROS_INFO.defaultPaymentLink;
    }
  });

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  const handleSavePaymentLink = (url: string) => {
    setPaymentLink(url);
    try {
      localStorage.setItem(STORAGE_PAYMENT_KEY, url);
    } catch {
      // Ignore storage quota errors
    }
  };

  const handleAddToCart = (dish: KairosDish) => {
    setCart((prev) => {
      const existing = prev.find((entry) => entry.dish.id === dish.id);
      if (existing) {
        return prev.map((entry) =>
          entry.dish.id === dish.id
            ? { ...entry, quantity: entry.quantity + 1 }
            : entry
        );
      }
      return [...prev, { dish, quantity: 1 }];
    });
  };

  const handleUpdateQty = (dishId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((entry) =>
          entry.dish.id === dishId
            ? { ...entry, quantity: entry.quantity + delta }
            : entry
        )
        .filter((entry) => entry.quantity > 0)
    );
  };

  const getQty = (dishId: string) =>
    cart.find((entry) => entry.dish.id === dishId)?.quantity ?? 0;

  const cartCount = cart.reduce((sum, entry) => sum + entry.quantity, 0);
  const cartSubtotal = cart.reduce(
    (sum, entry) => sum + entry.dish.price * entry.quantity,
    0
  );

  const filteredMenu = KAIROS_MENU.filter((dish) => {
    if (activeCategory !== 'all' && dish.category !== activeCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        dish.nameDe.toLowerCase().includes(q) ||
        dish.nameAr.toLowerCase().includes(q) ||
        dish.descDe.toLowerCase().includes(q) ||
        dish.descAr.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const directCateringWhatsAppUrl = buildWhatsAppUrl(
    lang === 'ar'
      ? `مرحباً Kairos Grill، أود الاستفسار عن باقات البوفيه والمناسبات (Catering).`
      : `Hallo Kairos Grill Team, ich möchte gerne ein Catering / eine Partyplatte anfragen.`
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F2] text-[#242E30]">
      {/* 3-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#EAE5DF]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6 sm:gap-8">
          {/* Zone 1: Brand */}
          <a
            href="#top"
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0"
          >
            <CroppedPhoto
              src={KAIROS_ASSETS.logoBanner}
              alt="Kairos Grill Logo"
              cropPosition="50% 36%"
              cropScale={1.7}
              className="w-9 h-9 rounded-[10px] shrink-0"
            />
            <span className="font-display text-[19px] font-extrabold tracking-tight text-[#242E30]">
              Kairos <span className="text-[#FF8000]">Grill</span>
            </span>
          </a>

          {/* Zone 2: Clean Single-Line Nav Links */}
          <nav className="hidden md:flex items-center gap-7 text-[14px] font-semibold text-[#5A6568]">
            <a
              href="#menu"
              onClick={() => setActiveCategory('all')}
              className="hover:text-[#FF8000] transition-colors whitespace-nowrap shrink-0"
            >
              {lang === 'ar' ? 'قائمة الطعام' : 'Speisekarte'}
            </a>
            <a
              href="#menu"
              onClick={() => setActiveCategory('torten')}
              className="hover:text-[#FF8000] transition-colors whitespace-nowrap shrink-0"
            >
              {lang === 'ar' ? 'الحلويات والتورتات' : 'Torten & Café'}
            </a>
            <a
              href="#catering"
              className="hover:text-[#FF8000] transition-colors whitespace-nowrap shrink-0"
            >
              {lang === 'ar' ? 'البوفيه والمناسبات' : 'Catering'}
            </a>
            <a
              href="#contact"
              className="hover:text-[#FF8000] transition-colors whitespace-nowrap shrink-0"
            >
              {lang === 'ar' ? 'العنوان والتواصل' : 'Kontakt'}
            </a>
          </nav>

          {/* Zone 3: Single Primary Cart CTA */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setIsCartOpen(true)}
              className="h-10 px-4 rounded-[12px] bg-[#FF8000] hover:bg-[#E67300] text-white text-[13px] font-bold flex items-center gap-2 shadow-[0_4px_14px_rgba(255,128,0,0.28)] transition-colors whitespace-nowrap shrink-0"
            >
              <ShoppingBag className="w-4 h-4 shrink-0" strokeWidth={2.2} />
              <span>
                {lang === 'ar' ? 'السلة' : 'Warenkorb'} ({cartCount})
              </span>
              {cartCount > 0 && (
                <span className="tabular-nums border-s border-white/30 ps-2">
                  {formatEuro(cartSubtotal)}
                </span>
              )}
            </button>
          </div>
        </div>
      </header>

      <main id="top" className="flex-1">
        {/* Section 1: Storefront Hero */}
        <section className="bg-white border-b border-[#EAE5DF]">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8 sm:py-12">
            {/* Sub-header Utility Strip: Language Toggle & Authentic Restaurant Info */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 mb-6 border-b border-[#EAE5DF]/80">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-[#5A6568]">
                <span className="inline-flex items-center gap-1.5 font-medium text-[#242E30]">
                  <MapPin className="w-4 h-4 text-[#FF8000] shrink-0" />
                  {KAIROS_INFO.address}
                </span>
                <span aria-hidden="true">·</span>
                <a
                  href={`tel:${KAIROS_INFO.phoneDisplay}`}
                  className="inline-flex items-center gap-1.5 font-semibold text-[#242E30] hover:text-[#FF8000] tabular-nums"
                >
                  <Phone className="w-3.5 h-3.5 text-[#FF8000] shrink-0" />
                  {KAIROS_INFO.phoneDisplay}
                </a>
              </div>

              {/* Language Switcher */}
              <div className="flex items-center gap-1 p-1 bg-[#F8F5F2] rounded-[12px] border border-[#EAE5DF]">
                <button
                  type="button"
                  onClick={() => setLang('ar')}
                  className={`px-3 py-1.5 rounded-[10px] text-[12px] font-bold transition-colors ${
                    lang === 'ar'
                      ? 'bg-[#FF8000] text-white shadow-xs'
                      : 'text-[#5A6568] hover:text-[#242E30]'
                  }`}
                >
                  العربية
                </button>
                <button
                  type="button"
                  onClick={() => setLang('de')}
                  className={`px-3 py-1.5 rounded-[10px] text-[12px] font-bold transition-colors ${
                    lang === 'de'
                      ? 'bg-[#FF8000] text-white shadow-xs'
                      : 'text-[#5A6568] hover:text-[#242E30]'
                  }`}
                >
                  Deutsch
                </button>
              </div>
            </div>

            {/* Split Hero Content */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
              <div className="lg:col-span-6 flex flex-col justify-center">
                <p className="text-[13px] font-bold text-[#FF8000] mb-2">
                  {lang === 'ar' ? KAIROS_INFO.taglineAr : KAIROS_INFO.taglineDe}
                </p>

                <h1 className="font-display text-[30px] sm:text-[42px] font-extrabold text-[#242E30] leading-[1.18] tracking-tight [text-wrap:balance]">
                  {lang === 'ar'
                    ? 'مطعم وكافيه كايروس غريل — اطلب وجبتك الطازجة مباشرة عبر واتساب'
                    : 'Kairos Grill Rostock — Orientalisch, frisch & 100% hausgemacht'}
                </h1>

                <p className="mt-4 text-[15px] text-[#5A6568] leading-relaxed max-w-xl">
                  {lang === 'ar'
                    ? 'شيش طاووق مشوي على الأصول، مناقيش وفطائر بالفرن الحجري، وتورتات وكب كيك مُحضّرة منزلياً يومياً. اختر طلبك ليصلنا فوراً برسالة واتساب متكاملة مع موقعك وطريقة الدفع.'
                    : 'Zartes Shish Tawook, ofenfrische Manakish & Pide sowie täglich frisch gebackene Torten. Direkt hier bestellen – Ihre Bestellung geht sofort inkl. Adresse per WhatsApp bei uns ein.'}
                </p>

                {/* Hours Summary */}
                <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-[#242E30] tabular-nums">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-[#FF8000] shrink-0" />
                    {lang === 'ar' ? KAIROS_INFO.hoursWeekdayAr : KAIROS_INFO.hoursWeekdayDe}
                  </span>
                  <span aria-hidden="true" className="text-[#5A6568]">
                    ·
                  </span>
                  <span>
                    {lang === 'ar' ? KAIROS_INFO.hoursWeekendAr : KAIROS_INFO.hoursWeekendDe}
                  </span>
                </div>

                {/* Primary CTAs + Android/iPhone Install Button */}
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <a
                    href="#menu"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-[12px] bg-[#FF8000] hover:bg-[#E67300] text-white font-display font-bold text-[14px] shadow-[0_8px_20px_rgba(255,128,0,0.3)] transition-colors whitespace-nowrap shrink-0"
                  >
                    <Utensils className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'تصفح القائمة واطلب الآن' : 'Jetzt bestellen'}</span>
                    <ArrowDown className="w-4 h-4" />
                  </a>

                  <PWAInstallButton lang={lang} variant="primary" />
                </div>
              </div>

              {/* Hero Visual Showcase using Real Uploaded Photos */}
              <div className="lg:col-span-6 grid grid-cols-2 gap-3.5">
                <div className="col-span-2 h-[210px] sm:h-[235px] rounded-[12px] overflow-hidden shadow-[0_8px_24px_rgba(36,46,48,0.08)]">
                  <CroppedPhoto
                    src={KAIROS_ASSETS.logoBanner}
                    alt="Kairos Grill Brand Banner"
                    cropPosition="50% 36%"
                    cropScale={1.5}
                    className="w-full h-full"
                  />
                </div>
                <div className="h-[155px] sm:h-[175px] rounded-[12px] overflow-hidden shadow-[0_6px_18px_rgba(36,46,48,0.08)]">
                  <CroppedPhoto
                    src="/assets/aistudio/Screenshot_________-_______13d642de.png"
                    alt="Shish Tawook Kairos Grill"
                    cropPosition="50% 48%"
                    cropScale={1.48}
                    className="w-full h-full"
                  />
                </div>
                <div className="h-[155px] sm:h-[175px] rounded-[12px] overflow-hidden shadow-[0_6px_18px_rgba(36,46,48,0.08)]">
                  <CroppedPhoto
                    src="/assets/aistudio/Screenshot_________-_______562cdf9c.png"
                    alt="Schoko-Kirsch-Torte 4,00 €"
                    cropPosition="50% 44%"
                    cropScale={1.55}
                    className="w-full h-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Interactive Menu & Ordering Catalog */}
        <section id="menu" className="max-w-[1280px] mx-auto px-4 sm:px-6 py-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="font-display text-[24px] sm:text-[28px] font-extrabold text-[#242E30]">
                {lang === 'ar' ? 'القائمة اليومية الطازجة' : 'Unsere Speisekarte'}
              </h2>
              <p className="text-[14px] text-[#5A6568] mt-1">
                {lang === 'ar'
                  ? 'جميع الأسعار باليورو (€) وتشمل التحضير المنزلي الطازج'
                  : 'Alle Preise in Euro (€) · Alle Gerichte sind 100% hausgemacht'}
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-72">
              <Search className="w-4 h-4 text-[#5A6568] absolute top-3.5 left-3.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={lang === 'ar' ? 'ابحث عن وجبة أو تورتة...' : 'Gericht oder Torte suchen...'}
                aria-label="Search menu"
                className="w-full h-11 pl-10 pr-9 rounded-[12px] bg-white border border-[#EAE5DF] focus:border-[#FF8000] focus:outline-none text-[13px] shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                  className="absolute top-3 right-3 text-[#5A6568] hover:text-[#242E30]"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Category Filter Buttons */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-3 mb-6">
            {MENU_CATEGORIES.map((cat) => {
              const isActive = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setActiveCategory(cat.id)}
                  className={`min-h-[42px] px-4 rounded-[12px] text-[13px] font-bold whitespace-nowrap shrink-0 transition-all ${
                    isActive
                      ? 'bg-[#FF8000] text-white shadow-[0_4px_14px_rgba(255,128,0,0.28)]'
                      : 'bg-white text-[#242E30] border border-[#EAE5DF] hover:bg-[#FFF3E6]'
                  }`}
                >
                  {lang === 'ar' ? cat.labelAr : cat.labelDe}
                </button>
              );
            })}
          </div>

          {/* Menu Grid */}
          {filteredMenu.length === 0 ? (
            <div className="bg-white rounded-[12px] p-10 text-center border border-[#EAE5DF]">
              <p className="font-display text-[16px] font-bold text-[#242E30]">
                {lang === 'ar' ? 'لم يتم العثور على أصناف مطابقة' : 'Keine Gerichte gefunden'}
              </p>
              <button
                type="button"
                onClick={() => {
                  setActiveCategory('all');
                  setSearchQuery('');
                }}
                className="mt-4 px-5 py-2.5 rounded-[12px] bg-[#FF8000] text-white text-[13px] font-bold"
              >
                {lang === 'ar' ? 'عرض كل الأصناف' : 'Alle Gerichte anzeigen'}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredMenu.map((dish) => {
                const qty = getQty(dish.id);
                return (
                  <article
                    key={dish.id}
                    className="bg-white rounded-[12px] overflow-hidden shadow-[0_2px_12px_rgba(36,46,48,0.06)] hover:shadow-[0_10px_28px_rgba(36,46,48,0.1)] transition-all duration-200 flex flex-col border border-[#EAE5DF]/70"
                  >
                    <div className="aspect-[4/3] w-full overflow-hidden">
                      <CroppedPhoto
                        src={dish.image}
                        alt={lang === 'ar' ? dish.nameAr : dish.nameDe}
                        cropPosition={dish.cropPosition}
                        cropScale={dish.cropScale}
                        className="w-full h-full"
                      />
                    </div>

                    <div className="p-4 flex-1 flex flex-col">
                      {(dish.highlightAr || dish.highlightDe) && (
                        <p className="text-[11px] font-bold text-[#FF8000] mb-1">
                          {lang === 'ar' ? dish.highlightAr : dish.highlightDe}
                        </p>
                      )}

                      <h3 className="font-display text-[16px] font-bold text-[#242E30] leading-snug">
                        {lang === 'ar' ? dish.nameAr : dish.nameDe}
                      </h3>
                      <p className="text-[12px] text-[#5A6568] mt-0.5">
                        {lang === 'ar' ? dish.nameDe : dish.unitDe}
                      </p>

                      <p className="mt-2 text-[13px] text-[#5A6568] leading-relaxed flex-1">
                        {lang === 'ar' ? dish.descAr : dish.descDe}
                      </p>

                      <div className="mt-4 pt-3 border-t border-[#EAE5DF] flex items-center justify-between gap-3">
                        <div>
                          <span className="font-display text-[18px] font-extrabold text-[#242E30] tabular-nums">
                            {formatEuro(dish.price)}
                          </span>
                          <span className="text-[11px] text-[#5A6568] ms-1.5">
                            / {lang === 'ar' ? dish.unitAr : dish.unitDe}
                          </span>
                        </div>

                        {qty === 0 ? (
                          <button
                            type="button"
                            onClick={() => handleAddToCart(dish)}
                            className="h-10 px-4 rounded-[12px] bg-[#FF8000] hover:bg-[#E67300] text-white text-[13px] font-bold flex items-center gap-1.5 transition-colors shrink-0"
                          >
                            <Plus className="w-4 h-4" strokeWidth={2.4} />
                            <span>{lang === 'ar' ? 'أضف' : 'Bestellen'}</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5 bg-[#FFF3E6] rounded-[12px] p-1 border border-[#FF8000]/30">
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(dish.id, -1)}
                              aria-label="Decrease quantity"
                              className="w-8 h-8 rounded-[10px] bg-white text-[#242E30] hover:text-[#FF8000] flex items-center justify-center shadow-xs"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="w-6 text-center text-[13px] font-extrabold text-[#242E30] tabular-nums">
                              {qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdateQty(dish.id, 1)}
                              aria-label="Increase quantity"
                              className="w-8 h-8 rounded-[10px] bg-[#FF8000] text-white hover:bg-[#E67300] flex items-center justify-center"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Section 3: Catering & Events */}
        <section id="catering" className="bg-white border-y border-[#EAE5DF] py-12">
          <div className="max-w-[1280px] mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-6 space-y-4">
              <p className="text-[13px] font-bold text-[#FF8000]">
                {lang === 'ar'
                  ? 'أعياد ميلاد · حفلات زفاف · اجتماعات عائلية'
                  : 'Geburtstag · Hochzeit · Familienfeier'}
              </p>
              <h2 className="font-display text-[26px] sm:text-[32px] font-extrabold text-[#242E30] leading-tight [text-wrap:balance]">
                {lang === 'ar'
                  ? 'خدمة البوفيه والضيافة الفاخرة لمناسباتكم الخاصة'
                  : 'Kairos Grill Catering — Frisch, hausgemacht & mit Liebe für Ihre Feier'}
              </h2>
              <p className="text-[14px] text-[#5A6568] leading-relaxed">
                {lang === 'ar'
                  ? 'نجهز لكم صواني الكبة المنزلية، سلطة التبولة الطازجة، البيدا، المناقيش المشكلة، المشاوي والحلويات حسب عدد ضيوفكم في روستوك وما حولها.'
                  : 'Kommen Sie vorbei oder bestellen Sie für Ihre nächste Feier: Hausgemachte Kibbeh, frischer Taboulé-Salat, leckere Pide, Grillspieße und Desserts individuell zusammengestellt.'}
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const cateringDish = KAIROS_MENU.find((d) => d.id === 'catering-party-platte');
                    if (cateringDish) {
                      handleAddToCart(cateringDish);
                      setIsCartOpen(true);
                    }
                  }}
                  className="h-11 px-5 rounded-[12px] bg-[#FF8000] hover:bg-[#E67300] text-white text-[13px] font-bold transition-colors"
                >
                  {lang === 'ar' ? 'إضافة باقة الضيافة للسلة' : 'Party-Platte in den Warenkorb'}
                </button>
                <a
                  href={directCateringWhatsAppUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="h-11 px-5 rounded-[12px] bg-[#F8F5F2] hover:bg-[#EAE5DF] text-[#242E30] text-[13px] font-bold inline-flex items-center gap-2 transition-colors"
                >
                  <MessageCircle className="w-4 h-4 text-[#16A34A]" />
                  <span>{lang === 'ar' ? 'استفسار مباشر عبر واتساب' : 'Catering per WhatsApp anfragen'}</span>
                </a>
              </div>
            </div>

            <div className="lg:col-span-6 grid grid-cols-2 gap-3.5">
              <div className="col-span-2 aspect-[16/9] rounded-[12px] overflow-hidden shadow-md">
                <CroppedPhoto
                  src={KAIROS_ASSETS.cateringHero}
                  alt="Kairos Grill Catering Collage"
                  cropPosition="50% 43%"
                  cropScale={1.52}
                  className="w-full h-full"
                />
              </div>
              <div className="aspect-[4/3] rounded-[12px] overflow-hidden shadow-sm">
                <CroppedPhoto
                  src={KAIROS_ASSETS.buffetInterior}
                  alt="Kairos Grill Buffet"
                  cropPosition="50% 43%"
                  cropScale={1.5}
                  className="w-full h-full"
                />
              </div>
              <div className="aspect-[4/3] rounded-[12px] overflow-hidden shadow-sm">
                <CroppedPhoto
                  src={KAIROS_ASSETS.collageGrill}
                  alt="Kairos Grill Spezialitäten"
                  cropPosition="50% 45%"
                  cropScale={1.5}
                  className="w-full h-full"
                />
              </div>
            </div>
          </div>
        </section>

        {/* Section 4: Contact, Hours, Payment Link Config & App Download */}
        <section id="contact" className="max-w-[1280px] mx-auto px-4 sm:px-6 py-12">
          <div className="bg-white rounded-[16px] p-6 sm:p-8 border border-[#EAE5DF] shadow-[0_4px_20px_rgba(36,46,48,0.05)] grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-5">
              <div className="aspect-[16/9] rounded-[12px] overflow-hidden border border-[#EAE5DF]">
                <CroppedPhoto
                  src={KAIROS_ASSETS.contactCard}
                  alt="Kairos Grill Kontakt & Öffnungszeiten"
                  cropPosition="50% 37%"
                  cropScale={1.75}
                  className="w-full h-full"
                />
              </div>
            </div>

            <div className="lg:col-span-7 space-y-5">
              <div>
                <h2 className="font-display text-[22px] sm:text-[26px] font-extrabold text-[#242E30]">
                  {lang === 'ar'
                    ? 'ساعات العمل، التوصيل وتثبيت التطبيق'
                    : 'Standort, Öffnungszeiten & App'}
                </h2>
                <p className="text-[14px] text-[#5A6568] mt-1">
                  Lieferservice Kairos Grill · {KAIROS_INFO.address}
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13px]">
                <div className="p-4 rounded-[12px] bg-[#F8F5F2]">
                  <p className="font-bold text-[#242E30] mb-1">
                    {lang === 'ar' ? 'أوقات الدوام' : 'Öffnungszeiten'}
                  </p>
                  <p className="text-[#5A6568] tabular-nums">
                    {lang === 'ar' ? KAIROS_INFO.hoursWeekdayAr : KAIROS_INFO.hoursWeekdayDe}
                  </p>
                  <p className="text-[#5A6568] tabular-nums mt-0.5">
                    {lang === 'ar' ? KAIROS_INFO.hoursWeekendAr : KAIROS_INFO.hoursWeekendDe}
                  </p>
                </div>

                <div className="p-4 rounded-[12px] bg-[#F8F5F2]">
                  <p className="font-bold text-[#242E30] mb-1">
                    {lang === 'ar' ? 'الهاتف والواتساب المباشر' : 'Telefon & WhatsApp'}
                  </p>
                  <a
                    href={`tel:${KAIROS_INFO.phoneDisplay}`}
                    className="block font-bold text-[#FF8000] text-[16px] tabular-nums hover:underline"
                  >
                    {KAIROS_INFO.phoneDisplay}
                  </a>
                  <p className="text-[12px] text-[#5A6568] mt-0.5">
                    {lang === 'ar'
                      ? 'تستلمون كل الطلبات فوراً على هذا الرقم'
                      : 'Bestellungen gehen direkt per WhatsApp ein'}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <PWAInstallButton lang={lang} variant="primary" />

                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(true)}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-[12px] bg-[#F8F5F2] hover:bg-[#EAE5DF] text-[#242E30] text-[13px] font-bold transition-colors"
                >
                  <CreditCard className="w-4 h-4 text-[#FF8000]" />
                  <span>
                    {paymentLink
                      ? lang === 'ar'
                        ? 'رابط الدفع مُفعّل (تعديل)'
                        : 'Zahlungslink aktiv (Ändern)'
                      : lang === 'ar'
                        ? 'إضافة رابط الدفع الإلكتروني'
                        : 'Zahlungslink hinterlegen'}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Clean Minimal Footer */}
      <footer className="bg-white border-t border-[#EAE5DF] py-6 pb-20 md:pb-6">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-[#5A6568]">
          <p>
            © {new Date().getFullYear()} Kairos Grill · {KAIROS_INFO.address}
          </p>
          <p className="tabular-nums">
            Telefon & WhatsApp: {KAIROS_INFO.phoneDisplay}
          </p>
        </div>
      </footer>

      {/* Mobile Sticky Bottom Cart Bar (when items > 0) */}
      {cartCount > 0 && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 p-3 bg-white/95 backdrop-blur-md border-t border-[#EAE5DF]">
          <button
            type="button"
            onClick={() => setIsCartOpen(true)}
            className="w-full h-12 px-4 rounded-[12px] bg-[#FF8000] hover:bg-[#E67300] text-white font-display font-bold text-[14px] flex items-center justify-between shadow-[0_8px_20px_rgba(255,128,0,0.3)]"
          >
            <span className="flex items-center gap-2">
              <ShoppingBag className="w-4 h-4" />
              <span>
                {lang === 'ar' ? `عرض السلة (${cartCount})` : `Warenkorb ansehen (${cartCount})`}
              </span>
            </span>
            <span className="tabular-nums">{formatEuro(cartSubtotal)}</span>
          </button>
        </div>
      )}

      {/* Drawers & Modals */}
      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        cart={cart}
        onUpdateQty={handleUpdateQty}
        onClearCart={() => setCart([])}
        lang={lang}
        paymentLink={paymentLink}
        onOpenPaymentConfig={() => setIsPaymentModalOpen(true)}
      />

      <PaymentLinkModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        currentLink={paymentLink}
        onSaveLink={handleSavePaymentLink}
        lang={lang}
      />

      <OfflineIndicator lang={lang} />
    </div>
  );
}
