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


# runtime stage -> serve static files with Nginx
FROM nginx:stable-alpine AS runtime

# remove default Nginx welcome page
RUN rm -rf /usr/share/nginx/html/*

# copy Vite build output into Nginx's serve directory
COPY --from=builder /app/dist /usr/share/nginx/html

# SPA fallback: all routes return index.html -> React Router works correctly
# Listen on 8080 (unprivileged) -> nginx user can bind without root
RUN printf 'server {\n\
    listen 8080;\n\
    root /usr/share/nginx/html;\n\
    index index.html;\n\
    location / {\n\
    try_files $uri $uri/ /index.html;\n\
    }\n\
    }\n' > /etc/nginx/conf.d/default.conf

# Grant nginx user write access to runtime dirs
RUN chown -R nginx:nginx /usr/share/nginx/html \
    /var/cache/nginx \
    /var/log/nginx \
    /etc/nginx/conf.d \
    && touch /var/run/nginx.pid \
    && chown nginx:nginx /var/run/nginx.pid

USER nginx

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
