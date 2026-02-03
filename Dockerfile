# Railway-specific Dockerfile
# This Dockerfile is used by Railway to build and run the application
# It's based on the main Dockerfile but includes fixes for Railway's auto-detection

FROM ubuntu:noble-20251013 AS base

# Build arguments
ARG ARG_UID=1000
ARG ARG_GID=1000

# Install system dependencies and Node.js
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
RUN DEBIAN_FRONTEND=noninteractive apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -yq --no-install-recommends \
        curl gnupg libgfortran5 libgbm1 tzdata netcat-openbsd \
        libasound2t64 libatk1.0-0 libc6 libcairo2 libcups2 libdbus-1-3 libexpat1 libfontconfig1 \
        libgcc1 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libx11-6 libx11-xcb1 libxcb1 \
        libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 \
        libxss1 libxtst6 ca-certificates fonts-liberation libappindicator3-1 libnss3 lsb-release \
        xdg-utils git build-essential ffmpeg && \
    mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_18.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list && \
    apt-get update && \
    apt-get install -yq --no-install-recommends nodejs && \
    curl -LO https://github.com/yarnpkg/yarn/releases/download/v1.22.19/yarn_1.22.19_all.deb \
        && dpkg -i yarn_1.22.19_all.deb \
        && rm yarn_1.22.19_all.deb && \
    curl -LsSf https://astral.sh/uv/0.6.10/install.sh | sh && \
        mv /root/.local/bin/uv /usr/local/bin/uv && \
        mv /root/.local/bin/uvx /usr/local/bin/uvx && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Create user
RUN (getent passwd "$ARG_UID" && userdel -f "$(getent passwd "$ARG_UID" | cut -d: -f1)") || true && \
    (getent group "$ARG_GID" && groupdel "$(getent group "$ARG_GID" | cut -d: -f1)") || true && \
    groupadd -g "$ARG_GID" anythingllm && \
    useradd -l -u "$ARG_UID" -m -d /app -s /bin/bash -g anythingllm anythingllm && \
    mkdir -p /app/frontend/ /app/server/ /app/collector/ && chown -R anythingllm:anythingllm /app

# Copy docker helper scripts
COPY ./docker/docker-entrypoint.sh /usr/local/bin/
COPY ./docker/docker-healthcheck.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh && \
    chmod +x /usr/local/bin/docker-healthcheck.sh

# Build frontend
FROM --platform=$BUILDPLATFORM node:18-slim AS frontend-build
WORKDIR /app/frontend
COPY ./frontend/package.json ./frontend/yarn.lock ./
# Install dependencies (warnings are non-critical)
RUN yarn install --network-timeout 100000 && yarn cache clean
COPY ./frontend/ ./
RUN yarn build
WORKDIR /app

# Install server and collector
FROM base AS backend-build
USER anythingllm
WORKDIR /app
COPY --chown=anythingllm:anythingllm ./server /app/server/
WORKDIR /app/server
# Install dependencies (warnings about form-data and @datastax/astra-db-ts are non-critical)
RUN yarn install --production --network-timeout 100000 && yarn cache clean
WORKDIR /app
COPY --chown=anythingllm:anythingllm ./collector/ ./collector/
WORKDIR /app/collector
ENV PUPPETEER_DOWNLOAD_BASE_URL=https://storage.googleapis.com/chrome-for-testing-public
# Install dependencies (warnings are non-critical)
RUN yarn install --production --network-timeout 100000 && yarn cache clean
WORKDIR /app

# Production build
FROM backend-build AS production-build
WORKDIR /app

# Copy root package.json - this prevents Railway from trying to run "yarn start" from root
COPY --chown=anythingllm:anythingllm ./package.json /app/package.json

# Copy built frontend
COPY --chown=anythingllm:anythingllm --from=frontend-build /app/frontend/dist /app/server/public

# Copy env example
COPY --chown=anythingllm:anythingllm ./docker/.env.example /app/server/.env

# Setup environment
ENV NODE_ENV=production
ENV ANYTHING_LLM_RUNTIME=docker
ENV DEPLOYMENT_VERSION=1.10.0

# Healthcheck
HEALTHCHECK --interval=1m --timeout=10s --start-period=1m \
  CMD /bin/bash /usr/local/bin/docker-healthcheck.sh || exit 1

# Use entrypoint script - this is the correct way to start the application
ENTRYPOINT ["/bin/bash", "/usr/local/bin/docker-entrypoint.sh"]
