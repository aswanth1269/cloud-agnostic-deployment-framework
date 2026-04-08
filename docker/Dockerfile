# Use official Node.js 18 LTS image as base
FROM node:18

# Set working directory inside container
WORKDIR /app

# Copy package.json and package-lock.json for dependency installation
# Doing this separately allows Docker to cache the dependency layer
COPY app/package*.json ./

# Install production dependencies
RUN npm install

# Copy application source code
COPY app .

# Expose port 3000 (Express server port)
EXPOSE 3000

# Start the application
CMD ["node", "server.js"]
