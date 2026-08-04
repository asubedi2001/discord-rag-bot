# discord-bot

The Discord interface for the RAG system. A discord.js bot that creates private threads for users and routes their messages through the RAG API to answer questions based on their ingested documents.

## How It Works

When a user runs `/chat`, the bot creates a private thread and registers it in the database. Messages sent inside that thread are intercepted by a message handler, forwarded to the RAG API (`/query`), and the response is posted back into the thread. Document ingestion can also be triggered directly from Discord by sharing a PDF attachment.

## Slash Commands

**RAG**

| Command | Description |
|---------|-------------|
| `/chat` | Creates a private thread for the calling user and begins a RAG session |

**Utility**

| Command | Description |
|---------|-------------|
| `/ping` | Check bot latency |
| `/echo` | Echo a message back |
| `/user` | Display user information |
| `/server` | Display server information |
| `/reload` | Hot-reload a command without restarting the bot |

## Requirements

- Node.js 18+
- A running PostgreSQL instance (stores user and thread records)
- A running `bot-api` instance
- A Discord bot token with the following intents enabled: `Guilds`, `GuildMessages`, `MessageContent`

## Setup

```bash
cp .env.example .env
# Fill in all values in .env

npm install
```

Register slash commands with Discord before running the bot for the first time:

```bash
node deploy-commands.js
```

Start the bot:

```bash
node index.js
```

## Environment Variables

| Variable | Description |
|----------|-------------|
| `DISCORD_TOKEN` | Bot token from the Discord Developer Portal |
| `CLIENT_ID` | Discord application client ID |
| `GUILD_ID` | ID of the Discord server to register commands to |
| `DATABASE_URL` | PostgreSQL connection string (`postgresql://...`) |
| `RAG_API_URL` | Base URL of the `bot-api` service (e.g. `http://localhost:5000`) |
| `INTERNAL_API_KEY` | Must match `INTERNAL_API_KEY` in `bot-api` |

## Docker

```bash
docker build -t discord-bot .
docker run --env-file .env discord-bot
```
