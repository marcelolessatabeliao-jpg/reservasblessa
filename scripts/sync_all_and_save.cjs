const fs = require('fs');
const { SUPABASE_URL, ANON_KEY, queryAsaasByCpf } = require('./asaas_helper.cjs');

const P1_ATIVOS = 'C:/Users/TERMINAL 00/.gemini/antigravity/brain/f6b3cbf2-80ca-4b7b-a312-2406b22ab3d9/.user_uploaded/media_1794867252381_1282bd88.xls';
const P2_INATIVOS = 'C:/Users/TERMINAL 00/.gemini/antigravity/brain/f6b3cbf2-80ca-4b7b-a312-2406b22ab3d9/.user_uploaded/media_1794867650728_47b05778.xls';

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function formatCpf(val) {
  const clean = String(val || '').replace(/\D/g, '');
  if (clean.length === 11) {
    return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  }
  return val || '';
}

function formatPhone(val) {
  const clean = String(val || '').replace(/\D/g, '');
  if (clean.length === 11) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 7)}-${clean.slice(7)}`;
  }
  if (clean.length === 10) {
    return `(${clean.slice(0, 2)}) ${clean.slice(2, 6)}-${clean.slice(6)}`;
  }
  if (clean.length > 11 && clean.startsWith('55')) {
    return formatPhone(clean.slice(2));
  }
  return val || '';
}

function getModalityInfo(plano) {
  const p = (plano || '').toLowerCase();
  if (p.includes('family publicidade') || p.includes('publicidade')) {
    return {
      modalityCode: 'PUBLICIDADE',
      modalityName: 'Lessa Family Publicidade',
      monthlyPrice: 0,
      frontCardUrl: '/cards/29.png',
      backCardUrl: '/cards/33.png',
      isFree: true,
      contractType: 'FAMILY_PUBLICIDADE'
    };
  }
  if (p.includes('inclusão') || p.includes('inclusao') || p.includes('pdc') || p.includes('pcd') || p.includes('tea')) {
    return {
      modalityCode: 'PCD_TEA',
      modalityName: 'Lessa Inclusão - PCD e TEA',
      monthlyPrice: 0,
      frontCardUrl: '/cards/35.png',
      backCardUrl: '/cards/24.png',
      isFree: true,
      contractType: 'ADESAO_PF'
    };
  }
  if (p.includes('vitalício') || p.includes('vitalicio') || p.includes('60+')) {
    return {
      modalityCode: 'IDOSO_60',
      modalityName: 'Lessa Vitalício 60+',
      monthlyPrice: 0,
      frontCardUrl: '/cards/26.png',
      backCardUrl: '/cards/39.png',
      isFree: true,
      contractType: 'ADESAO_PF'
    };
  }
  if (p.includes('kids')) {
    return {
      modalityCode: 'KIDS',
      modalityName: 'Lessa Kids',
      monthlyPrice: 0,
      frontCardUrl: '/cards/38.png',
      backCardUrl: '/cards/39.png',
      isFree: true,
      contractType: 'ADESAO_PF'
    };
  }
  if (p.includes('day use') || p.includes('dayuse') || p.includes('convênio') || p.includes('convenio')) {
    return {
      modalityCode: 'CONVENIO_DAYUSE',
      modalityName: 'Lessa Convênio (Day Use)',
      monthlyPrice: 0,
      frontCardUrl: '/cards/21.png',
      backCardUrl: '/cards/16.png',
      isFree: true,
      contractType: 'ADESAO_PF'
    };
  }
  if (p.includes('corporate')) {
    return {
      modalityCode: 'CORPORATE',
      modalityName: 'Lessa Corporate Pass',
      monthlyPrice: 0,
      frontCardUrl: '/cards/14.png',
      backCardUrl: '/cards/24.png',
      isFree: true,
      contractType: 'ADESAO_PF'
    };
  }
  if (p.includes('student') || p.includes('estudante')) {
    return {
      modalityCode: 'ESTUDANTE',
      modalityName: 'Lessa Student Pass',
      monthlyPrice: 25,
      frontCardUrl: '/cards/6.png',
      backCardUrl: '/cards/24.png',
      isFree: false,
      contractType: 'ADESAO_PF'
    };
  }
  if (p.includes('professor')) {
    return {
      modalityCode: 'PROFESSOR',
      modalityName: 'Lessa Professor Pass',
      monthlyPrice: 25,
      frontCardUrl: '/cards/3.png',
      backCardUrl: '/cards/24.png',
      isFree: false,
      contractType: 'ADESAO_PF'
    };
  }
  if (p.includes('servidor')) {
    return {
      modalityCode: 'SERVIDOR',
      modalityName: 'Lessa Servidor Pass',
      monthlyPrice: 25,
      frontCardUrl: '/cards/10.png',
      backCardUrl: '/cards/24.png',
      isFree: p.includes('r$ 0,00'),
      contractType: 'ADESAO_PF'
    };
  }
  if (p.includes('parceiro')) {
    return {
      modalityCode: 'PARCEIRO',
      modalityName: 'Lessa Parceiro',
      monthlyPrice: 25,
      frontCardUrl: '/cards/21.png',
      backCardUrl: '/cards/24.png',
      isFree: false,
      contractType: 'ADESAO_PF'
    };
  }
  let price = 49.9;
  if (p.includes('2 pessoas') || p.includes('99,80')) price = 99.8;
  if (p.includes('3 pessoas') || p.includes('149,70')) price = 149.7;
  if (p.includes('4 pessoas') || p.includes('199,60')) price = 199.6;
  if (p.includes('anual') || p.includes('538,92')) price = 538.92;

  return {
    modalityCode: 'ADULTO',
    modalityName: 'Lessa Club',
    monthlyPrice: price,
    frontCardUrl: '/cards/44.png',
    backCardUrl: '/cards/24.png',
    isFree: p.includes('r$ 0,00'),
    contractType: 'ADESAO_PF'
  };
}

function parseRows(filePath) {
  const content = fs.readFileSync(filePath, 'latin1');
  const trs = content.match(/<tr[\s\S]*?<\/tr>/gi) || [];
  const rows = [];
  for (let i = 1; i < trs.length; i++) {
    const tds = (trs[i].match(/<td[\s\S]*?<\/td>/gi) || []).map(td => td.replace(/<[\s\S]*?>/g, '').trim());
    if (tds.length >= 7) {
      rows.push({
        cartao: tds[0],
        nome: tds[1],
        cpf: tds[2],
        plano: tds[3],
        nasc: tds[4],
        fone: tds[5],
        cadPor: tds[6],
        status: tds[7] || ''
      });
    }
  }
  return rows;
}

function mapAsaasPaymentsToInvoices(payments, subId, subCode, holder) {
  const invoices = [];
  const sorted = [...payments].filter(p => !p.deleted).sort((a, b) => String(a.dueDate || '').localeCompare(String(b.dueDate || '')));

  for (let idx = 0; idx < sorted.length; idx++) {
    const p = sorted[idx];
    const desc = String(p.description || '');
    const codeMatch = desc.match(/Lessa Club \((\d+)\)/i);
    const paymentSubCode = codeMatch ? codeMatch[1] : '';

    let carneGroup = 1;
    if (paymentSubCode && paymentSubCode !== subCode) {
      carneGroup = 2;
    } else if (p.billingType === 'CREDIT_CARD' && !desc.includes('/12')) {
      carneGroup = 3;
    }

    const installmentMatch = desc.match(/\((\d+)\/(\d+)\)/);
    const instNum = installmentMatch ? Number(installmentMatch[1]) : (idx + 1);
    const totalInst = installmentMatch ? Number(installmentMatch[2]) : 12;

    const isPaid = p.status === 'RECEIVED' || p.status === 'CONFIRMED' || p.status === 'RECEIVED_IN_CASH';
    const isOverdue = p.status === 'OVERDUE';

    invoices.push({
      id: `inv_asaas_${p.id}`,
      subscriptionId: subId,
      subscriptionCode: subCode,
      holderName: holder.holderName,
      holderCpf: holder.holderCpf,
      holderPhone: holder.holderPhone,
      installmentNumber: instNum,
      totalInstallments: totalInst,
      referenceMonth: p.dueDate ? p.dueDate.slice(5, 7) + '/' + p.dueDate.slice(0, 4) : '11/2026',
      amount: Number(p.value || 0),
      dueDate: p.dueDate,
      paidAt: isPaid ? (p.clientPaymentDate || p.paymentDate || p.confirmedDate || undefined) : undefined,
      paymentMethod: p.billingType === 'CREDIT_CARD' ? 'CREDIT_CARD' : (p.billingType === 'PIX' ? 'PIX' : 'BOLETO'),
      status: isPaid ? 'PAID' : (isOverdue ? 'OVERDUE' : 'PENDING'),
      asaasPaymentId: p.id,
      boletoNumber: p.nossoNumero || undefined,
      invoiceUrl: p.invoiceUrl || p.bankSlipUrl || undefined,
      paymentUrl: p.bankSlipUrl || p.invoiceUrl || undefined,
      description: desc.split('\n')[0] || `Mensalidade ${instNum}/${totalInst}`,
      carneGroup,
      invoiceKind: 'MENSALIDADE',
      createdAt: p.dateCreated || new Date().toISOString()
    });
  }

  return invoices;
}

async function main() {
  console.log('--- ETAPA 1: Carregando banco de dados atual do Supabase ---');
  const getRes = await fetch(`${SUPABASE_URL}/rest/v1/site_settings?key=eq.lessa_club_ecosystem_v1&select=*`, {
    headers: { 'apikey': ANON_KEY, 'Authorization': `Bearer ${ANON_KEY}` }
  });
  const currentDbRows = await getRes.json();
  if (!currentDbRows[0]) throw new Error('site_settings lessa_club_ecosystem_v1 não encontrado');

  const currentEcosystem = currentDbRows[0].value;
  const existingSubs = currentEcosystem.subscriptions || [];

  // Preservar cadastros origin SITE
  const siteSubs = existingSubs.filter(s => s.origin === 'SITE');
  console.log(`Preservando ${siteSubs.length} assinaturas origin SITE:`);
  siteSubs.forEach(s => console.log(` - [SITE] ${s.holderName} (CPF: ${s.holderCpf}, Code: ${s.subscriptionCode})`));

  // Mapa de notas, anexos, transferCompleted existentes de cadastros Labcard anteriores
  const existingOverridesMap = new Map();
  for (const s of existingSubs) {
    if (s.origin === 'IMPORT_LABCARD') {
      existingOverridesMap.set(s.subscriptionCode, {
        transferCompleted: s.transferCompleted,
        transferredAt: s.transferredAt,
        notes: s.notes,
        attachments: s.attachments || [],
        visits: s.visits || [],
        cardStatus: s.cardStatus,
        documentStatus: s.members?.[0]?.documentStatus
      });
    }
  }

  console.log('\n--- ETAPA 2: Processando 2174 registros da Planilha de Ativos ---');
  const ativosRows = parseRows(P1_ATIVOS);
  const activeSubs = [];
  let currentActiveSub = null;

  for (const r of ativosRows) {
    const isDep = !r.plano || r.plano === '- R$ 0,00' || r.plano.startsWith('- ');
    const modInfo = getModalityInfo(r.plano);

    if (!isDep) {
      const isAnnual = (r.plano || '').toLowerCase().includes('anual');
      const monthlyVal = modInfo.isFree ? 0 : (isAnnual ? Math.round((modInfo.monthlyPrice / 12) * 100) / 100 : modInfo.monthlyPrice);
      const totalVal = modInfo.isFree ? 0 : (isAnnual ? modInfo.monthlyPrice : modInfo.monthlyPrice * 12);
      const formattedCpf = formatCpf(r.cpf);
      const formattedPhone = formatPhone(r.fone);

      const prev = existingOverridesMap.get(r.cartao);

      currentActiveSub = {
        id: `sub-labcard-${r.cartao}`,
        subscriptionCode: r.cartao,
        personType: 'PF',
        holderName: r.nome,
        holderCpf: formattedCpf,
        holderPhone: formattedPhone,
        holderBirthDate: r.nasc || '',
        addressCity: 'Porto Velho',
        addressState: 'RO',
        billingCycle: isAnnual ? 'ANNUAL' : 'MONTHLY',
        paymentMethod: modInfo.isFree ? 'COURTESY' : 'PIX',
        installments: 1,
        monthlyEquivalent: monthlyVal,
        totalContractValue: totalVal,
        dueDay: 10,
        status: prev?.transferCompleted ? 'ACTIVE' : 'PENDING_TRANSFER',
        transferCompleted: prev?.transferCompleted || false,
        transferredAt: prev?.transferredAt || undefined,
        cardStatus: prev?.cardStatus || undefined,
        origin: 'IMPORT_LABCARD',
        contractType: modInfo.contractType,
        contractAccepted: true,
        contractSignedAt: '2025-01-01T00:00:00.000Z',
        startDate: '2025-01-01',
        endDate: '2027-10-31',
        planSummaryLabel: r.plano,
        notes: prev?.notes || (r.cadPor ? `Cadastrado por ${r.cadPor} no Labcard` : 'Importado do Labcard'),
        members: [],
        invoices: [],
        attachments: prev?.attachments || [],
        visits: prev?.visits || [],
        additionalServices: [],
        createdAt: '2025-01-01T00:00:00.000Z',
        updatedAt: new Date().toISOString()
      };

      currentActiveSub.members.push({
        id: `mem-${r.cartao}`,
        subscriptionId: currentActiveSub.id,
        role: 'TITULAR',
        modalityCode: modInfo.modalityCode,
        modalityName: modInfo.modalityName,
        planCycleLabel: r.plano,
        fullName: r.nome,
        cpf: formattedCpf,
        birthDate: r.nasc || '',
        phone: formattedPhone,
        cardNumber: r.cartao,
        holderCardNumber: r.cartao,
        qrToken: `LC-${r.cartao}`,
        frontCardUrl: modInfo.frontCardUrl,
        backCardUrl: modInfo.backCardUrl,
        validityLabel: '10/2027',
        monthlyValue: monthlyVal,
        status: currentActiveSub.status,
        manualStatusOverride: true,
        documentStatus: prev?.documentStatus || undefined,
        createdAt: '2025-01-01T00:00:00.000Z'
      });

      activeSubs.push(currentActiveSub);
    } else {
      if (currentActiveSub) {
        const depModInfo = r.plano && r.plano !== '- R$ 0,00' ? getModalityInfo(r.plano) : getModalityInfo(currentActiveSub.planSummaryLabel);
        const depCpf = formatCpf(r.cpf);
        const depPhone = formatPhone(r.fone) || currentActiveSub.holderPhone;

        currentActiveSub.members.push({
          id: `mem-${r.cartao}`,
          subscriptionId: currentActiveSub.id,
          role: 'DEPENDENTE',
          modalityCode: depModInfo.modalityCode,
          modalityName: depModInfo.modalityName,
          planCycleLabel: depModInfo.modalityName,
          fullName: r.nome,
          cpf: depCpf,
          birthDate: r.nasc || '',
          phone: depPhone,
          cardNumber: r.cartao,
          holderCardNumber: currentActiveSub.subscriptionCode,
          qrToken: `LC-${r.cartao}`,
          frontCardUrl: depModInfo.frontCardUrl,
          backCardUrl: depModInfo.backCardUrl,
          validityLabel: '10/2027',
          monthlyValue: 0,
          status: currentActiveSub.status,
          manualStatusOverride: true,
          createdAt: '2025-01-01T00:00:00.000Z'
        });
      }
    }
  }

  console.log(`Planilha de Ativos processada com sucesso:`);
  console.log(` - Titulares (Assinaturas): ${activeSubs.length}`);
  const totalActiveMems = activeSubs.reduce((acc, s) => acc + s.members.length, 0);
  console.log(` - Total de Integrantes (Titulares + Dependentes): ${totalActiveMems}`);

  console.log('\n--- ETAPA 3: Consultando Asaas para Titulares Ativos com Planos Pagos ---');
  // Titulares pagos em activeSubs
  const paidActiveSubs = activeSubs.filter(s => s.monthlyEquivalent > 0);
  console.log(`Total de titulares ativos com planos pagos: ${paidActiveSubs.length}`);

  let asaasSyncedCount = 0;
  for (let i = 0; i < paidActiveSubs.length; i++) {
    const s = paidActiveSubs[i];
    const cleanCpf = s.holderCpf.replace(/\D/g, '');
    if (cleanCpf.length === 11) {
      try {
        const res = await queryAsaasByCpf(cleanCpf);
        const payments = res.payments || [];
        if (payments.length > 0) {
          s.invoices = mapAsaasPaymentsToInvoices(payments, s.id, s.subscriptionCode, s);
          if (res.customer?.id) s.asaasCustomerId = res.customer.id;
          asaasSyncedCount++;
          console.log(` [ASAAS SYNC] ${s.holderName} (CPF: ${s.holderCpf}) -> ${payments.length} cobranças vinculadas`);
        }
      } catch (err) {
        console.error(`Erro ao consultar Asaas para ${s.holderName}:`, err.message);
      }
      // Safe delay de 350ms para respeitar limites do Asaas
      await sleep(350);
    }
  }
  console.log(`Total de clientes ativos sincronizados com faturas do Asaas: ${asaasSyncedCount}`);

  console.log('\n--- ETAPA 4: Processando Planilha de Inativos & Cobranças Pendentes no Asaas ---');
  const inativosRows = parseRows(P2_INATIVOS);
  const inativosGroups = [];
  let curInatGroup = null;

  for (const r of inativosRows) {
    const isDep = !r.plano || r.plano === '- R$ 0,00' || r.plano.startsWith('- ');
    if (!isDep) {
      curInatGroup = { titular: r, dependentes: [] };
      inativosGroups.push(curInatGroup);
    } else {
      if (curInatGroup) curInatGroup.dependentes.push(r);
      else inativosGroups.push({ titular: null, dependentes: [r] });
    }
  }

  // Filtrar apenas inativos com CPF e pendências/inadimplência no Asaas
  const inativosToImport = [];
  const inatPaidTitulares = inativosGroups.filter(g => g.titular && !g.titular.plano.includes('R$ 0,00'));
  console.log(`Total de titulares inativos com planos pagos a consultar no Asaas: ${inatPaidTitulares.length}`);

  for (let i = 0; i < inatPaidTitulares.length; i++) {
    const g = inatPaidTitulares[i];
    const cleanCpf = g.titular.cpf.replace(/\D/g, '');
    if (cleanCpf.length === 11) {
      try {
        const res = await queryAsaasByCpf(cleanCpf);
        const payments = res.payments || [];
        const openOrOverdue = payments.filter(p => !p.deleted && (p.status === 'OVERDUE' || p.status === 'PENDING'));

        if (openOrOverdue.length > 0) {
          console.log(` [INATIVO COM DÉBITO] ${g.titular.nome} (CPF: ${g.titular.cpf}) -> ${openOrOverdue.length} cobranças em aberto no Asaas`);
          const modInfo = getModalityInfo(g.titular.plano);
          const isAnnual = (g.titular.plano || '').toLowerCase().includes('anual');
          const monthlyVal = modInfo.isFree ? 0 : (isAnnual ? Math.round((modInfo.monthlyPrice / 12) * 100) / 100 : modInfo.monthlyPrice);
          const totalVal = modInfo.isFree ? 0 : (isAnnual ? modInfo.monthlyPrice : modInfo.monthlyPrice * 12);
          const formattedCpf = formatCpf(g.titular.cpf);
          const formattedPhone = formatPhone(g.titular.fone);

          const inatSub = {
            id: `sub-labcard-${g.titular.cartao}`,
            subscriptionCode: g.titular.cartao,
            personType: 'PF',
            holderName: g.titular.nome,
            holderCpf: formattedCpf,
            holderPhone: formattedPhone,
            holderBirthDate: g.titular.nasc || '',
            addressCity: 'Porto Velho',
            addressState: 'RO',
            billingCycle: isAnnual ? 'ANNUAL' : 'MONTHLY',
            paymentMethod: 'PIX',
            installments: 1,
            monthlyEquivalent: monthlyVal,
            totalContractValue: totalVal,
            dueDay: 10,
            status: 'INACTIVE',
            transferCompleted: false,
            origin: 'IMPORT_LABCARD',
            contractType: modInfo.contractType,
            contractAccepted: false,
            contractSignedAt: '2025-01-01T00:00:00.000Z',
            startDate: '2025-01-01',
            endDate: '2025-12-31',
            planSummaryLabel: `${g.titular.plano} (Inativo com Débito)`,
            notes: `Inativo importado com ${openOrOverdue.length} mensalidades em aberto no Asaas para cobrança.`,
            members: [],
            invoices: mapAsaasPaymentsToInvoices(payments, `sub-labcard-${g.titular.cartao}`, g.titular.cartao, {
              holderName: g.titular.nome,
              holderCpf: formattedCpf,
              holderPhone: formattedPhone
            }),
            attachments: [],
            visits: [],
            additionalServices: [],
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: new Date().toISOString()
          };

          inatSub.members.push({
            id: `mem-${g.titular.cartao}`,
            subscriptionId: inatSub.id,
            role: 'TITULAR',
            modalityCode: modInfo.modalityCode,
            modalityName: modInfo.modalityName,
            planCycleLabel: g.titular.plano,
            fullName: g.titular.nome,
            cpf: formattedCpf,
            birthDate: g.titular.nasc || '',
            phone: formattedPhone,
            cardNumber: g.titular.cartao,
            holderCardNumber: g.titular.cartao,
            qrToken: `LC-${g.titular.cartao}`,
            frontCardUrl: modInfo.frontCardUrl,
            backCardUrl: modInfo.backCardUrl,
            validityLabel: 'EXPIRADO',
            monthlyValue: monthlyVal,
            status: 'INACTIVE',
            manualStatusOverride: true,
            createdAt: '2025-01-01T00:00:00.000Z'
          });

          // Dependentes vinculados a este titular inativo
          for (const dep of g.dependentes) {
            const depModInfo = dep.plano && dep.plano !== '- R$ 0,00' ? getModalityInfo(dep.plano) : modInfo;
            inatSub.members.push({
              id: `mem-${dep.cartao}`,
              subscriptionId: inatSub.id,
              role: 'DEPENDENTE',
              modalityCode: depModInfo.modalityCode,
              modalityName: depModInfo.modalityName,
              planCycleLabel: depModInfo.modalityName,
              fullName: dep.nome,
              cpf: formatCpf(dep.cpf),
              birthDate: dep.nasc || '',
              phone: formatPhone(dep.fone) || formattedPhone,
              cardNumber: dep.cartao,
              holderCardNumber: g.titular.cartao,
              qrToken: `LC-${dep.cartao}`,
              frontCardUrl: depModInfo.frontCardUrl,
              backCardUrl: depModInfo.backCardUrl,
              validityLabel: 'EXPIRADO',
              monthlyValue: 0,
              status: 'INACTIVE',
              manualStatusOverride: true,
              createdAt: '2025-01-01T00:00:00.000Z'
            });
          }

          inativosToImport.push(inatSub);
        }
      } catch (err) {
        console.error(`Erro ao consultar Asaas para inativo ${g.titular.nome}:`, err.message);
      }
      await sleep(350);
    }
  }

  console.log(`\nInativos com cobranças pendentes localizados: ${inativosToImport.length}`);

  console.log('\n--- ETAPA 5: Unificando Base Final e Salvando no Supabase ---');
  // Unir: Site Subs + Active Subs + Inativos com débito
  const allFinalSubscriptions = [
    ...siteSubs,
    ...activeSubs,
    ...inativosToImport
  ];

  console.log(`Total de assinaturas final: ${allFinalSubscriptions.length}`);
  const totalFinalMembers = allFinalSubscriptions.reduce((acc, s) => acc + s.members.length, 0);
  console.log(`Total de associados final (titulares + dependentes): ${totalFinalMembers}`);

  currentEcosystem.subscriptions = allFinalSubscriptions;
  currentEcosystem.updatedAt = new Date().toISOString();

  // Fazer backup local antes de salvar
  fs.writeFileSync('scripts/lessa_club_ecosystem_backup_before_sync.json', JSON.stringify(currentDbRows[0], null, 2), 'utf8');

  // Atualizar Supabase via PATCH
  const patchUrl = `${SUPABASE_URL}/rest/v1/site_settings?key=eq.lessa_club_ecosystem_v1`;
  const patchRes = await fetch(patchUrl, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'apikey': ANON_KEY,
      'Authorization': `Bearer ${ANON_KEY}`,
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({
      value: currentEcosystem,
      updated_at: new Date().toISOString()
    })
  });

  if (!patchRes.ok) {
    const errText = await patchRes.text();
    throw new Error(`Falha ao salvar no Supabase (${patchRes.status}): ${errText}`);
  }

  const savedResult = await patchRes.json();
  console.log('Sucesso! Banco de dados atualizado no Supabase.');
  console.log(`Assinaturas salvas: ${savedResult[0]?.value?.subscriptions?.length}`);
}

main().catch(console.error);
