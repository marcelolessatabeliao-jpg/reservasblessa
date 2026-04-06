import React, { useState } from 'react';
import { 
  Plus, 
  Trash2,
  User,
  Phone,
  FileText,
  DollarSign,
  Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    cpf: '',
    amount: '',
    notes: ''
  });

  const handleAddNewCredit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.amount) {
      toast({ title: "Erro", description: "Nome e Valor são obrigatórios.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from('internal_credits').insert({
        customer_name: formData.name,
        customer_phone: formData.phone,
        customer_cpf: formData.cpf,
        amount: parseFloat(formData.amount),
        notes: formData.notes
      });
      
      if (error) throw error;

      toast({ title: "✓ Crédito Adicionado!", description: `R$ ${formData.amount} para ${formData.name}` });
      setIsDialogOpen(false);
      setFormData({ name: '', phone: '', cpf: '', amount: '', notes: '' });
      fetchData();
    } catch (error: any) {
      toast({ title: "Erro ao adicionar crédito", description: error.message, variant: "destructive" });
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

  return (
    <div className="bg-white/95 backdrop-blur-md rounded-[2.5rem] p-8 md:p-10 shadow-2xl border-2 border-amber-100/50 animate-in fade-in duration-500">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10">
          <div>
             <h2 className="text-3xl font-black text-amber-950 tracking-tight">Créditos Internos</h2>
             <p className="text-amber-600 font-bold text-xs uppercase tracking-widest mt-1">Saldo em haver para clientes e reagendamentos</p>
          </div>
          
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl h-14 px-8 shadow-lg border-2 border-amber-600 flex items-center gap-3 transition-all hover:scale-105 active:scale-95">
                <Plus className="w-6 h-6" /> NOVO CRÉDITO
              </Button>
            </DialogTrigger>
            <DialogContent className="rounded-[2.5rem] border-4 border-amber-100 shadow-3xl bg-white p-0 overflow-hidden max-w-md">
              <div className="bg-amber-500 p-8 text-white">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-sm border border-white/30">
                    <Plus className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black tracking-tight">Adicionar Crédito</h3>
                    <p className="text-amber-100 text-xs font-bold uppercase tracking-wider">Preencha os dados do cliente</p>
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
                      onChange={e => setFormData({...formData, phone: e.target.value})}
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
                      onChange={e => setFormData({...formData, cpf: e.target.value})}
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

                <DialogFooter className="pt-4 gap-3">
                  <Button 
                    type="button"
                    variant="ghost" 
                    className="flex-1 h-12 rounded-xl font-black text-slate-400 uppercase text-xs"
                    onClick={() => setIsDialogOpen(false)}
                  >
                    Cancelar
                  </Button>
                  <Button 
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-black h-12 rounded-xl text-xs uppercase shadow-lg shadow-amber-900/20"
                  >
                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Confirmar Crédito'}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
       </div>

       <div className="overflow-x-auto min-h-[400px]">
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
                {credits.length === 0 ? (
                  <tr><td colSpan={5} className="py-20 text-center text-slate-400 font-bold italic">Nenhum crédito registrado.</td></tr>
                ) : credits.map(cred => (
                   <tr key={cred.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="px-6 py-5">
                         <div className="font-bold text-slate-900">{cred.customer_name}</div>
                         {cred.notes && <div className="text-[10px] text-amber-600 font-bold italic mt-0.5 line-clamp-1">{cred.notes}</div>}
                      </td>
                      <td className="px-6 py-5">
                         <div className="flex flex-col text-xs font-bold text-slate-500">
                            <span>{cred.customer_phone || "-"}</span>
                            <span>{cred.customer_cpf || "-"}</span>
                         </div>
                      </td>
                      <td className="px-6 py-5 font-black text-amber-600 text-lg">
                         {formatCurrency(cred.amount)}
                      </td>
                      <td className="px-6 py-5 font-bold text-slate-400">
                         {formatCurrency(cred.used_amount || 0)}
                      </td>
                      <td className="px-6 py-5 text-right">
                         <Button size="icon" variant="ghost" className="h-9 w-9 text-red-500 hover:bg-red-50 rounded-xl" onClick={() => handleDeleteCredit(cred.id)}><Trash2 className="w-4.5 h-4.5" /></Button>
                      </td>
                   </tr>
                ))}
             </tbody>
          </table>
       </div>
    </div>
  );
}
