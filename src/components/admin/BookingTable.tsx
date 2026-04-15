import React, { useState } from "react";

import { createPortal } from "react-dom";
import { format, parseISO, isToday, isBefore, startOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ChevronDown,
  CheckCircle,
  XCircle,
  Clock,
  QrCode,
  UserCheck,
  Trash2,
  Plus,
  Pencil,
  Check,
  X,
  Users,
  Calendar,
  Upload,
  FileCheck,
  Loader2,
  CalendarClock,
  StickyNote,
  CalendarRange,
  Search,
  Filter,
  MapPin,
  Phone,
  CreditCard,
  ChevronRight,
  Calendar as CalendarIcon,
  RotateCcw,
  Wallet,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar as CalendarUI } from "@/components/ui/calendar";
import { formatCurrency } from "@/lib/booking-types";
import { BookingDetail } from "./BookingDetail";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Booking {
  id: string;
  name: string;
  phone: string | null;
  confirmation_code: string | null;
  visit_date: string;
  adults: number;
  children: any;
  kiosks?: any;
  quads?: any;
  additionals?: any;
  has_donation?: boolean | null;
  is_associado?: boolean | null;
  total_amount: number;
  status: string;
  notes: string | null;
  checked_in_at: string | null;
  created_at: string;
  is_order?: boolean;
  receipt_url?: string | null;
  customer_phone?: string | null;
  customer_cpf?: string | null;
  order_items?: any[];
  last_voucher_sent_at?: string | null;
}

interface BookingTableProps {
  bookings: Booking[];
  onStatusChange: (
    bookingId: string,
    status: string,
    isOrder?: boolean,
  ) => void;
  onAddNote: (bookingId: string, notes: string, isOrder?: boolean) => void;
  onReschedule: (bookingId: string, newDate: string, isOrder?: boolean) => void;
  onDelete: (bookingId: string, isOrder?: boolean) => void;
  onRemoveItem: (orderId: string, itemId: string, productId: string) => void;
  updatingId: string | null;
  onFileUpload?: (file: File, id: string, isOrder: boolean) => Promise<void>;
  isUploading?: boolean;
  onRemoveReceipt?: (bookingId: string) => void;
  onRefresh?: () => void;
  onGeneratePayment?: (id: string, isOrder: boolean) => void;
  onSyncPayment?: (orderId: string) => void;
  onConvertToCredit?: (booking: any) => void;
  onUpdateCustomer?: (bookingId: string, data: { name?: string, phone?: string, cpf?: string }, isOrder?: boolean) => Promise<boolean>;
  isAllowedDay?: (date: Date) => boolean;
  kioskReservations?: any[];
  quadReservations?: any[];
  totalQuads?: number;
}

const STATUS_CONFIG: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "outline" | "destructive";
    icon: React.ElementType;
    color: string;
    bgColor: string;
    borderColor: string;
  }
