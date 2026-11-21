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
  X,
  ArrowDown,
  Utensils,
  ExternalLink,
} from 'lucide-react';
import {
  CartEntry,
  DishVariant,
  KAIROS_ASSETS,
  KAIROS_INFO,
  KAIROS_MENU,
  KairosDish,
  MENU_CATEGORIES,
  MenuCategoryId,
  buildWhatsAppUrl,
  calculateCartTotals,
  formatEuro,
} from '@/src/data/kairosData';
import { CroppedPhoto } from '@/src/components/CroppedPhoto';
import { CartDrawer } from '@/src/components/CartDrawer';
import { OfflineIndicator } from '@/src/components/OfflineIndicator';
import { VideoShowcase } from '@/src/components/VideoShowcase';
import { CustomerOrderTracker } from '@/src/components/CustomerOrderTracker';
import { AdminDashboard } from '@/src/components/AdminDashboard';
import { ManagementModal } from '@/src/components/ManagementModal';
import { usePWAInstall } from '@/src/hooks/usePWAInstall';

function makeCartKey(dishId: string, variant?: DishVariant): string {
  return variant ? `${dishId}__${variant.id}` : dishId;
}

interface MenuCardActionProps {
  dish: KairosDish;
  lang: 'ar' | 'de';
  selectedVariant?: DishVariant;
  onSelectVariant?: (variant: DishVariant) => void;
  qty: number;
  onAdd: (dish: KairosDish, variant?: DishVariant) => void;
  onUpdateQty: (entryKey: string, delta: number) => void;
}

