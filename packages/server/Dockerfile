FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY packages/server/package*.json ./packages/server/

RUN npm install --workspace=packages/server

COPY packages/server ./packages/server
COPY tsconfig.base.json ./

RUN npm run build --workspace=packages/server

RUN mkdir -p /app/packages/server/data

EXPOSE 3001

CMD ["node", "packages/server/dist/index.js"]
