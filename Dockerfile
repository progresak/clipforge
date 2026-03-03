FROM node:20-alpine

# Install ffmpeg for video processing
RUN apk add --no-cache ffmpeg

# Create app directory
WORKDIR /app

# Copy package files
COPY package.json ./

# Install dependencies
RUN npm install --production

# Copy application source
COPY src/ ./src/
COPY prompts/ ./prompts/

# Create data directory for persistence
RUN mkdir -p /app/data

# Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app
USER nodejs

# Start the bot
CMD ["node", "src/index.js"]
