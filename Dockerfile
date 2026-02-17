FROM node:20-alpine AS base

FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Install fonts, fontconfig, and Tailscale dependencies
RUN apk update && apk add --no-cache \
  fontconfig \
  ca-certificates \
  iptables \
  ip6tables \
  && rm -rf /var/cache/apk/*

# Register Inter font (used for story overlay)
COPY --from=builder /app/src/server/assets/fonts /usr/share/fonts/truetype/inter
RUN fc-cache -f -v

# Copy Tailscale binaries from the tailscale image on Docker Hub
COPY --from=docker.io/tailscale/tailscale:stable /usr/local/bin/tailscaled /app/tailscaled
COPY --from=docker.io/tailscale/tailscale:stable /usr/local/bin/tailscale /app/tailscale

# Create Tailscale directories
RUN mkdir -p /var/run/tailscale /var/cache/tailscale /var/lib/tailscale

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 expressjs

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules

COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

RUN chown -R expressjs:nodejs /app

EXPOSE 3000
CMD ["/app/start.sh"] 
