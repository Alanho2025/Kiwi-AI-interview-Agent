FROM node:20-slim

# Install Azure Speech SDK dependencies
# libasound2 and ca-certificates are strictly required by the Microsoft Speech SDK C++ binaries on Linux
RUN apt-get update && apt-get install -y --no-install-recommends \
    libasound2 \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy application source
COPY . .

# Run the app
EXPOSE 8080
CMD ["npm", "start"]
