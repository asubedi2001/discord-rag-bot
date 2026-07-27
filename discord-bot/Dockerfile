# build stage
FROM node:22-slim AS builder

# add environment variable defaults in line with .env.example
ENV TZ="America/New_York"
ENV HOST_OS=""
ENV HOST_HOSTNAME=""
ENV HOST_CONTAINERNAME=""
ENV DISCORD_TOKEN=""
ENV CLIENT_ID=""
ENV GUILD_ID=""
ENV DATABASE_URL=""
ENV RAG_API_URL=""
ENV INTERNAL_API_KEY=""

WORKDIR /app

# copy manifests first for layer cache efficiency
COPY package.json package-lock.json ./

# install only production dependencies (no devDependencies)
RUN npm ci --omit=dev


# runtime stage
FROM node:22-slim AS runtime

# create a non root user for security
RUN addgroup --system appgroup && adduser --system --ingroup appgroup appuser

WORKDIR /app

# copy pruned node_modules from the build stage
COPY --from=builder /app/node_modules ./node_modules

# copy application source
COPY index.js db.js deploy-commands.js ./
COPY commands/ ./commands/
COPY events/   ./events/

RUN chown -R appuser:appgroup /app

USER appuser

# discord bot uses websocket outbound connections only, no inbound port needed
# cmd uses exec form so SIGTERM reaches node (enables graceful shutdown)
CMD ["node", "index.js"]
