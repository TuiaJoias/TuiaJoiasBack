# Contrato da API (para o frontend)

Base local: `http://localhost:3001` → no Next.js use `NEXT_PUBLIC_API_URL`.

- JSON em UTF-8. Datas em ISO 8601 (UTC).
- Rotas `/admin/*` e `GET /auth/me` exigem `Authorization: Bearer <accessToken>`.
- Todas as rotas usam JSON. As fotos **não** passam pela API: o navegador as envia
  direto ao Supabase Storage com uma URL assinada (veja [Upload de fotos](#upload-de-fotos)).

## Formato de erro

Todos os erros têm o mesmo formato, com mensagens prontas para exibir:

```json
{
  "statusCode": 400,
  "error": "Bad Request",
  "message": "Dados inválidos.",
  "details": ["Informe o título.", "Selecione uma categoria válida."],
  "path": "/admin/works",
  "timestamp": "2026-10-01T12:00:00.000Z"
}
```

`details` só aparece em erros de validação. Mostre `message` e, se existir, a lista
`details`.

| Status | Exemplos de `message` | O que o front faz |
|---|---|---|
| 400 | `Arquivo excede 25 MB.` · `Formato de arquivo não permitido. Envie JPG, PNG ou WEBP.` · `Limite de 15 trabalhos atingido. Exclua um trabalho para cadastrar outro.` · `Dados inválidos.` | Exibir a mensagem |
| 401 | `Credenciais inválidas.` (login) · `Token ausente ou inválido.` · `Sessão expirada. Faça login novamente.` | Fora do login: limpar o token e redirecionar para `/admin/login` |
| 404 | `Trabalho não encontrado.` · `Categoria não encontrada.` | Exibir / invalidar o cache |
| 409 | `Já existe uma categoria com esse nome ou slug.` · `Não é possível excluir uma categoria com trabalhos…` | Exibir |
| 429 | `Muitas tentativas. Aguarde um minuto e tente novamente.` | Exibir (login) |
| 502 | `Não foi possível salvar a imagem. Tente novamente.` | Oferecer "tentar de novo" |
| 503 | `Armazenamento de imagens não configurado.` | Exibir |
| 500 | `Erro interno.` | Mensagem genérica |

Falha de rede (sem resposta): exiba "Não foi possível conectar ao servidor".

## Tipos

```ts
interface Category { id: number; name: string; slug: string }

interface PublicWork {
  id: number;
  title: string;
  description: string | null;   // ex.: "Ouro 18k · peça única"
  imageUrl: string;             // WebP otimizado no Supabase
  width: number;                // para aspect-ratio e next/image
  height: number;
  isFavorite: boolean;          // "destaque"
  position: number;
  category: Category;
  createdAt: string;
}

interface AdminWork extends PublicWork {
  categoryId: number;
  isPublished: boolean;
  updatedAt: string;
}

interface WorkStats {
  total: number;      // "08 FOTOS"
  favorites: number;  // "02 DESTAQUES"
  hidden: number;     // "01 OCULTA"
  published: number;
  maxWorks: number;
  remaining: number;  // 0 → desabilitar o upload e mostrar o motivo
  upload: { maxFileSizeMb: number; acceptedMimeTypes: string[] };
}
```

## Rotas públicas

### `GET /works?category=aneis&page=1&limit=50`

Somente trabalhos publicados, por `position` crescente. Todos os parâmetros são
opcionais (`limit` vai até 100). Uma categoria inexistente retorna lista vazia.

```json
{ "items": [PublicWork], "meta": { "page": 1, "limit": 50, "total": 8, "totalPages": 1 } }
```

### `GET /works/:id`

Retorna um `PublicWork`, ou 404 se o trabalho não existir ou estiver oculto.

### `GET /categories`

Retorna `Category[]` na ordem de criação (Correntes, Anéis, Pulseiras, Colares,
Pingentes, Alianças, Restauração). Use para montar os filtros. Antes deles vem
"Todas", que é só ausência de filtro.

### `GET /health`

Retorna `{ "status": "ok", "database": "up" }`.

## Autenticação

### `POST /auth/login`

```json
// requisição
{ "email": "voce@exemplo.com", "password": "..." }
// 200
{
  "accessToken": "eyJ...",
  "tokenType": "Bearer",
  "expiresIn": "1d",
  "expiresAt": "2026-10-02T12:00:00.000Z",
  "user": { "id": 1, "name": "Ourives", "email": "voce@exemplo.com" }
}
```

Limite: 5 tentativas por minuto por IP (429 depois disso).

### `GET /auth/me`

Retorna `{ id, name, email }`. Use para validar o token ao abrir `/admin`.

## Rotas administrativas (JWT)

| Método e rota | Corpo | Resposta |
|---|---|---|
| `GET /admin/works?category=slug` | — | `AdminWork[]` (publicados e ocultos, por posição) |
| `GET /admin/works/stats` | — | `WorkStats` |
| `POST /admin/works/uploads` | `{ "contentType": "image/jpeg", "size": 3145728, "purpose": "create" \| "replace" }` | `201 UploadTicket` |
| `POST /admin/works` | `{ "uploadPath", "title", "categoryId", "description?", "isFavorite?", "isPublished?" }` | `201 AdminWork` |
| `PATCH /admin/works/:id` | `{ "title?", "categoryId?", "description?", "isFavorite?", "isPublished?", "uploadPath?" }` (com `uploadPath`, troca a foto) | `AdminWork` |
| `PATCH /admin/works/:id/favorite` | `{ "isFavorite": true }` | `AdminWork` |
| `PATCH /admin/works/:id/publish` | `{ "isPublished": false }` | `AdminWork` |
| `PATCH /admin/works/reorder` | `{ "items": [{ "id": 5, "position": 1 }, …] }` | `AdminWork[]` na nova ordem |
| `DELETE /admin/works/:id` | — | `204` |
| `GET /admin/categories` | — | `Category[]` |
| `POST /admin/categories` | `{ "name": "Brincos", "slug?": "brincos" }` | `201 Category` |
| `PATCH /admin/categories/:id` | `{ "name?": "...", "slug?": "..." }` | `Category` |
| `DELETE /admin/categories/:id` | — | `204` (409 se houver trabalhos) |

Regras:

- **Limites**: `title` até 120 caracteres; `description` até 160 (string vazia ou
  `null` apaga).
- **Upload**: uma foto por vez, no fluxo de 3 etapas abaixo. Para várias fotos, repita
  o fluxo para cada arquivo e mostre o progresso de cada um.
- **Reorder**: envie **todos** os trabalhos com posições `1..N`, sem repetição. Com um
  filtro de categoria ativo, mova o item dentro da lista completa e envie a lista
  completa. Uma lista parcial retorna 400.
- **Posição**: novos trabalhos entram no fim da ordem. Ao excluir, as posições
  seguintes sobem uma casa.
- **Categoria**: renomear não muda o `slug`, para não quebrar links. Envie `slug`
  para trocá-lo.

## Upload de fotos

A foto vai **do navegador direto para o Supabase Storage**, sem passar pela API. Assim
o upload funciona em qualquer hospedagem, inclusive na Vercel, que limita o corpo das
requisições a 4,5 MB.

```ts
interface UploadTicket {
  uploadPath: string;       // ex.: "staging/3f2a…c1.jpg"
  uploadUrl: string;        // URL assinada do Supabase (o token já vem nela)
  expiresInSeconds: number; // 7200
}
```

1. **Pedir a URL de envio:** `POST /admin/works/uploads` com `{ contentType, size, purpose }`.
   - `purpose` é `"create"` (foto nova, padrão) ou `"replace"` (troca da foto de um
     trabalho existente).
   - A API valida o formato (JPG, PNG ou WEBP), o tamanho declarado (`MAX_FILE_SIZE_MB`)
     e, para `"create"`, o limite `MAX_WORKS`. Se algo falhar, responde 400 antes de
     qualquer envio.
2. **Enviar a foto:** `PUT uploadUrl`, com o arquivo como corpo e o header
   `Content-Type` do arquivo. Não precisa de token nem de chave do Supabase.
   - O bucket recusa formato errado (HTTP 400 com `statusCode: "415"`) e arquivo grande
     demais (`"413"`).
   - A mesma URL não pode ser usada duas vezes (`"409"`).
3. **Salvar:** `POST /admin/works` (foto nova) ou `PATCH /admin/works/:id` (troca),
   enviando o `uploadPath`.
   - A API baixa o original e confere de novo o **conteúdo real** e o **tamanho real**.
   - Gera o WebP otimizado, publica no bucket público e grava o registro.
   - O original temporário é sempre apagado, com sucesso ou erro.

Erros da etapa 3:

| Situação | Resposta |
|---|---|
| Foto não enviada, ou URL expirada | 400 `A foto enviada não foi encontrada ou expirou. Envie novamente.` |
| Arquivo não é imagem (apesar do Content-Type) | 400 `Formato de arquivo não permitido. Envie JPG, PNG ou WEBP.` |
| Arquivo maior que o limite | 400 `Arquivo excede 25 MB.` |
| `uploadPath` fora do padrão | 400 `Envio de imagem inválido. Envie a foto novamente.` |

Originais abandonados (URL pedida, foto enviada, mas sem a etapa 3) são apagados
automaticamente depois de 1 hora.

## Notas de integração (Next.js)

### Imagens

Libere o domínio do Supabase em `next.config.ts`:

```ts
images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: '<id-do-projeto>.supabase.co',
      pathname: '/storage/v1/object/public/works/**',
    },
  ],
},
```

Use `width`/`height` do trabalho no `<Image>` ou como `aspect-ratio`. Isso evita
"pulos" de layout e diferencia as fotos 4/5 das 1/1 da galeria. As URLs nunca mudam
(cada foto tem um UUID), então o cache pode ser longo.

### Upload no painel

- `<input type="file" multiple accept="image/jpeg,image/png,image/webp">`. Com esse
  `accept`, o iPhone converte HEIC em JPEG ao enviar.
- Antes de enviar, valide tamanho e tipo usando `stats.upload.maxFileSizeMb` e
  `stats.upload.acceptedMimeTypes`, para não fixar esses valores no front. O backend
  valida de novo.
- Antes de enviar, compare a quantidade de arquivos selecionados com `stats.remaining`.
- O progresso da etapa 2 (PUT no Supabase) exige `XMLHttpRequest` (evento
  `upload.onprogress`), ou axios com `onUploadProgress`. O `fetch` não informa o
  progresso do envio.
- Depois de 100% do envio, a etapa 3 leva alguns segundos (otimização). Mostre algo
  como "Otimizando…".

### Token e proteção do `/admin`

Como o painel chama a API direto do navegador, o token precisa estar acessível no
cliente. Sugestão:

- Após o login, salve `accessToken` em um cookie `Secure; SameSite=Lax` com expiração
  em `expiresAt`.
- O `middleware.ts` redireciona `/admin` → `/admin/login` sem o cookie, e
  `/admin/login` → `/admin` com o cookie.
- Ao abrir o painel, chame `GET /auth/me`. Se vier 401, apague o cookie e volte ao
  login.

### TanStack Query

Chaves sugeridas: `['works', 'admin', category?]`, `['works', 'stats']`,
`['categories']`. Após criar, editar, excluir, favoritar, publicar ou reordenar,
invalide `['works']` (invalida lista e stats juntos). No reorder, aplique a nova
ordem otimisticamente e reverta se a requisição falhar.

### Botão "Publicar no site" do protótipo

Cada ação é salva na hora: não existe rascunho nem publicação em lote. O indicador do
cabeçalho pode refletir as requisições em andamento (`useIsMutating()`), com
"Salvando…" enquanto houver mutação e "Tudo publicado" quando não houver. Isso dispensa
o botão ou o deixa apenas informativo.
