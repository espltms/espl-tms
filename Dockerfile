# Multi-stage production Dockerfile for Hugging Face Spaces (Backend Only)
FROM node:20-alpine AS builder
WORKDIR /app

# Copy backend package files and install dependencies
COPY backend/package*.json ./
RUN npm ci

# Copy the rest of the backend files
COPY backend/ ./

# Generate Prisma Client and build the NestJS application
RUN npx prisma generate
RUN npm run build

# Runner stage
FROM node:20-alpine AS runner
WORKDIR /app

COPY backend/package*.json ./
RUN npm ci --only=production

# Copy built files and prisma from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/prisma ./prisma

# Hugging Face Spaces runs on port 7860 by default
EXPOSE 7860
ENV PORT=7860

CMD ["node", "dist/src/main"]
