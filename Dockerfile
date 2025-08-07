# Use official Node.js LTS image
FROM node:18

# Set working directory
WORKDIR /app

# Install build dependencies for native modules (Debian-based)
RUN apt-get update && apt-get install -y \
    python3 \
    python3-distutils \
    make \
    g++ \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Copy package.json and package-lock.json
COPY package*.json ./

# Install all dependencies including devDependencies for browser-sync
RUN npm ci

# Copy the rest of the code
COPY . .

# Rebuild SQLite3 for the container architecture
RUN npm rebuild sqlite3

# Initialize the database
RUN npm run init

# Populate database
RUN npm run generate-data

# Install process manager for running multiple processes
RUN npm install -g concurrently

# Expose frontend port
EXPOSE 5500

# Start both backend and frontend servers
CMD ["concurrently", "'npm run server'", "'npm run serve'"]