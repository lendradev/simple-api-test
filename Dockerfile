# Dockerfile for a Bun-based app (multi-stage, small runtime)
FROM oven/bun:alpine AS builder
WORKDIR /app
COPY package.json bun.lockb* ./
RUN bun install --production
COPY . .

FROM oven/bun:alpine AS runtime
WORKDIR /app
COPY --from=builder /app /app
ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "run", "start"]