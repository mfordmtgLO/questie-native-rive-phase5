# Questie Native Mascot Studio — Cloud Run deployment image (matches Dockerfile.questie)
FROM oven/bun:1.4.2-alpine AS build
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile --ignore-scripts && bun run scripts/copy-wasm.ts && bun run scripts/build-questie-guides.ts
FROM oven/bun:1.4.2-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=8080
COPY --from=build /app/questie-site ./questie-site
COPY --from=build /app/questie-preview/server.ts ./questie-preview/server.ts
USER bun
EXPOSE 8080
CMD ["bun","run","questie-preview/server.ts"]
