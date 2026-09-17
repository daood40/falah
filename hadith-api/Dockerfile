# FALAH Hadith API — runtime image (no build step: Node strips the types).
FROM node:22-alpine

# bash + psql for the migration and import scripts
RUN apk add --no-cache bash postgresql16-client

ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev || npm install --omit=dev

COPY src ./src
COPY migrations ./migrations
COPY scripts ./scripts
COPY clients ./clients
COPY openapi.yaml ./openapi.yaml
COPY contracts ./contracts

RUN addgroup -S falah && adduser -S falah -G falah && chown -R falah:falah /app
USER falah

EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "--experimental-strip-types", "src/http/server.ts"]
