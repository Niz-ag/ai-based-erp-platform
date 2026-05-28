# Build stage
FROM node:22-alpine AS builder
WORKDIR /app

# AI MANDATE: Robust Native Bindings
# bcrypt requires compilation tools on Alpine.
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm install --legacy-peer-deps
COPY prisma ./prisma/
RUN npx prisma generate
COPY . .
RUN npm run build

# Production stage
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV production

# Ensure runtime dependencies for native modules are present if needed
# (Usually not for bcrypt if statically linked, but good for safety)

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

CMD ["sh", "-c", "npx prisma db push && npx prisma db seed && npm run start:prod"]
