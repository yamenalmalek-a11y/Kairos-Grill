import { useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';

interface CroppedPhotoProps {
  src: string;
  alt: string;
  cropPosition?: string;
  cropScale?: number;
  className?: string;
}

export function CroppedPhoto({
  src,
  alt,
  cropPosition = '50% 45%',
  cropScale = 1.48,
  className = '',
}: CroppedPhotoProps) {
  const [hasError, setHasError] = useState(false);

  if (hasError || !src) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-[#FFF3E6] via-[#F8F5F2] to-[#EAE5DF] text-[#5A6568] ${className}`}
        role="img"
        aria-label={alt}
      >
        <UtensilsCrossed className="w-7 h-7 text-[#FF8000] mb-1.5" strokeWidth={1.75} />
        <span className="text-[12px] font-medium px-3 text-center line-clamp-1">{alt}</span>
      </div>
    );
  }

  return (
    <div className={`overflow-hidden bg-[#242E30]/5 ${className}`}>
      <img
        src={src}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setHasError(true)}
        style={{
          objectPosition: cropPosition,
          transform: `scale(${cropScale})`,
          transformOrigin: cropPosition,
        }}
        className="w-full h-full object-cover transition-transform duration-300"
      />
    </div>
  );
}
