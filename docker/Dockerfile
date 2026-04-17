# Use official Node.js 18 LTS image as base
FROM node:18

# Keep project-relative imports intact (app -> ../deployment, ../policy-engine)
WORKDIR /workspace

# Install app dependencies first for better layer caching
COPY app/package*.json ./app/
RUN npm --prefix app install

# Copy runtime folders required by app/server.js and deployment/deploy.js
COPY app ./app
COPY deployment ./deployment
COPY policy-engine ./policy-engine
COPY k8s ./k8s
COPY docker ./docker

# Expose port 3000 (Express server port)
EXPOSE 3000

# Start the application from the app folder
WORKDIR /workspace/app
CMD ["node", "server.js"]
