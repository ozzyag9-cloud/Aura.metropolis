# Use Node.js 20 as base
FROM node:20-slim AS base

# Install build dependencies
WORKDIR /app
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Production image
FROM node:20-slim
WORKDIR /app

# Copy built assets and production dependencies
COPY --from=base /app/dist ./dist
COPY --from=base /app/package*.json ./
RUN npm install --omit=dev

# Export port
EXPOSE 3000

# Start the server
CMD ["npm", "start"]
