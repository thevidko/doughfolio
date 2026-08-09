# DoughFolio production image.
# Bun's fullstack server bundles the frontend at startup, so the image ships
# sources + dependencies and needs no separate build stage.
FROM oven/bun:1.3-slim

WORKDIR /app

# Install dependencies first so Docker layer caching survives source changes.
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src

# Persistent state (SQLite database) lives in /data — mount a volume there.
RUN mkdir -p /data && chown bun:bun /data
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data
VOLUME /data
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s \
  CMD bun -e "fetch('http://localhost:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"

USER bun
CMD ["bun", "src/server/index.ts"]
