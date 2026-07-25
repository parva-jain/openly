# Node backend image — multi-stage build.
#
# Stage 1 (build): install ALL deps and compile TypeScript -> dist/.
# Stage 2 (runtime): install only production deps and copy the compiled dist/.
# Result: a lean final image with no TypeScript, no devDeps, no source.

# ---- build stage ----
FROM node:24-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# ---- runtime stage ----
FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist

EXPOSE 3000
CMD ["node", "dist/index.js"]
