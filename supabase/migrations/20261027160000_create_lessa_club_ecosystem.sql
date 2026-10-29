-- ============================================================================
-- ECOSSISTEMA DE ASSINATURAS LESSA CLUB (Substituição Completa do Labcard)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.club_modalities (
    id TEXT PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    subtitle TEXT,
    verse TEXT,
    monthly_price NUMERIC(10,2) NOT NULL DEFAULT 0,
    annual_price NUMERIC(10,2) NOT NULL DEFAULT 0,
    annual_installment NUMERIC(10,2) NOT NULL DEFAULT 0,
    adhesion_fee NUMERIC(10,2) NOT NULL DEFAULT 0,
    max_dependents INTEGER NOT NULL DEFAULT 99,
    grace_period_days INTEGER NOT NULL DEFAULT 0,
    front_card_url TEXT NOT NULL,
    dependent_front_card_url TEXT,
    back_card_url TEXT NOT NULL,
    dependent_back_card_url TEXT,
    requires_document BOOLEAN NOT NULL DEFAULT false,
    document_label TEXT,
    is_free_tier BOOLEAN NOT NULL DEFAULT false,
    is_corporate BOOLEAN NOT NULL DEFAULT false,
    requires_vehicle BOOLEAN NOT NULL DEFAULT false,
    visible_on_site BOOLEAN NOT NULL DEFAULT true,
    visible_to_consultants BOOLEAN NOT NULL DEFAULT true,
    visible_to_influencers BOOLEAN NOT NULL DEFAULT true,
    contract_type TEXT NOT NULL DEFAULT 'ADESAO_PF',
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.club_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_code TEXT UNIQUE NOT NULL,
    person_type TEXT NOT NULL DEFAULT 'PF', -- PF | PJ
    holder_name TEXT NOT NULL,
    holder_cpf TEXT NOT NULL,
    holder_rg TEXT,
    holder_birth_date TEXT,
    holder_sex TEXT,
    holder_marital_status TEXT,
    holder_phone TEXT NOT NULL,
    holder_email TEXT,
    address_cep TEXT,
    address_street TEXT,
    address_number TEXT,
    address_complement TEXT,
    address_neighborhood TEXT,
    address_city TEXT DEFAULT 'Ariquemes',
    address_state TEXT DEFAULT 'RO',
    billing_cycle TEXT NOT NULL DEFAULT 'ANNUAL', -- MONTHLY | ANNUAL
    payment_method TEXT NOT NULL DEFAULT 'PIX', -- PIX | CREDIT_CARD | BOLETO | COURTESY | LOCAL
    installments INTEGER NOT NULL DEFAULT 1,
    monthly_equivalent NUMERIC(10,2) NOT NULL DEFAULT 0,
    total_contract_value NUMERIC(10,2) NOT NULL DEFAULT 0,
    due_day INTEGER NOT NULL DEFAULT 10,
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | PENDING | OVERDUE | INACTIVE | CANCELLED | PROSPECT
    origin TEXT NOT NULL DEFAULT 'SITE', -- SITE | ADMIN | IMPORT_LABCARD
    consultant_id TEXT,
    consultant_name TEXT,
    influencer_name TEXT,
    plan_summary_label TEXT NOT NULL,
    vehicle_model TEXT,
    vehicle_plate TEXT,
    vehicle_color TEXT,
    notes TEXT,
    asaas_customer_id TEXT,
    asaas_subscription_id TEXT,
    asaas_payment_id TEXT,
    asaas_invoice_url TEXT,
    contract_type TEXT NOT NULL DEFAULT 'ADESAO_PF',
    contract_accepted BOOLEAN NOT NULL DEFAULT true,
    contract_signed_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    contract_signature_ip TEXT,
    start_date DATE NOT NULL DEFAULT CURRENT_DATE,
    end_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '1 year'),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.club_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES public.club_subscriptions(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'TITULAR', -- TITULAR | DEPENDENTE
    modality_code TEXT NOT NULL,
    modality_label TEXT NOT NULL,
    full_name TEXT NOT NULL,
    cpf TEXT NOT NULL,
    rg TEXT,
    birth_date TEXT,
    phone TEXT,
    photo_url TEXT,
    document_proof_url TEXT,
    card_number TEXT UNIQUE NOT NULL,
    holder_card_number TEXT,
    qr_token TEXT UNIQUE NOT NULL,
    front_card_url TEXT NOT NULL,
    back_card_url TEXT NOT NULL,
    validity_label TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | PENDING | INACTIVE | CANCELLED
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.club_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES public.club_subscriptions(id) ON DELETE CASCADE,
    holder_name TEXT NOT NULL,
    holder_cpf TEXT NOT NULL,
    installment_number INTEGER NOT NULL DEFAULT 1,
    total_installments INTEGER NOT NULL DEFAULT 1,
    reference_month TEXT NOT NULL,
    amount NUMERIC(10,2) NOT NULL,
    due_date DATE NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    payment_method TEXT NOT NULL DEFAULT 'PIX',
    status TEXT NOT NULL DEFAULT 'PENDING', -- PAID | PENDING | OVERDUE | CANCELLED
    asaas_payment_id TEXT,
    invoice_url TEXT,
    pix_payload TEXT,
    pix_qr_code TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

ALTER TABLE public.club_modalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to club_modalities" ON public.club_modalities FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to club_subscriptions" ON public.club_subscriptions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to club_members" ON public.club_members FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to club_invoices" ON public.club_invoices FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_modalities TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_subscriptions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_members TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_invoices TO anon, authenticated;
