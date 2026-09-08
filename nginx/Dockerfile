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
RUN pnpm --filter @spark/activity build && \
    pnpm --filter @spark/staff build && \
    pnpm --filter @spark/admin build

FROM nginx:1.29-alpine
COPY nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY nginx/proxy_params /etc/nginx/proxy_params
COPY --from=build /app/apps/activity/dist /usr/share/nginx/html/activity
COPY --from=build /app/apps/staff/dist /usr/share/nginx/html/staff
COPY --from=build /app/apps/admin/dist /usr/share/nginx/html/admin
EXPOSE 8080
