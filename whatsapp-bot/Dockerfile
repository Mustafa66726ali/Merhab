FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    CHROME_PATH=/usr/bin/chromium

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY . .

EXPOSE 8088

CMD ["node", "index.js"]
