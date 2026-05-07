# Solarabase

Multi-tenant Knowledgebase-as-a-Service. Upload documents, auto-index with PageIndex (LLM-powered hierarchical tree index), and query them via an AI agent chat. Per-KB API keys, Stripe billing, Google OAuth.

## Stack

- **Backend**: Rust + Axum + SQLx
- **Frontend**: React + Vite + Tailwind CSS
- **Database**: PostgreSQL (Neon)
- **Storage**: S3-compatible (DigitalOcean Spaces)
- **LLM**: OpenAI (gpt-4o default, configurable per-KB)
- **Auth**: Google OAuth → JWT httpOnly cookie
- **Billing**: Stripe (Free / Pro / Team)

## Local Development

### Prerequisites

- Rust 1.75+
- Node.js 20+
- PostgreSQL (or Neon DB)
- S3-compatible bucket (DigitalOcean Spaces, MinIO, etc.)
- OpenAI API key
- Google OAuth credentials

### Setup

```bash
# Clone
git clone git@github.com:ethereumdegen/solarabase-monorepo.git
cd solarabase-monorepo

# Configure
cp .env.example .env
# Edit .env with your credentials

# Backend
cargo run

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

The backend runs on `http://localhost:3000` and serves the API + static frontend.
The Vite dev server runs on `http://localhost:5173` and proxies API calls to `:3000`.

### Database

Migrations run automatically on startup via `sqlx::migrate!()`. No manual migration step needed.

## Deploy to Railway (Docker)

### 1. Create Railway project

```bash
# Install Railway CLI
npm i -g @railway/cli
railway login
railway init
```

### 2. Add PostgreSQL

Add a PostgreSQL plugin in the Railway dashboard, or use an external Neon DB.

### 3. Set environment variables

In the Railway dashboard (or via CLI), set all variables from `.env.example`:

```
DATABASE_URL=postgres://...
S3_REGION=nyc3
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
S3_BUCKET=solarabase-docs
S3_ENDPOINT=https://nyc3.digitaloceanspaces.com
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o
GOOGLE_CLIENT_ID=...apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://YOUR_DOMAIN/auth/google/callback
JWT_SECRET=<random-64-char-string>
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRO_PRICE_ID=price_...
STRIPE_TEAM_PRICE_ID=price_...
HOST=0.0.0.0
PORT=3000
PUBLIC_URL=https://YOUR_DOMAIN
```

### 4. Deploy

```bash
railway up
```

Railway auto-detects the `Dockerfile` and `railway.toml`. The multi-stage Docker build:
1. Builds the React frontend (`npm run build`)
2. Compiles the Rust binary (`cargo build --release`)
3. Packages into a slim Debian runtime image

The health check hits `/api/health`.

### 5. Configure Google OAuth

Update `GOOGLE_REDIRECT_URI` to match your Railway domain:
```
https://your-app.up.railway.app/auth/google/callback
```

Also add this URI in the Google Cloud Console → Credentials → OAuth 2.0 Client → Authorized redirect URIs.

### 6. Configure Stripe Webhook

In the Stripe Dashboard → Webhooks, add endpoint:
```
https://your-app.up.railway.app/webhooks/stripe
```

Events to listen for:
- `checkout.session.completed`
- `customer.subscription.deleted`

## Architecture

```
User → Google OAuth → JWT Cookie → Axum API
                                      ↓
                              KbAccess extractor
                          (workspace membership OR API key)
                                      ↓
                              Per-KB RagAgent (cached)
                                   ↓      ↓
                            PageIndex    LLM Query
                            (indexer)    (tools: list_docs, search_index, read_page)
```

- **Multi-tenancy**: Workspace → Knowledgebase → Documents. All queries scoped by `kb_id`.
- **Indexer**: Background worker processes all pending documents globally. Builds per-page tree indexes + root document index via LLM.
- **RagCache**: LRU cache of `Arc<RagAgent>` per KB, evicted after 30min idle.
- **API Keys**: `sb_live_*` keys scoped to a single KB. SHA256 hashed, shown once on creation.
- **Retrieve endpoint**: `/api/kb/:id/retrieve` — RAG without LLM synthesis, for external agent integration.

## Plan Limits

| | Free | Pro ($19/mo) | Team ($49/mo) |
|---|---|---|---|
| KBs | 1 | 5 | Unlimited |
| Docs/KB | 50 | Unlimited | Unlimited |
| Queries/mo | 100 | 5,000 | Unlimited |
| Members | 1 | 3 | Unlimited |
| File size | 10 MB | 50 MB | 100 MB |

## License

Proprietary. All rights reserved.
