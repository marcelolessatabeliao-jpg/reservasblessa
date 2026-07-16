import React, { useState, useEffect, useCallback } from 'react';
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

  useEffect(() => {
    if (open) setIdx(initialIndex);
  }, [open, initialIndex]);

  const prev = useCallback(() => setIdx(i => (i - 1 + KIOSK_PHOTOS.length) % KIOSK_PHOTOS.length), []);
  const next = useCallback(() => setIdx(i => (i + 1) % KIOSK_PHOTOS.length), []);

  // Fechar com Esc
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose, prev, next]);

  if (!open) return null;

  const photo = KIOSK_PHOTOS[idx];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.88)' }}
      onClick={onClose}
    >
      {/* Modal container */}
      <div
        className="relative w-full max-w-2xl mx-auto flex flex-col items-center"
        onClick={e => e.stopPropagation()}
      >
        {/* Fechar */}
        <button
          onClick={onClose}
          className="absolute -top-10 right-0 text-white/70 hover:text-white transition-colors flex items-center gap-1.5 text-sm font-bold"
        >
          <X className="h-5 w-5" /> Fechar
        </button>

        {/* Imagem INTEIRA sem corte */}
        <div className="w-full bg-black rounded-2xl overflow-hidden shadow-2xl border border-white/10">
          <img
            key={photo.src}
            src={photo.src}
            alt={photo.caption}
            className="w-full h-auto block"
            style={{ maxHeight: '75vh', objectFit: 'contain', background: '#000' }}
            loading="eager"
            fetchPriority="high"
            decoding="sync"
          />
        </div>

        {/* Caption */}
        <div className="mt-4 text-center px-4">
          <div className="flex items-center justify-center gap-1.5 mb-1">
            <Camera className="h-3 w-3 text-white/50" />
            <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">Foto Real</span>
          </div>
          <p className="text-white font-black text-base">{photo.caption}</p>
          <p className="text-white/60 text-xs font-medium mt-0.5">{photo.sub}</p>
        </div>

        {/* Navegação */}
        <div className="flex items-center gap-6 mt-5">
          <button
            onClick={prev}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-all border border-white/20"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          {/* Dots */}
          <div className="flex gap-2">
            {KIOSK_PHOTOS.map((_, i) => (
              <button
                key={i}
                onClick={() => setIdx(i)}
                className={cn(
                  'rounded-full transition-all',
                  i === idx ? 'w-6 h-2.5 bg-white' : 'w-2.5 h-2.5 bg-white/30 hover:bg-white/60'
                )}
              />
            ))}
          </div>

          <button
            onClick={next}
            className="w-10 h-10 rounded-full bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-all border border-white/20"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Contador */}
        <p className="mt-3 text-white/40 text-xs font-bold">
          {idx + 1} / {KIOSK_PHOTOS.length}
        </p>
      </div>
    </div>
  );
}

/** Botão compacto para abrir o popup */
export function KioskPhotoButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
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
