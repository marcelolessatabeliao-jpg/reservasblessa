import React, { useState } from 'react';
import { 
  Plus, 
  Trash2,
  User,
  Phone,
  FileText,
  DollarSign,
  CheckCircle2,
  History,
  Pencil,
  Loader2,
  Upload,
  CalendarCheck,
  Calendar,
  Share2
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter
} from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/booking-types';
import { supabase } from '@/integrations/supabase/client';
import { CreditVoucherShareDialog } from './CreditVoucherShareDialog';

interface AdminCreditsTabProps {
  credits: any[];
  fetchData: () => void;
  toast: any;
}

export function AdminCreditsTab({
  credits,
  fetchData,
  toast
}: AdminCreditsTabProps) {
  const formatCPF = (val: string) => {
    const numeric = val.replace(/\D/g, '').substring(0, 11);
    return numeric.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")
                 .replace(/(\d{3})(\d{3})(\d{3})/, "$1.$2.$3")
                 .replace(/(\d{3})(\d{3})/, "$1.$2");
  };

  const formatPhone = (val: string) => {
    const numeric = val.replace(/\D/g, '').substring(0, 11);
    if (numeric.length <= 10) {
      return numeric.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
    }
    return numeric.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  };

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentTab, setCurrentTab] = useState<'ativos' | 'historico'>('ativos');
  const [editingCredit, setEditingCredit] = useState<any>(null);
  const [voucherCredit, setVoucherCredit] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    cpf: '',
    amount: '',
    notes: '',
    receipt_url: ''
  });
  const [isUploading, setIsUploading] = useState(false);
  const [reactivatingCredit, setReactivatingCredit] = useState<any>(null);
  const [reactivateDate, setReactivateDate] = useState('');

  const handleOpenReactivate = async (cred: any) => {
    setReactivatingCredit(cred);
    try {
      const refMatch = cred.notes?.match(/\\[REF:(.+?)\\]/);
      let orderId = refMatch ? refMatch[1] : null;
      
      if (!orderId) {
         const oldMatch = cred.notes?.match(/pedido #([a-zA-Z0-9]{8})/);
         orderId = oldMatch ? oldMatch[1] : null;
      }
      
      if (orderId) {
         const { data: orders } = await supabase.from('orders').select('visit_date').ilike('id', `${orderId}%`);
         if (orders && orders.length > 0 && orders[0].visit_date) {
            setReactivateDate(orders[0].visit_date);
         }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleReactivateCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reactivateDate || !reactivatingCredit) return;
    
    setLoading(true);
    try {
      const refMatch = reactivatingCredit.notes?.match(/\\[REF:(.+?)\\]/);
      let orderIdStr = refMatch ? refMatch[1] : null;
      
      if (!orderIdStr) {
         const oldMatch = reactivatingCredit.notes?.match(/pedido #([a-zA-Z0-9]{8})/);
         orderIdStr = oldMatch ? oldMatch[1] : null;
      }
      
      let order: any = null;
      if (orderIdStr) {
         const { data: orders } = await supabase.from('orders').select('*').ilike('id', `${orderIdStr}%`);
         if (orders && orders.length > 0) order = orders[0];
      }
      
      if (!order) {
        toast({ title: 'Erro', description: 'Não foi possível encontrar o pedido original vinculado a este crédito.', variant: 'destructive' });
        setLoading(false);
        return;
      }
      
      // Update order
      const newNotes = (order.notes || '').replace(' [Convertido em Crédito]', '') + ` [Reativado para ${format(parseISO(reactivateDate), 'dd/MM/yyyy')}]`;
      await supabase.from('orders').update({ visit_date: reactivateDate, status: 'paid', notes: newNotes }).eq('id', order.id);
      
      // Update booking
      if (order.booking_id) {
         await supabase.from('bookings').update({ visit_date: reactivateDate, status: 'paid' }).eq('id', order.booking_id);
      }
      
      // Update related items (kiosks and quads)
      const { data: items } = await supabase.from('order_items').select('id').eq('order_id', order.id);
      if (items && items.length > 0) {
         const itemIds = items.map((i: any) => i.id);
         await supabase.from('kiosk_reservations').update({ reservation_date: reactivateDate }).in('order_item_id', itemIds);
         await supabase.from('quad_reservations').update({ reservation_date: reactivateDate }).in('order_item_id', itemIds);
      }
      
      // Delete the credit
      await supabase.from('internal_credits').delete().eq('id', reactivatingCredit.id);
      
      toast({ title: 'Reserva Reativada!', description: `Reagendada com sucesso para ${format(parseISO(reactivateDate), 'dd/MM/yyyy')}. Para alterar os itens, use a aba de Vendas.` });
      setReactivatingCredit(null);
      setReactivateDate('');
      fetchData();
    } catch(err: any) {
      console.error(err);
      toast({ title: 'Erro ao reativar', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (cred: any) => {
    setEditingCredit(cred);
    setFormData({
      name: cred.customer_name,
      phone: cred.customer_phone || '',
      cpf: cred.customer_cpf || '',
      amount: cred.amount.toString(),
      notes: cred.notes || '',
      receipt_url: cred.receipt_url || ''
    });
    setIsDialogOpen(true);
  };

  const resetForm = () => {
    setIsDialogOpen(false);
    setEditingCredit(null);
    setFormData({ name: '', phone: '', cpf: '', amount: '', notes: '', receipt_url: '' });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('receipts').upload(fileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from('receipts').getPublicUrl(fileName);
      setFormData(prev => ({ ...prev, receipt_url: publicUrl }));
      toast({ title: "Comprovante anexado!" });
    } catch (err: any) {
      toast({ title: "Erro no upload", description: err.message, variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleMarkUsed = async (id: string, amount: number) => {
    if (confirm("Marcar este crédito como totalmente utilizado? Ele será movido para o histórico.")) {
      const { error } = await supabase.from('internal_credits').update({ used_amount: amount }).eq('id', id);
      if (error) {
        toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Crédito atualizado!" });
        fetchData();
      }
    }
  };

  const handleAddNewCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.amount) {
      toast({ title: "Erro", description: "Nome e Valor são obrigatórios.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      // Build payload — only include receipt_url if it has a value
      // This avoids schema cache errors if the column hasn't been migrated yet
      const basePayload: any = {
        customer_name: formData.name,
        customer_phone: formData.phone || null,
        customer_cpf: formData.cpf || null,
        amount: parseFloat(formData.amount),
        notes: formData.notes || null,
      };
      if (formData.receipt_url) {
        basePayload.receipt_url = formData.receipt_url;
      }

      const trySave = async (payload: any) => {
        if (editingCredit) {
          return supabase.from('internal_credits').update(payload).eq('id', editingCredit.id);
        } else {
          return supabase.from('internal_credits').insert(payload);
        }
      };

      let { error } = await trySave(basePayload);

      // If error is about receipt_url column not existing, retry without it
      if (error && error.message?.includes('receipt_url')) {
        const { receipt_url: _omit, ...payloadWithoutReceipt } = basePayload;
        const result = await trySave(payloadWithoutReceipt);
        error = result.error;
        if (!error) {
          toast({ title: "⚠️ Salvo sem comprovante", description: "Execute o SQL de migração no Supabase para habilitar comprovantes.", variant: "destructive" });
        }
      }

      if (error) throw error;

      toast({ title: editingCredit ? "✓ Crédito Atualizado!" : "✓ Crédito Adicionado!", description: editingCredit ? undefined : `R$ ${formData.amount} para ${formData.name}` });
      resetForm();
      fetchData();
    } catch (error: any) {
      toast({ title: "Erro ao processar", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCredit = async (id: string) => {
    if (confirm("Deseja realmente excluir este crédito?")) {
      const { error } = await supabase.from('internal_credits').delete().eq('id', id);
      if (error) {
        toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Crédito excluído" });
        fetchData();
      }
    }
  };

  const handleSendVoucher = async (cred: any) => {
    const notesText = cred.notes ? `\\n\\nMotivo/Obs: ${cred.notes}` : '';
    const text = `Olá ${cred.customer_name}!\\n\\nSeu voucher de crédito no valor de R$ ${cred.amount.toFixed(2)} foi gerado com sucesso no Balneário Lessa.\\n\\nEste crédito pode ser utilizado em sua próxima reserva!${notesText}`;
    
    // Attempt to copy to clipboard
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: "Texto copiado!", description: "O texto do voucher foi copiado para a área de transferência." });
    } catch (e) {
      // Ignore if clipboard fails
    }
    
    // Append [ENVIADO] to notes if not already there
    if (!cred.notes?.includes('[ENVIADO]')) {
      const newNotes = (cred.notes || '') + ' [ENVIADO]';
      await supabase.from('internal_credits').update({ notes: newNotes }).eq('id', cred.id);
      fetchData();
    }
    
    // Open WhatsApp
    const phone = cred.customer_phone?.replace(/\\D/g, '');
    if (phone && phone.length >= 10) {
      window.open(`https://wa.me/55${phone}?text=${encodeURIComponent(text)}`, '_blank');
    }
  };

  const activeCredits = credits.filter(c => (c.used_amount || 0) < c.amount);
  const historyCredits = credits.filter(c => (c.used_amount || 0) >= c.amount);
  const shownCredits = currentTab === 'ativos' ? activeCredits : historyCredits;

  return (
    <div className="bg-white/95 backdrop-blur-md rounded-[2.5rem] p-8 md:p-10 shadow-2xl border-2 border-amber-100/50 animate-in fade-in duration-500">
       <CreditVoucherShareDialog 
         open={!!voucherCredit} 
         onOpenChange={(open) => !open && setVoucherCredit(null)} 
         credit={voucherCredit} 
       />
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
             <h2 className="text-3xl font-black text-amber-950 tracking-tight">Créditos Internos</h2>
             <div className="flex items-center gap-4 mt-2">
                <button 
                  onClick={() => setCurrentTab('ativos')}
                  className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all ${currentTab === 'ativos' ? 'bg-amber-100 text-amber-800 border-2 border-amber-200' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Ativos ({activeCredits.length})
                </button>
                <button 
                  onClick={() => setCurrentTab('historico')}
                  className={`text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl transition-all ${currentTab === 'historico' ? 'bg-slate-100 text-slate-800 border-2 border-slate-200' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  Histórico ({historyCredits.length})
                </button>
             </div>
           
           <Dialog open={!!reactivatingCredit} onOpenChange={(open) => !open && setReactivatingCredit(null)}>
             <DialogContent className="rounded-3xl border-4 border-amber-100 p-0 max-w-sm overflow-hidden bg-white">
                <div className="bg-amber-500 p-6 text-white text-center">
                   <div className="w-12 h-12 bg-white/20 rounded-2xl mx-auto flex items-center justify-center backdrop-blur-sm border border-white/30 mb-3">
                      <CalendarCheck className="w-6 h-6" />
                   </div>
                   <h3 className="text-xl font-black tracking-tight">Reativar Reserva</h3>
                   <p className="text-amber-100 text-xs font-bold uppercase tracking-wider mt-1">Escolha a nova data da visita</p>
                </div>
                <form onSubmit={handleReactivateCredit} className="p-6 space-y-6">
                   <div className="space-y-2">
                     <Label className="text-xs font-black uppercase text-amber-700/60 ml-1 flex items-center gap-1.5">
                       <Calendar className="w-4 h-4" /> Nova Data
                     </Label>
                     <Input 
                       type="date"
                       required
                       min={format(new Date(), 'yyyy-MM-dd')}
                       value={reactivateDate}
                       onChange={e => setReactivateDate(e.target.value)}
                       className="h-14 rounded-2xl border-2 border-amber-100 focus:border-amber-300 bg-slate-50 font-bold"
                     />
                   </div>
                   <div className="flex gap-3">
                     <Button type="button" variant="outline" onClick={() => setReactivatingCredit(null)} className="flex-1 rounded-2xl font-bold h-12 border-2 text-slate-500">Cancelar</Button>
                     <Button type="submit" disabled={loading} className="flex-1 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl font-black h-12 shadow-md">
                       {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar'}
                     </Button>
                   </div>
                </form>
             </DialogContent>
           </Dialog>
           
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={(open) => {
            if (!open) resetForm();
            setIsDialogOpen(open);
          }}>
            <DialogTrigger asChild>
              <Button onClick={() => setEditingCredit(null)} className="bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl h-14 px-8 shadow-lg border-2 border-amber-600 flex items-center gap-3 transition-all hover:scale-105 active:scale-95">
                <Plus className="w-6 h-6" /> NOVO CRÉDITO
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2.5rem] border-4 border-amber-100 shadow-3xl bg-white p-0 overflow-hidden max-w-md">
              <div className="bg-amber-500 p-8 text-white">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/30">
                    {editingCredit ? <Pencil className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="text-xl font-black tracking-tight">{editingCredit ? 'Editar Crédito' : 'Adicionar Crédito'}</h3>
                    <p className="text-amber-100 text-xs font-bold uppercase tracking-wider">{editingCredit ? 'Atualize os dados do cliente' : 'Preencha os dados do cliente'}</p>
                  </div>
                </div>
              </div>

              <form onSubmit={handleAddNewCredit} className="p-8 space-y-5">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-amber-700/60 ml-1 flex items-center gap-1.5">
                    <User className="w-3 h-3" /> Nome do Cliente
                  </Label>
                  <Input 
                    required
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    placeholder="Nome completo"
                    className="h-12 rounded-xl border-2 border-amber-50 focus:border-amber-200 bg-slate-50 font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-amber-700/60 ml-1 flex items-center gap-1.5">
                      <Phone className="w-3 h-3" /> Telefone
                    </Label>
                    <Input 
                      value={formData.phone}
                      onChange={e => setFormData({...formData, phone: formatPhone(e.target.value)})}
                      placeholder="(00) 00000-0000"
                      className="h-12 rounded-xl border-2 border-amber-50 focus:border-amber-200 bg-slate-50 font-bold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10px] font-black uppercase text-amber-700/60 ml-1 flex items-center gap-1.5">
                      <FileText className="w-3 h-3" /> CPF (Opcional)
                    </Label>
                    <Input 
                      value={formData.cpf}
                      onChange={e => setFormData({...formData, cpf: formatCPF(e.target.value)})}
                      placeholder="000.000.000-00"
                      className="h-12 rounded-xl border-2 border-amber-50 focus:border-amber-200 bg-slate-50 font-bold"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-amber-700/60 ml-1 flex items-center gap-1.5">
                    <FileText className="w-3 h-3" /> Motivo / Observação
                  </Label>
                  <Input 
                    value={formData.notes}
                    onChange={e => setFormData({...formData, notes: e.target.value})}
                    placeholder="Ex: Reagendamento da reserva #123"
                    className="h-12 rounded-xl border-2 border-amber-50 focus:border-amber-200 bg-slate-50 font-bold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] font-black uppercase text-amber-700/60 ml-1 flex items-center gap-1.5">
                    <DollarSign className="w-3 h-3" /> Valor do Crédito (R$)
                  </Label>
                  <Input 
                    required
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={e => setFormData({...formData, amount: e.target.value})}
                    placeholder="0.00"
                    className="h-14 rounded-xl border-2 border-amber-100 focus:border-amber-500 bg-amber-50 text-xl font-black text-amber-900"
                  />
                </div>

                <div className="space-y-1.5 pt-2 border-t border-amber-50">
                  <Label className="text-[10px] font-black uppercase text-amber-700/60 ml-1 flex items-center gap-1.5">
                    <Upload className="w-3 h-3" /> Comprovante (Opcional)
                  </Label>
                  <div className="flex items-center gap-3">
                    <Input 
                      type="file" 
                      accept="image/*,.pdf"
                      onChange={handleFileUpload}
                      disabled={isUploading}
                      className="h-10 rounded-xl focus:border-amber-200 bg-slate-50 font-bold file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-[10px] file:font-black file:bg-amber-100 file:text-amber-700 hover:file:bg-amber-200 cursor-pointer"
                    />
                    {isUploading && <Loader2 className="w-5 h-5 animate-spin text-amber-500" />}
                  </div>
                  {formData.receipt_url && (
                    <a href={formData.receipt_url} target="_blank" rel="noreferrer" className="text-[10px] font-black text-blue-600 hover:underline flex items-center gap-1 mt-1">
                      <FileText className="w-3 h-3" /> Visualizar comprovante salvo
                    </a>
                  )}
                </div>

                <DialogFooter className="pt-4 gap-3">
                  <Button 
                    type="button"
                    variant="ghost" 
                    className="flex-1 h-12 rounded-xl font-black text-slate-400 uppercase text-xs"
                    onClick={resetForm}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-black h-12 rounded-xl text-xs uppercase shadow-lg shadow-amber-900/20"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : editingCredit ? 'Salvar Alterações' : 'Confirmar Crédito'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
       </div>

       <div className="min-h-[400px]">
          {/* Desktop Table View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left">
               <thead className="bg-amber-50/50 text-[10px] font-black uppercase text-amber-800 tracking-widest border-b-2 border-amber-100">
                  <tr>
                     <th className="px-6 py-5">Cliente</th>
                     <th className="px-6 py-5">Contato / CPF</th>
                     <th className="px-6 py-5">Saldo Total</th>
                     <th className="px-6 py-5">Utilizado</th>
                     <th className="px-6 py-5 text-right">Ações</th>
                  </tr>
               </thead>
                <tbody className="divide-y divide-amber-50">
                  {shownCredits.length === 0 ? (
                    <tr><td colSpan={5} className="py-20 text-center text-slate-400 font-bold italic">{currentTab === 'ativos' ? 'Nenhum crédito ativo.' : 'Histórico vazio.'}</td></tr>
                  ) : shownCredits.map(cred => (
                     <tr key={cred.id} className="hover:bg-amber-50/30 transition-colors">
                        <td className="px-6 py-5">
                           <div className="font-bold text-slate-900">{cred.customer_name}</div>
                           {cred.notes && (
                             <div className="text-[10px] text-amber-600 font-bold italic mt-1 break-words max-w-sm">
                               {cred.notes.replace('[ENVIADO]', '')}
                               {cred.notes.includes('[ENVIADO]') && (
                                 <Badge variant="outline" className="ml-2 text-[8px] bg-green-50 text-green-600 border-green-200 uppercase">Enviado</Badge>
                               )}
                             </div>
                           )}
                        </td>
                        <td className="px-6 py-5">
                           <div className="flex flex-col text-xs font-bold text-slate-500">
                              <span>{cred.customer_phone ? formatPhone(cred.customer_phone) : "-"}</span>
                              <span>{cred.customer_cpf ? formatCPF(cred.customer_cpf) : "-"}</span>
                           </div>
                        </td>
                        <td className="px-6 py-5 font-black text-amber-600 text-lg">
                           {formatCurrency(cred.amount)}
                        </td>
                        <td className="px-6 py-5 font-bold text-slate-400">
                           {formatCurrency(cred.used_amount || 0)}
                           {(cred.used_amount || 0) >= cred.amount && (
                             <Badge variant="outline" className="ml-2 text-[8px] bg-slate-50 border-slate-200">UTILIZADO</Badge>
                           )}
                        </td>
                        <td className="px-6 py-5 text-right">
                           <div className="flex items-center justify-end gap-1">
                              {cred.receipt_url && (
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-9 w-9 text-blue-600 hover:bg-blue-50 hover:text-blue-700 rounded-xl"
                                    onClick={() => window.open(cred.receipt_url, '_blank')}
                                    title="Ver Comprovante"
                                  >
                                    <FileText className="w-4 h-4" />
                                  </Button>
                              )}
                              {currentTab === 'ativos' && (
                                <>
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-9 w-9 text-blue-600 hover:bg-blue-50 hover:text-blue-700 rounded-xl"
                                    onClick={() => handleSendVoucher(cred)}
                                    title="Enviar Link WhatsApp"
                                  >
                                    <Share2 className="w-4 h-4" />
                                  </Button>
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-9 w-9 text-amber-500 hover:bg-amber-50 hover:text-amber-600 rounded-xl"
                                    onClick={() => {
                                      if (typeof (window as any).setVoucherCredit === 'function') {
                                         (window as any).setVoucherCredit(cred);
                                      } else if (typeof setVoucherCredit === 'function') {
                                         // @ts-ignore
                                         setVoucherCredit(cred);
                                      }
                                    }}
                                    title="Gerar Voucher de Crédito"
                                  >
                                    <FileText className="w-4 h-4" />
                                  </Button>
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-9 w-9 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl"
                                    onClick={() => handleMarkUsed(cred.id, cred.amount)}
                                    title="Marcar como usado"
                                  >
                                    <CheckCircle2 className="w-5 h-5" />
                                  </Button>
                                  {(cred.notes || '').includes('pedido #') && (
                                    <Button 
                                      size="icon" 
                                      variant="ghost" 
                                      className="h-9 w-9 text-amber-600 hover:bg-amber-50 hover:text-amber-700 rounded-xl"
                                      onClick={() => handleOpenReactivate(cred)}
                                      title="Reagendar e Reativar Reserva"
                                    >
                                      <CalendarCheck className="w-5 h-5" />
                                    </Button>
                                  )}
                                  <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-9 w-9 text-blue-600 hover:bg-blue-50 hover:text-blue-700 rounded-xl"
                                    onClick={() => startEditing(cred)}
                                    title="Editar dados"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                              <Button 
                                size="icon" 
                                variant="ghost" 
                                className="h-9 w-9 text-red-500 hover:bg-red-100 hover:text-red-700 rounded-xl transition-colors" 
                                onClick={() => handleDeleteCredit(cred.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                           </div>
                        </td>
                     </tr>
                  ))}
                </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="md:hidden space-y-4">
            {shownCredits.length === 0 ? (
               <div className="py-20 text-center text-slate-400 font-bold italic">{currentTab === 'ativos' ? 'Nenhum crédito ativo.' : 'Histórico vazio.'}</div>
            ) : (
              shownCredits.map(cred => (
                <div key={cred.id} className="bg-amber-50/30 rounded-3xl p-5 border-2 border-amber-50 space-y-4 shadow-sm">
                   <div className="flex justify-between items-start">
                      <div className="space-y-1">
                         <div className="font-black text-slate-900 uppercase tracking-tight leading-none">{cred.customer_name}</div>
                         <div className="flex flex-col text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">
                            <span>{cred.customer_phone ? formatPhone(cred.customer_phone) : "Sem Telefone"}</span>
                            {cred.customer_cpf && <span>{formatCPF(cred.customer_cpf)}</span>}
                         </div>
                      </div>
                      <div className="text-right">
                         <div className="text-[9px] font-black text-amber-700 uppercase tracking-widest">Saldo</div>
                         <div className="font-black text-amber-600 text-lg">{formatCurrency(cred.amount)}</div>
                      </div>
                   </div>

                   {cred.notes && (
                      <div className="bg-white/60 p-3 rounded-xl border border-amber-100">
                         <div className="text-[9px] font-black text-amber-800/50 uppercase tracking-widest mb-1 flex justify-between items-center">
                            Observação
                            {cred.notes.includes('[ENVIADO]') && (
                               <Badge variant="outline" className="text-[8px] bg-green-50 text-green-600 border-green-200">Enviado</Badge>
                            )}
                         </div>
                         <div className="text-[10px] text-amber-900 font-bold italic break-words">{cred.notes.replace('[ENVIADO]', '')}</div>
                      </div>
                   )}

                   <div className="flex items-center justify-between pt-2 border-t border-amber-100/50">
                      <div className="flex items-center gap-2">
                         {cred.receipt_url && (
                            <Button size="icon" variant="ghost" className="h-10 w-10 text-blue-600 bg-white shadow-sm rounded-xl" onClick={() => window.open(cred.receipt_url, '_blank')}><FileText className="w-4 h-4" /></Button>
                         )}
                         <Button size="icon" variant="ghost" className="h-10 w-10 text-red-500 bg-white shadow-sm rounded-xl" onClick={() => handleDeleteCredit(cred.id)}><Trash2 className="w-4 h-4" /></Button>
                         {currentTab === 'ativos' && (
                            <Button size="icon" variant="ghost" className="h-10 w-10 text-blue-600 bg-white shadow-sm rounded-xl" onClick={() => handleSendVoucher(cred)}><Share2 className="w-4 h-4" /></Button>
                         )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                         {currentTab === 'ativos' ? (
                            <>
                               <Button size="icon" variant="ghost" className="h-10 w-10 text-amber-500 bg-white shadow-sm rounded-xl" onClick={() => {
                                    if (typeof (window as any).setVoucherCredit === 'function') {
                                       (window as any).setVoucherCredit(cred);
                                    } else if (typeof setVoucherCredit === 'function') {
                                       // @ts-ignore
                                       setVoucherCredit(cred);
                                    }
                               }}><FileText className="w-4 h-4" /></Button>
                               <Button size="icon" variant="ghost" className="h-10 w-10 text-amber-600 bg-white shadow-sm rounded-xl" onClick={() => handleOpenReactivate(cred)}><CalendarCheck className="w-4 h-4" /></Button>
                               <Button size="icon" variant="ghost" className="h-10 w-10 text-blue-600 bg-white shadow-sm rounded-xl" onClick={() => startEditing(cred)}><Pencil className="w-4 h-4" /></Button>
                               <Button 
                                 className="h-10 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl text-[10px] uppercase shadow-md shadow-emerald-900/10"
                                 onClick={() => handleMarkUsed(cred.id, cred.amount)}
                               >
                                 <CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Utilizar
                               </Button>
                            </>
                         ) : (
                            <Badge className="bg-slate-200 text-slate-700 font-black px-3 py-1 text-[9px] uppercase tracking-widest">Utilizado</Badge>
                         )}
                      </div>
                   </div>
                </div>
              ))
            )}
          </div>
       </div>
    </div>
  );
}
