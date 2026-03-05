FROM node:22-alpine

# Install minimal Python for license validation
RUN apk add --no-cache python3 py3-cryptography && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

# Copy application files
COPY --chown=nodejs:nodejs server.js ./
COPY --chown=nodejs:nodejs public ./public
COPY --chown=nodejs:nodejs license_validator_simple.py ./
COPY --chown=nodejs:nodejs machine_id_simple.py ./
COPY --chown=nodejs:nodejs license_public_key.pem ./

# Create data directory and set permissions
RUN mkdir -p /app/data && chown nodejs:nodejs /app/data

USER nodejs

EXPOSE 3000
EXPOSE 3001/udp

CMD ["node", "server.js"]