> = {
  pending: {
    label: "PENDENTE",
    variant: "outline",
    icon: Clock,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
  waiting_local: {
    label: "WHATSAPP",
    variant: "outline",
    icon: Clock,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  paid: {
    label: "PAGO OK",
    variant: "secondary",
    icon: CheckCircle,
    color: "text-emerald-700",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
  },
  "checked-in": {
    label: "CHECK-IN ✓",
    variant: "default",
    icon: UserCheck,
    color: "text-white",
    bgColor: "bg-emerald-600",
    borderColor: "border-emerald-700",
  },
  cancelled: {
    label: "CANCELADA",
    variant: "destructive",
    icon: XCircle,
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
  },
  awaiting_payment: {
    label: "AGUARDANDO PGTO",
    variant: "outline",
    icon: Clock,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
};

const getStatusConfig = (booking: any) => {
  const baseConfig = STATUS_CONFIG[booking.status] || STATUS_CONFIG.pending;

  if (booking.status === "paid" || booking.status === "confirmed") {
    const payment = booking.payments?.[0];
    if (payment) {
      if (payment.metodo === "PIX")
        return { ...baseConfig, label: "PAGO VIA PIX" };
      if (
        payment.metodo === "CREDIT_CARD" ||
        payment.metodo === "DEBIT_CARD" ||
        payment.metodo === "cartao"
      )
        return { ...baseConfig, label: "PAGO VIA CARTÃO" };
    }
  }
  return baseConfig;
};

export function BookingTable({
  bookings,
  onStatusChange,
  onAddNote,
  onReschedule,
  onDelete,
  onRemoveItem,
  updatingId,
  onFileUpload,
  isUploading,
  onRemoveReceipt,
  onRefresh,
  onGeneratePayment,
  onSyncPayment,
  onConvertToCredit,
  onUpdateCustomer,
  isAllowedDay,
  kioskReservations = [],
  quadReservations = [],
  totalQuads = 3,
}: BookingTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [rescheduleId, setRescheduleId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [customerEditData, setCustomerEditData] = useState({ name: '', phone: '', cpf: '' });

  if (bookings.length === 0) {
    return (
      <div className="text-center py-20 bg-emerald-50/30 rounded-3xl border-2 border-dashed border-emerald-100/50 text-emerald-950/70 font-black animate-in fade-in zoom-in-95 duration-500 uppercase tracking-widest text-[10px]">
        Nenhuma reserva encontrada.
      </div>
    );
  }

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === bookings.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(bookings.map((b) => b.id)));
  };

  const handleBulkAction = async (action: "confirm" | "cancel" | "delete") => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (
      action === "delete" &&
      !confirm(
        `Atenção: Você irá apagar permanentemente ${ids.length} reservas. Continuar?`,
      )
    )
      return;

    for (const id of ids) {
      const b = bookings.find((x) => x.id === id);
      if (!b) continue;
      if (action === "confirm") onStatusChange(b.id, "paid", b.is_order);
      else if (action === "cancel")
        onStatusChange(b.id, "cancelled", b.is_order);
      else if (action === "delete") {
        onDelete(b.id, b.is_order);
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    setSelectedIds(new Set());
  };

  return (
    <div className="space-y-6 relative pb-20">
      {selectedIds.size > 0 &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-[100] bg-emerald-950 text-white px-8 py-4 rounded-[2rem] shadow-2xl border border-white/10 flex items-center gap-8 animate-in slide-in-from-bottom-12 duration-500 backdrop-blur-2xl">
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase tracking-widest text-emerald-700 mb-0.5">
                Selecionados
              </span>
              <span className="text-xl font-black tabular-nums">
                {selectedIds.size}
              </span>
            </div>
            <div className="h-10 w-px bg-white/10" />
            <div className="flex gap-2">
              <Button
                onClick={() => handleBulkAction("confirm")}
                className="bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-bold text-[10px] h-10 px-6 rounded-xl uppercase tracking-wider"
              >
                Confirmar
              </Button>
              <Button
                onClick={() => handleBulkAction("cancel")}
                className="bg-amber-500 hover:bg-amber-400 text-white font-bold text-[10px] h-10 px-6 rounded-xl uppercase tracking-wider"
              >
                Cancelar
              </Button>
              <Button
                onClick={() => handleBulkAction("delete")}
                variant="ghost"
                className="text-red-400 hover:text-red-100 font-bold text-[10px] h-10 px-4 rounded-xl uppercase"
              >
                Excluir
              </Button>
            </div>
            <div className="h-10 w-px bg-white/10" />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedIds(new Set())}
              className="text-white/40 font-bold uppercase text-[9px] px-4 h-10 rounded-xl"
            >
              Limpar
            </Button>
          </div>,
          document.body,
        )}

      <div className="bg-transparent">
        {/* MOBILE CARDS VIEW */}
        <div className="md:hidden space-y-4 p-4 bg-slate-50/30">
          {bookings.map((booking) => {
            const config = getStatusConfig(booking);
            const StatusIcon = config.icon;
            const expanded = expandedId === booking.id;
            const bookingDate = parseISO(
              booking.visit_date || new Date().toISOString(),
            );
            const childrenCount = Array.isArray(booking.children)
              ? booking.children.length
              : typeof booking.children === "number"
                ? booking.children
                : 0;
            const totalPeople = (booking.adults || 0) + childrenCount;

            return (
              <div
                key={booking.id}
                className={cn(
                  "p-4 space-y-4 mb-4 rounded-2xl border-2 border-emerald-100 shadow-sm",
                  expanded ? "bg-emerald-50/30" : "bg-white",
                )}
              >
                <div
                  className="flex items-center justify-between"
                  onClick={() => setExpandedId(expanded ? null : booking.id)}
                >
                  <div className="flex flex-col">
                    <div className="flex items-center gap-1.5 mb-1">
                      <Calendar className="w-3 h-3 text-emerald-700 bg-emerald-100/50 px-2 py-0.5 rounded-md" />
                      <span className="text-[10px] font-black text-emerald-950 uppercase">
                        {format(bookingDate, "dd/MM/yyyy", { locale: ptBR })}
                      </span>
                    </div>
                    {editingCustomerId === booking.id ? (
                      <div className="flex flex-col gap-2 mt-2 w-full" onClick={e => e.stopPropagation()}>
                        <input
                          type="text"
                          value={customerEditData.name}
                          onChange={e => setCustomerEditData(prev => ({ ...prev, name: e.target.value }))}
                          className="w-full text-xs font-black uppercase rounded border border-emerald-200 px-2 py-1"
                          placeholder="Nome"
                        />
                        <div className="flex gap-2 w-full">
                          <input
                            type="text"
                            value={customerEditData.cpf}
                            onChange={e => {
                              let val = e.target.value.replace(/\D/g, '');
                              if (val.length > 11) val = val.slice(0, 11);
                              if (val.length > 9) val = val.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
                              else if (val.length > 6) val = val.replace(/(\d{3})(\d{3})(\d{3})/, "$1.$2.$3");
                              else if (val.length > 3) val = val.replace(/(\d{3})(\d{3})/, "$1.$2");
                              setCustomerEditData(prev => ({ ...prev, cpf: val }));
                            }}
                            className="w-1/2 text-[10px] font-black uppercase rounded border border-slate-200 px-2 py-1"
                            placeholder="CPF"
                          />
                          <input
                            type="text"
                            value={customerEditData.phone}
                            onChange={e => {
                              let val = e.target.value.replace(/\D/g, '');
                              if (val.length > 11) val = val.slice(0, 11);
                              if (val.length > 10) val = val.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
                              else if (val.length > 6) val = val.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
                              else if (val.length > 2) val = val.replace(/(\d{2})(\d{0,5})/, "($1) $2");
                              setCustomerEditData(prev => ({ ...prev, phone: val }));
                            }}
                            className="w-1/2 text-[10px] font-black uppercase rounded border border-blue-200 px-2 py-1"
                            placeholder="WhatsApp"
                          />
                        </div>
                        <div className="flex gap-2">
                           <button onClick={async (e) => {
                               e.stopPropagation();
                               if (onUpdateCustomer) {
                                  const success = await onUpdateCustomer(booking.id, customerEditData, booking.is_order);
                                  if (success) setEditingCustomerId(null);
                               }
                             }} className="flex-1 bg-emerald-500 text-white rounded text-xs font-bold py-1">Salvar</button>
                           <button onClick={(e) => { e.stopPropagation(); setEditingCustomerId(null); }} className="flex-1 bg-slate-200 text-slate-700 rounded text-xs font-bold py-1">Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-black text-emerald-950 uppercase tracking-tight leading-tight">
                            {booking.name ||
                              (booking as any).customer_name ||
                              "CLIENTE GERAL"}
                          </span>
                          {onUpdateCustomer && (
                             <button 
                               onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingCustomerId(booking.id);
                                  setCustomerEditData({ 
                                    name: booking.name || (booking as any).customer_name || '', 
                                    phone: booking.customer_phone || (booking as any).phone || '', 
                                    cpf: booking.customer_cpf || (booking as any).cpf || '' 
                                  });
                               }}
                               className="p-1 hover:bg-emerald-50 text-emerald-600 rounded"
                             >
                               <Pencil className="w-3 h-3" />
                             </button>
                          )}
                        </div>
                        {(booking.customer_cpf || booking.customer_phone) && (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {booking.customer_cpf && (
                              <span className="text-[7px] font-bold px-1 bg-slate-100 rounded text-slate-500 uppercase tracking-tighter shrink-0">
                                {booking.customer_cpf}
                              </span>
                            )}
                            {booking.customer_phone && (
                              <span className="text-[7px] font-bold px-1 bg-blue-50 rounded text-blue-500 uppercase tracking-tighter shrink-0">
                                {booking.customer_phone}
                              </span>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <div
                      className={cn(
                        "flex items-center gap-1 px-2 py-0.5 rounded-md border text-[7px] font-black uppercase",
                        config.bgColor,
                        config.color,
                        config.borderColor,
                      )}
                    >
                      <StatusIcon className="w-2.5 h-2.5" />
                      {config.label}
                    </div>
                    <ChevronDown
                      className={cn(
                        "w-5 h-5 text-emerald-200 transition-transform",
                        expanded && "rotate-180 text-emerald-600",
                      )}
                    />
                  </div>
                </div>

                {!expanded && (
                  <div className="flex items-center justify-between bg-emerald-50/50 p-2 rounded-xl border border-emerald-100/50">
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-emerald-700" />
                      <span className="text-xs font-black text-emerald-950">
                        {totalPeople} Pessoas
                      </span>
                    </div>
                    <span className="text-sm font-black text-emerald-600">
                      {formatCurrency(booking.total_amount)}
                    </span>
                  </div>
                )}

                {expanded && (
                  <div className="pt-2 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="bg-white rounded-2xl p-4 shadow-inner border border-emerald-100/50 space-y-4">
                      <BookingDetail
                        booking={booking}
                        onRemoveReceipt={onRemoveReceipt}
                        onRefresh={onRefresh}
                      />

                      <div className="space-y-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700/60 pl-1">
                          Pagamento / Comprovante
                        </p>
                        {onFileUpload && (
                          <div className="flex flex-col gap-2">
                            <input
                              type="file"
                              id={`m-up-${booking.id}`}
                              className="hidden"
                              onChange={(e) =>
                                e.target.files &&
                                onFileUpload(
                                  e.target.files[0],
                                  booking.id,
                                  !!booking.is_order,
                                )
                              }
                            />
                            {booking.receipt_url ? (
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  className="flex-1 h-10 rounded-xl bg-emerald-50 border-emerald-200 text-emerald-700 font-black text-[9px] uppercase"
                                  onClick={() =>
                                    window.open(booking.receipt_url!)
                                  }
                                >
                                  <FileCheck className="w-3.5 h-3.5 mr-2" /> Ver
                                  Comprovante
                                </Button>
                                <Button
                                  variant="outline"
                                  className="w-10 h-10 rounded-xl bg-red-50 border-red-200 text-red-500 flex items-center justify-center"
                                  onClick={() => onRemoveReceipt?.(booking.id)}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ) : (
                              <label
                                htmlFor={`m-up-${booking.id}`}
                                className="flex items-center justify-center gap-2 w-full h-10 rounded-xl bg-white border-2 border-dashed border-emerald-200 text-emerald-800 font-black text-[9px] uppercase cursor-pointer hover:bg-emerald-50 transition-all"
                              >
                                {isUploading ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Upload className="w-3.5 h-3.5" />
                                )}
                                Anexar Comprovante
                              </label>
                            )}
                          </div>
                        )}
                      </div>
                      <div className="space-y-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-emerald-700/60 pl-1">
                          Ações e Controle
                        </p>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <Button
                            onClick={(e: any) => {
                              e.stopPropagation();
                              const phone = (
                                booking.customer_phone ||
                                (booking as any).phone ||
                                ""
                              ).replace(/\D/g, "");
                              
                              if (!phone) {
                                toast({ title: "Erro", description: "Telefone do cliente não encontrado.", variant: "destructive" });
                                return;
                              }

                              const code = booking.confirmation_code;
                              if (!code) {
                                toast({ title: "Erro", description: "Código do voucher não encontrado.", variant: "destructive" });
                                return;
                              }

                              const items = (booking as any).order_items || [];
                              const itemsList = items
                                .map(
                                  (it: any) =>
                                    `* ${it.quantity}x ${it.product_name || it.product_id} (${formatCurrency(it.unit_price)})`,
                                )
                                .join("\n");
                              
                              const dateStr = format(
                                parseISO(
                                  booking.visit_date ||
                                    new Date().toISOString(),
                                ),
                                "dd/MM/yyyy",
                                { locale: ptBR },
                              );
                              
                              const name = booking.name || (booking as any).customer_name;

                              const message = 
                                `🌿 *BALNEÁRIO FAMÍLIA LESSA*\n\n` +
                                `Esse é seu voucher de confirmação da sua reserva e o resumo do seu pedido para apresentar caso seja solicitado.\n\n` +
                                `📅 *Data:* ${dateStr}\n` +
                                `👤 *Titular:* ${name}\n\n` +
                                `📝 *Resumo do Pedido:*\n${itemsList}\n\n` +
                                `💰 *Total:* ${formatCurrency(booking.total_amount)}\n\n` +
                                `Voucher: https://reservas.balneariolessa.com.br/voucher/${code}\n\n` +
                                `✨ *Aguardamos vocês para o lazer que a sua família merece.*`;
                              
                              const text = encodeURIComponent(message);

                              // Open WhatsApp immediately to avoid popup blocking
                              window.open(
                                "https://wa.me/55" + phone + "?text=" + text,
                                "_blank",
                              );

                              // Update marker in DB asynchronously
                              if (booking.id && !booking.id.startsWith('order-')) {
                                supabase.from('orders')
                                  .update({ last_voucher_sent_at: new Date().toISOString() })
                                  .eq('id', booking.id)
                                  .then(() => {
                                    if (onRefresh) onRefresh();
                                  });
                              }
                            }}
                            className={cn(
                              "relative border-2 font-black uppercase text-[9px] h-12 rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-300",
                              booking.last_voucher_sent_at 
                                ? "bg-emerald-50 border-emerald-600 text-emerald-700 hover:bg-emerald-600 hover:text-white" 
                                : "bg-indigo-50 border-indigo-600 text-indigo-700 hover:bg-indigo-600 hover:text-white"
                            )}
                          >
                            <FileCheck className="w-3.5 h-3.5" />
                            {booking.last_voucher_sent_at ? "REENVIAR" : "Voucher"}
                            {booking.last_voucher_sent_at && (
                              <div className="absolute -top-2 -right-1 bg-emerald-600 text-white text-[6px] px-1.5 py-0.5 rounded-full border border-white shadow-sm">
                                ENVIADO
                              </div>
                            )}
                          </Button>
                          {![
                            "pago",
                            "paid",
                            "checked-in",
                            "cancelled",
                            "cancelado",
                          ].includes(booking.status?.toLowerCase() || "") &&
                            onGeneratePayment && (
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onGeneratePayment(
                                    booking.id,
                                    !!booking.is_order,
                                  );
                                }}
                                className="bg-amber-500 hover:bg-amber-600 border border-amber-600 text-white h-12 rounded-xl text-[9px] font-black uppercase shadow-sm flex flex-col items-center justify-center gap-0.5 transition-all hover:scale-105 active:scale-95"
                              >
                                <QrCode className="w-4 h-4" />
                                PIX
                              </Button>
                            )}
                          {onSyncPayment &&
                            [
                              "pending",
                              "awaiting_payment",
                              "aguardando pgto",
                              "waiting_local",
                              "waiting_confirmation",
                            ].includes(booking.status?.toLowerCase() || "") && (
                              <Button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSyncPayment(booking.id);
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white h-12 rounded-xl text-[9px] font-black uppercase shadow-sm flex flex-col items-center justify-center gap-0.5 transition-all hover:scale-105 active:scale-95"
                              >
                                <RefreshCw className="w-4 h-4" />
                                Sincronizar
                              </Button>
                            )}
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              onStatusChange(
                                booking.id,
                                "paid",
                                booking.is_order,
                              );
                            }}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white h-12 rounded-xl text-[9px] font-black uppercase shadow-sm flex flex-col items-center justify-center"
                          >
                            Efetivar
                          </Button>
                          <Button
                            onClick={(e) => {
                              e.stopPropagation();
                              onStatusChange(
                                booking.id,
                                "checked-in",
                                booking.is_order,
                              );
                            }}
                            className="bg-emerald-700 hover:bg-emerald-800 text-white h-12 rounded-xl text-[9px] font-black uppercase shadow-sm flex flex-col items-center justify-center"
                          >
                            Check-in
                          </Button>
                          {onConvertToCredit && (
                            <Button
                              onClick={(e) => {
                                e.stopPropagation();
                                onConvertToCredit(booking);
                              }}
                              className="bg-purple-600 hover:bg-purple-700 text-white h-12 rounded-xl text-[9px] font-black uppercase shadow-sm flex flex-col items-center justify-center gap-0.5"
                            >
                              <Wallet className="w-3.5 h-3.5" />
                              Reserva em Aberto
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRescheduleId(
                                rescheduleId === booking.id ? null : booking.id,
                              );
                              setRescheduleDate(booking.visit_date || "");
                            }}
                            className={cn(
                              "h-12 rounded-xl text-[9px] font-black uppercase border-2 shadow-sm flex flex-col items-center justify-center",
                              rescheduleId === booking.id
                                ? "bg-blue-600 text-white border-blue-700"
                                : "bg-white border-blue-200 text-blue-700",
                            )}
                          >
                            Reagendar
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="hidden md:block overflow-x-auto pb-10">
          <table className="w-full text-left border-separate border-spacing-y-3">
            <thead className="bg-[#0b2b24]">
              <tr className="text-[10px] font-extrabold uppercase text-white tracking-widest">
                <th className="p-5 w-14 text-center rounded-l-2xl">
                  <input
                    type="checkbox"
                    checked={
                      selectedIds.size === bookings.length &&
                      bookings.length > 0
                    }
                    onChange={toggleSelectAll}
                    className="w-5 h-5 border-emerald-800 bg-emerald-900 shadow-sm cursor-pointer accent-emerald-500 rounded-md"
                  />
                </th>
                <th className="p-5">Agenda / Operação</th>
                <th className="p-5">Identificação Cliente</th>
                <th className="p-5 text-center">Configuração</th>
                <th className="p-5 text-right">Financeiro TOTAL</th>
                <th className="p-5 text-center opacity-0 w-20 rounded-r-2xl">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="bg-transparent">
              {bookings.map((booking) => {
                const expanded = expandedId === booking.id;
                const isSelected = selectedIds.has(booking.id);
                const config = getStatusConfig(booking);
                const StatusIcon = config.icon;

                const bookingDate = parseISO(
                  booking.visit_date || new Date().toISOString(),
                );
                const childrenCount = Array.isArray(booking.children)
                  ? booking.children.length
                  : typeof booking.children === "number"
                    ? booking.children
                    : 0;
                const totalPeople = (booking.adults || 0) + childrenCount;

                return (
                  <React.Fragment key={booking.id}>
                    <tr
                      onClick={() =>
                        setExpandedId(expanded ? null : booking.id)
                      }
                      className={cn(
                        "group transition-all cursor-pointer duration-300 overflow-hidden",
                        isSelected
                          ? "bg-emerald-50/80"
                          : "bg-white hover:bg-slate-50",
                        expanded && "bg-slate-50 shadow-inner",
                      )}
                    >
                      <td className="p-5 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onClick={(e) => toggleSelect(booking.id, e)}
                          onChange={() => {}}
                          className="w-5 h-5 rounded-lg border-emerald-200 bg-white cursor-pointer accent-emerald-600"
                        />
                      </td>
                      <td className="p-5">
                        <div className="space-y-1 min-w-[130px]">
                          <div className="flex items-center gap-2">
                            <Calendar
                              className={cn(
                                "w-3.5 h-3.5",
                                isToday(bookingDate)
                                  ? "text-emerald-600"
                                  : "text-emerald-700/60",
                              )}
                            />
                            <span
                              className={cn(
                                "text-[15px] font-black uppercase tracking-tight",
                                isToday(bookingDate)
                                  ? "text-emerald-600"
                                  : "text-emerald-950",
                              )}
                            >
                              {format(bookingDate, "dd/MM/yyyy", {
                                locale: ptBR,
                              })}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest pl-6">
                              {format(bookingDate, "EEEE", { locale: ptBR })}
                            </span>
                          </div>
                          <div className="pl-5 pt-1">
                            <div
                              className={cn(
                                "flex items-center gap-1.5 font-extrabold uppercase text-[8px] tracking-wider w-fit px-2 py-0.5 rounded-md border shadow-sm",
                                config.bgColor,
                                config.color,
                                config.borderColor,
                              )}
                            >
                              <StatusIcon className="w-2.5 h-2.5" />
                              <span>{config.label}</span>
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-5">
                        <div className="flex flex-col gap-0.5">
                          {editingCustomerId === booking.id ? (
                             <div className="flex items-center gap-2 mb-1" onClick={e => e.stopPropagation()}>
                                <input
                                  type="text"
                                  value={customerEditData.name}
                                  onChange={e => setCustomerEditData(prev => ({ ...prev, name: e.target.value }))}
                                  className="w-full h-8 text-[11px] font-black uppercase rounded-lg border-2 border-emerald-200 px-2 focus:border-emerald-500 focus:outline-none"
                                  placeholder="Nome"
                                />
                             </div>
                          ) : (
                             <div className="flex items-center gap-2 group/edit">
                                <span className="font-extrabold text-lg text-emerald-950 uppercase tracking-tight leading-tight group-hover:text-emerald-600 transition-colors">
                                  {booking.name ||
                                    (booking as any).customer_name ||
                                    "CLIENTE GERAL"}
                                </span>
                                {onUpdateCustomer && (
                                   <button 
                                     onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingCustomerId(booking.id);
                                        setCustomerEditData({ 
                                          name: booking.name || (booking as any).customer_name || '', 
                                          phone: booking.customer_phone || (booking as any).phone || '', 
                                          cpf: booking.customer_cpf || (booking as any).cpf || '' 
                                        });
                                     }}
                                     className="opacity-0 group-hover/edit:opacity-100 p-1.5 hover:bg-emerald-50 text-emerald-600 rounded-lg transition-all"
                                   >
                                     <Pencil className="w-3.5 h-3.5" />
                                   </button>
                                )}
                             </div>
                          )}
                          
                          {(booking.customer_cpf || booking.customer_phone || editingCustomerId === booking.id) && (
                            <div className="flex flex-wrap gap-2 mt-1">
                              {editingCustomerId === booking.id ? (
                                <div className="flex items-center gap-2 w-full" onClick={e => e.stopPropagation()}>
                                  <input
                                    type="text"
                                    value={customerEditData.cpf}
                                    onChange={e => {
                                      let val = e.target.value.replace(/\D/g, '');
                                      if (val.length > 11) val = val.slice(0, 11);
                                      if (val.length > 9) val = val.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
                                      else if (val.length > 6) val = val.replace(/(\d{3})(\d{3})(\d{3})/, "$1.$2.$3");
                                      else if (val.length > 3) val = val.replace(/(\d{3})(\d{3})/, "$1.$2");
                                      setCustomerEditData(prev => ({ ...prev, cpf: val }));
                                    }}
                                    className="w-24 h-7 text-[9px] font-black uppercase rounded-lg border-2 border-slate-200 px-2"
                                    placeholder="CPF"
                                  />
                                  <input
                                    type="text"
                                    value={customerEditData.phone}
                                    onChange={e => {
                                      let val = e.target.value.replace(/\D/g, '');
                                      if (val.length > 11) val = val.slice(0, 11);
                                      if (val.length > 10) val = val.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
                                      else if (val.length > 6) val = val.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
                                      else if (val.length > 2) val = val.replace(/(\d{2})(\d{0,5})/, "($1) $2");
                                      setCustomerEditData(prev => ({ ...prev, phone: val }));
                                    }}
                                    className="w-28 h-7 text-[9px] font-black uppercase rounded-lg border-2 border-blue-200 px-2"
                                    placeholder="WhatsApp"
                                  />
                                  <div className="flex ml-auto gap-1">
                                    <button
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        if (onUpdateCustomer) {
                                           const success = await onUpdateCustomer(booking.id, customerEditData, booking.is_order);
                                           if (success) setEditingCustomerId(null);
                                        }
                                      }}
                                      className="h-7 w-7 bg-emerald-500 text-white rounded-lg flex items-center justify-center hover:bg-emerald-600"
                                    >
                                      <Check className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setEditingCustomerId(null);
                                      }}
                                      className="h-7 w-7 bg-slate-200 text-slate-600 rounded-lg flex items-center justify-center hover:bg-slate-300"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {booking.customer_cpf && (
                                    <span className="text-[9px] font-black px-1.5 py-0.5 bg-slate-50 border border-slate-200 text-slate-500 rounded shadow-xs uppercase tracking-tighter">
                                      CPF: {booking.customer_cpf}
                                    </span>
                                  )}
                                  {booking.customer_phone && (
                                    <span className="text-[9px] font-black px-1.5 py-0.5 bg-blue-50 border border-blue-100 text-blue-500 rounded shadow-xs uppercase tracking-tighter flex items-center gap-1">
                                      <Phone className="w-2.5 h-2.5" />{" "}
                                      {booking.customer_phone}
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                          <div className="flex items-center gap-2 mt-1">
                            <span className="bg-slate-100 text-slate-800 border-2 border-slate-200 px-3 py-1 rounded-lg font-black text-[10px] uppercase tracking-widest leading-none">
                              ID: {booking.id.slice(0, 8)}
                            </span>
                            {booking.is_associado && (
                              <Badge className="bg-amber-100 text-amber-700 border-none text-[8px] font-black uppercase px-2 h-4 rounded-full">
                                Sócio
                              </Badge>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-5 text-center">
                        <div className="inline-flex flex-col items-center justify-center bg-emerald-50 border-2 border-emerald-300 w-20 h-20 rounded-2xl shadow-sm group-hover:border-emerald-500 group-hover:scale-105 transition-all">
                          <Users className="w-5 h-5 text-emerald-700 mb-1" />
                          <span className="text-3xl font-black text-emerald-950 leading-none">
                            {totalPeople}
                          </span>
                          <span className="text-[8px] font-black text-emerald-700 uppercase tracking-widest mt-1">
                            Pessoas
                          </span>
                        </div>
                      </td>
                      <td className="p-5 text-right">
                        <div className="flex flex-col items-end">
                          <span className="text-2xl font-extrabold text-emerald-600 tracking-tighter">
                            {formatCurrency(booking.total_amount)}
                          </span>
                          <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-widest mt-0.5">
                            Auditado OK
                          </span>
                        </div>
                      </td>
                      <td className="p-5 text-center">
                        <Button
                          size="icon"
                          variant="ghost"
                          className={cn(
                            "h-12 w-12 rounded-2xl transition-all duration-300 border-2",
                            expanded
                              ? "bg-emerald-900 text-white border-emerald-950 rotate-180 shadow-lg"
                              : "text-emerald-700 border-emerald-100 hover:bg-emerald-600 hover:text-white hover:border-emerald-600",
                          )}
                        >
                          <ChevronDown className="w-6 h-6" />
                        </Button>
                      </td>
                    </tr>

                    {expanded && (
                      <tr className="border-x-4 border-slate-200">
                        <td
                          colSpan={6}
                          className="p-0 bg-slate-50/50 border-y-4 border-slate-200 shadow-2xl rounded-b-3xl"
                        >
                          <div className="p-6 space-y-6 animate-in slide-in-from-top-4 duration-500">
                            <div className="bg-white rounded-3xl p-6 shadow-xl border border-slate-200">
                              <BookingDetail
                                booking={booking}
                                onRemoveReceipt={onRemoveReceipt}
                                onRefresh={onRefresh}
                              />
                            </div>

                            <div className="flex flex-col gap-6 w-full">
                              {/* Ações Rápidas - Ocupa 100% da largura em uma linha */}
                              <div className="w-full space-y-6">
                                <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-xl border border-slate-200 flex flex-col justify-between space-y-8 relative overflow-hidden group">
                                  <div className="relative z-10 space-y-6">
                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-emerald-50 pb-4">
                                      <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-600">
                                          <CalendarClock className="w-5 h-5" />
                                        </div>
                                        <div>
                                          <h4 className="text-[8px] font-black uppercase text-emerald-700/60 tracking-widest text-[#064e3b]">
                                            Ações Rápidas
                                          </h4>
                                          <p className="text-base font-extrabold text-emerald-950">
                                            Controle de Reserva
                                          </p>
                                        </div>
                                      </div>

                                      {onFileUpload && (
                                        <div className="flex items-center gap-2">
                                          <input
                                            type="file"
                                            id={`upload-${booking.id}`}
                                            className="hidden"
                                            onChange={(e) => {
                                              if (e.target.files)
                                                onFileUpload(
                                                  e.target.files[0],
                                                  booking.id,
                                                  !!booking.is_order,
                                                );
                                            }}
                                          />
                                          {booking.receipt_url ? (
                                            <>
                                              <a
                                                href={booking.receipt_url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-2 px-4 py-3 bg-emerald-600 border-2 border-emerald-700 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-sm hover:bg-emerald-700 transition-all"
                                              >
                                                <FileCheck className="w-4 h-4" />{" "}
                                                VER
                                              </a>
                                              <label
                                                htmlFor={`upload-${booking.id}`}
                                                className="flex items-center gap-2 px-4 py-3 bg-white border-2 border-dashed border-emerald-200 text-emerald-800 rounded-2xl cursor-pointer font-black text-[10px] uppercase tracking-widest hover:bg-emerald-50 transition-all"
                                              >
                                                {isUploading ? (
                                                  <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                  <Upload className="w-4 h-4" />
                                                )}
                                                SUBSTITUIR
                                              </label>
                                            </>
                                          ) : (
                                            <label
                                              htmlFor={`upload-${booking.id}`}
                                              className={cn(
                                                "flex items-center gap-3 px-6 py-3 rounded-2xl cursor-pointer transition-all duration-300 font-black text-[10px] uppercase tracking-widest shadow-sm hover:shadow-md hover:scale-[1.02] active:scale-[0.98]",
                                                "bg-white border-2 border-dashed border-emerald-200 text-emerald-800 hover:bg-emerald-50 hover:border-emerald-400",
                                              )}
                                            >
                                              {isUploading ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                              ) : (
                                                <Upload className="w-4 h-4" />
                                              )}
                                              ANEXAR COMPROVANTE
                                            </label>
                                          )}
                                        </div>
                                      )}
                                    </div>

                                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-3 pt-2">
                                      {onGeneratePayment &&
                                        ![
                                          "paid",
                                          "pago",
                                          "checked-in",
                                          "cancelled",
                                          "cancelado",
                                        ].includes(
                                          booking.status?.toLowerCase() || "",
                                        ) && (
                                          <Button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onGeneratePayment(
                                                booking.id,
                                                !!booking.is_order,
                                              );
                                            }}
                                            className="bg-amber-100 text-amber-900 border-b-4 border-amber-300 hover:border-b-0 hover:translate-y-[2px] hover:bg-amber-500 hover:text-white shadow-md transition-all duration-300 font-black uppercase text-[9px] md:text-[10px] h-14 md:h-16 rounded-2xl flex flex-col items-center justify-center gap-1 w-full p-0"
                                          >
                                            <QrCode className="w-4 h-4 md:w-5 md:h-5" />
                                            <span>PIX</span>
                                          </Button>
                                        )}
                                      {onSyncPayment &&
                                        ![
                                          "paid",
                                          "pago",
                                          "checked-in",
                                          "cancelled",
                                          "cancelado",
                                        ].includes(
                                          booking.status?.toLowerCase() || "",
                                        ) && (
                                          <Button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onSyncPayment(booking.id);
                                            }}
                                            className="bg-blue-100 text-blue-900 border-b-4 border-blue-300 hover:border-b-0 hover:translate-y-[2px] hover:bg-blue-600 hover:text-white shadow-md transition-all duration-300 font-black uppercase text-[9px] md:text-[10px] h-14 md:h-16 rounded-2xl flex flex-col items-center justify-center gap-1 w-full p-0"
                                            disabled={updatingId === booking.id}
                                          >
                                            <RotateCcw
                                              className={cn(
                                                "w-4 h-4 md:w-5 md:h-5",
                                                updatingId === booking.id &&
                                                  "animate-spin",
                                              )}
                                            />
                                            <span>SINC</span>
                                          </Button>
                                        )}
                                      <Button
                                        onClick={() =>
                                          onStatusChange(
                                            booking.id,
                                            "paid",
                                            booking.is_order,
                                          )
                                        }
                                        disabled={
                                          booking.status === "paid" ||
                                          updatingId === booking.id
                                        }
                                        className="bg-emerald-600 text-white border-b-4 border-emerald-900 hover:border-b-0 hover:translate-y-[2px] hover:bg-emerald-700 disabled:opacity-40 shadow-md transition-all duration-300 font-black uppercase text-[9px] md:text-[10px] h-14 md:h-16 rounded-2xl flex flex-col items-center justify-center gap-1 w-full p-0"
                                      >
                                        <CheckCircle className="w-4 h-4 md:w-5 md:h-5" />
                                        <span>PAGO OK</span>
                                      </Button>
                                      <Button
                                        onClick={() =>
                                          onStatusChange(
                                            booking.id,
                                            "checked-in",
                                            booking.is_order,
                                          )
                                        }
                                        className={cn(
                                          "transition-all duration-300 font-black uppercase text-[9px] md:text-[10px] h-14 md:h-16 rounded-2xl flex flex-col items-center justify-center gap-1 w-full p-0 border-b-4 hover:border-b-0 hover:translate-y-[2px] shadow-md",
                                          booking.status === "checked-in"
                                            ? "bg-emerald-900 text-white border-emerald-950 shadow-inner"
                                            : "bg-emerald-100 text-emerald-900 border-emerald-300 hover:bg-emerald-800 hover:text-white",
                                        )}
                                      >
                                        <UserCheck className="w-4 h-4 md:w-5 md:h-5" />
                                        <span>CHECK-IN</span>
                                      </Button>
                                      <Popover>
                                        <PopoverTrigger asChild>
                                          <Button
                                            className={cn(
                                              "transition-all duration-300 font-black uppercase text-[9px] md:text-[10px] h-14 md:h-16 rounded-2xl flex flex-col items-center justify-center gap-1 w-full p-0 shadow-md border-b-4 hover:border-b-0 hover:translate-y-[2px]",
                                              rescheduleId === booking.id
                                                ? "bg-blue-600 text-white border-blue-800 shadow-inner"
                                                : "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-600 hover:text-white hover:border-blue-800",
                                            )}
                                          >
                                            <CalendarRange className="w-4 h-4 md:w-5 md:h-5" />
                                            <span>REAGENDAR</span>
                                          </Button>
                                        </PopoverTrigger>
                                        <PopoverContent
                                          className="w-auto p-0 rounded-3xl border-2 border-blue-100 shadow-2xl overflow-hidden"
                                          align="end"
                                        >
                                          <div className="bg-blue-50 p-4 border-b border-blue-100">
                                            <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest">
                                              Nova Data da Visita
                                            </p>
                                          </div>
                                          <CalendarUI
                                            mode="single"
                                            selected={
                                              rescheduleDate
                                                ? parseISO(rescheduleDate)
                                                : undefined
                                            }
                                            onSelect={(date) =>
                                              setRescheduleDate(
                                                date
                                                  ? format(date, "yyyy-MM-dd")
                                                  : "",
                                              )
                                            }
                                            initialFocus
                                            className="p-3"
                                            disabled={(date) => isAllowedDay ? (!isAllowedDay(date) || isBefore(date, startOfDay(new Date()))) : isBefore(date, startOfDay(new Date()))}
                                            components={{
                                              DayContent: ({ date }) => {
                                                const dateStr = format(date, 'yyyy-MM-dd');
                                                const hasKiosk = (kioskReservations || []).some(r => r.reservation_date === dateStr);
                                                const hasQuad = (quadReservations || []).some(r => r.reservation_date === dateStr);
                                                const kiosksFull = (kioskReservations || []).filter(r => r.reservation_date === dateStr).length >= 5;
                                                const quadsFull = (quadReservations || []).filter(r => r.reservation_date === dateStr).reduce((s, r) => s + (Number(r.quantity) || 1), 0) >= (totalQuads * 4);
                                                const isFull = kiosksFull && quadsFull;
                                                return (
                                                  <div className={cn("relative flex flex-col items-center p-0.5 rounded w-full h-full justify-center", isFull && "bg-red-50/50")}>
                                                    <span className={cn("text-[11px]", isFull && "text-red-600 font-black")}>{date.getDate()}</span>
                                                    <div className="flex gap-0.5 mt-0.5">
                                                      {hasKiosk && <div className={cn("w-1.5 h-1.5 rounded-full ring-1 ring-white/50", kiosksFull ? "bg-red-600" : "bg-emerald-600")} />}
                                                      {hasQuad && <div className={cn("w-1.5 h-1.5 rounded-full ring-1 ring-white/50", quadsFull ? "bg-red-600" : "bg-blue-600")} />}
                                                    </div>
                                                  </div>
                                                );
                                              }
                                            }}
                                          />
                                          <div className="p-4 bg-white flex gap-2">
                                            <Button
                                              onClick={() => {
                                                if (rescheduleDate) {
                                                  onReschedule(
                                                    booking.id,
                                                    rescheduleDate,
                                                    booking.is_order,
                                                  );
                                                  setRescheduleId(null);
                                                }
                                              }}
                                              disabled={
                                                !rescheduleDate ||
                                                updatingId === booking.id
                                              }
                                              className="flex-1 bg-blue-600 text-white font-black text-[10px] h-10 rounded-xl"
                                            >
                                              CONFIRMAR
                                            </Button>
                                          </div>
                                        </PopoverContent>
                                      </Popover>
                                      <Button
                                        onClick={() =>
                                          onStatusChange(
                                            booking.id,
                                            "cancelled",
                                            booking.is_order,
                                          )
                                        }
                                        className="bg-red-100 text-red-900 border-b-4 border-red-300 hover:border-b-0 hover:translate-y-[2px] hover:bg-red-600 hover:text-white shadow-md transition-all duration-300 font-black uppercase text-[9px] md:text-[10px] h-14 md:h-16 rounded-2xl flex flex-col items-center justify-center gap-1 w-full p-0"
                                      >
                                        <XCircle className="w-4 h-4 md:w-5 md:h-5" />
                                        <span>CANCELAR</span>
                                      </Button>
                                      {onConvertToCredit && (
                                        <Button
                                          onClick={() =>
                                            onConvertToCredit(booking)
                                          }
                                          className="bg-purple-100 text-purple-900 border-b-4 border-purple-300 hover:border-b-0 hover:translate-y-[2px] hover:bg-purple-600 hover:text-white shadow-md transition-all duration-300 font-black uppercase text-[9px] md:text-[10px] h-14 md:h-16 rounded-2xl flex flex-col items-center justify-center gap-1 w-full p-0"
                                        >
                                          <Wallet className="w-4 h-4 md:w-5 md:h-5" />
                                          <span>CRÉDITO</span>
                                        </Button>
                                      )}
                                        <Button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const phone = (
                                              booking.customer_phone ||
                                              (booking as any).phone ||
                                              ""
                                            ).replace(/\D/g, "");
                                            
                                            if (!phone) {
                                              toast({ title: "Erro", description: "Telefone do cliente não encontrado.", variant: "destructive" });
                                              return;
                                            }

                                            const code = booking.confirmation_code;
                                            if (!code) {
                                              toast({ title: "Erro", description: "Código do voucher não encontrado.", variant: "destructive" });
                                              return;
                                            }

                                            const items =
                                              (booking as any).order_items ||
                                              [];
                                            const itemsList = items
                                              .map(
                                                (it: any) =>
                                                  `* ${it.quantity}x ${it.product_name || it.product_id} (${formatCurrency(it.unit_price)})`,
                                              )
                                              .join("\n");
                                            const dateStr = format(
                                              parseISO(
                                                booking.visit_date ||
                                                  new Date().toISOString(),
                                              ),
                                              "dd/MM/yyyy",
                                              { locale: ptBR },
                                            );
                                            const name =
                                              booking.name ||
                                              (booking as any).customer_name;

                                            const message = 
                                              `🌿 *BALNEÁRIO FAMÍLIA LESSA*\n\n` +
                                              `Esse é seu voucher de confirmação da sua reserva e o resumo do seu pedido para apresentar caso seja solicitado.\n\n` +
                                              `📅 *Data:* ${dateStr}\n` +
                                              `👤 *Titular:* ${name}\n\n` +
                                              `📝 *Resumo do Pedido:*\n${itemsList}\n\n` +
                                              `💰 *Total:* ${formatCurrency(booking.total_amount)}\n\n` +
                                              `Voucher: https://reservas.balneariolessa.com.br/voucher/${code}\n\n` +
                                              `✨ *Aguardamos vocês para o lazer que a sua família merece.*`;
                                            
                                            const text = encodeURIComponent(message);

                                            // Open WhatsApp immediately
                                            window.open(
                                              "https://wa.me/55" +
                                                phone +
                                                "?text=" +
                                                text,
                                              "_blank",
                                            );

                                            // Update marker in DB
                                            if (booking.id && !booking.id.startsWith('order-')) {
                                              supabase.from('orders')
                                                .update({ last_voucher_sent_at: new Date().toISOString() })
                                                .eq('id', booking.id)
                                                .then(() => {
                                                  if (onRefresh) onRefresh();
                                                });
                                            }
                                          }}
                                          className={cn(
                                            "relative shadow-md transition-all duration-300 font-black uppercase text-[9px] md:text-[10px] h-14 md:h-16 rounded-2xl flex flex-col items-center justify-center gap-1 w-full p-0 border-b-4 hover:border-b-0 hover:translate-y-[2px]",
                                            booking.last_voucher_sent_at 
                                              ? "bg-emerald-50 text-emerald-900 border-emerald-300 hover:bg-emerald-600 hover:text-white" 
                                              : "bg-indigo-100 text-indigo-900 border-indigo-300 hover:bg-indigo-600 hover:text-white"
                                          )}
                                        >
                                          <FileCheck className="w-4 h-4 md:w-5 md:h-5" />
                                          <span>{booking.last_voucher_sent_at ? "REENVIAR" : "VOUCHER"}</span>
                                          {booking.last_voucher_sent_at && (
                                            <div className="absolute -top-1 -right-1 bg-emerald-600 text-white text-[7px] px-2 py-0.5 rounded-full border border-white shadow-sm font-black">
                                              ENVIADO
                                            </div>
                                          )}
                                        </Button>
                                      {onSyncPayment &&
                                        [
                                          "pending",
                                          "awaiting_payment",
                                          "aguardando pgto",
                                          "waiting_local",
                                          "waiting_confirmation",
                                        ].includes(
                                          booking.status?.toLowerCase() || "",
                                        ) && (
                                          <Button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onSyncPayment(booking.id);
                                            }}
                                            className="bg-blue-100 text-blue-900 border-b-4 border-blue-300 hover:border-b-0 hover:translate-y-[2px] hover:bg-blue-600 hover:text-white shadow-md transition-all duration-300 font-black uppercase text-[9px] md:text-[10px] h-14 md:h-16 rounded-2xl flex flex-col items-center justify-center gap-1 w-full p-0"
                                          >
                                            <RefreshCw className="w-4 h-4 md:w-5 md:h-5" />
                                            <span>SYNC ASAAS</span>
                                          </Button>
                                        )}
                                    </div>
                                  </div>
                                </div>
                              </div>

                              {/* Notas Internas - Ocupa 100% da largura logo abaixo */}
                              <div className="w-full bg-[#0b2b24] text-white p-6 md:p-8 rounded-[2rem] shadow-xl border border-emerald-900 flex flex-col space-y-4 relative overflow-hidden group">
                                <div className="absolute inset-0 bg-emerald-800/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                <div className="relative z-10">
                                  <div className="flex items-center gap-2 mb-4">
                                    <StickyNote className="w-5 h-5 text-emerald-500" />
                                    <p className="text-[10px] md:text-xs font-black uppercase tracking-widest text-[#a7f3d0]">
                                      Notas Internas Gerais
                                    </p>
                                  </div>

                                  {editingNoteId === booking.id ? (
                                    <div className="space-y-4">
                                      <Textarea
                                        value={noteText}
                                        onChange={(e) =>
                                          setNoteText(e.target.value)
                                        }
                                        className="rounded-2xl border-white/20 min-h-[80px] text-xs p-4 bg-black/20 text-white placeholder:text-white/30 focus:border-emerald-500 focus:ring-emerald-500/20"
                                        placeholder="Digite aqui anotações, detalhes de reagendamentos ou avisos importantes..."
                                      />
                                      <div className="flex gap-3">
                                        <Button
                                          onClick={() => {
                                            onAddNote(
                                              booking.id,
                                              noteText,
                                              booking.is_order,
                                            );
                                            setEditingNoteId(null);
                                          }}
                                          className="px-8 bg-emerald-500 hover:bg-emerald-400 text-emerald-950 font-black text-[10px] h-10 rounded-xl uppercase tracking-wider"
                                        >
                                          SALVAR NOTA
                                        </Button>
                                        <Button
                                          onClick={() => setEditingNoteId(null)}
                                          variant="ghost"
                                          className="text-[10px] text-white/50 hover:text-white/80 hover:bg-white/10 h-10 rounded-xl font-bold uppercase tracking-wider"
                                        >
                                          CANCELAR
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div
                                      onClick={() => {
                                        setEditingNoteId(booking.id);
                                        setNoteText(booking.notes || "");
                                      }}
                                      className="cursor-pointer min-h-[60px] p-4 rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center transition-all hover:bg-white/5 hover:border-emerald-500/50"
                                    >
                                      {booking.notes ? (
                                        <p className="text-sm font-medium text-emerald-50 italic leading-relaxed w-full">
                                          "{booking.notes}"
                                        </p>
                                      ) : (
                                        <div className="flex items-center gap-2 text-white/30">
                                          <Plus className="w-4 h-4" />
                                          <span className="text-[10px] font-black uppercase tracking-wider">
                                            Adicionar anotação
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
