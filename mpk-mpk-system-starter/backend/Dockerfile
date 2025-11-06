# Backend Dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json* pnpm-lock.yaml* yarn.lock* ./
RUN npm install --legacy-peer-deps || true
COPY . .
RUN npx prisma generate
RUN npm run build || true
EXPOSE 8080
CMD ["npm","run","start:dev"]
