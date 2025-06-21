FROM node:20-alpine

RUN apk add --no-cache python3 bash

RUN npm install -g ts-node@10.9.2 typescript@5.3.3

RUN mkdir -p /code
RUN echo '{"compilerOptions":{"target":"ES2020","module":"CommonJS","moduleResolution":"node","esModuleInterop":true,"strict":false}}' > /code/tsconfig.json

WORKDIR /code

CMD ["node", "/code/index.js"]