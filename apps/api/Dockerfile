FROM node:24.11.0-alpine AS build
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/activity/package.json apps/activity/package.json
COPY apps/admin/package.json apps/admin/package.json
COPY apps/api/package.json apps/api/package.json
COPY apps/staff/package.json apps/staff/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/templates/package.json packages/templates/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @spark/api build

FROM node:24.11.0-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV API_HOST=0.0.0.0
RUN corepack enable
COPY --from=build /app /app
EXPOSE 3000
CMD ["sh", "-c", "node apps/api/dist/database/migrate.js && exec node apps/api/dist/src/main.js"]
