import React, { useEffect, useRef, useState } from 'react';
import html2canvas from 'html2canvas';
import {
  Download,
  Printer,
  Camera,
  RefreshCw,
  Move,
  ZoomIn,
  ZoomOut,
  Check,
  X,
  RotateCcw,
  UserCheck,
  Lock,
  Crown,
  Users,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { ClubMember } from '@/lib/club-types';

interface ClubMemberCardViewProps {
  member: ClubMember;
  showBackSide?: boolean;
  sideBySidePrintMode?: boolean;
  onUpdatePhoto?: (memberId: string, photoDataUrl: string) => void;
  compact?: boolean;
  locked?: boolean;
  lockReason?: string;
  dependentIndex?: number;
}

export const formatTwoFirstNames = (fullName?: string | null): string => {
  const parts = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length <= 2) return parts.join(' ').toUpperCase();
  return `${parts[0]} ${parts[1]}`.toUpperCase();
};

export const getVerificationUrl = (cardNumberOrToken: string) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://balneariolessa.com.br';
  return `${origin}/verificar/${encodeURIComponent(cardNumberOrToken)}`;
};

export const getQrCodeImageUrl = (data: string, size = 220) => {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&margin=2&data=${encodeURIComponent(data)}`;
};

export const ClubMemberCardView: React.FC<ClubMemberCardViewProps> = ({
  member,
  showBackSide = true,
  sideBySidePrintMode = false,
  onUpdatePhoto,
  compact = false,
  locked = false,
  lockReason,
  dependentIndex,
}) => {
  const cardPairRef = useRef<HTMLDivElement>(null);
  const frontOnlyRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [viewMode, setViewMode] = useState<'BOTH' | 'FRONT' | 'BACK'>(
    sideBySidePrintMode ? 'BOTH' : showBackSide ? 'BOTH' : 'FRONT'
  );

  const isHolder = member.role === 'TITULAR';
  const isCardActive = !locked && member.status === 'ACTIVE';

  // ============================================================================
  // EDITOR DE ENQUADRAMENTO E REPOSICIONAMENTO DE FOTO 3x4 (FOCO PERFIL / ROSTO)
  // ============================================================================
  const [rawPhotoSource, setRawPhotoSource] = useState<string | null>(null);
  const [editingPhotoUrl, setEditingPhotoUrl] = useState<string | null>(null);
  const [photoZoom, setPhotoZoom] = useState<number>(1.35);
  const [photoOffsetX, setPhotoOffsetX] = useState<number>(0);
  const [photoOffsetY, setPhotoOffsetY] = useState<number>(18); // Foco padrão na parte superior (rosto/busto)
  const [isDraggingPhoto, setIsDraggingPhoto] = useState<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number; startX: number; startY: number }>({
    x: 0,
    y: 0,
    startX: 0,
    startY: 0,
  });
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const loadedImageRef = useRef<HTMLImageElement | null>(null);

  const qrUrl = getQrCodeImageUrl(getVerificationUrl(member.cardNumber), 240);

  // Abre o editor quando o usuário seleciona uma nova foto
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (locked) return;
    const file = e.target.files?.[0];
    if (!file || !onUpdatePhoto) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setRawPhotoSource(reader.result);
        setEditingPhotoUrl(reader.result);
        // Padrão inteligente: leve zoom e foco no rosto (parte superior da foto)
        setPhotoZoom(1.4);
        setPhotoOffsetX(0);
        setPhotoOffsetY(22);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Abre o editor para reposicionar a foto já existente
  const handleOpenRepositionEditor = () => {
    if (locked) return;
    const src = rawPhotoSource || member.photoUrl;
    if (!src) {
      fileInputRef.current?.click();
      return;
    }
    setEditingPhotoUrl(src);
    if (!rawPhotoSource) {
      setPhotoZoom(1.2);
      setPhotoOffsetX(0);
      setPhotoOffsetY(0);
    }
  };

  // Desenha a prévia 3x4 em tempo real no canvas do editor
  const drawCroppedPortraitToCanvas = (
    canvas: HTMLCanvasElement,
    img: HTMLImageElement,
    zoom: number,
    offXPercent: number,
    offYPercent: number
  ) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const targetW = canvas.width;
    const targetH = canvas.height;

    ctx.clearRect(0, 0, targetW, targetH);
    ctx.fillStyle = '#005c14';
    ctx.fillRect(0, 0, targetW, targetH);

    // Escala base "object-cover" para preencher 100% da moldura 3x4
    const baseScale = Math.max(targetW / img.width, targetH / img.height);
    const finalScale = baseScale * zoom;

    const drawW = img.width * finalScale;
    const drawH = img.height * finalScale;

    // Deslocamento em pixels a partir do centro
    const maxPanX = Math.max(80, (drawW - targetW) / 2 + targetW * 0.25);
    const maxPanY = Math.max(100, (drawH - targetH) / 2 + targetH * 0.25);

    const centerX = (targetW - drawW) / 2 + (offXPercent / 100) * maxPanX;
    const centerY = (targetH - drawH) / 2 + (offYPercent / 100) * maxPanY;

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, centerX, centerY, drawW, drawH);
  };

  useEffect(() => {
    if (!editingPhotoUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      loadedImageRef.current = img;
      if (previewCanvasRef.current) {
        drawCroppedPortraitToCanvas(
          previewCanvasRef.current,
          img,
          photoZoom,
          photoOffsetX,
          photoOffsetY
        );
      }
    };
    img.src = editingPhotoUrl;
  }, [editingPhotoUrl]);

  useEffect(() => {
    if (!editingPhotoUrl || !loadedImageRef.current || !previewCanvasRef.current) return;
    drawCroppedPortraitToCanvas(
      previewCanvasRef.current,
      loadedImageRef.current,
      photoZoom,
      photoOffsetX,
      photoOffsetY
    );
  }, [photoZoom, photoOffsetX, photoOffsetY, editingPhotoUrl]);

  const handlePointerDownPhoto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDraggingPhoto(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      startX: photoOffsetX,
      startY: photoOffsetY,
    };
  };

  const handlePointerMovePhoto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingPhoto) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    const nextX = Math.max(-100, Math.min(100, dragStartRef.current.startX + dx * 0.65));
    const nextY = Math.max(-100, Math.min(100, dragStartRef.current.startY + dy * 0.65));
    setPhotoOffsetX(Math.round(nextX));
    setPhotoOffsetY(Math.round(nextY));
  };

  const handlePointerUpPhoto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDraggingPhoto) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      setIsDraggingPhoto(false);
    }
  };

  const handleSaveCroppedPhoto = () => {
    if (!previewCanvasRef.current || !onUpdatePhoto) return;
    const finalDataUrl = previewCanvasRef.current.toDataURL('image/jpeg', 0.92);
    onUpdatePhoto(member.id, finalDataUrl);
    setEditingPhotoUrl(null);
  };

  const handleDownloadImage = async (onlyFront = false) => {
    if (locked) return;
    const target = onlyFront ? frontOnlyRef.current : cardPairRef.current;
    if (!target) return;
    setIsExporting(true);
    try {
      const canvas = await html2canvas(target, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        scrollX: 0,
        scrollY: 0,
      });
      const link = document.createElement('a');
      link.download = `Carteirinha_${member.fullName.replace(/\s+/g, '_')}_${member.cardNumber}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Erro ao baixar carteirinha:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const cleanPlanName = (member.modalityName || member.planCycleLabel || 'Lessa Club')
    .replace(/\s*\(.*?\)/g, '')
    .trim();

  const cardDisplayName = formatTwoFirstNames(member.fullName);

  const planFontSize =
    cleanPlanName.length > 26
      ? 'clamp(7px, 1.0vw, 10.5px)'
      : cleanPlanName.length > 20
      ? 'clamp(8px, 1.15vw, 12px)'
      : cleanPlanName.length > 15
      ? 'clamp(8.8px, 1.3vw, 13.5px)'
      : 'clamp(10px, 1.55vw, 15.5px)';

  return (
    <div className="space-y-3">
      {/* CABEÇALHO DE IDENTIFICAÇÃO CLARA: TITULAR vs DEPENDENTE + STATUS ATIVO / INATIVO */}
      {!sideBySidePrintMode && !compact && (
        <div
          className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 rounded-2xl border ${
            isHolder
              ? 'bg-emerald-950 text-white border-emerald-800'
              : 'bg-slate-900 text-white border-slate-700'
          }`}
        >
          <div className="flex flex-wrap items-center gap-2.5">
            <Badge
              className={
                isHolder
                  ? 'bg-amber-400 text-emerald-950 font-black text-[11px] px-2.5 py-0.5'
                  : 'bg-sky-400 text-slate-950 font-black text-[11px] px-2.5 py-0.5'
              }
            >
              {isHolder ? (
                <span className="flex items-center gap-1">
                  <Crown className="w-3.5 h-3.5" /> CARTEIRINHA DO TITULAR PRINCIPAL
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> CARTEIRINHA DE DEPENDENTE
                  {dependentIndex ? ` #${dependentIndex}` : ''}
                </span>
              )}
            </Badge>
            <span className="font-black text-sm sm:text-base tracking-tight">
              {member.fullName}
            </span>
            <span className="text-xs text-slate-300">
              • {cleanPlanName} • Nº Cartão: <strong>{member.cardNumber}</strong>
            </span>
          </div>

          <Badge
            className={
              isCardActive
                ? 'bg-emerald-500 text-slate-950 font-black text-[11px]'
                : 'bg-rose-600 text-white font-black text-[11px]'
            }
          >
            {isCardActive
              ? '● PLANO ATIVO (LIBERADO)'
              : lockReason
              ? `● PLANO INATIVO (${lockReason.toUpperCase()})`
              : '● PLANO INATIVO (AGUARDANDO PAGAMENTO / COMPROVAÇÃO)'}
          </Badge>
        </div>
      )}

      {!sideBySidePrintMode && !compact && (
        <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-950/5 p-2.5 rounded-xl border border-emerald-900/10">
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              variant={viewMode === 'BOTH' ? 'default' : 'outline'}
              onClick={() => setViewMode('BOTH')}
              className="h-8 text-xs font-bold"
            >
              Frente + Verso
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === 'FRONT' ? 'default' : 'outline'}
              onClick={() => setViewMode('FRONT')}
              className="h-8 text-xs font-bold"
            >
              Só Frente
            </Button>
            <Button
              type="button"
              size="sm"
              variant={viewMode === 'BACK' ? 'default' : 'outline'}
              onClick={() => setViewMode('BACK')}
              className="h-8 text-xs font-bold"
            >
              Só Verso
            </Button>
          </div>

          {locked ? (
            <div className="flex items-center gap-2 bg-rose-50 border border-rose-200 text-rose-800 px-3 py-1.5 rounded-lg text-xs font-bold">
              <Lock className="w-3.5 h-3.5 text-rose-600 shrink-0" />
              <span>
                {lockReason
                  ? `Edição de foto e download bloqueados: ${lockReason}`
                  : 'Edição de foto e download bloqueados até a confirmação do pagamento ou envio da comprovação (Plano Inativo)'}
              </span>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              {onUpdatePhoto && (
                <>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoSelect}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 text-xs font-bold border-emerald-600 bg-white text-emerald-800 hover:bg-emerald-50 hover:text-emerald-950"
                  >
                    <Camera className="w-3.5 h-3.5 mr-1.5" />
                    {member.photoUrl ? 'Trocar Foto' : 'Enviar Foto'}
                  </Button>
                  {member.photoUrl && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleOpenRepositionEditor}
                      className="h-8 text-xs font-bold border-amber-500 bg-amber-50 text-amber-950 hover:bg-amber-100"
                    >
                      <Move className="w-3.5 h-3.5 mr-1.5" />
                      Reposicionar / Enquadrar Perfil
                    </Button>
                  )}
                </>
              )}
              <Button
                type="button"
                size="sm"
                onClick={() => handleDownloadImage(viewMode === 'FRONT')}
                disabled={isExporting}
                className="h-8 text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white"
              >
                {isExporting ? (
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                )}
                Baixar PNG Alta Resolução
              </Button>
            </div>
          )}
        </div>
      )}

      {/* PAINEL INTERATIVO DE REPOSICIONAMENTO E ENQUADRAMENTO DE FOTO DE PERFIL 3x4 */}
      {editingPhotoUrl && (
        <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 border-2 border-amber-400 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
            <div>
              <h4 className="font-black text-sm sm:text-base text-amber-300 flex items-center gap-2">
                <UserCheck className="w-4 h-4" />
                Ajustar e Reposicionar Foto de Perfil (3x4) — {member.fullName}
              </h4>
              <p className="text-xs text-slate-300">
                Arraste a imagem com o mouse/dedo ou use os controles ao lado para centralizar o rosto no padrão de foto de perfil.
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setEditingPhotoUrl(null)}
              className="text-slate-300 hover:bg-slate-800 hover:text-white h-8"
            >
              <X className="w-4 h-4 mr-1" /> Cancelar
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
            {/* Moldura Interativa 3x4 */}
            <div className="md:col-span-5 flex flex-col items-center">
              <div className="relative rounded-xl overflow-hidden border-4 border-[#f7e600] shadow-lg bg-[#005c14]">
                <canvas
                  ref={previewCanvasRef}
                  width={394}
                  height={565}
                  onPointerDown={handlePointerDownPhoto}
                  onPointerMove={handlePointerMovePhoto}
                  onPointerUp={handlePointerUpPhoto}
                  onPointerCancel={handlePointerUpPhoto}
                  className="w-[180px] h-[258px] cursor-move touch-none block"
                />
                {/* Guia visual de enquadramento do rosto */}
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-start pt-5">
                  <div className="w-24 h-28 rounded-full border-2 border-dashed border-white/45" />
                  <span className="mt-2 text-[9px] font-bold uppercase tracking-wider bg-black/50 text-white px-2 py-0.5 rounded-full">
                    Arraste p/ Enquadrar
                  </span>
                </div>
              </div>
            </div>

            {/* Controles de Zoom e Posição */}
            <div className="md:col-span-7 space-y-3.5 bg-slate-800/80 p-4 rounded-xl border border-slate-700">
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    setPhotoZoom(1.55);
                    setPhotoOffsetX(0);
                    setPhotoOffsetY(32);
                  }}
                  className="h-8 text-xs font-bold bg-amber-400 hover:bg-amber-300 text-slate-950"
                >
                  <UserCheck className="w-3.5 h-3.5 mr-1.5" />
                  Focar Rosto / Perfil (Padrão)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setPhotoZoom(1);
                    setPhotoOffsetX(0);
                    setPhotoOffsetY(0);
                  }}
                  className="h-8 text-xs font-bold border-slate-600 bg-slate-900 text-slate-200 hover:bg-slate-700 hover:text-white"
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
                  Centralizar (1x)
                </Button>
              </div>

              {/* Controle de Zoom */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                  <span className="flex items-center gap-1.5">
                    <ZoomIn className="w-3.5 h-3.5 text-amber-400" /> Zoom (Aproximar Rosto)
                  </span>
                  <span className="text-amber-300">{Math.round(photoZoom * 100)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <ZoomOut className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="range"
                    min="1"
                    max="3.5"
                    step="0.05"
                    value={photoZoom}
                    onChange={(e) => setPhotoZoom(parseFloat(e.target.value))}
                    className="w-full accent-amber-400 cursor-pointer"
                  />
                  <ZoomIn className="w-4 h-4 text-slate-400 shrink-0" />
                </div>
              </div>

              {/* Controle Vertical (Subir/Descer Foto) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                  <span>Posição Vertical (Altura do Rosto)</span>
                  <span className="text-slate-400">{photoOffsetY}</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={photoOffsetY}
                  onChange={(e) => setPhotoOffsetY(parseInt(e.target.value, 10))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>

              {/* Controle Horizontal (Esquerda/Direita) */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold text-slate-200">
                  <span>Posição Horizontal (Esquerda / Direita)</span>
                  <span className="text-slate-400">{photoOffsetX}</span>
                </div>
                <input
                  type="range"
                  min="-100"
                  max="100"
                  step="1"
                  value={photoOffsetX}
                  onChange={(e) => setPhotoOffsetX(parseInt(e.target.value, 10))}
                  className="w-full accent-amber-400 cursor-pointer"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={handleSaveCroppedPhoto}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-black px-5 h-9"
                >
                  <Check className="w-4 h-4 mr-1.5" />
                  Aplicar Foto de Perfil na Carteirinha
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CONTAINER DE RENDERIZAÇÃO FIEL AO LAYOUT OFICIAL LABCARD */}
      <div
        ref={cardPairRef}
        className={
          sideBySidePrintMode
            ? 'grid grid-cols-2 gap-0 w-full bg-white'
            : viewMode === 'BOTH'
            ? 'grid grid-cols-1 xl:grid-cols-2 gap-3 w-full'
            : 'w-full max-w-xl mx-auto'
        }
      >
        {/* FRENTE DA CARTEIRINHA */}
        {(viewMode === 'BOTH' || viewMode === 'FRONT' || sideBySidePrintMode) && (
          <div
            ref={frontOnlyRef}
            className="relative w-full overflow-hidden select-none shadow-md"
            style={{
              aspectRatio: '3240 / 2045',
              backgroundColor: '#006818',
              borderRadius: sideBySidePrintMode ? '0px' : '14px',
            }}
          >
            {/* Imagem de Fundo Oficial do Plano */}
            <img
              src={member.frontCardUrl}
              alt={member.modalityName}
              crossOrigin="anonymous"
              className="absolute inset-0 w-full h-full object-fill pointer-events-none"
            />

            {/* Moldura da Foto 3x4 do Associado */}
            <div
              onClick={() =>
                onUpdatePhoto &&
                (member.photoUrl ? handleOpenRepositionEditor() : fileInputRef.current?.click())
              }
              title={
                onUpdatePhoto
                  ? 'Clique para enviar ou reposicionar a foto de perfil do sócio'
                  : member.fullName
              }
              style={{
                position: 'absolute',
                left: '2.9%',
                top: '5.5%',
                width: '24.6%',
                height: '56.5%',
                borderRadius: '12px',
                border: '3px solid #f7e600',
                backgroundColor: '#005c14',
                overflow: 'hidden',
                zIndex: 10,
              }}
              className={onUpdatePhoto ? 'cursor-pointer group' : ''}
            >
              {member.photoUrl ? (
                <img
                  src={member.photoUrl}
                  alt={member.fullName}
                  crossOrigin="anonymous"
                  className="w-full h-full object-cover object-top"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-center p-2 bg-gradient-to-b from-emerald-800 to-emerald-950 text-emerald-100">
                  <Camera className="w-7 h-7 mb-1 opacity-75" />
                  <span className="text-[9px] font-black uppercase tracking-wider leading-tight">
                    {onUpdatePhoto ? 'Clique p/ Foto' : 'Sem Foto'}
                  </span>
                </div>
              )}
            </div>

            {/* QR Code Dinâmico de Verificação Cadastral */}
            <div
              style={{
                position: 'absolute',
                right: '3.0%',
                top: '3.4%',
                width: '15.8%',
                aspectRatio: '1 / 1',
                backgroundColor: '#ffffff',
                padding: '0.8%',
                borderRadius: '6px',
                zIndex: 10,
                boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
              }}
            >
              <img
                src={qrUrl}
                alt={`QR Code ${member.cardNumber}`}
                crossOrigin="anonymous"
                className="w-full h-full object-contain"
              />
            </div>

            {/* CAMPOS DINÂMICOS INFERIORES ORGANIZADOS EM GRADE 2x3 SEM SOBREPOSIÇÃO À FRASE */}
            {/* LINHA 1: NOME DO ASSOCIADO (2 PRIMEIROS NOMES, ESQUERDA) */}
            <div
              style={{
                position: 'absolute',
                left: '4.8%',
                top: '72.2%',
                width: '51%',
                zIndex: 10,
              }}
            >
              <div
                style={{
                  fontSize: 'clamp(6.5px, 1.0vw, 9.5px)',
                  color: 'rgba(255,255,255,0.85)',
                  fontWeight: 700,
                  lineHeight: 1.05,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  marginBottom: '1px',
                }}
              >
                NOME
              </div>
              <div
                style={{
                  fontSize: 'clamp(10.5px, 1.9vw, 17px)',
                  color: '#ffffff',
                  fontWeight: 900,
                  lineHeight: 1.15,
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                }}
                title={member.fullName}
              >
                {cardDisplayName}
              </div>
            </div>

            {/* LINHA 1: CPF (DIREITA) */}
            <div
              style={{
                position: 'absolute',
                left: '57.5%',
                top: '72.2%',
                width: '39.5%',
                zIndex: 10,
              }}
            >
              <div
                style={{
                  fontSize: 'clamp(6.5px, 1.0vw, 9.5px)',
                  color: 'rgba(255,255,255,0.85)',
                  fontWeight: 700,
                  lineHeight: 1.05,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  marginBottom: '1px',
                }}
              >
                CPF
              </div>
              <div
                style={{
                  fontSize: 'clamp(10.5px, 1.8vw, 16.5px)',
                  color: '#ffffff',
                  fontWeight: 900,
                  lineHeight: 1.15,
                  letterSpacing: '0.03em',
                  whiteSpace: 'nowrap',
                  textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                }}
              >
                {member.cpf || 'ISENTO / DEP.'}
              </div>
            </div>

            {/* LINHA 2: Nº CARTÃO (ESQUERDA) */}
            <div
              style={{
                position: 'absolute',
                left: '4.8%',
                top: '85.2%',
                width: '24%',
                zIndex: 10,
              }}
            >
              <div
                style={{
                  fontSize: 'clamp(6px, 0.95vw, 9px)',
                  color: 'rgba(255,255,255,0.85)',
                  fontWeight: 700,
                  lineHeight: 1.05,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  marginBottom: '1px',
                }}
              >
                Nº CARTÃO
              </div>
              <div
                style={{
                  fontSize: 'clamp(10px, 1.6vw, 15.5px)',
                  color: '#ffffff',
                  fontWeight: 900,
                  lineHeight: 1.15,
                  letterSpacing: '0.03em',
                  whiteSpace: 'nowrap',
                  textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                }}
              >
                {member.cardNumber}
              </div>
            </div>

            {/* LINHA 2: VALIDADE (MEIO) */}
            <div
              style={{
                position: 'absolute',
                left: '31%',
                top: '85.2%',
                width: '24%',
                zIndex: 10,
              }}
            >
              <div
                style={{
                  fontSize: 'clamp(6px, 0.95vw, 9px)',
                  color: 'rgba(255,255,255,0.85)',
                  fontWeight: 700,
                  lineHeight: 1.05,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  marginBottom: '1px',
                }}
              >
                VALIDADE
              </div>
              <div
                style={{
                  fontSize: 'clamp(10px, 1.6vw, 15.5px)',
                  color: '#ffffff',
                  fontWeight: 900,
                  lineHeight: 1.15,
                  letterSpacing: '0.03em',
                  whiteSpace: 'nowrap',
                  textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                }}
              >
                {member.validityLabel}
              </div>
            </div>

            {/* LINHA 2: PLANO (DIREITA COM DESTAQUE EM AMARELO - SEM CORTES) */}
            <div
              style={{
                position: 'absolute',
                left: '57.5%',
                top: '85.2%',
                width: '40%',
                zIndex: 10,
              }}
            >
              <div
                style={{
                  fontSize: 'clamp(6px, 0.95vw, 9px)',
                  color: '#fde047',
                  fontWeight: 800,
                  lineHeight: 1.05,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  marginBottom: '1px',
                }}
              >
                PLANO
              </div>
              <div
                style={{
                  fontSize: planFontSize,
                  color: '#facc15',
                  fontWeight: 900,
                  lineHeight: 1.15,
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  textShadow: '0 2px 4px rgba(0,0,0,0.6)',
                }}
                title={cleanPlanName}
              >
                {cleanPlanName}
              </div>
            </div>
          </div>
        )}

        {/* VERSO DA CARTEIRINHA */}
        {(viewMode === 'BOTH' || viewMode === 'BACK' || sideBySidePrintMode) && (
          <div
            className="relative w-full overflow-hidden select-none shadow-md"
            style={{
              aspectRatio: '3240 / 2045',
              backgroundColor: '#006818',
              borderRadius: sideBySidePrintMode ? '0px' : '14px',
            }}
          >
            <img
              src={member.backCardUrl}
              alt={`Verso ${member.modalityName}`}
              crossOrigin="anonymous"
              className="absolute inset-0 w-full h-full object-fill pointer-events-none"
            />
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// FOLHA DE IMPRESSÃO MULTI-CARTÃO (4 CARTEIRINHAS FRENTE E VERSO POR PÁGINA)
// Idêntica ao arquivo "IMPRIMIR GERAIS (1).png" da Labcard
// ============================================================================
interface MultiCardPrintSheetProps {
  members: ClubMember[];
}

export const MultiCardPrintSheet: React.FC<MultiCardPrintSheetProps> = ({ members }) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const handleDownloadSheet = async () => {
    if (!sheetRef.current) return;
    setExporting(true);
    try {
      const canvas = await html2canvas(sheetRef.current, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
      });
      const link = document.createElement('a');
      link.download = `IMPRIMIR_CARTEIRINHAS_LESSA_${new Date().toISOString().slice(0, 10)}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error('Erro ao exportar folha de impressão:', e);
    } finally {
      setExporting(false);
    }
  };

  const handlePrintWindow = () => {
    window.print();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-emerald-950 text-white p-4 rounded-2xl shadow-lg print:hidden">
        <div>
          <h4 className="font-black text-sm uppercase tracking-wider text-amber-400">
            Folha de Impressão Multi-Cartão (Padrão Gráfica / PVC)
          </h4>
          <p className="text-xs text-emerald-100/80">
            {members.length} carteirinha(s) montada(s) com Frente + Verso lado a lado, QR Code ativo e foto.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={handlePrintWindow}
            className="bg-white/10 border-white/20 text-white hover:bg-white/20 font-bold text-xs"
          >
            <Printer className="w-4 h-4 mr-1.5" />
            Imprimir Folha (A4)
          </Button>
          <Button
            type="button"
            onClick={handleDownloadSheet}
            disabled={exporting}
            className="bg-amber-400 hover:bg-amber-300 text-emerald-950 font-black text-xs"
          >
            <Download className="w-4 h-4 mr-1.5" />
            {exporting ? 'Gerando Folha HD...' : 'Baixar Folha Completa (PNG)'}
          </Button>
        </div>
      </div>

      <div
        ref={sheetRef}
        className="bg-white p-4 sm:p-6 space-y-5 max-w-[1100px] mx-auto border border-slate-200 shadow-xl print:shadow-none print:border-none print:p-0"
      >
        {members.map((member) => (
          <div key={member.id} className="w-full">
            <ClubMemberCardView member={member} sideBySidePrintMode />
          </div>
        ))}
      </div>
    </div>
  );
};
