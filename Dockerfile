FROM node:22-alpine

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

COPY server.js ./
COPY public ./public

EXPOSE 3000
EXPOSE 3001/udp

CMD ["node", "server.js"]
