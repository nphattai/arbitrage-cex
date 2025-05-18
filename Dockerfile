# Use Node.js LTS version
FROM node:20-slim

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json ./

# Install dependencies
RUN npm install

# Bundle app source
COPY . .

# Compile TypeScript
RUN npm run build

# Command to run the application
CMD ["node", "dist/index.js"] 