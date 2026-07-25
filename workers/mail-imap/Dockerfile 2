FROM node:22-bookworm-slim

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.js ./

ENV NODE_ENV=production
# Cloud Run sets PORT=8080
EXPOSE 8080
CMD ["node", "server.js"]
