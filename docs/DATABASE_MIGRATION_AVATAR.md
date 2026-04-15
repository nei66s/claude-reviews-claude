# Migração: Adicionar coluna avatar na tabela app_users

Execute o seguinte comando SQL no seu PostgreSQL para adicionar suporte a fotos de perfil:

```sql
-- Adicionar coluna avatar (TEXT para armazenar base64)
ALTER TABLE public.app_users 
ADD COLUMN IF NOT EXISTS avatar TEXT;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_app_users_avatar ON public.app_users (id);
```

## Status

- ✅ Backend: API /auth/profile pronta para receber avatar
- ✅ Frontend: Página de perfil com upload de foto
- ✅ Database: Query pronta para update (função updateDbUser)
- ⏳ TODO: Executar o SQL acima no seu PostgreSQL

## Como o Avatar é Armazenado

O avatar é armazenado como **base64** (data URL) na coluna `avatar`:
- Formato: `data:image/jpeg;base64,...`
- Máximo: 500KB
- Tipos aceitos: JPG, PNG, GIF

## Fluxo

1. Usuário seleciona arquivo de imagem
2. Convertido para base64 no cliente
3. Enviado para `/auth/profile` via PUT
4. Salvo no PostgreSQL (coluna `avatar`)
5. Recuperado no login e mostrado no avatar

## Rollback (se necessário)

```sql
ALTER TABLE public.app_users DROP COLUMN IF EXISTS avatar;
```
