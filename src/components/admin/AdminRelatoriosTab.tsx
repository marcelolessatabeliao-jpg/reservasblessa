import React, { useState, useMemo } from 'react';
import { 
  format, 
  parseISO, 
  isWithinInterval, 
  startOfDay, 
  endOfDay, 
  subDays, 
  startOfMonth, 
  endOfMonth,
} from 'date-fns';
import { 
  FileSpreadsheet, 
  Calendar as CalendarIcon, 
  ShoppingBag, 
  DollarSign, 
  Filter, 
  Clock, 
  TrendingUp, 
  Tags, 
  CalendarRange,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { formatCurrency } from '@/lib/booking-types';
import { exportMultiSheetExcel } from '@/utils/export-utils';
import { cn } from "@/lib/utils";

interface AdminRelatoriosTabProps {
  orders: any[];
}

// Helper to categorize products dynamically based on their names/IDs
const getProductCategory = (productName: string, productId: string) => {
  const name = `${productName} ${productId}`.toLowerCase();
  if (name.includes('quiosque')) return 'Quiosque';
  if (name.includes('quadriciclo') || name.includes('quad')) return 'Quadriciclo';
  if (
    name.includes('adulto') || 
    name.includes('solidario') || 
    name.includes('solidário') || 
    name.includes('professor') || 
    name.includes('estudante') || 
    name.includes('servidor') || 
    name.includes('assinante') || 
    name.includes('crianca') || 
    name.includes('criança') || 
    name.includes('idoso') || 
    name.includes('pcd') || 
    name.includes('aniversariante') || 
    name.includes('entrada') || 
    name.includes('kids') || 
    name.includes('ingresso')
  ) return 'Entrada / Ingresso';
  return 'Outros';
};

const MONTHS = [
  { value: '01', label: 'Janeiro' },
  { value: '02', label: 'Fevereiro' },
  { value: '03', label: 'Março' },
  { value: '04', label: 'Abril' },
  { value: '05', label: 'Maio' },
  { value: '06', label: 'Junho' },
  { value: '07', label: 'Julho' },
  { value: '08', label: 'Agosto' },
  { value: '09', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' }
];

export function AdminRelatoriosTab({ orders = [] }: AdminRelatoriosTabProps) {
  const [dateBasis, setDateBasis] = useState<'compra' | 'visita'>('compra');
  const [statusFilter, setStatusFilter] = useState<'paid_only' | 'all' | 'pending' | 'cancelled'>('paid_only');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [productFilter, setProductFilter] = useState<string>('all');
  
  // Date states
  const [periodType, setPeriodType] = useState<'shortcuts' | 'specific_month' | 'custom'>('shortcuts');
  const [shortcutPeriod, setShortcutPeriod] = useState<string>('este_mes');
  
  const currentYearStr = new Date().getFullYear().toString();
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'MM'));
  const [selectedYear, setSelectedYear] = useState<string>(currentYearStr);
  
  const [startDate, setStartDate] = useState<Date | undefined>(subDays(new Date(), 30));
  const [endDate, setEndDate] = useState<Date | undefined>(new Date());

  // Dynamic products scanned from database
  const allProducts = useMemo(() => {
    const productsMap = new Map<string, { name: string; category: string }>();
    orders.forEach(order => {
      order.order_items?.forEach((item: any) => {
        const name = item.product_name || item.product_id || 'Produto Geral';
        const category = getProductCategory(item.product_name || '', item.product_id || '');
        productsMap.set(name, { name, category });
      });
    });
    return Array.from(productsMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [orders]);

  // Filtered specific products based on the category filter
  const filteredProductsSelect = useMemo(() => {
    if (categoryFilter === 'all') return allProducts;
    return allProducts.filter(p => p.category === categoryFilter);
  }, [allProducts, categoryFilter]);

  // Compute start/end dates based on chosen period type & selections
  const dateRange = useMemo(() => {
    const now = new Date();
    let start = startOfDay(now);
    let end = endOfDay(now);

    if (periodType === 'shortcuts') {
      if (shortcutPeriod === 'hoje') {
        start = startOfDay(now);
        end = endOfDay(now);
      } else if (shortcutPeriod === 'ontem') {
        const yesterday = subDays(now, 1);
        start = startOfDay(yesterday);
        end = endOfDay(yesterday);
      } else if (shortcutPeriod === 'ultimos_7') {
        start = startOfDay(subDays(now, 6));
        end = endOfDay(now);
      } else if (shortcutPeriod === 'ultimos_30') {
        start = startOfDay(subDays(now, 29));
        end = endOfDay(now);
      } else if (shortcutPeriod === 'este_mes') {
        start = startOfMonth(now);
        end = endOfMonth(now);
      } else if (shortcutPeriod === 'mes_passado') {
        const firstOfThisMonth = startOfMonth(now);
        const lastMonthDate = subDays(firstOfThisMonth, 5);
        start = startOfMonth(lastMonthDate);
        end = endOfMonth(lastMonthDate);
      }
    } else if (periodType === 'specific_month') {
      const monthStr = `${selectedYear}-${selectedMonth}-01`;
      try {
        const parsed = parseISO(monthStr);
        start = startOfMonth(parsed);
        end = endOfMonth(parsed);
      } catch (e) {
        start = startOfMonth(now);
        end = endOfMonth(now);
      }
    } else {
      start = startDate ? startOfDay(startDate) : startOfDay(now);
      end = endDate ? endOfDay(endDate) : endOfDay(now);
    }

    return { start, end };
  }, [periodType, shortcutPeriod, selectedMonth, selectedYear, startDate, endDate]);

  // Filter all items
  const filteredItems = useMemo(() => {
    const items: any[] = [];

    orders.forEach(order => {
      const status = (order.status || '').toLowerCase();
      const isPaid = ['paid', 'pago', 'confirmed', 'checked-in', 'completed'].includes(status);
      const isPending = ['pending', 'pendente', 'awaiting_payment', 'waiting_local', 'waiting_confirmation'].includes(status);
      const isCancelled = ['cancelled', 'cancelado', 'canceled'].includes(status);

      if (statusFilter === 'paid_only' && !isPaid) return;
      if (statusFilter === 'pending' && !isPending) return;
      if (statusFilter === 'cancelled' && !isCancelled) return;

      const dateToCompareStr = dateBasis === 'compra' ? order.created_at : (order.visit_date || order.created_at);
      if (!dateToCompareStr) return;
      
      const dateToCompare = parseISO(dateToCompareStr);

      if (!isWithinInterval(dateToCompare, { start: dateRange.start, end: dateRange.end })) return;

      order.order_items?.forEach((item: any) => {
        const productName = item.product_name || item.product_id || 'Produto Geral';
        const category = getProductCategory(item.product_name || '', item.product_id || '');

        if (categoryFilter !== 'all' && category !== categoryFilter) return;
        if (productFilter !== 'all' && productName !== productFilter) return;

        items.push({
          orderId: order.id,
          confirmationCode: order.confirmation_code || order.id.slice(0, 8),
          orderDate: order.created_at,
          visitDate: order.visit_date || order.created_at.split('T')[0],
          customerName: order.customer_name || 'Cliente Geral',
          customerPhone: order.customer_phone || order.phone || 'Sem Telefone',
          customerCpf: order.customer_cpf || order.cpf || 'Sem CPF',
          productId: item.product_id,
          productName,
          category,
          quantity: item.quantity || 1,
          unitPrice: item.unit_price || 0,
          totalPrice: (item.quantity || 1) * (item.unit_price || 0),
          orderStatus: order.status,
          paymentMethod: order.payments?.[0]?.payment_method || 'PIX',
        });
      });
    });

    return items;
  }, [orders, dateBasis, statusFilter, categoryFilter, productFilter, dateRange]);

  // Statistics summaries
  const totalRevenue = useMemo(() => {
    return filteredItems.reduce((acc, curr) => acc + curr.totalPrice, 0);
  }, [filteredItems]);

  const totalItemsSold = useMemo(() => {
    return filteredItems.reduce((acc, curr) => acc + curr.quantity, 0);
  }, [filteredItems]);

  const totalOrdersCount = useMemo(() => {
    const orderIds = new Set(filteredItems.map(item => item.orderId));
    return orderIds.size;
  }, [filteredItems]);

  const topProduct = useMemo(() => {
    if (filteredItems.length === 0) return { name: 'Nenhum', qty: 0 };
    const map = new Map<string, number>();
    filteredItems.forEach(item => {
      map.set(item.productName, (map.get(item.productName) || 0) + item.quantity);
    });
    let maxName = '';
    let maxQty = 0;
    map.forEach((qty, name) => {
      if (qty > maxQty) {
        maxQty = qty;
        maxName = name;
      }
    });
    return { name: maxName, qty: maxQty };
  }, [filteredItems]);

  // Excel multi-sheet export
  const handleExcelExport = () => {
    if (filteredItems.length === 0) return;

    const periodStr = periodType === 'shortcuts' 
      ? shortcutPeriod.replace('_', ' ').toUpperCase()
      : periodType === 'specific_month'
      ? `${MONTHS.find(m => m.value === selectedMonth)?.label} / ${selectedYear}`
      : `${format(dateRange.start, 'dd/MM/yyyy')} até ${format(dateRange.end, 'dd/MM/yyyy')}`;

    // Sheet 1: Resumo Geral
    const summaryData = [
      { 'Métrica de Vendas': 'Período do Relatório', 'Valor Consolidado': periodStr },
      { 'Métrica de Vendas': 'Base de Data Utilizada', 'Valor Consolidado': dateBasis === 'compra' ? 'Data de Compra (created_at)' : 'Data de Visita (visit_date)' },
      { 'Métrica de Vendas': 'Filtro por Categoria', 'Valor Consolidado': categoryFilter === 'all' ? 'Todas as Categorias' : categoryFilter },
      { 'Métrica de Vendas': 'Filtro por Produto', 'Valor Consolidado': productFilter === 'all' ? 'Todos os Produtos' : productFilter },
      { 'Métrica de Vendas': 'Status de Pedido Selecionado', 'Valor Consolidado': statusFilter === 'paid_only' ? 'Apenas Pagos/Confirmados' : statusFilter === 'all' ? 'Todos os Status' : statusFilter === 'pending' ? 'Apenas Pendentes' : 'Apenas Cancelados' },
      { 'Métrica de Vendas': 'Faturamento Acumulado', 'Valor Consolidado': formatCurrency(totalRevenue) },
      { 'Métrica de Vendas': 'Quantidade de Pedidos', 'Valor Consolidado': totalOrdersCount },
      { 'Métrica de Vendas': 'Itens Totais Vendidos', 'Valor Consolidado': `${totalItemsSold} unidades` },
      { 'Métrica de Vendas': 'Produto Campeão de Vendas', 'Valor Consolidado': `${topProduct.name} (${topProduct.qty} un)` },
      { 'Métrica de Vendas': 'Data de Emissão do Relatório', 'Valor Consolidado': format(new Date(), 'dd/MM/yyyy HH:mm:ss') }
    ];

    // Compute sales by category
    const categorySummary: Record<string, { qty: number, total: number }> = {};
    filteredItems.forEach(item => {
      if (!categorySummary[item.category]) {
        categorySummary[item.category] = { qty: 0, total: 0 };
      }
      categorySummary[item.category].qty += item.quantity;
      categorySummary[item.category].total += item.totalPrice;
    });

    const categoryRows = Object.entries(categorySummary).map(([cat, val]) => ({
      'Categoria': cat,
      'Quantidade Vendida': `${val.qty} un`,
      'Faturamento Total (R$)': formatCurrency(val.total)
    }));

    // Sheet 2: Itens Detalhados
    const detailedData = filteredItems.map((item, index) => ({
      'Nº': index + 1,
      'ID do Pedido': item.orderId.slice(0, 8).toUpperCase(),
      'Cód. Confirmação': item.confirmationCode,
      'Data da Compra': format(parseISO(item.orderDate), 'dd/MM/yyyy HH:mm'),
      'Data da Visita': format(parseISO(item.visitDate + 'T00:00:00'), 'dd/MM/yyyy'),
      'Nome do Cliente': item.customerName,
      'Telefone': item.customerPhone,
      'CPF': item.customerCpf,
      'Categoria': item.category,
      'Produto': item.productName,
      'Qtd': item.quantity,
      'Valor Unitário': item.unitPrice,
      'Valor Total': item.totalPrice,
      'Status': item.orderStatus.toUpperCase(),
      'Forma de Pagamento': item.paymentMethod.toUpperCase()
    }));

    const sheets = [
      { name: 'Resumo Geral', data: summaryData },
      { name: 'Desempenho por Categoria', data: categoryRows },
      { name: 'Vendas Detalhadas', data: detailedData }
    ];

    const fileName = `relatorio_vendas_lessa_${format(new Date(), 'yyyy-MM-dd')}`;
    exportMultiSheetExcel(sheets, fileName);
  };

  return (
    <div className="bg-white/95 backdrop-blur-md rounded-[2.5rem] p-6 md:p-10 shadow-2xl border-2 border-emerald-100/50 animate-in fade-in duration-500 space-y-8">
      
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-emerald-50 pb-6">
        <div>
          <h2 className="text-3xl font-black text-emerald-950 tracking-tight">Filtros & Relatórios Financeiros</h2>
          <p className="text-emerald-600 font-bold text-xs uppercase tracking-widest mt-1">Extraia relatórios em Excel de forma rápida e customizada</p>
        </div>
        <Button 
          onClick={handleExcelExport}
          disabled={filteredItems.length === 0}
          className="rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white font-black h-12 px-6 shadow-lg border-2 border-emerald-700/80 active:scale-95 transition-all flex items-center gap-2.5 disabled:opacity-50 disabled:pointer-events-none"
        >
          <FileSpreadsheet className="w-5 h-5 text-white" />
          EXPORTAR PARA EXCEL
        </Button>
      </div>

      {/* Filter Matrix Card */}
      <div className="bg-emerald-50/20 rounded-3xl p-6 md:p-8 border border-emerald-100/50 grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Date Basis & Status */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-wider text-emerald-900">Basear Filtro de Data em</Label>
            <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
              <button
                onClick={() => setDateBasis('compra')}
                className={cn(
                  "py-2 px-3 text-[10px] font-black uppercase rounded-lg transition-all",
                  dateBasis === 'compra' ? "bg-white text-emerald-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                )}
              >
                Compra
              </button>
              <button
                onClick={() => setDateBasis('visita')}
                className={cn(
                  "py-2 px-3 text-[10px] font-black uppercase rounded-lg transition-all",
                  dateBasis === 'visita' ? "bg-white text-emerald-900 shadow-sm" : "text-slate-500 hover:text-slate-900"
                )}
              >
                Visita
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-wider text-emerald-900">Status dos Pedidos</Label>
            <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
              <SelectTrigger className="rounded-xl border-emerald-100 bg-white h-11 text-xs font-bold text-emerald-950">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-emerald-100">
                <SelectItem value="paid_only" className="text-xs font-bold">Apenas Confirmados/Pagos</SelectItem>
                <SelectItem value="all" className="text-xs font-bold">Todos os Status</SelectItem>
                <SelectItem value="pending" className="text-xs font-bold text-amber-600">Apenas Pendentes</SelectItem>
                <SelectItem value="cancelled" className="text-xs font-bold text-red-500">Apenas Cancelados</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Product Category & Specific Product Filters */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-wider text-emerald-900">Categoria do Produto</Label>
            <Select value={categoryFilter} onValueChange={(val) => { setCategoryFilter(val); setProductFilter('all'); }}>
              <SelectTrigger className="rounded-xl border-emerald-100 bg-white h-11 text-xs font-bold text-emerald-950">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-emerald-100">
                <SelectItem value="all" className="text-xs font-bold">Todas as Categorias</SelectItem>
                <SelectItem value="Entrada / Ingresso" className="text-xs font-bold">Entradas / Ingressos</SelectItem>
                <SelectItem value="Quiosque" className="text-xs font-bold">Quiosques</SelectItem>
                <SelectItem value="Quadriciclo" className="text-xs font-bold">Quadriciclos</SelectItem>
                <SelectItem value="Outros" className="text-xs font-bold">Outros</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-wider text-emerald-900">Produto Específico</Label>
            <Select value={productFilter} onValueChange={(val) => setProductFilter(val)}>
              <SelectTrigger className="rounded-xl border-emerald-100 bg-white h-11 text-xs font-bold text-emerald-950">
                <SelectValue placeholder="Todos os Produtos" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-emerald-100 max-h-[300px]">
                <SelectItem value="all" className="text-xs font-bold">Todos os Produtos</SelectItem>
                {filteredProductsSelect.map((prod, idx) => (
                  <SelectItem key={idx} value={prod.name} className="text-xs font-bold">
                    {prod.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Period Selection Type */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase tracking-wider text-emerald-900">Tipo de Período</Label>
            <Select value={periodType} onValueChange={(val: any) => setPeriodType(val)}>
              <SelectTrigger className="rounded-xl border-emerald-100 bg-white h-11 text-xs font-bold text-emerald-950">
                <SelectValue placeholder="Tipo de Período" />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-emerald-100">
                <SelectItem value="shortcuts" className="text-xs font-bold">Atalhos Rápidos</SelectItem>
                <SelectItem value="specific_month" className="text-xs font-bold">Mês Específico</SelectItem>
                <SelectItem value="custom" className="text-xs font-bold">Intervalo Personalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Conditional rendering of parameters based on Type */}
          {periodType === 'shortcuts' && (
            <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <Label className="text-[10px] font-black uppercase tracking-wider text-emerald-900">Período de Vendas</Label>
              <Select value={shortcutPeriod} onValueChange={setShortcutPeriod}>
                <SelectTrigger className="rounded-xl border-emerald-100 bg-white h-11 text-xs font-bold text-emerald-950">
                  <SelectValue placeholder="Atalhos" />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-emerald-100">
                  <SelectItem value="hoje" className="text-xs font-bold">Hoje</SelectItem>
                  <SelectItem value="ontem" className="text-xs font-bold">Ontem</SelectItem>
                  <SelectItem value="ultimos_7" className="text-xs font-bold">Últimos 7 Dias</SelectItem>
                  <SelectItem value="ultimos_30" className="text-xs font-bold">Últimos 30 Dias</SelectItem>
                  <SelectItem value="este_mes" className="text-xs font-bold">Este Mês</SelectItem>
                  <SelectItem value="mes_passado" className="text-xs font-bold">Mês Passado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {periodType === 'specific_month' && (
            <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-wider text-emerald-900">Mês</Label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="rounded-xl border-emerald-100 bg-white h-11 text-xs font-bold text-emerald-950">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-emerald-100 max-h-[200px]">
                    {MONTHS.map(m => (
                      <SelectItem key={m.value} value={m.value} className="text-xs font-bold">{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-wider text-emerald-900">Ano</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="rounded-xl border-emerald-100 bg-white h-11 text-xs font-bold text-emerald-950">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-emerald-100">
                    <SelectItem value="2024" className="text-xs font-bold">2024</SelectItem>
                    <SelectItem value="2025" className="text-xs font-bold">2025</SelectItem>
                    <SelectItem value="2026" className="text-xs font-bold">2026</SelectItem>
                    <SelectItem value="2027" className="text-xs font-bold">2027</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {periodType === 'custom' && (
            <div className="grid grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-wider text-emerald-900">De</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full h-11 rounded-xl text-left font-normal border-emerald-100 text-xs px-3 bg-white">
                      <CalendarIcon className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                      {startDate ? format(startDate, 'dd/MM/yy') : <span>Início</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-2xl border-2 border-emerald-100 shadow-2xl">
                    <Calendar
                      mode="single"
                      selected={startDate}
                      onSelect={setStartDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase tracking-wider text-emerald-900">Até</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full h-11 rounded-xl text-left font-normal border-emerald-100 text-xs px-3 bg-white">
                      <CalendarIcon className="mr-1 h-3.5 w-3.5 text-emerald-600" />
                      {endDate ? format(endDate, 'dd/MM/yy') : <span>Fim</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-2xl border-2 border-emerald-100 shadow-2xl">
                    <Calendar
                      mode="single"
                      selected={endDate}
                      onSelect={setEndDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          )}
        </div>

        {/* Selected Summary Metrics quick stats */}
        <div className="bg-emerald-950 text-white rounded-3xl p-5 flex flex-col justify-between shadow-xl relative overflow-hidden border border-emerald-800">
          <div className="absolute right-[-15px] bottom-[-15px] opacity-10">
            <Clock className="w-32 h-32 text-white" />
          </div>
          <div>
            <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400 block mb-1">Período Ativo</span>
            <h4 className="text-sm font-black uppercase text-amber-400 tracking-tight leading-tight">
              {periodType === 'shortcuts' && shortcutPeriod.replace('_', ' ')}
              {periodType === 'specific_month' && `${MONTHS.find(m => m.value === selectedMonth)?.label}/${selectedYear}`}
              {periodType === 'custom' && 'Período Personalizado'}
            </h4>
            <span className="text-[9px] text-emerald-200 mt-2 block font-medium">
              {format(dateRange.start, 'dd/MM/yyyy')} — {format(dateRange.end, 'dd/MM/yyyy')}
            </span>
          </div>
          <div className="border-t border-emerald-800 pt-3 mt-3 flex items-center justify-between">
            <Badge className="bg-emerald-800 text-emerald-300 font-bold uppercase rounded-md text-[8px] tracking-wider px-2 py-0.5 border-0">
              {filteredItems.length} registros
            </Badge>
            <span className="text-[9px] text-emerald-300 font-bold uppercase">
              {dateBasis === 'compra' ? 'Compra' : 'Visita'}
            </span>
          </div>
        </div>

      </div>

      {/* KPI Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        
        <Card className="rounded-[2rem] border-2 border-emerald-100/60 shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-emerald-50/20 to-white overflow-hidden relative group">
          <CardContent className="p-6 md:p-8 flex items-center gap-5">
            <div className="w-14 h-14 bg-emerald-100 rounded-2xl flex items-center justify-center border-2 border-emerald-200 group-hover:scale-110 transition-transform duration-300 shadow-sm">
              <DollarSign className="w-7 h-7 text-emerald-700" />
            </div>
            <div>
              <span className="text-[9px] font-black text-emerald-700/60 uppercase tracking-widest block mb-0.5">Faturamento Total</span>
              <span className="text-2xl font-black text-emerald-950 tracking-tight block leading-none">
                {formatCurrency(totalRevenue)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-2 border-amber-100/60 shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-amber-50/20 to-white overflow-hidden relative group">
          <CardContent className="p-6 md:p-8 flex items-center gap-5">
            <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center border-2 border-amber-200 group-hover:scale-110 transition-transform duration-300 shadow-sm">
              <ShoppingBag className="w-7 h-7 text-amber-700" />
            </div>
            <div>
              <span className="text-[9px] font-black text-amber-700/60 uppercase tracking-widest block mb-0.5">Pedidos Pagos</span>
              <span className="text-2xl font-black text-amber-950 tracking-tight block leading-none">
                {totalOrdersCount}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-2 border-blue-100/60 shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-blue-50/20 to-white overflow-hidden relative group">
          <CardContent className="p-6 md:p-8 flex items-center gap-5">
            <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center border-2 border-blue-200 group-hover:scale-110 transition-transform duration-300 shadow-sm">
              <Tags className="w-7 h-7 text-blue-700" />
            </div>
            <div>
              <span className="text-[9px] font-black text-blue-700/60 uppercase tracking-widest block mb-0.5">Itens Vendidos</span>
              <span className="text-2xl font-black text-blue-950 tracking-tight block leading-none">
                {totalItemsSold}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-2 border-purple-100/60 shadow-md hover:shadow-lg transition-shadow bg-gradient-to-br from-purple-50/20 to-white overflow-hidden relative group">
          <CardContent className="p-6 md:p-8 flex items-center gap-5">
            <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center border-2 border-purple-200 group-hover:scale-110 transition-transform duration-300 shadow-sm">
              <TrendingUp className="w-7 h-7 text-purple-700" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[9px] font-black text-purple-700/60 uppercase tracking-widest block mb-0.5">Destaque de Vendas</span>
              <span className="text-sm font-black text-purple-950 tracking-tight block truncate leading-tight uppercase">
                {topProduct.name}
              </span>
              <span className="text-[9px] font-bold text-purple-600 block mt-0.5">
                {topProduct.qty} unidades vendidas
              </span>
            </div>
          </CardContent>
        </Card>

      </div>

      {/* Table Section */}
      <div className="space-y-4 border-2 border-emerald-50 rounded-[2rem] p-6 bg-slate-50/50 shadow-inner">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-emerald-800" />
            <h3 className="text-sm font-black text-emerald-950 uppercase tracking-wider">Visualização Prévia dos Itens ({filteredItems.length})</h3>
          </div>
          {filteredItems.length > 10 && (
            <span className="text-[9px] font-bold text-slate-400 uppercase">Mostrando últimos lançamentos</span>
          )}
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white max-h-[450px] overflow-y-auto">
          <table className="w-full text-left border-collapse">
            <thead className="bg-slate-50 text-[9px] font-black uppercase text-slate-500 tracking-wider border-b border-slate-200 sticky top-0 z-10">
              <tr>
                <th className="px-5 py-4 bg-slate-50">Data</th>
                <th className="px-5 py-4 bg-slate-50">Visita</th>
                <th className="px-5 py-4 bg-slate-50">Cliente</th>
                <th className="px-5 py-4 bg-slate-50">Categoria</th>
                <th className="px-5 py-4 bg-slate-50">Produto</th>
                <th className="px-5 py-4 bg-slate-50 text-center">Qtd</th>
                <th className="px-5 py-4 bg-slate-50 text-right">Preço Unit.</th>
                <th className="px-5 py-4 bg-slate-50 text-right">Total Item</th>
                <th className="px-5 py-4 bg-slate-50 text-center">Pagamento</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-20 text-center text-slate-400 font-bold italic">
                    Nenhum item de venda atende aos filtros selecionados.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4 font-medium whitespace-nowrap">
                      {format(parseISO(item.orderDate), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-500 whitespace-nowrap">
                      {format(parseISO(item.visitDate + 'T00:00:00'), 'dd/MM/yyyy')}
                    </td>
                    <td className="px-5 py-4 font-bold text-slate-900">
                      <div className="flex flex-col">
                        <span className="uppercase">{item.customerName}</span>
                        <span className="font-mono text-[9px] text-slate-400">#{item.confirmationCode}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <Badge className={cn(
                        "rounded-lg font-black text-[8px] px-2 py-0.5 uppercase tracking-wide border-0 shadow-sm",
                        item.category === 'Quiosque' ? "bg-amber-100 text-amber-900" :
                        item.category === 'Quadriciclo' ? "bg-blue-100 text-blue-900" :
                        item.category === 'Entrada / Ingresso' ? "bg-emerald-100 text-emerald-900" :
                        "bg-slate-100 text-slate-900"
                      )}>
                        {item.category}
                      </Badge>
                    </td>
                    <td className="px-5 py-4 font-medium max-w-[200px] truncate uppercase" title={item.productName}>
                      {item.productName}
                    </td>
                    <td className="px-5 py-4 text-center font-mono font-bold">
                      {item.quantity}
                    </td>
                    <td className="px-5 py-4 text-right font-mono font-bold text-slate-500">
                      {formatCurrency(item.unitPrice)}
                    </td>
                    <td className="px-5 py-4 text-right font-mono font-black text-emerald-600 text-sm">
                      {formatCurrency(item.totalPrice)}
                    </td>
                    <td className="px-5 py-4 text-center">
                      <Badge className="bg-slate-100 text-slate-700 font-bold uppercase rounded-md text-[8px] tracking-wider px-2 py-0.5 border-0">
                        {item.paymentMethod}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
