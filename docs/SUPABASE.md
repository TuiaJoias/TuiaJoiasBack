# Configurar o Supabase Storage

A API guarda as fotos no Supabase Storage. O PostgreSQL guarda só a URL pública
(`imageUrl`) e a chave do arquivo (`storagePath`, ex.: `works/3f2a…c1.webp`).

São usados dois buckets:

| Bucket | Acesso | Para quê |
|---|---|---|
| `works` (`SUPABASE_STORAGE_BUCKET`) | **Público** | Fotos otimizadas (WebP) exibidas no site |
| `uploads` (`SUPABASE_UPLOADS_BUCKET`) | **Privado** | Originais enviados direto pelo navegador. A API os lê, otimiza e apaga em seguida. |

O navegador envia o original para `uploads` com uma URL assinada, válida só para aquele
arquivo, gerada pela API. Assim a foto não passa pelo corpo da requisição da API, o que
permite hospedar a API na Vercel (limite de 4,5 MB por requisição).

## 1. Criar o projeto

1. Acesse <https://supabase.com/dashboard> e entre (ou crie uma conta).
2. **New project**:
   - **Name**: `tuia-joias`
   - **Database password**: gere uma senha forte e guarde-a. Você só vai precisar
     dela se usar o PostgreSQL do Supabase em produção (passo 6).
   - **Region**: **South America (São Paulo)**, mais perto dos visitantes.
3. Aguarde a criação, que leva cerca de 2 minutos.

## 2. Copiar a URL e a secret key

1. **Project Settings → API Keys** → aba **Publishable and secret API keys**.
   - Se aparecer o botão **Create new API keys**, clique nele. Isso não afeta nada
     que já exista.
2. Em **Secret keys**, revele e copie a chave `default` (começa com `sb_secret_`).
3. Copie a **Project URL** (`https://<id-do-projeto>.supabase.co`, **sem** `/rest/v1`
   no final). Ela fica em **Project Settings → Data API**, ou no botão **Connect** no
   topo do painel.

> As chaves legadas `anon` e `service_role` estão sendo descontinuadas pelo Supabase
> (fim de 2026). Use a **secret key** nova. A API aceita os dois formatos, mas não
> dependa da legada.

Preencha no `.env` da API:

```env
SUPABASE_URL=https://<id-do-projeto>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<cole-aqui-a-secret-key>
SUPABASE_STORAGE_BUCKET=works
SUPABASE_UPLOADS_BUCKET=uploads
```

### Segurança da secret key

- Ela tem acesso total ao projeto e ignora o RLS. Fica **somente** no `.env` da API e
  nas variáveis do servidor de produção.
- **Nunca** coloque no frontend, em variável `NEXT_PUBLIC_*`, em commit ou em print.
- Se vazar: **API Keys → ⋯ → Revoke** na chave, crie outra e atualize o `.env`.

## 3. Criar os buckets (automático)

```bash
npm run storage:setup
```

O script é idempotente:

- cria o `works` (público, 25 MB, só `image/webp`). Se já existir, apenas confere se
  está público;
- cria ou atualiza o `uploads` (privado, `MAX_FILE_SIZE_MB`, `image/jpeg`, `image/png`
  e `image/webp`).

Saída esperada:

```
✔ Bucket "works" já existe e está público.
✔ Bucket "uploads" criado (privado).
```

<details>
<summary>Prefere criar pelo painel?</summary>

**Storage → New bucket**, duas vezes:

| Campo | `works` | `uploads` |
|---|---|---|
| Public bucket | **ligado** | **desligado** |
| Restrict file size | 25 MB | 25 MB |
| Allowed MIME types | `image/webp` | `image/jpeg, image/png, image/webp` |

</details>

Não é preciso criar policies (RLS):

- a leitura do `works` é pública por ser um bucket público;
- a escrita é feita pela API com a secret key, que ignora o RLS;
- o envio para o `uploads` usa URLs assinadas, que já carregam a permissão.

