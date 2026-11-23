-- ============================================================================
-- PERSISTENCIA ATOMICA POR CADASTRO, ANEXOS EM STORAGE E HISTORICO IMUTAVEL
-- ============================================================================

-- 1. Tabela principal de cadastros individuais (1 linha por associado = zero perda por sobrescrita cruzada)
CREATE TABLE IF NOT EXISTS public.club_records (
  subscription_code TEXT PRIMARY KEY,
  subscription_id TEXT NOT NULL,
  holder_name TEXT NOT NULL DEFAULT '',
  holder_cpf TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'PENDING_TRANSFER',
  payload JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_by TEXT DEFAULT 'admin'
);

CREATE INDEX IF NOT EXISTS idx_club_records_sub_id ON public.club_records (subscription_id);
CREATE INDEX IF NOT EXISTS idx_club_records_cpf ON public.club_records (holder_cpf);
CREATE INDEX IF NOT EXISTS idx_club_records_updated_at ON public.club_records (updated_at DESC);

-- 2. Tabela imutavel de historico de alteracoes (Audit Log para restauracao a qualquer momento)
CREATE TABLE IF NOT EXISTS public.club_record_history (
  id BIGSERIAL PRIMARY KEY,
  subscription_code TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  holder_name TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL DEFAULT 'SAVE',
  version INTEGER NOT NULL DEFAULT 1,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_club_record_history_code_date
  ON public.club_record_history (subscription_code, created_at DESC);

-- Trigger automatico: TODA insercao ou alteracao em club_records gera um snapshot imutavel no historico
CREATE OR REPLACE FUNCTION public.log_club_record_history()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.version := COALESCE(OLD.version, 1) + 1;
  END IF;

  INSERT INTO public.club_record_history (
    subscription_code,
    subscription_id,
    holder_name,
    action,
    version,
    snapshot,
    created_at
  ) VALUES (
    NEW.subscription_code,
    NEW.subscription_id,
    COALESCE(NEW.holder_name, ''),
    COALESCE(NEW.updated_by, TG_OP),
    NEW.version,
    NEW.payload,
    timezone('utc'::text, now())
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_club_records_history ON public.club_records;
CREATE TRIGGER trg_club_records_history
  BEFORE INSERT OR UPDATE ON public.club_records
  FOR EACH ROW
  EXECUTE FUNCTION public.log_club_record_history();

-- 3. Tabela dedicada de anexos (1 linha por arquivo, com URL no Storage e fallback em data_url, soft-delete)
CREATE TABLE IF NOT EXISTS public.club_attachments (
  id TEXT PRIMARY KEY,
  subscription_code TEXT NOT NULL,
  subscription_id TEXT NOT NULL DEFAULT '',
  member_id TEXT DEFAULT '',
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  storage_path TEXT DEFAULT '',
  public_url TEXT DEFAULT '',
  data_url TEXT DEFAULT '',
  file_size INTEGER DEFAULT 0,
  is_deleted BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_club_attachments_code ON public.club_attachments (subscription_code) WHERE is_deleted = false;
CREATE INDEX IF NOT EXISTS idx_club_attachments_sub_id ON public.club_attachments (subscription_id) WHERE is_deleted = false;

-- 4. RLS e permissoes para o painel Admin e Portal do Socio
ALTER TABLE public.club_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_record_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_attachments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access to club_records" ON public.club_records;
CREATE POLICY "Allow all access to club_records"
  ON public.club_records FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow read and insert club_record_history" ON public.club_record_history;
CREATE POLICY "Allow read and insert club_record_history"
  ON public.club_record_history FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all access to club_attachments" ON public.club_attachments;
CREATE POLICY "Allow all access to club_attachments"
  ON public.club_attachments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_records TO anon, authenticated;
GRANT SELECT, INSERT ON public.club_record_history TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.club_record_history_id_seq TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_attachments TO anon, authenticated;

-- 5. Bucket real de arquivos no Supabase Storage (club-files)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('club-files', 'club-files', true, 20971520)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 20971520;

DROP POLICY IF EXISTS "Public read club-files" ON storage.objects;
CREATE POLICY "Public read club-files"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'club-files');

DROP POLICY IF EXISTS "Allow upload club-files" ON storage.objects;
CREATE POLICY "Allow upload club-files"
  ON storage.objects FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'club-files');

DROP POLICY IF EXISTS "Allow update club-files" ON storage.objects;
CREATE POLICY "Allow update club-files"
  ON storage.objects FOR UPDATE TO anon, authenticated
  USING (bucket_id = 'club-files')
  WITH CHECK (bucket_id = 'club-files');

DROP POLICY IF EXISTS "Allow delete club-files" ON storage.objects;
CREATE POLICY "Allow delete club-files"
  ON storage.objects FOR DELETE TO anon, authenticated
  USING (bucket_id = 'club-files');
