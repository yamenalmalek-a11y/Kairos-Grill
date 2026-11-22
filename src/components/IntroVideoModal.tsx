import { useEffect, useRef, useState } from 'react';
import { Pause, Play, Utensils, Volume2, VolumeX, X } from 'lucide-react';
import { KAIROS_ASSETS } from '@/src/data/kairosData';

interface IntroVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: 'ar' | 'de';
}

export function IntroVideoModal({ isOpen, onClose, lang }: IntroVideoModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!isOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
      video.muted = true;
      setIsMuted(true);
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {
          setIsPlaying(false);
        });
      }
    }

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

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
    const nextMuted = !video.muted;
    video.muted = nextMuted;
    setIsMuted(nextMuted);
    if (video.paused) {
      video.play().catch(() => {});
      setIsPlaying(true);
    }
  };

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    setProgress(Math.min(100, (video.currentTime / video.duration) * 100));
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={lang === 'ar' ? 'فيديو كايروس غريل الترحيبي' : 'Kairos Grill Willkommensvideo'}
      className="fixed inset-0 z-50 bg-[#0B0D0F]/92 backdrop-blur-md flex items-center justify-center p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="relative h-[min(88dvh,700px)] max-w-full aspect-[9/16] rounded-[16px] overflow-hidden bg-[#14171A] shadow-[0_24px_64px_rgba(0,0,0,0.75)] border border-[#262B31] flex flex-col justify-between"
        onClick={(e) => e.stopPropagation()}
      >
        <video
          ref={videoRef}
          src={KAIROS_ASSETS.introVideo}
          autoPlay
          muted={isMuted}
          playsInline
          preload="auto"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={handleTimeUpdate}
          onEnded={onClose}
          onError={onClose}
          onClick={togglePlay}
          className="absolute inset-0 w-full h-full object-cover cursor-pointer"
        />

        {/* Top Progress Bar & Header Scrim */}
        <div className="relative z-10 bg-gradient-to-b from-black/80 via-black/35 to-transparent">
          <div className="h-1 w-full bg-white/15">
            <div
              className="h-full bg-[#FF8000] transition-[width] duration-150"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div className="p-3.5 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-[#FF8000] truncate">
                Kairos Grill · Rostock
              </p>
              <p className="font-display text-[13px] font-bold text-white truncate">
                {lang === 'ar' ? 'أهلاً بكم في كايروس غريل' : 'Willkommen im Kairos Grill'}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label={lang === 'ar' ? 'إغلاق الفيديو' : 'Video schließen'}
              className="w-10 h-10 rounded-[12px] bg-black/55 hover:bg-[#FF8000] text-white flex items-center justify-center backdrop-blur-xs transition-colors shrink-0"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Bottom Scrim & Action Controls */}
        <div className="relative z-10 p-4 bg-gradient-to-t from-black/90 via-black/55 to-transparent space-y-3">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={toggleMute}
              className={`h-10 px-3.5 rounded-[10px] text-[12px] font-bold inline-flex items-center gap-2 backdrop-blur-xs transition-colors whitespace-nowrap shrink-0 ${
                isMuted
                  ? 'bg-[#14171A]/90 text-[#F4F5F6] hover:bg-[#1C2024] border border-[#FF8000]/50'
                  : 'bg-black/55 text-white hover:bg-black/75 border border-white/20'
              }`}
            >
              {isMuted ? (
                <>
                  <VolumeX className="w-4 h-4 text-[#FF8000]" />
                  <span>{lang === 'ar' ? 'تشغيل الصوت' : 'Ton einschalten'}</span>
                </>
              ) : (
                <>
                  <Volume2 className="w-4 h-4 text-[#FF8000]" />
                  <span>{lang === 'ar' ? 'كتم الصوت' : 'Ton aus'}</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause video' : 'Play video'}
              className="w-10 h-10 rounded-[10px] bg-black/55 hover:bg-[#FF8000] text-white border border-white/20 flex items-center justify-center backdrop-blur-xs transition-colors shrink-0"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-full h-11 px-4 rounded-[12px] bg-[#FF8000] hover:bg-[#E67300] text-white font-display font-bold text-[14px] flex items-center justify-center gap-2 shadow-[0_8px_20px_rgba(255,128,0,0.35)] transition-colors whitespace-nowrap"
          >
            <Utensils className="w-4 h-4 shrink-0" />
            <span>
              {lang === 'ar' ? 'تخطي والدخول إلى القائمة' : 'Direkt zur Speisekarte'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
