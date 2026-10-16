import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Camera, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Fotos dos quiosques — ordem correta
export const KIOSK_PHOTOS = [
  {
    src: '/images/quiosque-familiar.jpg',
    caption: 'Quiosques Familiares (06 ao 12)',
    sub: 'Até 5 pessoas • Churrasqueira • Beira d\'água',
  },
  {
    src: '/images/quiosque-01.jpg',
    caption: 'Quiosque Grande (01)',
    sub: 'Até 25 pessoas • Separado dos demais • Churrasqueira, pia, grelha',
  },
  {
    src: '/images/quiosque-medio.jpg',
    caption: 'Quiosques Médios (02 ao 05)',
    sub: 'Até 15 pessoas • Churrasqueira, pia, grelha, mesas e cadeiras',
  },
];

interface KioskPhotoPopupProps {
  open: boolean;
  onClose: () => void;
  initialIndex?: number;
}

export function KioskPhotoPopup({ open, onClose, initialIndex = 0 }: KioskPhotoPopupProps) {
  const [idx, setIdx] = useState(initialIndex);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);

  useEffect(() => {
    if (open) {
      setIdx(initialIndex);
      // Preload all kiosk photos for instant navigation
      KIOSK_PHOTOS.forEach((p) => {
        const img = new Image();
        img.src = p.src;
      });
    }
  }, [open, initialIndex]);

  const prev = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIdx(i => (i - 1 + KIOSK_PHOTOS.length) % KIOSK_PHOTOS.length);
  }, []);

  const next = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIdx(i => (i + 1) % KIOSK_PHOTOS.length);
  }, []);

  // Fechar com Esc e navegar com setas
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'ArrowLeft') {
        e.stopPropagation();
        prev();
      }
      if (e.key === 'ArrowRight') {
        e.stopPropagation();
        next();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [open, onClose, prev, next]);

  if (!open) return null;

  const photo = KIOSK_PHOTOS[idx];

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const diff = touchStartX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) {
      if (diff > 0) next();
      else prev();
    }
    setTouchStartX(null);
  };

  return createPortal(
    <div
      data-kiosk-portal="true"
      className="fixed inset-0 z-[99999] flex items-center justify-center p-4 pointer-events-auto"
      style={{ backgroundColor: 'rgba(0,0,0,0.92)', pointerEvents: 'auto' }}
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Modal container */}
      <div
        className="relative w-full max-w-2xl mx-auto flex flex-col items-center pointer-events-auto"
        onClick={e => e.stopPropagation()}
        onPointerDown={e => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Fechar */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute -top-10 right-2 sm:right-0 z-20 text-white/80 hover:text-white transition-colors flex items-center gap-1.5 text-sm font-bold bg-black/40 px-3 py-1.5 rounded-full border border-white/10 backdrop-blur-sm cursor-pointer pointer-events-auto"
        >
          <X className="h-4 w-4" /> Fechar
        </button>

        {/* Imagem INTEIRA sem corte */}
        <div className="relative w-full bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10 flex items-center justify-center">
          <img
            key={photo.src}
            src={photo.src}
            alt={photo.caption}
            className="w-full h-auto block max-h-[50dvh] sm:max-h-[60dvh] select-none"
            style={{ objectFit: 'contain', background: '#000' }}
            loading="eager"
            fetchPriority="high"
            decoding="sync"
          />

          {/* Setas laterais sobre a imagem para facilitar a passagem */}
          <button
            type="button"
            onClick={prev}
            className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-all border border-white/20 active:scale-90 cursor-pointer pointer-events-auto shadow-lg"
            aria-label="Foto anterior"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={next}
            className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-all border border-white/20 active:scale-90 cursor-pointer pointer-events-auto shadow-lg"
            aria-label="Próxima foto"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        </div>

        {/* Info Card - Glassmorphism */}
        <div className="w-full mt-4 bg-black/60 backdrop-blur-md border border-white/15 rounded-2xl p-4 text-center flex flex-col items-center pointer-events-auto">
          {/* Caption */}
          <div className="flex items-center justify-center gap-1.5 mb-1.5">
            <Camera className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest leading-none">Foto Real</span>
          </div>
          <h4 className="text-white font-black text-base sm:text-lg leading-snug">{photo.caption}</h4>
          <p className="text-white/70 text-xs font-semibold mt-1 leading-normal">{photo.sub}</p>

          {/* Navegação */}
          <div className="flex items-center gap-5 mt-4">
            <button
              type="button"
              onClick={prev}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all border border-white/20 active:scale-90 cursor-pointer pointer-events-auto"
              aria-label="Foto anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            {/* Dots */}
            <div className="flex gap-2 items-center">
              {KIOSK_PHOTOS.map((_, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIdx(i);
                  }}
                  className={cn(
                    'rounded-full transition-all duration-300 cursor-pointer pointer-events-auto',
                    i === idx ? 'w-6 h-2.5 bg-emerald-400' : 'w-2.5 h-2.5 bg-white/30 hover:bg-white/60'
                  )}
                  aria-label={`Ir para foto ${i + 1}`}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={next}
              className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all border border-white/20 active:scale-90 cursor-pointer pointer-events-auto"
              aria-label="Próxima foto"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Contador */}
          <p className="mt-3 text-white/40 text-[10px] font-black tracking-widest uppercase">
            {idx + 1} / {KIOSK_PHOTOS.length}
          </p>
        </div>
      </div>
    </div>,
    document.body
  );
}

/** Botão compacto para abrir o popup */
export function KioskPhotoButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          'inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-emerald-500/50 bg-white/80 hover:bg-emerald-50 text-emerald-800 font-bold text-xs transition-all shadow-sm hover:shadow-md hover:border-emerald-600 active:scale-95',
          className
        )}
      >
        <Camera className="h-3.5 w-3.5" />
        Ver fotos dos quiosques
      </button>
      <KioskPhotoPopup open={open} onClose={() => setOpen(false)} />
    </>
  );
}
