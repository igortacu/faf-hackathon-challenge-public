FROM node:22-alpine AS builder
RUN corepack enable && corepack prepare pnpm@10.18.0 --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
ARG VITE_GATEWAY_URL=http://localhost:8000
ARG VITE_MOCK=false
ARG VITE_ADMIN_PASSCODE=
ARG VITE_TRAFFIC_GENERATOR=on
ARG VITE_PARROT_CHAT_COOLDOWN_MS=30000
ARG VITE_SIMULATION_START_TIME=2026-06-20T00:00:00Z
ARG VITE_GAME_SPEED=300
ENV VITE_GATEWAY_URL=$VITE_GATEWAY_URL
ENV VITE_MOCK=$VITE_MOCK
ENV VITE_ADMIN_PASSCODE=$VITE_ADMIN_PASSCODE
ENV VITE_TRAFFIC_GENERATOR=$VITE_TRAFFIC_GENERATOR
ENV VITE_PARROT_CHAT_COOLDOWN_MS=$VITE_PARROT_CHAT_COOLDOWN_MS
ENV VITE_SIMULATION_START_TIME=$VITE_SIMULATION_START_TIME
ENV VITE_GAME_SPEED=$VITE_GAME_SPEED
RUN pnpm build

FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@10.18.0 --activate
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
EXPOSE 5173
CMD ["pnpm", "preview", "--host", "0.0.0.0", "--port", "5173"]
