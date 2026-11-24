-- Corrige disparo duplo do trigger de historico em UPSERT (INSERT ... ON CONFLICT DO UPDATE).
-- Antes, BEFORE INSERT OR UPDATE disparava 2x (1x no INSERT com version=1 e 1x no UPDATE),
-- dobrando o volume de gravacao JSONB e WAL no PostgreSQL.
-- Agora: BEFORE UPDATE apenas incrementa version, e AFTER INSERT OR UPDATE grava exatamente 1 snapshot.

CREATE OR REPLACE FUNCTION public.bump_club_record_version()
RETURNS TRIGGER AS $$
BEGIN
  NEW.version := COALESCE(OLD.version, 1) + 1;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.log_club_record_history()
RETURNS TRIGGER AS $$
BEGIN
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
    COALESCE(NEW.version, 1),
    NEW.payload,
    timezone('utc'::text, now())
  );
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_club_records_history ON public.club_records;
DROP TRIGGER IF EXISTS trg_club_records_bump_version ON public.club_records;

CREATE TRIGGER trg_club_records_bump_version
  BEFORE UPDATE ON public.club_records
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_club_record_version();

CREATE TRIGGER trg_club_records_history
  AFTER INSERT OR UPDATE ON public.club_records
  FOR EACH ROW
  EXECUTE FUNCTION public.log_club_record_history();