function MenuCardAction({
  dish,
  lang,
  selectedVariant,
  onSelectVariant,
  qty,
  onAdd,
  onUpdateQty,
}: MenuCardActionProps) {
  const activePrice = selectedVariant ? selectedVariant.price : dish.price;
  const entryKey = makeCartKey(dish.id, selectedVariant);

  return (
    <div className="space-y-2.5">
      {dish.variants && dish.variants.length > 0 && onSelectVariant && (
        <div className="flex flex-wrap gap-1.5">
          {dish.variants.map((variant) => {
            const isSelected = selectedVariant?.id === variant.id;
            return (
              <button
                key={variant.id}
                type="button"
                onClick={() => onSelectVariant(variant)}
                className={`px-2.5 py-1 rounded-[8px] text-[11px] font-bold transition-colors tabular-nums ${
                  isSelected
                    ? 'bg-[#242E30] text-white'
                    : 'bg-[#F8F5F2] text-[#242E30] border border-[#EAE5DF] hover:bg-[#FFF3E6]'
                }`}
              >
                {lang === 'ar' ? variant.labelAr : variant.labelDe} · {formatEuro(variant.price)}
              </button>
            );
          })}
        </div>
      )}

      <div className="pt-2.5 border-t border-[#EAE5DF] flex items-center justify-between gap-3">
        <div>
          <span className="font-display text-[17px] sm:text-[18px] font-extrabold text-[#242E30] tabular-nums">
            {formatEuro(activePrice)}
          </span>
          <span className="text-[11px] text-[#5A6568] ms-1.5 tabular-nums">
            / {selectedVariant ? (lang === 'ar' ? selectedVariant.labelAr : selectedVariant.labelDe) : lang === 'ar' ? dish.unitAr : dish.unitDe} ·{' '}
            {dish.taxRate === 0.19 ? '19%' : '7%'}
          </span>
        </div>

        {qty === 0 ? (
          <button
            type="button"
            onClick={() => onAdd(dish, selectedVariant)}
            className="h-9 sm:h-10 px-3.5 sm:px-4 rounded-[12px] bg-[#FF8000] hover:bg-[#E67300] text-white text-[13px] font-bold flex items-center gap-1.5 transition-colors shrink-0"
          >
            <Plus className="w-4 h-4" strokeWidth={2.4} />
            <span>{lang === 'ar' ? 'أضف' : 'Bestellen'}</span>
          </button>
        ) : (
          <div className="flex items-center gap-1.5 bg-[#FFF3E6] rounded-[12px] p-1 border border-[#FF8000]/30">
            <button
              type="button"
              onClick={() => onUpdateQty(entryKey, -1)}
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
              onClick={() => onUpdateQty(entryKey, 1)}
              aria-label="Increase quantity"
              className="w-8 h-8 rounded-[10px] bg-[#FF8000] text-white hover:bg-[#E67300] flex items-center justify-center"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

const ACTIVE_ORDER_STORAGE_KEY = 'kairos_active_order_id';

function isAdminUrl(): boolean {
  if (typeof window === 'undefined') return false;
  const params = new URLSearchParams(window.location.search);
  return (
    params.get('admin') === '1' ||
    window.location.pathname.toLowerCase().startsWith('/admin')
  );
}

export default function App() {
  const [lang, setLang] = useState<'ar' | 'de'>('ar');
  const [viewMode, setViewMode] = useState<'customer' | 'admin'>(() =>
    isAdminUrl() ? 'admin' : 'customer'
  );

  // Customer Live Order Tracking state
  const [activeOrderId, setActiveOrderId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem(ACTIVE_ORDER_STORAGE_KEY);
  });

  const [activeCategory, setActiveCategory] = useState<MenuCategoryId>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isManagementOpen, setIsManagementOpen] = useState(false);
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});

  // Capture & suppress automatic browser install prompts globally; UI only shown after Admin login
  usePWAInstall();

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  // Sync URL navigation
  useEffect(() => {
    const onPopState = () => {
      setViewMode(isAdminUrl() ? 'admin' : 'customer');
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigateToCustomer = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('admin');
    if (url.pathname.toLowerCase().startsWith('/admin')) {
      url.pathname = '/';
    }
    window.history.pushState({}, '', url.toString());
    setViewMode('customer');
  };

  const getSelectedVariant = (dish: KairosDish): DishVariant | undefined => {
    if (!dish.variants || dish.variants.length === 0) return undefined;
    const chosenId = selectedVariants[dish.id];
    return (
      dish.variants.find((v) => v.id === chosenId) ??
      dish.variants[dish.variants.length > 1 && dish.category === 'pizza' ? 1 : 0]
    );
  };

  const handleSelectVariant = (dishId: string, variant: DishVariant) => {
    setSelectedVariants((prev) => ({ ...prev, [dishId]: variant.id }));
  };

  const handleAddToCart = (dish: KairosDish, variant?: DishVariant) => {
    const chosenVariant = variant ?? getSelectedVariant(dish);
    const key = makeCartKey(dish.id, chosenVariant);

    setCart((prev) => {
      const existing = prev.find((entry) => entry.key === key);
      if (existing) {
        return prev.map((entry) =>
          entry.key === key ? { ...entry, quantity: entry.quantity + 1 } : entry
        );
      }
      return [...prev, { key, dish, variant: chosenVariant, quantity: 1 }];
    });
  };

  const handleUpdateQty = (entryKey: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((entry) =>
          entry.key === entryKey
            ? { ...entry, quantity: entry.quantity + delta }
            : entry
        )
        .filter((entry) => entry.quantity > 0)
    );
  };

  const getQty = (dishId: string, variant?: DishVariant) => {
    const key = makeCartKey(dishId, variant);
    return cart.find((entry) => entry.key === key)?.quantity ?? 0;
  };

  const cartCount = cart.reduce((sum, entry) => sum + entry.quantity, 0);
  const cartTotals = calculateCartTotals(cart, 'delivery');
  const cartItemsWithTax = cartTotals.subtotal + cartTotals.totalTax;

  const filteredMenu = KAIROS_MENU.filter((dish) => {
    if (activeCategory !== 'all' && dish.category !== activeCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        (dish.itemNumber && dish.itemNumber.includes(q)) ||
        dish.nameDe.toLowerCase().includes(q) ||
        dish.nameAr.toLowerCase().includes(q) ||
        dish.descDe.toLowerCase().includes(q) ||
        dish.descAr.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const photoCardDishes = filteredMenu.filter((dish) => dish.featuredPhotoCard && dish.image);

  const groupedCategories = MENU_CATEGORIES.filter((c) => c.id !== 'all')
    .map((cat) => {
      const items = filteredMenu.filter((d) => d.category === cat.id);
      return { cat, items };
    })
    .filter(({ items }) => items.length > 0);

  const directCateringWhatsAppUrl = buildWhatsAppUrl(
    lang === 'ar'
      ? `مرحباً Kairos Grill، أود الاستفسار عن باقات البوفيه والمناسبات (Catering).`
      : `Hallo Kairos Grill Team, ich möchte gerne ein Catering / eine Partyplatte anfragen.`
  );

  if (viewMode === 'admin') {
    return (
      <>
        <AdminDashboard
          lang={lang}
          onChangeLang={setLang}
          onExitAdmin={navigateToCustomer}
        />
        <OfflineIndicator lang={lang} />
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F5F2] text-[#242E30]">
      {/* 3-Zone Top Navigation Bar */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-[#EAE5DF]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-6 sm:gap-8">
          {/* Zone 1: Brand */}
          <a
            href="#top"
            className="flex items-center whitespace-nowrap shrink-0"
            aria-label="Kairos Grill"
          >
            <img
              src={KAIROS_ASSETS.logoBanner}
              alt="Kairos Grill"
              className="h-11 w-auto object-contain"
            />
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
              onClick={() => setActiveCategory('drinks')}
              className="hover:text-[#FF8000] transition-colors whitespace-nowrap shrink-0"
            >
              {lang === 'ar' ? 'المشروبات' : 'Getränke'}
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
              {lang === 'ar' ? 'التواصل' : 'Kontakt'}
            </a>
            <button
              type="button"
              onClick={() => setIsManagementOpen(true)}
              className="hover:text-[#FF8000] transition-colors whitespace-nowrap shrink-0 font-semibold"
            >
              {lang === 'ar' ? 'الإدارة' : 'Verwaltung'}
            </button>
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
                  {formatEuro(cartItemsWithTax)}
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
            {/* Sub-header Utility Strip */}
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

              {/* Language Switcher & Management Access */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsManagementOpen(true)}
                  className="md:hidden h-9 px-3 rounded-[10px] bg-[#F8F5F2] hover:bg-[#FFF3E6] border border-[#EAE5DF] text-[12px] font-bold text-[#242E30] transition-colors"
                >
                  {lang === 'ar' ? 'الإدارة' : 'Verwaltung'}
                </button>

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
                    ? 'شيش طاووق مشوي على الأصول، مقبلات وكبة، مناقيش صاج، بيتزا بالفرن الحجري، برغر، باستا، شنيتزل وتورتات منزلية يومياً مع فاتورة تفصيلية مباشرة على واتساب.'
                    : 'Zartes Shish Tawook, orientalische Mezze, Saj, Steinofen-Pizza, handmade Burger, Pasta, Schnitzel & hausgemachte Torten. Direkt bestellen – Ihre Rechnung geht sofort per WhatsApp ein.'}
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

                {/* Primary Menu CTA (Customer Web-Only Experience — No App Download) */}
                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <a
                    href="#menu"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-[12px] bg-[#FF8000] hover:bg-[#E67300] text-white font-display font-bold text-[14px] shadow-[0_8px_20px_rgba(255,128,0,0.3)] transition-colors whitespace-nowrap shrink-0"
                  >
                    <Utensils className="w-4 h-4" />
                    <span>{lang === 'ar' ? 'تصفح القائمة واطلب الآن' : 'Jetzt bestellen'}</span>
                    <ArrowDown className="w-4 h-4" />
                  </a>
                </div>
              </div>

              {/* Hero Visual Showcase using Real Uploaded Photos */}
              <div className="lg:col-span-6 grid grid-cols-2 gap-3.5">
                <div className="col-span-2 h-[200px] sm:h-[225px] rounded-[12px] overflow-hidden bg-white border border-[#EAE5DF] p-5 flex items-center justify-center shadow-[0_8px_24px_rgba(36,46,48,0.06)]">
                  <img
                    src={KAIROS_ASSETS.logoBanner}
                    alt="Kairos Grill Logo"
                    className="max-h-full max-w-full object-contain"
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

        {/* Live Order Status Notification Banner for Customer */}
        {activeOrderId && (
          <CustomerOrderTracker
            orderId={activeOrderId}
            lang={lang}
            onDismiss={() => {
              localStorage.removeItem(ACTIVE_ORDER_STORAGE_KEY);
              setActiveOrderId(null);
            }}
          />
        )}

        {/* Video Showcase Section */}
        <VideoShowcase
          lang={lang}
          onJumpToCategory={(category) => {
            setActiveCategory(category);
            setSearchQuery('');
          }}
        />

        {/* Section 2: Interactive Menu & Complete Official Speisekarte */}
        <section id="menu" className="max-w-[1280px] mx-auto px-4 sm:px-6 py-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <h2 className="font-display text-[24px] sm:text-[28px] font-extrabold text-[#242E30]">
                {lang === 'ar' ? 'قائمة الطعام الكاملة (01–82) والمشروبات' : 'Unsere komplette Speisekarte'}
              </h2>
              <p className="text-[14px] text-[#5A6568] mt-1">
                {lang === 'ar'
                  ? 'الأسعار باليورو (€) · يُضاف ٧٪ ضريبة للطعام و١٩٪ للمشروبات'
                  : 'Alle Preise netto in Euro (€) zzgl. 7% MwSt. (Speisen) & 19% MwSt. (Getränke)'}
              </p>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-[#5A6568] absolute top-3.5 left-3.5 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  lang === 'ar' ? 'ابحث برقم الصنف أو الاسم (مثال: 24، شيش، بيتزا)...' : 'Suche nach Nr. oder Gericht (z. B. 27, Shish)...'
                }
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
            <div className="space-y-12">
              {/* Photo Highlights Grid (Drinks with new photos, Torten, Grill & Bakery photos) */}
              {photoCardDishes.length > 0 && (
                <div>
                  {activeCategory === 'all' && !searchQuery.trim() && (
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-display text-[19px] font-extrabold text-[#242E30]">
                        {lang === 'ar'
                          ? 'أبرز الأطباق، المشروبات والتورتات بالصور'
                          : 'Spezialitäten, Torten & Getränke'}
                      </h3>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {photoCardDishes.map((dish) => {
                      const activeVariant = getSelectedVariant(dish);
                      const qty = getQty(dish.id, activeVariant);
                      return (
                        <article
                          key={`photo-${dish.id}`}
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
                              {dish.itemNumber ? `${dish.itemNumber}. ` : ''}
                              {lang === 'ar' ? dish.nameAr : dish.nameDe}
                            </h3>
                            <p className="text-[12px] text-[#5A6568] mt-0.5">
                              {lang === 'ar' ? dish.nameDe : dish.unitDe}
                            </p>

                            <p className="mt-2 mb-3 text-[13px] text-[#5A6568] leading-relaxed flex-1">
                              {lang === 'ar' ? dish.descAr : dish.descDe}
                            </p>

                            <MenuCardAction
                              dish={dish}
                              lang={lang}
                              selectedVariant={activeVariant}
                              onSelectVariant={(variant) => handleSelectVariant(dish.id, variant)}
                              qty={qty}
                              onAdd={handleAddToCart}
                              onUpdateQty={handleUpdateQty}
                            />
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Grouped Full Numbered Menu Catalog (items without duplicate photo-only category) */}
              {groupedCategories
                .filter(({ items }) => items.some((item) => !item.featuredPhotoCard))
                .map(({ cat, items }) => (
                  <div key={cat.id} className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-1 pb-2 border-b border-[#EAE5DF]">
                      <h3 className="font-display text-[20px] font-extrabold text-[#242E30]">
                        {lang === 'ar' ? cat.labelAr : cat.labelDe}
                      </h3>
                      {(cat.noteAr || cat.noteDe) && (
                        <p className="text-[12px] font-semibold text-[#FF8000]">
                          {lang === 'ar' ? cat.noteAr : cat.noteDe}
                        </p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {items.map((dish) => {
                        const activeVariant = getSelectedVariant(dish);
                        const qty = getQty(dish.id, activeVariant);
                        return (
                          <article
                            key={dish.id}
                            className="bg-white rounded-[12px] p-4 border border-[#EAE5DF]/85 shadow-[0_2px_10px_rgba(36,46,48,0.04)] hover:shadow-[0_8px_22px_rgba(36,46,48,0.08)] transition-shadow flex flex-col justify-between gap-3"
                          >
                            <div className="flex items-start gap-3.5">
                              {dish.image && (
                                <CroppedPhoto
                                  src={dish.image}
                                  alt={lang === 'ar' ? dish.nameAr : dish.nameDe}
                                  cropPosition={dish.cropPosition}
                                  cropScale={dish.cropScale}
                                  className="w-24 h-24 sm:w-28 sm:h-28 rounded-[10px] shrink-0"
                                />
                              )}
                              <div className="min-w-0 flex-1">
                                <h4 className="font-display text-[15px] font-bold text-[#242E30] leading-snug">
                                  {dish.itemNumber && (
                                    <span className="text-[#FF8000] tabular-nums me-1.5">
                                      {dish.itemNumber}.
                                    </span>
                                  )}
                                  {lang === 'ar' ? dish.nameAr : dish.nameDe}
                                </h4>
                                <p className="text-[12px] font-medium text-[#5A6568] mt-0.5">
                                  {lang === 'ar' ? dish.nameDe : dish.nameAr}
                                </p>
                                <p className="mt-1.5 text-[13px] text-[#5A6568] leading-relaxed">
                                  {lang === 'ar' ? dish.descAr : dish.descDe}
                                </p>
                                {dish.allergens && (
                                  <p className="mt-1 text-[11px] text-[#5A6568]/80">
                                    Allergene: {dish.allergens}
                                  </p>
                                )}
                              </div>
                            </div>

                            <MenuCardAction
                              dish={dish}
                              lang={lang}
                              selectedVariant={activeVariant}
                              onSelectVariant={(variant) => handleSelectVariant(dish.id, variant)}
                              qty={qty}
                              onAdd={handleAddToCart}
                              onUpdateQty={handleUpdateQty}
                            />
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ))}
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

        {/* Section 4: Contact, Hours & App Download */}
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
                    ? 'ساعات العمل، التوصيل والتواصل'
                    : 'Standort, Öffnungszeiten & Kontakt'}
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
                <a
                  href={KAIROS_INFO.facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-[12px] bg-[#F0F6FF] hover:bg-[#E1EEFF] text-[#1877F2] border border-[#1877F2]/20 font-display font-bold text-[13px] transition-colors whitespace-nowrap shrink-0"
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="w-4 h-4 fill-current shrink-0"
                  >
                    <path d="M22 12c0-5.52-4.48-10-10-10S2 6.48 2 12c0 4.99 3.66 9.13 8.44 9.88v-6.99H7.9v-2.89h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.87h2.78l-.44 2.89h-2.34v6.99C18.34 21.13 22 16.99 22 12z" />
                  </svg>
                  <span>
                    {lang === 'ar'
                      ? 'العروض الدائمة على فيسبوك'
                      : 'Angebote auf Facebook'}
                  </span>
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>
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
          <div className="flex flex-wrap items-center gap-4">
            <a
              href={KAIROS_INFO.facebookUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 font-semibold text-[#1877F2] hover:underline"
            >
              <span>
                {lang === 'ar' ? 'فيسبوك (العروض الدائمة)' : 'Facebook · Dauerangebote'}
              </span>
              <ExternalLink className="w-3 h-3" />
            </a>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => setIsManagementOpen(true)}
              className="font-semibold text-[#242E30] hover:text-[#FF8000] transition-colors"
            >
              {lang === 'ar' ? 'الإدارة والشكاوي' : 'Verwaltung & Beschwerden'}
            </button>
            <span aria-hidden="true">·</span>
            <p className="tabular-nums">
              Telefon & WhatsApp: {KAIROS_INFO.phoneDisplay}
            </p>
          </div>
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
            <span className="tabular-nums">{formatEuro(cartItemsWithTax)}</span>
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
        onOrderCreated={(orderId) => {
          localStorage.setItem(ACTIVE_ORDER_STORAGE_KEY, orderId);
          setActiveOrderId(orderId);
        }}
      />

      <ManagementModal
        isOpen={isManagementOpen}
        onClose={() => setIsManagementOpen(false)}
        lang={lang}
        onOpenAdminDashboard={() => setViewMode('admin')}
      />

      <OfflineIndicator lang={lang} />
    </div>
  );
}
