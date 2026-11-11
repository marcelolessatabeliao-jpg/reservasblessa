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
  getLastClubFetchError,
  saveClubState,
  findMemberOrSubscriptionByQuery,
  formatDateBR,
  isClubDateExpired,
  isMemberBlockedForMissingDoc,
} from '@/lib/club-service';
import { ClubMemberCardView } from '@/components/club/ClubMemberCardView';
import { useToast } from '@/hooks/use-toast';

interface MemberGateStatus {
  isActive: boolean;
  statusLabel: 'ATIVO' | 'INATIVO' | 'EXPIRADO';
  reason?: string;
  effectiveExpiration?: string;
}

const getMemberGateStatus = (sub: ClubSubscription, member: ClubMember): MemberGateStatus => {
  const effectiveExpiration = member.expirationDate || sub.endDate;
  const expired = isClubDateExpired(effectiveExpiration);
  const missingDoc = isMemberBlockedForMissingDoc(member, sub);
  const hasOverdueInvoice = (sub.invoices || []).some(
    (inv) =>
      inv.status === 'OVERDUE' ||
      (inv.status === 'PENDING' && new Date(inv.dueDate + 'T23:59:59') < new Date())
  );
  const subInactive = sub.status !== 'ACTIVE';
  const memberInactive = member.status !== 'ACTIVE';

  if (subInactive) {
    return {
      isActive: false,
      statusLabel: expired ? 'EXPIRADO' : 'INATIVO',
      effectiveExpiration,
      reason:
        sub.status === 'PENDING' || sub.status === 'PENDING_TRANSFER'
          ? 'Aguardando confirmação de pagamento / liberação'
          : sub.status === 'OVERDUE'
          ? 'Assinatura com fatura vencida'
          : 'Cadastro marcado como INATIVO',
    };
  }
  if (memberInactive) {
    return {
      isActive: false,
      statusLabel: 'INATIVO',
      effectiveExpiration,
      reason: 'Integrante marcado como INATIVO individualmente',
    };
  }
  if (expired) {
    return {
      isActive: false,
      statusLabel: 'EXPIRADO',
      effectiveExpiration,
      reason: `Cadastro expirado em ${formatDateBR(effectiveExpiration)}`,
    };
  }
  if (missingDoc) {
    return {
      isActive: false,
      statusLabel: 'INATIVO',
      effectiveExpiration,
      reason: `Pendente comprovação documental (${member.modalityName})`,
    };
  }
  if (hasOverdueInvoice) {
    return {
      isActive: false,
      statusLabel: 'INATIVO',
      effectiveExpiration,
      reason: 'Consta mensalidade/fatura em atraso neste contrato',
    };
  }
  return {
    isActive: true,
    statusLabel: 'ATIVO',
    effectiveExpiration,
  };
};

