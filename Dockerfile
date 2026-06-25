# ==========================================
# Stage 1: Build React 19 + Vite Application
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package configuration files first for layer caching
COPY package.json package-lock.json ./

# Install dependencies cleanly using ci
RUN npm ci

# Copy the rest of the frontend source code
COPY . .

# Accept VITE_API_URL as a build argument and set it as an environment variable
# This ensures Vite embeds the correct API URL during the production build step
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}

# Build the Vite application for production
RUN npm run build

# ==========================================
# Stage 2: Production Nginx Server
# ==========================================
FROM nginx:alpine

# Use fixed port 8080 to perfectly align with Railway's default edge proxy routing
ENV PORT=8080
EXPOSE 8080

# Copy compiled production assets from the builder stage to Nginx serve directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Create an Nginx configuration supporting Single Page Application (SPA) routing
# listening explicitly on port 8080 with wildcard server_name
RUN echo 'server { \
    listen 8080 default_server; \
    server_name _; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
    error_page 500 502 503 504 /50x.html; \
    location = /50x.html { \
        root /usr/share/nginx/html; \
    } \
}' > /etc/nginx/conf.d/default.conf

# Start Nginx directly
CMD ["nginx", "-g", "daemon off;"]
