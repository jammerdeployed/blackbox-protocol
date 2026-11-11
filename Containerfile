# Stage 1: Build PWA static assets
FROM node:20-alpine AS builder

WORKDIR /app

# Install pnpm version matching package.json
RUN npm install -g pnpm@9.15.0

# Copy source files (excluding items in .containerignore)
COPY . .

# Install dependencies and build web frontend
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @blackbox-protocol/web build

# Stage 2: Serve static files with Nginx
FROM nginx:alpine

# Nginx configuration for SPA routing and caching
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build artifacts from builder stage
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