const VerificarCarteirinha: React.FC = () => {
  const { toast } = useToast();
  const { codigo } = useParams<{ codigo?: string }>();
  const [searchParams] = useSearchParams();
  const rawQueryParam = codigo || searchParams.get('q') || searchParams.get('codigo') || '';
  const initialQuery = (() => {
    try {
      return decodeURIComponent(rawQueryParam).trim();
    } catch {
      return rawQueryParam.trim();
    }
  })();

  const [state, setState] = useState<ClubDatabaseState | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [matchedSub, setMatchedSub] = useState<ClubSubscription | null>(null);
  const [matchedMember, setMatchedMember] = useState<ClubMember | null>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const pickBestMatch = (
    matches: Array<{ member: ClubMember; subscription: ClubSubscription }>,
    rawSearch: string
  ) => {
    const cleanQ = rawSearch.replace(/\D/g, '');
    const lowerQ = rawSearch.trim().toLowerCase();
    const exactCard = matches.find(
      (m) =>
        m.member.cardNumber.toLowerCase() === lowerQ ||
        m.member.qrToken.toLowerCase() === lowerQ ||
        (cleanQ.length >= 4 && m.member.cardNumber.replace(/\D/g, '') === cleanQ)
    );
    if (exactCard) return exactCard;
    return matches.find((m) => m.member.role === 'TITULAR') || matches[0];
  };

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
    try {
      await saveClubState(nextState);
      setState(nextState);
      setMatchedSub(updatedSub);
    } catch (err) {
      if (!silent) {
        toast({
          title: 'Não foi possível registrar entrada no servidor',
          description: 'Verifique a conexão e tente novamente.',
          variant: 'destructive',
        });
      } else {
        console.warn('[VerificarCarteirinha] Silent visit log failed:', err);
      }
      return;
    }
    if (!silent) {
      toast({
        title: 'Visita registrada na Agenda do Cliente!',
        description: `${member.fullName} — Entrada confirmada em ${formatDateBR(today)} às ${nowTime}.`,
      });
    }
  };

  const loadAndVerify = async (lookupValue: string) => {
    setLoading(true);
    setFetchError(null);
    let loaded = await fetchClubState({ timeoutMs: 25000 });
    let err = getLastClubFetchError();
    let matches = lookupValue ? findMemberOrSubscriptionByQuery(loaded, lookupValue) : [];

    // Retry once automatically if server errored/timed out OR card wasn't in initial snapshot
    if (lookupValue && (err || matches.length === 0)) {
      await new Promise((r) => setTimeout(r, 600));
      loaded = await fetchClubState({ timeoutMs: 30000 });
      err = getLastClubFetchError();
      matches = findMemberOrSubscriptionByQuery(loaded, lookupValue);
    }

    setState(loaded);
    setFetchError(err);
    setLoading(false);

    if (lookupValue) {
      if (matches.length > 0) {
        const best = pickBestMatch(matches, lookupValue);
        setMatchedSub(best.subscription);
        setMatchedMember(best.member);
        const gate = getMemberGateStatus(best.subscription, best.member);
        if (gate.isActive) {
          handleRegisterVisit(loaded, best.subscription, best.member, true);
        }
      } else {
        setMatchedSub(null);
        setMatchedMember(null);
      }
      setSearched(true);
    }
  };

  useEffect(() => {
    setQuery(initialQuery);
    loadAndVerify(initialQuery);
  }, [initialQuery]);

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!state || !query.trim()) return;
    const matches = findMemberOrSubscriptionByQuery(state, query);
    if (matches.length > 0) {
      const best = pickBestMatch(matches, query);
      setMatchedSub(best.subscription);
      setMatchedMember(best.member);
    } else {
      setMatchedSub(null);
      setMatchedMember(null);
    }
    setSearched(true);
  };

  const gateStatus =
    matchedSub && matchedMember ? getMemberGateStatus(matchedSub, matchedMember) : null;
  const isSubActive = Boolean(gateStatus?.isActive);
  const dependentsList =
    matchedSub?.members.filter((m, idx) => m.role === 'DEPENDENTE' || idx > 0) || [];

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
            <Button size="sm" variant="outline" className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white">
              Área do Sócio
            </Button>
          </Link>
        </div>
      </header>

      <div className="container mx-auto px-4 pt-8 max-w-4xl">
        {/* Tela Privada: Orientação para Leitura do QR Code pelo Celular */}
        {!initialQuery && !matchedMember && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 sm:p-12 shadow-2xl text-center space-y-5 max-w-xl mx-auto my-8">
            <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto">
              <QrCode className="w-10 h-10 animate-pulse" />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-black text-white">
                Validação de Acesso via QR Code
              </h1>
              <p className="text-sm text-slate-300 leading-relaxed">
                Aponte a <strong>câmera do seu celular</strong> para o QR Code presente na carteirinha física ou digital do associado para validar os dados e liberar o acesso na portaria.
              </p>
            </div>
            <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-4 text-xs text-slate-400 text-left space-y-2">
              <div className="flex items-center gap-2 text-amber-400 font-bold">
                <ShieldCheck className="w-4 h-4" />
                <span>Privacidade & Segurança dos Associados:</span>
              </div>
              <p>
                Por proteção de dados pessoais (LGPD), a consulta manual direta fica disponível exclusivamente para a recepção e administração autenticada no <strong>Painel Lessa Club &gt; Clientes &gt; Validar Carteirinha</strong>.
              </p>
            </div>
            <div className="pt-2">
              <Link to="/assinatura">
                <Button variant="outline" className="border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 hover:text-white">
                  <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao Início
                </Button>
              </Link>
            </div>
          </div>
        )}

        {loading && (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-10 text-center space-y-3 my-6">
            <QrCode className="w-10 h-10 text-emerald-400 mx-auto animate-pulse" />
            <div className="text-sm font-bold text-slate-200">
              Consultando base oficial de associados...
            </div>
            <p className="text-xs text-slate-400">
              Validando status atual da carteirinha #{initialQuery || query}
            </p>
          </div>
        )}

        {!loading && searched && !matchedSub && (
          <div className="bg-red-950/40 border-2 border-red-500/50 rounded-3xl p-8 text-center space-y-4">
            <XCircle className="w-16 h-16 text-red-400 mx-auto" />
            <h2 className="text-2xl font-black text-red-200">
              {fetchError
                ? 'CONEXÃO INSTÁVEL AO VALIDAR CARTEIRINHA'
                : 'CARTEIRINHA OU ASSOCIADO NÃO ENCONTRADO'}
            </h2>
            <p className="text-sm text-red-300 max-w-md mx-auto">
              {fetchError
                ? `Não foi possível sincronizar completamente com o servidor (${fetchError}). Toque abaixo para tentar buscar novamente o cartão (${initialQuery || query}).`
                : `Nenhum registro localizado para o código ou documento informado (${initialQuery || query}). Verifique os números ou toque para atualizar a base.`}
            </p>
            <div className="pt-2 flex flex-wrap items-center justify-center gap-3">
              <Button
                type="button"
                onClick={() => loadAndVerify(initialQuery || query)}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold"
              >
                Atualizar Base e Tentar Novamente
              </Button>
              <Link to="/socio">
                <Button variant="outline" className="border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 hover:text-white">
                  Acessar Portal do Sócio
                </Button>
              </Link>
            </div>
          </div>
        )}

        {!loading && matchedSub && matchedMember && gateStatus && (
          <div className="space-y-6">
            {/* Gate Status Banner */}
            <div
              className={`rounded-3xl p-6 md:p-8 border-2 shadow-2xl flex flex-col md:flex-row items-center gap-6 ${
                isSubActive
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
                    isSubActive
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-red-500 text-white'
                  }`}
                >
                  {matchedMember.role === 'TITULAR' ? 'Titular' : 'Dependente'}
                </div>
              </div>

              <div className="flex-1 text-center md:text-left space-y-2.5">
                <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                  {isSubActive ? (
                    <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-emerald-500 text-slate-950 font-black text-sm uppercase tracking-wide">
                      <CheckCircle2 className="w-5 h-5" /> STATUS: ATIVO • ACESSO LIBERADO
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-red-600 text-white font-black text-sm uppercase tracking-wide">
                      <AlertTriangle className="w-5 h-5" /> STATUS: {gateStatus.statusLabel} • ACESSO BLOQUEADO
                    </span>
                  )}

                  <Badge variant="outline" className="border-white/30 text-white font-mono">
                    Cartão #{matchedMember.cardNumber}
                  </Badge>
                </div>

                <h2 className="text-2xl md:text-3xl font-black text-white">
                  {matchedMember.fullName}
                </h2>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 text-left">
                  <div className="bg-black/30 rounded-xl p-2.5 border border-white/10">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 block">
                      Status Atual
                    </span>
                    <span
                      className={`font-black text-sm ${
                        isSubActive ? 'text-emerald-400' : 'text-red-400'
                      }`}
                    >
                      {gateStatus.statusLabel}
                    </span>
                  </div>
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
                      Validade / Expiração
                    </span>
                    <span className="font-bold text-sm text-white">
                      {formatDateBR(gateStatus.effectiveExpiration || matchedSub.endDate)}
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
                      <CheckCircle2 className="w-4 h-4 mr-1.5" /> Confirmar Entrada Hoje (Registrar na Agenda)
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

                {!isSubActive && (
                  <div className="mt-4 bg-red-950/80 border-2 border-red-500 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-left">
                    <div className="space-y-1">
                      <strong className="text-red-200 text-sm block">
                        ⛔ Status: {gateStatus.statusLabel} — Acesso Bloqueado
                      </strong>
                      <p className="text-xs text-red-300">
                        {gateStatus.reason || 'A assinatura ou carteirinha encontra-se inativa no momento.'}
                      </p>
                    </div>
                    <Link to={`/socio?card=${encodeURIComponent(matchedMember.cardNumber)}`}>
                      <Button size="sm" className="bg-red-600 hover:bg-red-700 text-white font-bold text-xs shrink-0 whitespace-nowrap">
                        <CreditCard className="w-4 h-4 mr-1.5" /> Acessar Portal do Sócio
                      </Button>
                    </Link>
                  </div>
                )}
              </div>
            </div>

            {/* SE IDENTIFICADO COMO TITULAR E HOUVER DEPENDENTES: MOSTRAR STATUS DE TODOS OS DEPENDENTES EM DESTAQUE */}
            {matchedMember.role === 'TITULAR' && dependentsList.length > 0 && (
              <div className="bg-slate-900 border-2 border-emerald-500/40 rounded-2xl p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-black text-white text-base">
                      Dependentes deste Cadastro ({dependentsList.length})
                    </h3>
                  </div>
                  <span className="text-xs text-emerald-300 font-semibold">
                    Status individual de cada dependente vinculado ao titular {matchedSub.holderName}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {dependentsList.map((dep) => {
                    const depGate = getMemberGateStatus(matchedSub, dep);
                    const isViewing = dep.id === matchedMember.id;
                    return (
                      <div
                        key={dep.id}
                        onClick={() => setMatchedMember(dep)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                          isViewing
                            ? 'bg-emerald-950/50 border-emerald-500'
                            : depGate.isActive
                            ? 'bg-slate-950/70 border-slate-800 hover:border-emerald-500/50'
                            : 'bg-red-950/25 border-red-500/40 hover:border-red-400'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-12 rounded-lg overflow-hidden bg-slate-800 border border-slate-700 shrink-0">
                            {dep.photoUrl ? (
                              <img
                                src={dep.photoUrl}
                                alt={dep.fullName}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-[9px] text-slate-400 font-bold">
                                FOTO
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-white truncate">
                              {dep.fullName}
                            </div>
                            <div className="text-[11px] text-slate-300 truncate">
                              {dep.modalityName} • Cartão #{dep.cardNumber}
                            </div>
                            <div className="text-[11px] text-slate-400">
                              Expiração: {formatDateBR(depGate.effectiveExpiration)}
                              {depGate.reason ? ` • ${depGate.reason}` : ''}
                            </div>
                          </div>
                        </div>

                        <Badge
                          className={`shrink-0 font-black text-xs px-3 py-1 ${
                            depGate.isActive
                              ? 'bg-emerald-500 text-slate-950'
                              : 'bg-red-600 text-white'
                          }`}
                        >
                          {depGate.statusLabel}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Carteirinha Digital + Todos os Integrantes da Assinatura */}
            <div className="grid lg:grid-cols-12 gap-6">
              <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                  <h3 className="font-black text-white text-sm flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-emerald-400" /> Carteirinha Digital Oficial
                  </h3>
                  <Badge
                    className={
                      isSubActive
                        ? 'bg-emerald-500 text-slate-950 font-black'
                        : 'bg-red-600 text-white font-black'
                    }
                  >
                    {gateStatus.statusLabel}
                  </Badge>
                </div>
                <div className="overflow-x-auto">
                  <ClubMemberCardView
                    member={matchedMember}
                    showBackSide={true}
                    locked={!isSubActive}
                    lockReason={gateStatus.reason}
                  />
                </div>
              </div>

              <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald-400" />
                    <h3 className="font-black text-white">
                      Integrantes ({matchedSub.members.length})
                    </h3>
                  </div>
                  <span className="text-xs text-slate-400">{matchedSub.planSummaryLabel}</span>
                </div>

                <div className="space-y-2.5">
                  {matchedSub.members.map((member) => {
                    const isSelected = member.id === matchedMember.id;
                    const memberGate = getMemberGateStatus(matchedSub, member);
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
                        <div className="flex items-center gap-3 min-w-0">
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
                          <div className="min-w-0">
                            <div className="font-bold text-sm text-white flex flex-wrap items-center gap-1.5">
                              <span className="truncate">{member.fullName}</span>
                              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                                {member.role}
                              </span>
                            </div>
                            <div className="text-xs text-slate-400 truncate">
                              {member.planCycleLabel} • #{member.cardNumber}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              Expira: {formatDateBR(memberGate.effectiveExpiration)}
                            </div>
                          </div>
                        </div>
                        <Badge
                          className={`shrink-0 font-black ${
                            memberGate.isActive
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                              : 'bg-red-500/20 text-red-300 border-red-500/30'
                          }`}
                        >
                          {memberGate.statusLabel}
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VerificarCarteirinha;
