# build the react application

FROM node:24-alpine AS builder
WORKDIR /app

# install dependencies
COPY package*.json ./
RUN npm ci

# VITE_* variables must be present at build time -> inlined into JS bundle
ARG VITE_DISCORD_REDIRECT_URI
ARG VITE_API_BASE_URL
ARG VITE_DISCORD_CLIENT_ID

ENV VITE_DISCORD_REDIRECT_URI=$VITE_DISCORD_REDIRECT_URI
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_DISCORD_CLIENT_ID=$VITE_DISCORD_CLIENT_ID

# copy source code
COPY . .

# build the app for production (generates dist/)
RUN npm run build

# runtime stage -> serve production build with nginx
FROM nginxinc/nginx-unprivileged:alpine-slim AS final

# copy server block config
COPY nginx.conf /etc/nginx/conf.d/default.conf

# copy compiled static assets from build stage
COPY --from=builder /app/dist /usr/share/nginx/html

# expose 8081
EXPOSE 8081

CMD ["nginx", "-g", "daemon off;"]
