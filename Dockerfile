# multi-stage, smaller final image (only runtime deps + built output)
FROM oven/bun:alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
ENV NODE_ENV=production
RUN bun install --production

FROM deps AS build
WORKDIR /app
COPY . .
RUN bun run compile

FROM oven/bun:alpine AS staging
WORKDIR /app
ENV NODE_ENV=production
# copy only runtime deps and built output
COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 3000
# keep same entry (adjust if your artifact needs a runtime invocation)
ENTRYPOINT ["dist/app"]