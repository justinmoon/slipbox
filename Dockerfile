FROM oven/bun:1-alpine

WORKDIR /app

# Copy package files
COPY package.json bun.lock* ./

# Install dependencies
RUN bun install --frozen-lockfile --production

# Copy source code
COPY src ./src
COPY static ./static
COPY tsconfig.json ./

# Build the application
RUN bun build src/index.ts --outdir dist --target bun

# Create a non-root user
RUN adduser -D -u 1001 appuser

# Create notes directory
RUN mkdir -p /app/data && chown -R appuser:appuser /app/data

USER appuser

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV NOTES_DIR=/app/data

# Start the application
CMD ["bun", "dist/index.js"]