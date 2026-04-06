import React from 'react';
import { 
  Plus, 
  Trash2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  
  const handleAddNewCredit = async () => {
    const name = prompt("Nome do Cliente:");
    const phone = prompt("Telefone:");
    const cpf = prompt("CPF:");
    const amount = prompt("Valor do Crédito (apenas números):");
    
    if (name && amount) {
      const { error } = await supabase.from('internal_credits').insert({
        customer_name: name,
        customer_phone: phone,
        customer_cpf: cpf,
        amount: parseFloat(amount)
      });
      
      if (error) {
        toast({ title: "Erro ao adicionar crédito", description: error.message, variant: "destructive" });
      } else {
        toast({ title: "Crédito Adicionado!" });
        fetchData();
      }
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
          <Button onClick={handleAddNewCredit} className="bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl h-14 px-8 shadow-lg border-2 border-amber-600 flex items-center gap-3">
            <Plus className="w-6 h-6" /> NOVO CRÉDITO
          </Button>
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
                      <td className="px-6 py-5 font-bold text-slate-900">
                         {cred.customer_name}
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
