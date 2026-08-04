# frontend

The web interface for the RAG system. A React + TypeScript single-page application where users authenticate with Discord, upload PDF documents, and query their knowledge base through a chat UI.

## How It Works

Authentication follows the Discord OAuth 2.0 Authorization Code flow with PKCE. The frontend generates a code challenge locally, redirects to Discord, and on return exchanges the code and verifier for a JWT issued by `bot-api`. That JWT is stored in `localStorage` and sent as a `Bearer` token on every subsequent API request.

Once authenticated, users can upload PDFs (up to 20 MB), chat against their ingested documents, and delete documents they no longer need. All API calls are scoped to the authenticated user's Discord ID.

## Requirements

- Node.js 18+
- A running `bot-api` instance
- A Discord application with a redirect URI configured to match `VITE_DISCORD_REDIRECT_URI`

## Setup

```bash
cp .env.example .env
# Fill in all values in .env

npm install
npm run dev
```

The dev server starts at `http://localhost:5173`.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE_URL` | Base URL of the `bot-api` service (e.g. `http://localhost:5000`) |
| `VITE_DISCORD_CLIENT_ID` | Discord application client ID |
| `VITE_DISCORD_REDIRECT_URI` | OAuth redirect URI (must match the value registered in the Discord application) |

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start the Vite development server |
| `npm run build` | Type-check and build for production |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Run ESLint |

## Docker

```bash
docker build -t frontend .
docker run -p 80:80 frontend
```

The production image is served by nginx. Make sure to include environment variables as build arguments.