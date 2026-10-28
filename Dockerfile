# Builds the site and runs server.mjs, which serves it and the Audits upload API.
# Secrets (GITHUB_TOKEN, GITHUB_REPO, ...) come from the container environment at runtime.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# server.mjs only uses Node built-ins, so no node_modules are needed at runtime.
COPY --from=build /app/dist ./dist
COPY server.mjs ./
COPY server ./server
EXPOSE 3000
CMD ["node", "server.mjs"]
