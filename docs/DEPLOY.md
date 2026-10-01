# Deploy em produção (Vercel)

```
Navegador ──► Front Next.js (Vercel) ──► API NestJS (Vercel Function) ──► PostgreSQL (Supabase)
    │                                          │
    └── PUT da foto (URL assinada) ──► Supabase Storage "uploads" ──► API otimiza ──► "works" (público, CDN)
```

A foto nunca passa pelo corpo de uma requisição da API: o navegador a envia direto ao
Supabase (veja [API.md → Upload de fotos](API.md#upload-de-fotos)). Por isso a API
cabe no limite de 4,5 MB por requisição da Vercel.

## Plano da Vercel: comece no Hobby, migre para o Pro antes de lançar

- **Durante a configuração e os testes:** o plano **Hobby** (grátis) basta. Use as
  URLs `*.vercel.app`, sem divulgar o site.
- **Antes de lançar** (domínio próprio, divulgação, uso pela ourivesaria): o Hobby é só
  para uso pessoal **não comercial**, então faça o upgrade para o **Pro** em
  **Settings → Billing**. Os projetos, variáveis e deploys continuam onde estão.
- **Teste grátis do Pro:** existe um de 14 dias (um por conta). Ele é útil só para
  conferir o Pro perto do lançamento, porque termina rápido.

## Pré-requisitos

- Os dois projetos em repositórios Git (GitHub, GitLab ou Bitbucket). Também dá para
  usar a [Vercel CLI](https://vercel.com/docs/cli) (`vercel`) direto de cada pasta.
- Supabase configurado ([SUPABASE.md](SUPABASE.md)): secret key e buckets
  (`npm run storage:setup`).

## 1. Banco de produção (a partir do seu computador)

A Vercel não executa migrations. Rode-as uma vez do seu computador, apontando para o
banco de produção. Variáveis passadas na linha de comando têm prioridade sobre o `.env`.

```bash
# Supabase → Connect → Transaction pooler (porta 6543)
export PROD_DB='postgresql://postgres.<id>:<senha>@<host>.pooler.supabase.com:6543/postgres'

DATABASE_URL="$PROD_DB" DATABASE_SSL=true npm run migration:run   # cria as tabelas
DATABASE_URL="$PROD_DB" DATABASE_SSL=true npm run seed            # categorias iniciais
DATABASE_URL="$PROD_DB" DATABASE_SSL=true npm run admin:create    # administrador
```

Em cada nova migration, repita a primeira linha antes do deploy da API.

## 2. API na Vercel

1. **Add New → Project** → importe o repositório da API. O framework **NestJS** é
   detectado sozinho (entrada `src/main.ts`) e não é preciso configurar build nem
   output.
2. **Environment Variables**: marque só **Production** por enquanto, para os previews
   não usarem o banco de produção.

   ```env
   DATABASE_URL=postgresql://...:6543/postgres
   DATABASE_SSL=true
   JWT_SECRET=<openssl rand -base64 48 — diferente do local>
   JWT_EXPIRES_IN=1d
   CORS_ORIGINS=https://<front>.vercel.app
   SUPABASE_URL=https://<id>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=sb_secret_...
   SUPABASE_STORAGE_BUCKET=works
   SUPABASE_UPLOADS_BUCKET=uploads
   MAX_FILE_SIZE_MB=25
   MAX_WORKS=15
   ```

   A Vercel define `NODE_ENV=production`, e o Node 24 vem do `engines` do
   `package.json`.
3. **Deploy**. Teste `https://<api>.vercel.app/health`, que deve retornar
   `{"status":"ok","database":"up"}`.

## 3. Front na Vercel

1. **Add New → Project** → importe o repositório do front (Next.js detectado).
2. Variável: `NEXT_PUBLIC_API_URL=https://<api>.vercel.app`, sem barra no final.
3. **Deploy**.
4. Se a URL final do front for diferente da que você pôs em `CORS_ORIGINS`, atualize a
   variável na API e faça **Redeploy**.

## 4. Domínio próprio (no lançamento)

1. Registre o `.com.br` no [Registro.br](https://registro.br). O domínio grátis do Pro
   não inclui `.com.br`.
2. No projeto do front: **Settings → Domains → Add** e siga as instruções de DNS.
3. Atualize `CORS_ORIGINS` da API (ex.: `https://tuiajoias.com.br,https://www.tuiajoias.com.br`)
   e faça **Redeploy** da API.

## Checklist de produção

- [ ] Plano **Pro** ativo antes de divulgar o site.
- [ ] `JWT_SECRET` exclusivo de produção, com 32+ caracteres.
- [ ] `CORS_ORIGINS` só com os domínios reais do front, sem `localhost`.
- [ ] `DATABASE_SSL=true` e o pooler de transações (porta 6543).
- [ ] Secret key do Supabase só nas variáveis da API.
- [ ] Buckets `works` (público) e `uploads` (privado) criados (`npm run storage:setup`).
- [ ] `GET /health` respondendo `{"status":"ok","database":"up"}`.
- [ ] Login, upload de uma foto real e exibição no site testados.

## Notas

- **Limite de login:** o limite de 5 tentativas por minuto fica em memória, por
  instância. Na Vercel cada instância tem a sua contagem. No Pro, reforce com uma regra
  de rate limit do **Vercel Firewall** para `POST /auth/login`.
- **Previews:** deploys de preview usam as variáveis do ambiente **Preview**. Se quiser
  testar previews da API, aponte-os para outro banco e outro projeto Supabase.
- **SSL do banco:** com `DATABASE_SSL=true` a conexão é criptografada, mas a cadeia do
  certificado não é validada (`rejectUnauthorized: false`), porque o Supabase usa CA
  própria. Para validar também, adicione o certificado da CA em
  `src/database/typeorm-options.ts`.
- **Builder da Vercel e o helmet:** o type-check do builder resolve os tipos CommonJS do
  `helmet`. Por isso `src/app.setup.ts` o carrega com `createRequire`; não troque para
  `import helmet from 'helmet'`.
- **Alternativa sem Vercel:** o `Dockerfile` da raiz continua funcionando em Render,
  Railway ou Fly.io. Ele aplica as migrations e o seed ao iniciar. Nesses serviços, use
  o **Session pooler** (porta 5432).
