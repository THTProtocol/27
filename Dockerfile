FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install --production

COPY . .

RUN mkdir -p data

EXPOSE 8080

ENV NODE_ENV=production

CMD ["node", "server.js"]
