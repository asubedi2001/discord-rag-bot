# build stage
FROM node:24-alpine AS builder

WORKDIR /app

# copy manifests first for better layer caching
COPY package.json package-lock.json ./
RUN npm ci

# VITE_* variables must be present at build time -> inlined into JS bundle
ARG VITE_API_BASE_URL
ARG VITE_DISCORD_CLIENT_ID
ARG VITE_DISCORD_REDIRECT_URI

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_DISCORD_CLIENT_ID=$VITE_DISCORD_CLIENT_ID
ENV VITE_DISCORD_REDIRECT_URI=$VITE_DISCORD_REDIRECT_URI

COPY . .
RUN npm run build


# runtime stage -> serve production build with vite preview
FROM node:24-alpine AS runtime

WORKDIR /app

# reuse node_modules from builder (vite is a devDependency, needed for preview)
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# copy Vite build output
COPY --from=builder /app/dist ./dist

# Switch to nonroot node user
USER node

# vite preview defaults to port 4173
EXPOSE 4173

CMD ["npm", "run", "preview", "--", "--host", "0.0.0.0"]
