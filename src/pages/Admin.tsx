import React, { useState } from 'react';
import { parseISO, isBefore, startOfDay, isToday } from 'date-fns';
import { 
  LogOut, 
  LayoutDashboard, 
  Tent, 
  Bike, 
  ShoppingBag, 
  CalendarPlus, 
  RefreshCw,
  Wallet
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AdminLogin } from '@/components/admin/AdminLogin';
import { Badge } from '@/components/ui/badge';
import { markOrderAsPaid } from '@/integrations/supabase/orders';
import { InternalBookingAssistant } from '@/components/admin/InternalBookingAssistant';
import { BookingTable } from '@/components/admin/BookingTable';
import { AgendaHeader } from '@/components/admin/AgendaHeader';
import { PaymentModal } from '@/components/booking/PaymentModal';

import { cn } from "@/lib/utils";
// Shared Components
import { 
  EditKioskDialog, 
  EditQuadDialog, 
  RescheduleDialog, 
  DeleteConfirmDialog 
} from '@/components/admin/AdminDialogs';
import { AdminDashboardTab } from '@/components/admin/AdminDashboardTab';
import { AdminKioskTab } from '@/components/admin/AdminKioskTab';
import { AdminQuadTab } from '@/components/admin/AdminQuadTab';
import { AdminVendasTab } from '@/components/admin/AdminVendasTab';
import { AdminCreditsTab } from '@/components/admin/AdminCreditsTab';

// Hooks & Constants
import { useAdminData } from '@/hooks/useAdminData';
import { isHoliday, isAllowedDay } from '@/lib/admin-constants';

type TabType = 'painel' | 'reservas' | 'quiosques' | 'quads' | 'vendas' | 'creditos';

