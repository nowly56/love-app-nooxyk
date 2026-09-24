FROM node:22-bookworm-slim AS build

ENV CI=1
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .
RUN npm run build:web

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY telegram-bot/server.mjs ./telegram-bot/server.mjs

EXPOSE 8787
CMD ["node", "telegram-bot/server.mjs"]
