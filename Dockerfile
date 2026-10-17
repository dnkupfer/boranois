# API image for Cloud Run. Build from the repo root:
#   gcloud builds submit --tag southamerica-east1-docker.pkg.dev/<project>/boranois/api
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @boranois/api

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --omit=dev -w @boranois/api
COPY --from=build /app/apps/api/dist apps/api/dist
COPY apps/api/db apps/api/db
WORKDIR /app/apps/api
USER node
CMD ["node", "dist/index.js"]
