# Multi-stage production build for Potato Hermes Voice Chat
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first for optimal Docker layer caching
COPY package.json package-lock.json* ./
RUN npm ci

# Copy application source code
COPY . .

# Build Vite client assets and production Node server
RUN npm run build

# Production runner stage
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Install dumb-init or clean signal handler
RUN apk add --no-cache curl

# Only copy production dependencies and built distribution files
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts

COPY --from=builder /app/dist ./dist

# Create non-root user for security
USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/status || exit 1

CMD ["node", "dist/server.js"]
