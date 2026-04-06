import React from 'react';
import { Search, Calendar as CalendarIcon, Filter, RotateCcw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from "@/lib/utils";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AgendaHeaderProps {
  agendaSubTab: 'hoje' | 'futuras' | 'historico';
  setAgendaSubTab: (tab: 'hoje' | 'futuras' | 'historico') => void;
  search: string;
  setSearch: (s: string) => void;
  filterDate: string;
  setFilterDate: (d: string) => void;
  statusFilter: string;
  setStatusFilter: (s: string) => void;
  isAllowedDay: (date: Date) => boolean;
}

export const AgendaHeader: React.FC<AgendaHeaderProps> = ({
  agendaSubTab,
  setAgendaSubTab,
  search,
  setSearch,
  filterDate,
  setFilterDate,
  statusFilter,
  setStatusFilter,
  isAllowedDay,
}) => {
  return (
    <div className="flex flex-row items-center gap-2 bg-emerald-900/5 p-2 rounded-xl border border-emerald-100 shadow-sm w-full mb-6 overflow-x-auto no-scrollbar">
      
      {/* ABAS DE NAVEGAÇÃO PÍLULA */}
      <div className="flex flex-row gap-1 bg-white/60 p-1 rounded-xl shrink-0 shadow-inner border border-white">
        {[
          { key: 'hoje', label: 'Hoje', color: 'bg-emerald-600 text-white shadow-md' },
          { key: 'futuras', label: 'Futuras', color: 'bg-blue-600 text-white shadow-md' },
          { key: 'historico', label: 'Histórico', color: 'bg-slate-700 text-white shadow-md' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => { setAgendaSubTab(t.key as any); setFilterDate(''); }}
            className={cn(
              'px-4 py-2 md:px-6 md:py-2.5 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-wider transition-all duration-300',
              agendaSubTab === t.key ? t.color : 'text-slate-500 hover:bg-white/80'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* BUSCA DE RESERVAS */}
      <div className="flex-1 min-w-[150px] relative group h-10">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-3.5 w-3.5 text-emerald-500 group-focus-within:text-emerald-700 transition-colors" />
        </div>
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="PESQUISAR NOME / CPF / TEL..."
          className="h-full pl-9 pr-4 rounded-lg bg-white border-emerald-100 focus:border-emerald-500 focus:ring-emerald-500/20 text-[10px] font-bold uppercase tracking-wider shadow-sm transition-all"
        />
      </div>

      {/* FILTROS AUXILIARES COMPACTOS */}
      <div className="flex items-center gap-1 shrink-0">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("h-10 px-2 rounded-lg bg-white shadow-sm border border-emerald-100 font-bold text-emerald-900 text-[10px] gap-1", !filterDate && "text-slate-400")}>
              <CalendarIcon className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">{filterDate ? format(parseISO(filterDate), 'dd/MM/yyyy', { locale: ptBR }) : "Data"}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0 rounded-2xl overflow-hidden border-2 border-emerald-100 shadow-2xl" align="end">
            <Calendar mode="single" selected={filterDate ? parseISO(filterDate) : undefined} onSelect={d => setFilterDate(d ? format(d, 'yyyy-MM-dd') : '')} locale={ptBR} disabled={(date) => !isAllowedDay(date)} />
          </PopoverContent>
        </Popover>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-10 px-2 rounded-lg bg-white shadow-sm border border-emerald-100 font-bold text-emerald-900 text-[10px] gap-1 min-w-[80px]">
            <Filter className="w-3.5 h-3.5 text-emerald-500" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent className="rounded-xl border border-emerald-100 shadow-xl">
            <SelectItem value="all" className="text-[10px] font-bold">TODOS</SelectItem>
            <SelectItem value="paid" className="text-[10px] font-bold text-emerald-600">PAGOS</SelectItem>
            <SelectItem value="pending" className="text-[10px] font-bold text-amber-600">PENDENTES</SelectItem>
            <SelectItem value="awaiting_payment" className="text-[10px] font-bold text-blue-600">AGUARDANDO</SelectItem>
            <SelectItem value="cancelled" className="text-[10px] font-bold text-red-600">CANCELADOS</SelectItem>
          </SelectContent>
        </Select>

        {(filterDate || statusFilter !== 'all' || search) && (
          <Button variant="ghost" size="icon" className="h-10 w-10 text-red-500 hover:bg-red-50 rounded-lg" onClick={() => {setFilterDate(''); setStatusFilter('all'); setSearch('');}}>
            <RotateCcw className="w-4 h-4" />
          </Button>
        )}
      </div>
    </div>
  );
};
