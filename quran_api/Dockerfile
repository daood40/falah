# FALAH Quran API — production image.
# Stateless: it needs DATABASE_URL and SUPABASE_JWT_SECRET from the environment,
# nothing else. No secret is baked into the image, and no dataset is copied in —
# the data lives in Postgres.
FROM node:22-alpine

ENV NODE_ENV=production \
    PORT=8787 \
    ENVIRONMENT=production

WORKDIR /app

# Dependencies first so the layer caches between code changes.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src ./src
COPY openapi ./openapi
COPY schemas ./schemas
COPY scripts ./scripts
# The API owns its schema: without the migrations the image can start but can
# never create the tables it reads, so every content request fails.
COPY migrations ./migrations

# Run unprivileged.
USER node

EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/server.ts"]
