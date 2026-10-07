FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY src ./src
COPY packages/conclave-hosted ./packages/conclave-hosted
ENV NODE_ENV=production
USER node
CMD ["node", "packages/conclave-hosted/src/server.js"]
