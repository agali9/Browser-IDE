FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY packages/client/package*.json ./packages/client/
COPY tsconfig.base.json ./

RUN npm install --workspace=packages/client

COPY packages/client ./packages/client

RUN npm run build --workspace=packages/client

FROM nginx:alpine
COPY --from=builder /app/packages/client/dist /usr/share/nginx/html
COPY packages/client/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
