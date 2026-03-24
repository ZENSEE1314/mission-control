# ─────────────────────────────────────────────────────────────
# Ruflo Mission Control — Docker image for Render (or any Docker host)
# ─────────────────────────────────────────────────────────────

FROM node:22-slim

# Install system deps needed by claude-flow / openclaw
RUN apt-get update && apt-get install -y \
    git \
    curl \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy dependency manifests first (layer caching)
COPY package.json ./

# Install app dependencies
RUN npm install

# Install ruflo + openclaw globally
# Smart install: only install if not already at target version
ARG OPENCLAW_VERSION=2026.3.22
RUN npm install -g ruflo || true
RUN npx openclaw --version 2>/dev/null | grep -q "${OPENCLAW_VERSION}" \
    && echo "OpenClaw ${OPENCLAW_VERSION} already installed — skipping" \
    || npm install -g openclaw@${OPENCLAW_VERSION}

# Copy app source
COPY server.js dashboard.html ./
COPY skills/ ./skills/

# Create task output directories
RUN mkdir -p tasks skills

# Expose port
EXPOSE 10000

ENV PORT=10000
ENV NODE_ENV=production

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:${PORT}/health || exit 1

CMD ["node", "server.js"]
