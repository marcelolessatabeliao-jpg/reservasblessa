import fs from 'fs';

const filePath = 'c:\\Users\\TERMINAL 00\\Desktop\\RESERVA LESSA\\src\\pages\\Admin.tsx';
let content = fs.readFileSync(filePath, 'utf8');

console.log('Original length:', content.length);

const kioskStartMarker = 'const renderKioskTab = () => {';
const quadStartMarker = 'const renderQuadTab = () => {';
const orderStartMarker = 'const renderOrderTab = () => (';

const kStart = content.indexOf(kioskStartMarker);
const qStart = content.indexOf(quadStartMarker);
const oStart = content.indexOf(orderStartMarker);

console.log('Markers:', { kStart, qStart, oStart });

if (kStart === -1 || qStart === -1 || oStart === -1) {
    console.error('Could not find all markers. Aborting.');
    process.exit(1);
}

// 1. Kiosk Section
const kioskReplacement = `const renderKioskTab = () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const allGroups = Object.values(kioskReservations.reduce((acc, curr) => {
      const key = \`\${curr.reservation_date}_\${curr.customer_name || 'Venda'}\`;
      if (!acc[key]) acc[key] = { group_key: key, reservation_date: curr.reservation_date, customer_name: curr.customer_name || (curr as any).bookings?.name || 'Venda', items: [], total_price: 0 };
      acc[key].items.push(curr);
      acc[key].total_price += (curr.price || (KIOSKS.find(k => k.id === Number(curr.kiosk_id))?.price || 75));
      return acc;
    }, {} as Record<string, any>));

    const groupsByTab: Record<string, any[]> = {
      hoje: allGroups.filter((g: any) => g.reservation_date === todayStr),
      futuras: allGroups.filter((g: any) => g.reservation_date > todayStr),
      historico: allGroups.filter((g: any) => g.reservation_date < todayStr),
    };
    const tabGroups = groupsByTab[kioskSubTab];

    const resolveGroup = (group: any) => {
      const dayKiosks = kioskReservations.filter(k => k.reservation_date === group.reservation_date);
      const resolved = group.items.map((r: any) => {
        const bid = r.kiosk_id;
        if (bid === 1 || bid === '1' || bid === 'MAIOR') return KIOSKS.find(k => k.id === 1);
        if (bid === 'MENOR') {
          const menors = dayKiosks.filter(dk => dk.kiosk_id === 'MENOR');
          const idx = menors.findIndex(dk => dk.id === r.id);
          return KIOSKS.find(k => k.id === idx + 2) || { id: 99, name: 'Quiosque Extra', capacity: 'Até 15 pessoas' };
        }
        return KIOSKS.find(k => k.id === Number(bid)) || { id: 99, name: \`Q-\${bid}\`, capacity: 'Até 15 pessoas' };
      });
      const names = resolved.map((k: any) => k?.name.replace('Quiosque ', 'Q-')).join(', ');
      const capacity = resolved.reduce((s: number, k: any) => s + parseInt((k?.capacity || '0').replace(/\\D/g, '') || '15'), 0);
      return { names, capacity };
    };

    const subTabConfig = [
      { key: 'hoje', label: 'Ativos Hoje', count: groupsByTab.hoje.length, color: 'bg-emerald-600 text-white' },
      { key: 'futuras', label: 'Reservas Futuras', count: groupsByTab.futuras.length, color: 'bg-blue-100 text-blue-700' },
      { key: 'historico', label: 'Histórico', count: groupsByTab.historico.length, color: 'bg-slate-100 text-slate-600' },
    ];

    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-xl overflow-hidden">
          <div className="p-6 border-b-2 border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-lg font-bold text-primary">Reservas de Quiosques</h3>
                <p className="text-xs text-muted-foreground">Gerencie todas as reservas por status</p>
              </div>
              <div className="grid grid-cols-2 md:flex gap-2 bg-slate-100 p-1 rounded-2xl w-full md:w-auto">
                {subTabConfig.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setKioskSubTab(t.key as any)}
                    className={cn(
                      'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all',
                      kioskSubTab === t.key ? t.color + ' shadow-md' : 'text-slate-500 hover:text-slate-700'
                    )}
                  >
                    {t.label}
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-black', kioskSubTab === t.key ? 'bg-white/30' : 'bg-slate-200')}>
                      {t.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {/* Mobile Cards View */}
            <div className="md:hidden space-y-4 p-4 bg-slate-50/50">
              {tabGroups.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground/40 font-bold uppercase text-[10px] tracking-widest">Nenhuma reserva</div>
              ) : (
                tabGroups.map((group: any) => {
                  const { names } = resolveGroup(group);
                  const isToday = group.reservation_date === todayStr;
                  return (
                    <div key={group.group_key} className="bg-white rounded-2xl border-2 border-emerald-100 shadow-sm overflow-hidden animate-in slide-in-from-bottom-2 duration-300">
                      <div className={cn("p-4 border-b border-emerald-100 flex justify-between items-center", isToday ? "bg-emerald-50" : "bg-white")}>
                         <div className="flex flex-col">
                            <span className="text-[10px] font-black text-emerald-800/60 uppercase tracking-widest">Data da Visita</span>
                            <span className="font-black text-emerald-900">{format(parseISO(group.reservation_date), 'dd/MM/yyyy')}</span>
                         </div>
                         {isToday && <span className="bg-emerald-600 text-white text-[9px] font-black px-3 py-1 rounded-full uppercase shadow-sm">Hoje</span>}
                      </div>
                      <div className="p-4 space-y-3">
                         <div>
                            <span className="text-[10px] font-black text-emerald-800/60 uppercase tracking-widest block mb-1">Cliente</span>
                            <span className="font-black text-emerald-950 uppercase text-sm block">{group.customer_name}</span>
                            <span className="text-[10px] text-emerald-700 font-bold">{group.items.length} reserva(s) • {formatCurrency(group.total_price)}</span>
                         </div>
                         <div>
                            <span className="text-[10px] font-black text-emerald-800/60 uppercase tracking-widest block mb-1">Quiosques</span>
                            <div className="flex flex-wrap gap-1.5">
                               {names.split(', ').map((n: string, i: number) => (
                                 <span key={i} className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-black border border-emerald-200">{n}</span>
                               ))}
                            </div>
                         </div>
                         <div className="pt-2 flex items-center justify-end gap-2 border-t border-emerald-50">
                            {group.items.some((r: any) => r.receipt_url) && (
                               <Button size="sm" variant="outline" className="h-9 px-3 rounded-xl border-emerald-200 text-emerald-700 font-black text-[10px]" onClick={() => window.open(group.items.find((r: any) => r.receipt_url)?.receipt_url)}>
                                 <FileText className="w-4 h-4 mr-2" /> Recibo
                               </Button>
                            )}
                            <Button size="icon" variant="ghost" className="h-9 w-9 text-blue-600 bg-blue-50 rounded-xl" onClick={() => {setRescheduleData({ type: 'kiosk', group }); setRescheduleDate(parseISO(group.reservation_date));}}><CalendarClock className="w-4 h-4" /></Button>
                            <Button size="icon" variant="ghost" className="h-9 w-9 text-red-500 bg-red-50 rounded-xl" onClick={() => requestDelete(group.items[0], 'kiosk')}><Trash2 className="w-4 h-4" /></Button>
                         </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block">
              {tabGroups.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground/40 font-bold uppercase text-xs tracking-widest">
                  {kioskSubTab === 'hoje' ? 'Nenhuma reserva ativa hoje' : kioskSubTab === 'futuras' ? 'Sem reservas futuras' : 'Sem histórico'}
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-slate-100/80 text-[10px] font-black uppercase text-slate-900 tracking-widest border-b-2 border-emerald-300">
                    <tr>
                      <th className="px-6 py-4">Data</th>
                      <th className="px-6 py-4">Cliente</th>
                      <th className="px-6 py-4">Quiosques / Capacidade</th>
                      <th className="px-6 py-4">Valor</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y-2 divide-emerald-200">
                    {tabGroups.map((group: any) => {
                      const { names } = resolveGroup(group);
                      const isToday = group.reservation_date === todayStr;
                      return (
                        <tr key={group.group_key} className={cn(
                          'border-b-2 border-emerald-200 hover:bg-emerald-100/50 transition-colors',
                          isToday ? 'bg-emerald-50/60' : 'bg-white'
                        )}>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              <span className={cn('font-bold text-sm', isToday ? 'text-emerald-800' : 'text-emerald-900')}>
                                {format(parseISO(group.reservation_date), 'dd/MM/yyyy')}
                              </span>
                              {isToday && <span className="text-[9px] bg-emerald-700 text-white font-black uppercase px-2 py-0.5 rounded-full w-fit">HOJE</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="font-black text-emerald-950 uppercase">{group.customer_name}</span>
                            <div className="text-[10px] text-emerald-950 font-black mt-0.5">{group.items.length} reserva(s)</div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              <Badge className="bg-emerald-100/80 text-emerald-800 border border-emerald-200 font-bold w-fit shadow-sm">{names}</Badge>
                            </div>
                          </td>
                          <td className="px-6 py-4 font-bold text-emerald-700">{formatCurrency(group.total_price)}</td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {group.items.some((r: any) => r.receipt_url) && (
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-primary hover:bg-emerald-600 hover:text-white transition-all shadow-sm" onClick={() => window.open(group.items.find((r: any) => r.receipt_url)?.receipt_url)}>
                                  <FileText className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                size="icon" variant="ghost"
                                className="h-8 w-8 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                title="Reagendar"
                                onClick={() => {
                                  setRescheduleData({ type: 'kiosk', group });
                                  setRescheduleDate(parseISO(group.reservation_date));
                                }}
                              ><CalendarClock className="w-4 h-4" /></Button>
                              <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:bg-red-600 hover:text-white transition-all shadow-sm" onClick={() => requestDelete(group.items[0], 'kiosk')}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };\n\n  `;

