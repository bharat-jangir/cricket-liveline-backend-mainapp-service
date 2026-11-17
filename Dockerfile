FROM node:20-alpine

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm ci

COPY . .

RUN npm run build && npm prune --omit=dev

# Default port
EXPOSE 5001

CMD ["npm", "run", "start:prod"]
