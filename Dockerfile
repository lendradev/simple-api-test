# multi-stage Dockerfile for a "staging" target
FROM oven/bun:alpine AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install

FROM deps AS build
WORKDIR /app
COPY . .
# run build if you have a build script
RUN bun run compile

FROM oven/bun:alpine AS staging
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build app .
EXPOSE 3000
ENTRYPOINT [ "dist/app" ]