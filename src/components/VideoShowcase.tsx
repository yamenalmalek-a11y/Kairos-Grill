import { useRef, useState } from 'react';
import { Play, Pause, Volume2, VolumeX, ArrowDown, ExternalLink } from 'lucide-react';
import { KAIROS_ASSETS, KAIROS_INFO, MenuCategoryId } from '@/src/data/kairosData';

interface VideoShowcaseProps {
  lang: 'ar' | 'de';
  onJumpToCategory: (category: MenuCategoryId) => void;
}

export function VideoShowcase({ lang, onJumpToCategory }: VideoShowcaseProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(true);
  const [videoError, setVideoError] = useState(false);

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const highlights = [
    {
      num: '01',
      titleAr: 'قرمشة ذهبية وتتبيلة شرقية خاصة',
      titleDe: 'Goldbraun & würzig mariniert',
      descAr:
        'أجنحة دجاج مقرمشة ومشوية على الأصول مع بطاطا مقلية ساخنة ومخللات طازجة.',
      descDe:
        'Knusprige und gegrillte Chicken Wings nach Hausrezept mit heißen Pommes.',
    },
    {
      num: '02',
      titleAr: 'جبنة ساخنة تذوب مع كل لقمة',
      titleDe: 'Frisch gebacken & geschmolzener Käse',
      descAr:
        'خبز سمسم محمّص محشو بالدجاج المتبّل والجبن الذائب يُحضّر لحظة بطلبكم.',
      descDe:
        'Fluffiges Sesambrot gefüllt mit zartem Fleisch und cremig geschmolzenem Käse.',
    },
    {
      num: '03',
      titleAr: 'نكهة تجمع العائلة على سفرة واحدة',
      titleDe: 'Geschmack für Familie & Freunde',
      descAr:
        'وجبات مشاركة وسناكس مثالية للسهرات والجمعات — تصلكم ساخنة في روستوك.',
      descDe:
        'Ideal zum Teilen für gemütliche Abende — frisch und heiß geliefert in Rostock.',
    },
  ];

  return (
    <section
      id="kitchen-story"
      className="max-w-[1280px] mx-auto px-4 sm:px-6 pt-10 pb-2"
    >
      <div className="bg-white rounded-[16px] border border-[#EAE5DF] shadow-[0_4px_20px_rgba(36,46,48,0.05)] p-5 sm:p-8 lg:p-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          {/* Portrait 9:16 Video Frame */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="relative w-full max-w-[320px] sm:max-w-[340px] aspect-[9/16] rounded-[14px] overflow-hidden bg-[#181E20] shadow-[0_14px_36px_rgba(36,46,48,0.16)] border border-[#EAE5DF]">
              {!videoError ? (
                <video
                  ref={videoRef}
                  src={KAIROS_ASSETS.promoVideo}
                  autoPlay
                  muted={isMuted}
                  loop
                  playsInline
                  preload="metadata"
                  onPlay={() => setIsPlaying(true)}
                  onPause={() => setIsPlaying(false)}
                  onError={() => setVideoError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center text-white/85">
                  <p className="font-display text-[16px] font-bold">Kairos Grill</p>
                  <p className="text-[13px] text-white/70 mt-1">
                    {lang === 'ar'
                      ? 'تعذّر تشغيل الفيديو على هذا المتصفح'
                      : 'Video wird auf diesem Gerät nicht unterstützt'}
                  </p>
                </div>
              )}

              {/* Bottom Scrim & Controls */}
              <div className="absolute inset-x-0 bottom-0 p-3.5 bg-gradient-to-t from-black/80 via-black/35 to-transparent flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold text-white/80">
                    {lang === 'ar' ? 'أصالة المذاق · كايروس غريل' : 'Echt. Frisch. Hausgemacht.'}
                  </p>
                  <p className="font-display text-[14px] font-bold text-white truncate">
                    {lang === 'ar'
                      ? 'طعم لا يُقاوم في كل وجبة'
                      : 'Genuss in jedem Bissen'}
                  </p>
                </div>

                {!videoError && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={togglePlay}
                      aria-label={isPlaying ? 'Pause video' : 'Play video'}
                      className="w-9 h-9 rounded-[10px] bg-black/55 hover:bg-[#FF8000] text-white flex items-center justify-center backdrop-blur-xs transition-colors"
                    >
                      {isPlaying ? (
                        <Pause className="w-4 h-4" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={toggleMute}
                      aria-label={isMuted ? 'Unmute video' : 'Mute video'}
                      className="w-9 h-9 rounded-[10px] bg-black/55 hover:bg-[#FF8000] text-white flex items-center justify-center backdrop-blur-xs transition-colors"
                    >
                      {isMuted ? (
                        <VolumeX className="w-4 h-4" />
                      ) : (
                        <Volume2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Editorial Culinary Phrases & Direct Order Links */}
          <div className="lg:col-span-7 flex flex-col justify-center">
            <div className="flex flex-wrap items-center gap-2 text-[13px] font-bold text-[#FF8000]">
              <span>
                {lang === 'ar' ? 'من مطبخ كايروس غريل' : 'Aus der Kairos Küche'}
              </span>
              <span aria-hidden="true" className="text-[#5A6568]">
                ·
              </span>
              <span className="text-[#5A6568] font-semibold">
                {lang === 'ar' ? 'طازج يومياً ١٠٠٪' : '100% Hausgemacht in Rostock'}
              </span>
            </div>

            <h2 className="mt-2 font-display text-[26px] sm:text-[34px] font-extrabold text-[#242E30] leading-[1.24] [text-wrap:balance]">
              {lang === 'ar'
                ? 'من قلب المطبخ إلى مائدتكم... قرمشة ذهبية ونكهة تبقى بالبال'
                : 'Knusprig, saftig & voller Aroma — frisch zubereitet für Sie'}
            </h2>

            <p className="mt-3 text-[15px] text-[#5A6568] leading-relaxed max-w-2xl">
              {lang === 'ar'
                ? 'نؤمن في كايروس غريل أن اللقمة الطيبة تبدأ من المكونات الطازجة، التتبيلة المتقنة، وحبّ الضيافة. شاهدوا تحضيراتنا واختاروا وجبتكم المفضلة لتصلكم ساخنة أينما كنتم في روستوك.'
                : 'Gutes Essen beginnt mit frischen Zutaten, ehrlichen Gewürzen und echter Leidenschaft. Entdecken Sie unsere beliebtesten Snacks, Wings und frisch gebackenen Kreationen.'}
            </p>

            {/* Culinary Highlights List separated by hairline dividers */}
            <div className="mt-6 divide-y divide-[#EAE5DF] border-y border-[#EAE5DF]">
              {highlights.map((item) => (
                <div key={item.num} className="py-3.5 flex items-baseline gap-4">
                  <span className="font-display text-[14px] font-extrabold text-[#FF8000] tabular-nums shrink-0">
                    {item.num}.
                  </span>
                  <div className="min-w-0">
                    <h3 className="font-display text-[15px] font-bold text-[#242E30]">
                      {lang === 'ar' ? item.titleAr : item.titleDe}
                    </h3>
                    <p className="text-[13px] text-[#5A6568] mt-0.5 leading-relaxed">
                      {lang === 'ar' ? item.descAr : item.descDe}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Action Links to Menu Categories */}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a
                href="#menu"
                onClick={() => onJumpToCategory('kids_snacks')}
                className="h-11 px-5 rounded-[12px] bg-[#FF8000] hover:bg-[#E67300] text-white text-[13px] font-bold inline-flex items-center gap-2 shadow-[0_6px_18px_rgba(255,128,0,0.26)] transition-colors whitespace-nowrap shrink-0"
              >
                <span>
                  {lang === 'ar'
                    ? 'اطلب أجنحة الدجاج والسناكس'
                    : 'Chicken Wings & Snacks bestellen'}
                </span>
                <ArrowDown className="w-4 h-4" />
              </a>

              <a
                href="#menu"
                onClick={() => onJumpToCategory('burger')}
                className="h-11 px-5 rounded-[12px] bg-[#F8F5F2] hover:bg-[#EAE5DF] text-[#242E30] border border-[#EAE5DF] text-[13px] font-bold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
              >
                <span>
                  {lang === 'ar' ? 'تصفح البرغر المنزلي' : 'Handmade Burger entdecken'}
                </span>
              </a>
            </div>

            <div className="mt-4 pt-4 border-t border-[#EAE5DF]/80">
              <a
                href={KAIROS_INFO.facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-[13px] font-bold text-[#1877F2] hover:underline"
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
                    ? 'للاطلاع على المزيد من العروض الدائمة تابعنا على فيسبوك'
                    : 'Weitere Dauerangebote auf unserer Facebook-Seite ansehen'}
                </span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
