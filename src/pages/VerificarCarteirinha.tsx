import React, { useEffect, useState } from 'react';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
  ShieldCheck,
  Users,
  Car,
  CreditCard,
  ArrowLeft,
  QrCode,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  ClubMember,
  ClubSubscription,
  ClubVisitRecord,
} from '@/lib/club-types';
import {
  ClubDatabaseState,
  fetchClubState,
  saveClubState,
  findMemberOrSubscriptionByQuery,
  formatDateBR,
} from '@/lib/club-service';
import { ClubMemberCardView } from '@/components/club/ClubMemberCardView';
import { useToast } from '@/hooks/use-toast';

const VerificarCarteirinha: React.FC = () => {
  const { toast } = useToast();
  const { codigo } = useParams<{ codigo?: string }>();
  const [searchParams] = useSearchParams();
  const initialQuery = codigo || searchParams.get('q') || '';

  const [state, setState] = useState<ClubDatabaseState | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [matchedSub, setMatchedSub] = useState<ClubSubscription | null>(null);
  const [matchedMember, setMatchedMember] = useState<ClubMember | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(true);

  const handleRegisterVisit = async (
    targetState: ClubDatabaseState,
    sub: ClubSubscription,
    member: ClubMember,
    silent = false
  ) => {
    const today = new Date().toISOString().split('T')[0];
    const nowTime = new Date().toTimeString().slice(0, 5);
    const existingVisits = sub.visits || [];
    const alreadyCheckedInToday = existingVisits.some(
      (v) => v.date === today && v.cardNumber === member.cardNumber
    );
    if (alreadyCheckedInToday && silent) return;

    const newVisit: ClubVisitRecord = {
      id: `vis_${Date.now()}`,
      date: today,
      time: nowTime,
      memberName: member.fullName,
      cardNumber: member.cardNumber,
      source: 'QR_SCAN',
      notes: 'Entrada validada via QR Code / Portaria',
    };
    const updatedSub: ClubSubscription = {
      ...sub,
      visits: [newVisit, ...existingVisits],
    };
    const nextState: ClubDatabaseState = {
      ...targetState,
      subscriptions: targetState.subscriptions.map((s) =>
        s.id === updatedSub.id ? updatedSub : s
      ),
    };
    await saveClubState(nextState);
    setState(nextState);
    setMatchedSub(updatedSub);
    if (!silent) {
      toast({
        title: 'Visita registrada na Agenda do Cliente!',
        description: `${member.fullName} — Entrada confirmada em ${formatDateBR(today)} às ${nowTime}.`,
      });
    }
  };

  useEffect(() => {
    fetchClubState().then((loaded) => {
      setState(loaded);
      setLoading(false);
      if (initialQuery) {
        const matches = findMemberOrSubscriptionByQuery(loaded, initialQuery);
        if (matches.length > 0) {
          setMatchedSub(matches[0].subscription);
          setMatchedMember(matches[0].member);
          if (matches[0].subscription.status === 'ACTIVE') {
            handleRegisterVisit(
              loaded,
              matches[0].subscription,
              matches[0].member,
              true
            );
          }
        } else {
          setMatchedSub(null);
          setMatchedMember(null);
        }
        setSearched(true);
      }
    });
  }, [initialQuery]);

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!state || !query.trim()) return;
    const matches = findMemberOrSubscriptionByQuery(state, query);
    if (matches.length > 0) {
      setMatchedSub(matches[0].subscription);
      setMatchedMember(matches[0].member);
    } else {
      setMatchedSub(null);
      setMatchedMember(null);
    }
    setSearched(true);
  };

  const isSubActive =
    matchedSub?.status === 'ACTIVE' &&
    matchedMember?.status === 'ACTIVE' &&
    new Date(matchedSub.endDate + 'T23:59:59') >= new Date();

  const hasOverdueInvoice = matchedSub?.invoices.some((inv) => {
    if (inv.status === 'OVERDUE') return true;
    if (inv.status === 'PENDING' && new Date(inv.dueDate + 'T23:59:59') < new Date()) {
      return true;
    }
    return false;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-16">
      {/* Top Bar */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-30">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <Link
            to="/assinatura"
            className="flex items-center gap-2 text-slate-300 hover:text-white text-sm font-medium"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar para Lessa Club
          </Link>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <span className="font-black tracking-tight text-sm md:text-base">
              VALIDADOR DE PORTARIA • RESERVA LESSA
            </span>
          </div>
          <Link to="/socio">
            <Button size="sm" variant="outline" className="border-slate-700 text-slate-200 hover:bg-slate-800">
              Área do Sócio
            </Button>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 pt-8 max-w-4xl">
        {/* Search Box */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg md:text-xl font-black text-white">
                Consulta Rápida de Carteirinha / QR Code
              </h1>
              <p className="text-xs text-slate-400">
                Digite o Nº da Carteirinha (ex: 1212253001), CPF ou Nome do Associado para validar o acesso na portaria
              </p>
            </div>
          </div>

          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Nº do Cartão, CPF ou Nome completo..."
                className="pl-10 bg-slate-950 border-slate-700 text-white h-12 text-base"
              />
            </div>
            <Button
              type="submit"
              className="h-12 px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              Verificar Acesso
            </Button>
          </form>
        </div>

        {loading && (
          <div className="text-center py-12 text-slate-400">Carregando base de associados...</div>
        )}

        {!loading && searched && !matchedSub && (
          <div className="bg-red-950/40 border-2 border-red-500/50 rounded-3xl p-8 text-center space-y-3">
            <XCircle className="w-16 h-16 text-red-400 mx-auto" />
            <h2 className="text-2xl font-black text-red-200">
              CARTEIRINHA OU ASSOCIADO NÃO ENCONTRADO
            </h2>
            <p className="text-sm text-red-300 max-w-md mx-auto">
              Nenhum registro localizado para o código ou documento informado (<strong>{query}</strong>). Verifique os números ou consulte a administração.
            </p>
          </div>
        )}

        {!loading && matchedSub && matchedMember && (
          <div className="space-y-6">
            {/* Gate Status Banner */}
            <div
              className={`rounded-3xl p-6 md:p-8 border-2 shadow-2xl flex flex-col md:flex-row items-center gap-6 ${
                isSubActive && !hasOverdueInvoice
                  ? 'bg-emerald-950/60 border-emerald-500 text-emerald-50'
                  : 'bg-red-950/60 border-red-500 text-red-50'
              }`}
            >
              <div className="relative shrink-0">
                <div className="w-28 h-36 md:w-32 md:h-40 rounded-2xl overflow-hidden border-4 border-white shadow-xl bg-slate-800">
                  {matchedMember.photoUrl ? (
                    <img
                      src={matchedMember.photoUrl}
                      alt={matchedMember.fullName}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 text-xs text-center p-2 font-bold">
                      SEM FOTO CADASTRADA
                    </div>
                  )}
                </div>
                <div
                  className={`absolute -bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider shadow-lg whitespace-nowrap ${
                    isSubActive && !hasOverdueInvoice
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-red-500 text-white'
                  }`}
                >
                  {matchedMember.role === 'TITULAR' ? 'Titular' : 'Dependente'}
                </div>
              </div>

              <div className="flex-1 text-center md:text-left space-y-2">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                  {isSubActive && !hasOverdueInvoice ? (
                    <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500 text-slate-950 font-black text-sm uppercase tracking-wide">
                      <CheckCircle2 className="w-5 h-5" /> ACESSO LIBERADO • ASSOCIADO ATIVO
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-red-500 text-white font-black text-sm uppercase tracking-wide">
                      <AlertTriangle className="w-5 h-5" /> ACESSO BLOQUEADO / PENDÊNCIA
                    </span>
                  )}

                  <Badge variant="outline" className="border-white/30 text-white font-mono">
                    Cartão #{matchedMember.cardNumber}
                  </Badge>
                </div>

                <h2 className="text-2xl md:text-3xl font-black text-white">
                  {matchedMember.fullName}
                </h2>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 text-left">
                  <div className="bg-black/30 rounded-xl p-2.5 border border-white/10">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                      CPF
                    </span>
                    <span className="font-bold text-sm text-white">
                      {matchedMember.cpf || 'Menor / Dep.'}
                    </span>
                  </div>
                  <div className="bg-black/30 rounded-xl p-2.5 border border-white/10">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                      Modalidade
                    </span>
                    <span className="font-bold text-sm text-emerald-300">
                      {matchedMember.planCycleLabel}
                    </span>
                  </div>
                  <div className="bg-black/30 rounded-xl p-2.5 border border-white/10">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                      Validade
                    </span>
                    <span className="font-bold text-sm text-white">
                      {formatDateBR(matchedSub.endDate)}
                    </span>
                  </div>
                  <div className="bg-black/30 rounded-xl p-2.5 border border-white/10">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                      Status Assinatura
                    </span>
                    <span className="font-bold text-sm text-white">
                      {matchedSub.status === 'ACTIVE'
                        ? 'Ativa'
                        : matchedSub.status === 'PENDING'
                        ? 'Aguardando Pagto'
                        : matchedSub.status === 'OVERDUE'
                        ? 'Fatura Vencida'
                        : 'Inativa / Cancelada'}
                    </span>
                  </div>
                </div>

                {state && isSubActive && (
                  <div className="pt-2 flex flex-wrap items-center gap-2">
                    <Button
                      size="sm"
                      onClick={() =>
                        handleRegisterVisit(state, matchedSub, matchedMember, false)
                      }
                      className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs"
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1.5" /> Confirmar Entrada Hoje (Registrar na Agenda do Cliente)
                    </Button>
                    <span className="text-xs text-emerald-200/80">
                      Total de visitas registradas: <strong>{(matchedSub.visits || []).length}</strong>
                    </span>
                  </div>
                )}

                {/* Vehicle Warning for Family Publicidade */}
                {matchedSub.contractType === 'FAMILY_PUBLICIDADE' && (
                  <div className="mt-3 bg-amber-500/20 border border-amber-400/50 rounded-xl p-3 flex items-center gap-3 text-left">
                    <Car className="w-6 h-6 text-amber-300 shrink-0" />
                    <div className="text-xs text-amber-100">
                      <strong className="block text-amber-300 uppercase">
                        Atenção Portaria • Plano Family Publicidade (Adesivo Obrigatório):
                      </strong>
                      Veículo cadastrado: <strong>{matchedSub.vehicleModel || '—'}</strong> • Placa:{' '}
                      <strong>{matchedSub.vehiclePlate || '—'}</strong> • Cor:{' '}
                      <strong>{matchedSub.vehicleColor || '—'}</strong>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Family Members & Digital Card Preview */}
            <div className="grid md:grid-cols-12 gap-6">
              <div className="md:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-black text-white">
                      Integrantes desta Assinatura ({matchedSub.members.length})
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400">{matchedSub.planSummaryLabel}</span>
                </div>

                <div className="space-y-2.5">
                  {matchedSub.members.map((member) => {
                    const isSelected = member.id === matchedMember.id;
                    return (
                      <div
                        key={member.id}
                        onClick={() => setMatchedMember(member)}
                        className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-emerald-950/40 border-emerald-500/60'
                            : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-12 rounded-lg overflow-hidden bg-slate-800 border border-slate-700 shrink-0">
                            {member.photoUrl ? (
                              <img
                                src={member.photoUrl}
                                alt={member.fullName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[9px] text-slate-500 font-bold">
                                FOTO
                              </div>
                            )}
                          </div>
                          <div>
                            <div className="font-bold text-sm text-white flex items-center gap-2">
                              {member.fullName}
                              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                                {member.role}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400">
                              {member.planCycleLabel} • Cartão #{member.cardNumber}
                            </div>
                          </div>
                        </div>
                        <Badge
                          className={
                            member.status === 'ACTIVE'
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-red-500/20 text-red-300 border-red-500/30'
                          }
                        >
                          {member.status === 'ACTIVE' ? 'Ativo' : 'Pendente'}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="md:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <h3 className="font-black text-white mb-3 text-sm flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-emerald-400" /> Espelho Oficial da Carteirinha
                </h3>
                <ClubMemberCardView member={matchedMember} showBackSide={false} compact />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerificarCarteirinha;
