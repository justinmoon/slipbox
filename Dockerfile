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

# Copy migrations for database setup AFTER build
RUN mkdir -p dist/db
COPY src/db/migrations ./dist/db/migrations

# Debug: List migration files
RUN ls -la dist/db/migrations/meta/

# Create a non-root user
RUN adduser -D -u 1001 appuser

# Create notes directory and ensure proper permissions
RUN mkdir -p /app/data && \
    chown -R appuser:appuser /app/data && \
    chown -R appuser:appuser /app/dist

USER appuser

# Expose port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV NOTES_DIR=/app/data

# Start the application
CMD ["bun", "dist/index.js"]