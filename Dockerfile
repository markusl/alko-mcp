# Build stage
# Node 24 for latest features and future-proofing
FROM node:24-slim AS builder

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install dependencies
RUN npm ci

# Copy source code
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Production stage
FROM node:24-slim

# Install Playwright/Chromium dependencies for Cloud Run
# Full list from: https://playwright.dev/docs/browsers#linux-dependencies
RUN apt-get update && apt-get install -y \
    # Core browser dependencies
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libdbus-1-3 \
    libxkbcommon0 \
    libatspi2.0-0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2 \
    libpango-1.0-0 \
    libcairo2 \
    # Additional X11 dependencies for headless Chrome
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxext6 \
    libxcursor1 \
    libxi6 \
    libxtst6 \
    # GPU and rendering
    libgl1 \
    libegl1 \
    # Fonts
    fonts-liberation \
    fonts-noto-color-emoji \
    # Utilities
    ca-certificates \
    wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./

# Install production dependencies only
RUN npm ci --production

# Install Playwright browsers
RUN npx playwright install chromium

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Copy seed data for auto-loading on first request
# This allows the server to bootstrap Firestore if empty
COPY data ./data

# Set environment variables
ENV NODE_ENV=production
ENV MCP_TRANSPORT=http

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "fetch('http://localhost:8080/health').then(r => process.exit(r.ok ? 0 : 1))"

# Start the server
CMD ["node", "dist/server.js"]
