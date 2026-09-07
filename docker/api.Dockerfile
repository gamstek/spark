FROM node:24.11.0-alpine AS build
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @spark/api build

FROM node:24.11.0-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable
COPY --from=build /app /app
EXPOSE 3000
CMD ["pnpm", "--filter", "@spark/api", "start"]