export default function Admin() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('admin_token'));
  const [activeTab, setActiveTab] = useState<TabType>('painel');
  const [kioskSubTab, setKioskSubTab] = useState<'hoje' | 'futuras' | 'historico'>('hoje');
  const [quadSubTab, setQuadSubTab] = useState<'hoje' | 'futuras' | 'historico'>('hoje');
  const [agendaSubTab, setAgendaSubTab] = useState<'hoje' | 'futuras' | 'historico'>('hoje');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [vendasStatusFilter, setVendasStatusFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const { toast } = useToast();

  const {
    loading,
    bookings,
    kioskReservations,
    quadReservations,
    orders,
    credits,
    targetDate,
    setTargetDate,
    fetchData,
    confirmDelete: dataConfirmDelete,
    handleRescheduleConfirm: dataRescheduleConfirm,
    convertToCredit: dataConvertToCredit
  } = useAdminData();

  // UI States
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<any>({});
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{item: any, type: string} | null>(null);
  const [rescheduleData, setRescheduleData] = useState<{type: 'kiosk' | 'quad', group: any} | null>(null);
  const [expandedQuadGroupId, setExpandedQuadGroupId] = useState<string | null>(null);
  const [editingKioskGroup, setEditingKioskGroup] = useState<any | null>(null);
  const [editingQuadItem, setEditingQuadItem] = useState<any | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPaymentBooking, setSelectedPaymentBooking] = useState<any | null>(null);

  const filterBookings = () => {
    return bookings.filter(b => {
      const bDate = parseISO(b.visit_date || new Date().toISOString());
      const today = startOfDay(new Date());
      
      if (agendaSubTab === 'hoje' && !isToday(bDate)) return false;
      if (agendaSubTab === 'futuras' && (isToday(bDate) || isBefore(bDate, today))) return false;
      if (agendaSubTab === 'historico' && !isBefore(bDate, today)) return false;
      if (statusFilter !== 'all' && b.status !== statusFilter) return false;
      if (filterDate && b.visit_date !== filterDate) return false;

      if (search) {
        const s = search.toLowerCase();
        return (
          (b.name || '').toLowerCase().includes(s) ||
          (b.customer_name || '').toLowerCase().includes(s) ||
          (b.customer_phone || '').includes(s) ||
          (b.customer_cpf || '').includes(s) ||
          b.id.toLowerCase().includes(s)
        );
      }
      return true;
    });
  };

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    setToken(null);
  };

  const requestDelete = (item: any, type: string) => {
    setItemToDelete({ item, type });
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    const success = await dataConfirmDelete(itemToDelete.item, itemToDelete.type);
    if (success) setDeleteDialogOpen(false);
  };

  const handleRescheduleConfirm = async (date: Date) => {
    if (!rescheduleData) return;
    const success = await dataRescheduleConfirm(rescheduleData.type, rescheduleData.group, date);
    if (success) setRescheduleData(null);
  };

  const updateOrderTotal = async (orderId: string) => {
    if (!orderId || orderId.startsWith('order-')) return;
    const { data: items } = await supabase.from('order_items').select('unit_price, quantity').eq('order_id', orderId);
    if (items) {
      const total = items.reduce((acc, it) => acc + (Number(it.unit_price) * (Number(it.quantity) || 1)), 0);
      await supabase.from('orders').update({ total_amount: total }).eq('id', orderId);
    }
  };

  if (!token) return <AdminLogin onLogin={setToken} />;

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans selection:bg-emerald-500/30">
      {/* Sidebar / Header */}
      <div className="fixed top-0 left-0 right-0 h-20 bg-slate-900/50 backdrop-blur-xl border-b border-slate-800 z-50 px-6 flex items-center justify-between">
         <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
               <LayoutDashboard className="text-white w-6 h-6" />
            </div>
            <div>
               <h1 className="text-xl font-black tracking-tight text-white uppercase">Balneário Lessa</h1>
               <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest leading-none mt-1">Painel Administrativo v2.0</p>
            </div>
         </div>

         <div className="flex items-center gap-6">
            <nav className="hidden xl:flex items-center gap-1 bg-slate-950/50 p-1.5 rounded-2xl border border-slate-800">
               {[
                 { id: 'painel', label: 'Painel', icon: LayoutDashboard },
                 { id: 'reservas', label: 'Agenda', icon: CalendarPlus },
                 { id: 'quiosques', label: 'Quiosques', icon: Tent },
                 { id: 'quads', label: 'Quadriciclos', icon: Bike },
                 { id: 'vendas', label: 'Vendas', icon: ShoppingBag },
                 { id: 'creditos', label: 'Créditos', icon: Wallet },
               ].map(tab => (
                 <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className={cn(
                      "flex items-center gap-2.5 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300",
                      activeTab === tab.id 
                        ? "bg-emerald-500 text-white shadow-lg shadow-emerald-500/20 scale-105" 
                        : "text-slate-400 hover:text-white hover:bg-slate-800"
                    )}
                 >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                 </button>
               ))}
            </nav>
            
            <div className="h-8 w-px bg-slate-800" />
            
            <button onClick={handleLogout} className="flex items-center gap-2 text-slate-400 hover:text-red-400 font-bold text-xs uppercase tracking-widest transition-colors group">
               <LogOut className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
               Sair
            </button>
         </div>
      </div>

      {/* Main Content */}
      <main className="pt-28 pb-12 px-6 max-w-[1600px] mx-auto min-h-screen">
        {activeTab === 'painel' && (
          <AdminDashboardTab 
            targetDate={targetDate} setTargetDate={setTargetDate}
            kioskReservations={kioskReservations} quadReservations={quadReservations}
            bookings={bookings} orders={orders}
            isAllowedDay={isAllowedDay} isHoliday={isHoliday}
          />
        )}

        {activeTab === 'reservas' && (
          <div className="space-y-8 animate-in fade-in duration-500">
             <InternalBookingAssistant onBookingComplete={fetchData} />
             <div className="bg-white/95 backdrop-blur-md rounded-[2.5rem] p-1 shadow-2xl border-2 border-emerald-100 overflow-hidden">
                <AgendaHeader 
                  agendaSubTab={agendaSubTab} setAgendaSubTab={setAgendaSubTab as any}
                  search={search} setSearch={setSearch}
                  filterDate={filterDate} setFilterDate={setFilterDate}
                  statusFilter={statusFilter} setStatusFilter={setStatusFilter}
                  isAllowedDay={isAllowedDay}
                />
                <BookingTable 
                  bookings={filterBookings()}
                  onStatusChange={(id, s, isOrder) => { setUpdatingId(id); (supabase.from(isOrder ? 'orders' : 'bookings') as any).update({ status: s }).eq('id', id).then(() => fetchData()); }}
                  onReschedule={(id, d, isOrder) => { setUpdatingId(id); (supabase.from(isOrder ? 'orders' : 'bookings') as any).update({ visit_date: d }).eq('id', id).then(() => fetchData()); }}
                  onRemoveItem={(orderId, itemId) => { /* Logic to remove item */ }}
                  onAddNote={(id, n, isOrder) => { setUpdatingId(id); (supabase.from(isOrder ? 'orders' : 'bookings') as any).update({ notes: n }).eq('id', id).then(() => fetchData()); }}
                  onDelete={(id, isOrder) => requestDelete({ id }, isOrder ? 'order' : 'reservas')}
                  onGeneratePayment={(id, isOrder) => { setSelectedPaymentBooking(bookings.find(b => b.id === id) || orders.find(o => o.id === id)); setIsPaymentModalOpen(true); }}
                  updatingId={updatingId}
                  onConvertToCredit={(b) => dataConvertToCredit(b, b.is_order ? 'order' : 'reservas')}
                />
             </div>
          </div>
        )}

        {activeTab === 'quiosques' && (
          <AdminKioskTab 
            kioskReservations={kioskReservations} kioskSubTab={kioskSubTab} setKioskSubTab={setKioskSubTab}
            setEditingKioskGroup={setEditingKioskGroup} setRescheduleData={setRescheduleData} setRescheduleDate={(d) => {}}
            requestDelete={requestDelete}
          />
        )}

        {activeTab === 'quads' && (
          <AdminQuadTab 
            quadReservations={quadReservations} quadSubTab={quadSubTab} setQuadSubTab={setQuadSubTab}
            expandedQuadGroupId={expandedQuadGroupId} setExpandedQuadGroupId={setExpandedQuadGroupId}
            editingId={editingId} editData={editData} setEditData={setEditData}
            startEditing={(i) => { setEditingId(i.id); setEditData(i); }} cancelEditing={() => setEditingId(null)}
            saveEditing={async () => { await supabase.from('quad_reservations').update(editData).eq('id', editingId); setEditingId(null); fetchData(); }}
            setEditingQuadItem={setEditingQuadItem} setRescheduleData={setRescheduleData} setRescheduleDate={(d) => {}}
            requestDelete={requestDelete}
          />
        )}

        {activeTab === 'vendas' && (
          <AdminVendasTab 
            orders={orders} vendasStatusFilter={vendasStatusFilter} setVendasStatusFilter={setVendasStatusFilter}
            updatingId={updatingId} markOrderAsPaid={async (id) => { setUpdatingId(id); return markOrderAsPaid(id); }}
            requestDelete={requestDelete} fetchData={fetchData} toast={toast}
            onConvertToCredit={(b) => dataConvertToCredit(b, 'order')}
          />
        )}

        {activeTab === 'creditos' && (
          <AdminCreditsTab credits={credits} fetchData={fetchData} toast={toast} />
        )}
      </main>

      {/* Dialogs */}
      <DeleteConfirmDialog 
        open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}
        onConfirm={confirmDelete} loading={loading}
      />
      
      <RescheduleDialog 
        data={rescheduleData} onClose={() => setRescheduleData(null)}
        onConfirm={handleRescheduleConfirm} loading={loading}
        kioskReservations={kioskReservations} quadReservations={quadReservations}
        isAllowedDay={isAllowedDay}
      />

      {editingKioskGroup && (
        <EditKioskDialog 
          group={editingKioskGroup} onClose={() => setEditingKioskGroup(null)}
          onUpdated={fetchData} updateOrderTotal={updateOrderTotal}
        />
      )}

      {editingQuadItem && (
        <EditQuadDialog 
          item={editingQuadItem} onClose={() => setEditingQuadItem(null)}
          onUpdated={fetchData} updateOrderTotal={updateOrderTotal}
        />
      )}

      {isPaymentModalOpen && selectedPaymentBooking && (
        <PaymentModal 
          open={isPaymentModalOpen} 
          onOpenChange={(o) => setIsPaymentModalOpen(o)}
          orderId={selectedPaymentBooking.id}
          totalAmount={selectedPaymentBooking.total_amount || selectedPaymentBooking.total_price || 0}
          name={selectedPaymentBooking.name || selectedPaymentBooking.customer_name}
          email={selectedPaymentBooking.email || 'contato@balneariolessa.com.br'}
          phone={selectedPaymentBooking.phone || selectedPaymentBooking.customer_phone}
          cpf={selectedPaymentBooking.cpf || selectedPaymentBooking.customer_cpf}
          onSuccess={() => { setIsPaymentModalOpen(false); fetchData(); }}
        />
      )}

      {/* Refresh FAB */}
      <button 
        onClick={fetchData}
        className="fixed bottom-8 right-8 w-14 h-14 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl shadow-2xl flex items-center justify-center transition-all hover:rotate-180 hover:scale-110 active:scale-95 group z-40"
      >
        <RefreshCw className={cn("w-6 h-6", loading && "animate-spin")} />
      </button>
    </div>
  );
}