// 2. Quad Section
const quadReplacement = \`const renderQuadTab = () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const allGroups = Object.values(quadReservations.reduce((acc, curr) => {
      const key = \\\`\\\${curr.reservation_date}_\\\${curr.customer_name || 'Venda'}\\\`;
      if (!acc[key]) acc[key] = { group_key: key, reservation_date: curr.reservation_date, customer_name: curr.customer_name || (curr as any).bookings?.name || 'Cliente', items: [], total_price: 0, total_quantity: 0 };
      acc[key].items.push(curr);
      acc[key].total_price += (curr.price || 0);
      acc[key].total_quantity += (Number(curr.quantity) || 1);
      return acc;
    }, {} as Record<string, any>));

    const groupsByTab: Record<string, any[]> = {
      hoje: allGroups.filter((g: any) => g.reservation_date === todayStr),
      futuras: allGroups.filter((g: any) => g.reservation_date > todayStr),
      historico: allGroups.filter((g: any) => g.reservation_date < todayStr),
    };
    const tabGroups = groupsByTab[quadSubTab];

    const subTabConfig = [
      { key: 'hoje', label: 'Ativos Hoje', count: groupsByTab.hoje.length, color: 'bg-blue-600 text-white' },
      { key: 'futuras', label: 'Reservas Futuras', count: groupsByTab.futuras.length, color: 'bg-blue-100 text-blue-700' },
      { key: 'historico', label: 'Histórico', count: groupsByTab.historico.length, color: 'bg-slate-100 text-slate-600' },
    ];

    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="bg-white rounded-3xl border-2 border-slate-300 shadow-xl overflow-hidden">
          <div className="p-6 border-b-2 border-slate-200 bg-blue-50/50">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h3 className="text-lg font-black text-blue-950">Reservas de Quadriciclos</h3>
                <p className="text-xs text-blue-900 font-bold">Clique em um grupo para ver os horários</p>
              </div>
              <div className="grid grid-cols-2 md:flex gap-2 bg-slate-100 p-1 rounded-2xl w-full md:w-auto">
                {subTabConfig.map(t => (
                  <button
                    key={t.key}
                    onClick={() => setQuadSubTab(t.key as any)}
                    className={cn(
                      'flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all',
                      quadSubTab === t.key ? t.color + ' shadow-md' : 'text-slate-500 hover:text-slate-700',
                      t.key === 'historico' && 'col-span-2 md:col-auto'
                    )}
                  >
                    {t.label}
                    <span className={cn('rounded-full px-1.5 py-0.5 text-[9px] font-black', quadSubTab === t.key ? 'bg-white/30' : 'bg-slate-200')}>
                      {t.count}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            {/* Mobile Cards View */}
            <div className="md:hidden space-y-4 p-4 bg-blue-50/30">
               {tabGroups.length === 0 ? (
                 <div className="text-center py-10 text-muted-foreground/40 font-bold uppercase text-[10px] tracking-widest">Nenhuma reserva</div>
               ) : (
                 tabGroups.map((group: any) => {
                   const isExpanded = expandedQuadGroupId === group.group_key;
                   const isToday = group.reservation_date === todayStr;
                   const uniqueModels = Array.from(new Set(group.items.map((r: any) => QUAD_MODELS_LABELS[r.quad_type || (r.time_slot === 'DUPLA' ? 'dupla' : 'individual')] || 'Individual')));
                   
                   return (
                     <div key={group.group_key} className="bg-white rounded-2xl border-2 border-blue-100 shadow-sm overflow-hidden box-border">
                        <div className={cn("p-4 flex justify-between items-center cursor-pointer", isToday ? "bg-blue-50/50" : "bg-white")} onClick={() => setExpandedQuadGroupId(isExpanded ? null : group.group_key)}>
                           <div className="flex flex-col">
                              <span className="text-[9px] font-black text-blue-700/60 uppercase tracking-widest">Cliente</span>
                              <span className="font-black text-blue-950 uppercase">{group.customer_name}</span>
                              <span className="text-[10px] font-bold text-blue-800">{format(parseISO(group.reservation_date), 'dd/MM/yyyy')}</span>
                           </div>
                           <div className="flex items-center gap-3">
                              {isToday && <span className="bg-blue-600 text-white text-[9px] font-black px-2.5 py-1 rounded-full uppercase">Hoje</span>}
                              <ChevronDown className={cn('w-5 h-5 text-blue-400 transition-transform', isExpanded && 'rotate-180')} />
                           </div>
                        </div>
                        
                        {isExpanded && (
                           <div className="p-4 bg-blue-50/30 border-t border-blue-100 space-y-4 animate-in slide-in-from-top-2 duration-300">
                              <div className="grid grid-cols-2 gap-4">
                                 <div>
                                    <span className="text-[9px] font-black text-blue-700/60 uppercase tracking-widest block mb-1">Modelos</span>
                                    <div className="flex flex-wrap gap-1">
                                       {uniqueModels.map((m, i) => <span key={i} className="px-2 py-0.5 bg-white border border-blue-200 text-blue-800 rounded text-[9px] font-black">{m}</span>)}
                                    </div>
                                 </div>
                                 <div className="text-right">
                                    <span className="text-[9px] font-black text-blue-700/60 uppercase tracking-widest block mb-1">Total</span>
                                    <span className="font-black text-blue-900 text-xs">{formatCurrency(group.total_price)}</span>
                                 </div>
                              </div>
                              
                              <div className="space-y-2">
                                 <span className="text-[9px] font-black text-blue-700/60 uppercase tracking-widest block mb-1">Horários Reservados</span>
                                 {group.items.map((r: any, i: number) => (
                                   <div key={i} className="flex justify-between items-center bg-white p-3 rounded-xl border border-blue-100 shadow-sm">
                                      <div className="flex items-center gap-2">
                                         <Clock className="w-3.5 h-3.5 text-blue-500" />
                                         <span className="text-[11px] font-black text-blue-900">{r.time_slot}</span>
                                         <span className="text-[10px] font-bold text-blue-600/60">• {QUAD_MODELS_LABELS[r.quad_type] || 'Individual'}</span>
                                      </div>
                                      <span className="text-[10px] font-black text-blue-900">{r.quantity} un.</span>
                                   </div>
                                 ))}
                              </div>

                              <div className="flex items-center justify-end gap-2 pt-2">
                                 {group.items.some((r: any) => r.receipt_url) && (
                                   <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 bg-blue-50 rounded-lg" onClick={() => window.open(group.items.find((r: any) => r.receipt_url)?.receipt_url)}>
                                     <FileText className="w-4 h-4" />
                                   </Button>
                                 )}
                                 <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 bg-blue-50 rounded-lg" onClick={() => {setRescheduleData({ type: 'quad', group }); setRescheduleDate(parseISO(group.reservation_date));}}><CalendarClock className="w-4 h-4" /></Button>
                                 <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 bg-red-50 rounded-lg" onClick={() => requestDelete(group.items[0], 'quad')}><Trash2 className="w-4 h-4" /></Button>
                              </div>
                           </div>
                        )}
                     </div>
                   );
                 })
               )}
            </div>

            {/* Desktop Table View */}
            <div className="hidden md:block">
              {tabGroups.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground/40 font-bold uppercase text-xs tracking-widest">
                  {quadSubTab === 'hoje' ? 'Nenhuma reserva ativa hoje' : quadSubTab === 'futuras' ? 'Sem reservas futuras' : 'Sem histórico'}
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-muted/50 text-[10px] font-bold uppercase text-muted-foreground tracking-widest border-b border-border/50">
                    <tr>
                      <th className="px-6 py-4 w-8"></th>
                      <th className="px-6 py-4">Data</th>
                      <th className="px-6 py-4">Cliente</th>
                      <th className="px-6 py-4">Modelos</th>
                      <th className="px-6 py-4 text-center">Total Quadriciclos</th>
                      <th className="px-6 py-4">Valor Total</th>
                      <th className="px-6 py-4 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tabGroups.map((group: any) => {
                      const isExpanded = expandedQuadGroupId === group.group_key;
                      const isToday = group.reservation_date === todayStr;
                      const uniqueModels = Array.from(new Set(group.items.map((r: any) => QUAD_MODELS_LABELS[r.quad_type || (r.time_slot === 'DUPLA' ? 'dupla' : 'individual')] || 'Individual')));

                      return (
                        <React.Fragment key={group.group_key}>
                          <tr
                            className={cn(
                              'border-b-2 border-blue-200 cursor-pointer hover:bg-blue-100/50 transition-colors',
                              isToday ? 'bg-blue-50/60' : 'bg-white',
                              isExpanded && 'bg-blue-100/40'
                            )}
                            onClick={() => setExpandedQuadGroupId(isExpanded ? null : group.group_key)}
                          >
                            <td className="px-4 py-4 text-center">
                              <ChevronDown className={cn('w-4 h-4 text-blue-500 transition-transform', isExpanded && 'rotate-180')} />
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-1">
                                <span className={cn('font-bold text-sm', isToday ? 'text-blue-700' : 'text-blue-900')}>
                                  {format(parseISO(group.reservation_date), 'dd/MM/yyyy')}
                                </span>
                                {isToday && <span className="text-[9px] bg-blue-600 text-white font-black uppercase px-2 py-0.5 rounded-full w-fit">HOJE</span>}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className="font-black text-blue-950 uppercase">{group.customer_name}</span>
                              <div className="text-[10px] text-blue-600/60 font-black mt-0.5">{group.items.length} horário(s) reservado(s)</div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-wrap gap-1">
                                {uniqueModels.map((m, i) => (
                                  <Badge key={i} variant="outline" className="border-blue-200 text-blue-800 font-bold bg-blue-50/50 text-[10px]">{m}</Badge>
                                ))}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <Badge className="bg-blue-100 text-blue-950 border-0 font-black">{group.total_quantity} quadriciclos</Badge>
                            </td>
                            <td className="px-6 py-4 font-black text-blue-900">{formatCurrency(group.total_price)}</td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                                {group.items.some((r: any) => r.receipt_url) && (
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-primary hover:bg-emerald-600 hover:text-white transition-all shadow-sm" onClick={() => window.open(group.items.find((r: any) => r.receipt_url)?.receipt_url)}>
                                    <FileText className="w-4 h-4" />
                                  </Button>
                                )}
                                <Button
                                  size="icon" variant="ghost"
                                  className="h-8 w-8 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm"
                                  title="Reagendar"
                                  onClick={() => {
                                    setRescheduleData({ type: 'quad', group });
                                    setRescheduleDate(parseISO(group.reservation_date));
                                  }}
                                ><CalendarClock className="w-4 h-4" /></Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:bg-red-600 hover:text-white transition-all shadow-sm" onClick={(e) => { e.stopPropagation(); requestDelete(group.items[0], 'quad'); }}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded && group.items.map((r: any, idx: number) => {
                            const isEditing = editingId === r.id;
                            return (
                              <tr key={r.id} className={cn("bg-blue-50/30 border-b border-blue-100 transition-all", isEditing ? "bg-amber-50/40" : "")}>
                                <td className="px-4 py-2"></td>
                                <td className="px-6 py-2">
                                  {isEditing ? (
                                    <Select value={editData.time_slot} onValueChange={v => setEditData({...editData, time_slot: v})}>
                                       <SelectTrigger className="h-8 text-[11px] font-black w-32 border-blue-200 bg-white shadow-sm"><SelectValue /></SelectTrigger>
                                       <SelectContent>
                                          {QUAD_TIMES.map(t => <SelectItem key={t} value={t} className="text-[11px] font-bold">{t}</SelectItem>)}
                                       </SelectContent>
                                    </Select>
                                  ) : (
                                    <span className={cn(
                                      'text-[10px] font-black uppercase px-2 py-0.5 rounded-md w-fit inline-block border flex items-center gap-1.5 shadow-sm',
                                      (r.time_slot === 'INDIV' || r.time_slot === 'DUPLA') 
                                        ? 'bg-amber-50 text-amber-700 border-amber-200' 
                                        : 'bg-blue-50 text-blue-700 border-blue-100'
                                    )}>
                                      {(r.time_slot === 'INDIV' || r.time_slot === 'DUPLA') ? (
                                        <>
                                          <AlertTriangle className="w-3 h-3" />
                                          {r.time_slot === 'INDIV' ? 'HORÁRIO NÃO DEFINIDO' : 'DUPLA (AGUARDANDO)'}
                                        </>
                                      ) : (
                                        <>
                                          <Clock className="w-3 h-3" />
                                          {r.time_slot}
                                        </>
                                      )}
                                    </span>
                                  )}
                                </td>
                                <td className="px-6 py-2 text-[11px] text-blue-700/60 font-black uppercase tracking-wider">Item #\\\${idx + 1}</td>
                                <td className="px-6 py-2">
                                  {isEditing ? (
                                    <div className="flex flex-col gap-1 w-32">
                                      <Select value={editData.quad_type || 'individual'} onValueChange={v => setEditData({...editData, quad_type: v})}>
                                         <SelectTrigger className="h-7 text-[10px] font-bold bg-white"><SelectValue /></SelectTrigger>
                                         <SelectContent>
                                            {Object.entries(QUAD_MODELS_LABELS).map(([k, v]) => <SelectItem key={k} value={k} className="text-[10px]">{v}</SelectItem>)}
                                         </SelectContent>
                                      </Select>
                                    </div>
                                  ) : (
                                    <Badge variant="outline" className="text-[9px] border-blue-100 text-blue-700 bg-white/50 font-black tracking-widest px-2">
                                      {QUAD_MODELS_LABELS[r.quad_type || (r.time_slot === 'DUPLA' ? 'dupla' : 'individual')] || 'Individual'}
                                    </Badge>
                                  )}
                                </td>
                                <td className="px-6 py-2 text-center">
                                  <span className="text-[11px] font-black text-blue-900 bg-blue-100/50 px-2 rounded-full border border-blue-200">{r.quantity || 1}x</span>
                                </td>
                                <td className="px-6 py-2 text-[11px] font-extrabold text-blue-700">{formatCurrency(r.price || 0)}</td>
                                <td className="px-6 py-2 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {isEditing ? (
                                      <>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-emerald-600 bg-emerald-50 hover:bg-emerald-600 hover:text-white border border-emerald-200" onClick={() => saveEditing('quad')}>
                                          <Check className="w-4 h-4" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 bg-white hover:bg-slate-100 border border-slate-200" onClick={cancelEditing}>
                                          <X className="w-4 h-4" />
                                        </Button>
                                      </>
                                    ) : (
                                      <>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-blue-600 hover:bg-blue-600 hover:text-white transition-all shadow-sm border border-blue-100 flex items-center justify-center" onClick={(e: any) => { e.stopPropagation(); startEditing(r); }}>
                                          <Pencil className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-8 w-8 text-red-500 hover:bg-red-600 hover:text-white transition-all shadow-sm border border-red-100" onClick={(e: any) => { e.stopPropagation(); requestDelete(r, 'quad'); }}>
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };\n\n  \`;

// Rebuild content
const newContent = content.substring(0, kStart) + kioskReplacement + quadReplacement + content.substring(oStart);

// 3. Hide Vendas Tab on Mobile
const vendasMarker = "setActiveTab('vendas')";
const vendasClassRegex = /className={cn\([\s\S]*?"col-span-2 lg:flex-1/;
let finalContent = newContent.replace(vendasClassRegex, 'className={cn(\\n               "hidden lg:flex lg:flex-1');

fs.writeFileSync(filePath, finalContent);
console.log('File written successfully.');
console.log('New length:', finalContent.length);
