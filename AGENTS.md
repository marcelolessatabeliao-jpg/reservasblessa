# Regras do Projeto — Reserva Lessa / Lessa Club

## Deploy e GitHub
- Sempre que concluir alterações de código neste repositório, validar com `npx tsc --noEmit` e `npm run build`, fazer commit apenas dos arquivos relevantes da tarefa (sem incluir arquivos temporários como `supabase/.temp/cli-latest`) e **sempre subir para o GitHub** (`git push origin main`) para disparar o deploy automático no Vercel.
- Quando houver alterações em Edge Functions em `supabase/functions/`, publicar também no Supabase (`npx supabase functions deploy <funcoes> --project-ref lcymbetnnuokrijynmjm --yes`).

## Integridade de Dados do Lessa Club
- A fonte da verdade soberana para cadastros individuais é `public.club_records` (1 linha por `subscription_code`) + histórico imutável em `public.club_record_history`.
- Todo carregamento completo de `club_records` ou `club_attachments` deve usar paginação via `.range()` em lotes de 1.000 linhas (para nunca truncar no limite padrão de 1.000 linhas do PostgREST).
- Todos os anexos, fotos e comprovantes devem ser enviados ao Supabase Storage (bucket `club-files`) e registrados em `public.club_attachments` (nunca depender de base64 em JSON).
- Nunca sobrescrever uma versão mais recente em `club_records` com um estado mais antigo nem apagar faturas vinculadas ao Asaas (`asaasPaymentId`) fora de ações explícitas de edição/exclusão de faturas.
