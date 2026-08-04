# bot-api

The RAG engine for this project. A FastAPI service that handles document ingestion, vector search, LLM query augmentation, and Discord OAuth authentication. Both the Discord bot and the web frontend communicate with this service.

## How It Works

- **Ingest** — PDFs are chunked with LangChain's `RecursiveCharacterTextSplitter`, embedded with a HuggingFace sentence-transformer model, and stored in a PostgreSQL pgvector collection scoped to the uploading user's Discord ID.
- **Query** — Incoming queries are matched against the user's documents via cosine similarity search, then the retrieved context is injected into a prompt sent to a self-hosted Ollama model.
- **Auth** — The web frontend authenticates via Discord OAuth 2.0 (Authorization Code + PKCE). On success, the server issues a short-lived HS256 JWT. The Discord bot authenticates via a shared internal API key.

## Endpoints

| Method | Path | Caller | Description |
|--------|------|--------|-------------|
| `POST` | `/ingest` | Bot | Queue a PDF from a URL for ingestion |
| `POST` | `/upload` | Frontend | Upload a raw PDF file for ingestion (multipart) |
| `POST` | `/query` | Bot, Frontend | Run a RAG query against the user's documents |
| `GET` | `/documents` | Bot, Frontend | List filenames ingested by the authenticated user |
| `DELETE` | `/documents/{filename}` | Bot, Frontend | Delete all chunks for a given file |
| `POST` | `/auth/discord` | Frontend | Exchange a Discord OAuth code for a JWT |

## Requirements

- Python 3.12
- A running PostgreSQL instance with the `pgvector` extension available
- A running [Ollama](https://ollama.com) instance with your chosen model pulled
- A Discord application with OAuth2 configured (for the web frontend path)

## Setup

```bash
cp .env.example .env
# Fill in all values in .env

pip install -r requirements.txt
python main.py
```

The server listens on port `5000` by default.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `HOST` | Bind address (default: `0.0.0.0`) |
| `FRONTEND_URL` | Allowed CORS origin for the frontend |
| `DATABASE_URL` | PostgreSQL connection string (`postgresql://...`) |
| `OLLAMA_URL` | Full URL to the Ollama generate endpoint |
| `OLLAMA_MODEL` | Name of the Ollama model to use |
| `HF_EMBED_MODEL` | HuggingFace model name for generating embeddings |
| `MODEL_PROMPT` | System prompt prepended to every LLM call |
| `DISCORD_CLIENT_ID` | Discord application client ID |
| `DISCORD_CLIENT_SECRET` | Discord application client secret |
| `DISCORD_REDIRECT_URI` | OAuth redirect URI registered in the Discord application |
| `JWT_SECRET` | Secret used to sign and verify JWTs |
| `INTERNAL_API_KEY` | Shared secret for bot-to-API authentication |

## Docker

```bash
docker build -t bot-api .
docker run -p 5000:5000 --env-file .env bot-api
```