**Não** crie policies de INSERT/UPDATE/DELETE para usuários anônimos.

## 4. Conferir o limite global de upload

**Storage → Settings → Global file size limit**: deve ser **maior ou igual a 25 MB**.
No plano gratuito o máximo é 50 MB, então basta conferir que não está abaixo de 25 MB.

Reinicie a API. O aviso `Supabase Storage não configurado` deve sumir do log.

## 5. Testar um upload

O jeito mais simples é pelo painel: `npm run dev` no front, `/admin`, arraste uma foto.

Pelo terminal, o fluxo tem 3 etapas, como no navegador:

```bash
API=http://localhost:3001
FOTO=/caminho/para/foto.jpg
json() { node -pe "JSON.parse(require('fs').readFileSync(0)).$1"; }

# Login (troque email e senha)
TOKEN=$(curl -s -X POST $API/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"voce@exemplo.com","password":"sua-senha"}' | json accessToken)

# 1. Pede a URL assinada
TICKET=$(curl -s -X POST $API/admin/works/uploads -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"contentType\":\"image/jpeg\",\"size\":$(stat -f%z "$FOTO")}")

# 2. Envia a foto direto ao Supabase
curl -s -X PUT "$(echo "$TICKET" | json uploadUrl)" -H 'Content-Type: image/jpeg' --data-binary @"$FOTO"

# 3. Cria o trabalho na categoria 2 (Anéis)
curl -s -X POST $API/admin/works -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d "{\"title\":\"Anel solitário\",\"categoryId\":2,\"uploadPath\":\"$(echo "$TICKET" | json uploadPath)\"}"
```

> No Linux, troque `stat -f%z` por `stat -c%s`.

A resposta da etapa 3 traz `imageUrl`. Abra no navegador: a foto deve aparecer. Em
**Storage → works → works/** o arquivo `.webp` estará listado, e **uploads → staging/**
fica vazio.

Erros comuns:

| Resposta | Causa provável |
|---|---|
| `503 Armazenamento de imagens não configurado.` | `.env` sem `SUPABASE_URL` ou sem a chave, ou API não reiniciada |
| `502 Não foi possível preparar o envio…` / `…salvar a imagem.` | Bucket inexistente ou com outro nome (rode `npm run storage:setup`), chave errada ou revogada. O log da API mostra o motivo. |
| `Invalid path specified in request URL` no log | `SUPABASE_URL` com algo depois de `.supabase.co` (ex.: `/rest/v1/`) |
| PUT responde `"statusCode":"415"` | Formato fora dos MIME types do bucket `uploads` |
| A imagem não abre (`400`/`404` na URL) | Bucket `works` criado como privado: **Edit bucket → Public bucket** |

## 6. (Opcional) Usar o PostgreSQL do Supabase em produção

O mesmo projeto também tem um PostgreSQL 17 gerenciado, a mesma versão do Docker local.

1. Botão **Connect** (topo do painel) → **Connection String**:
   - **API na Vercel (serverless):** use o **Transaction pooler** (porta **6543**).
   - **API em servidor contínuo** (Render, Railway, Docker): use o **Session pooler**
     (porta **5432**).
   - Os dois funcionam em redes IPv4; a conexão direta é só IPv6.
2. Copie a URL e troque `[YOUR-PASSWORD]` pela senha do passo 1.
3. Nas variáveis de produção:

```env
DATABASE_URL=postgresql://postgres.<id>:<senha>@<host-do-pooler>.pooler.supabase.com:6543/postgres
DATABASE_SSL=true
```

4. Crie as tabelas, as categorias e o admin a partir do seu computador (veja
   [DEPLOY.md](DEPLOY.md)).

> Projetos no plano gratuito são **pausados após ~7 dias sem atividade** (banco e
> storage ficam fora do ar até você reativar no painel). Para um site em produção,
> considere o plano Pro.
