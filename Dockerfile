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

# Default Railway port configuration fallback
ENV PORT=80
EXPOSE 80

# Copy compiled production assets from the builder stage to Nginx serve directory
COPY --from=builder /app/dist /usr/share/nginx/html

# Create an Nginx configuration template supporting Single Page Application (SPA) routing
# and dynamically binding to the Railway $PORT environment variable at runtime
RUN echo 'server { \
    listen ${PORT}; \
    server_name localhost; \
    location / { \
        root /usr/share/nginx/html; \
        index index.html index.htm; \
        try_files $uri $uri/ /index.html; \
    } \
    error_page 500 502 503 504 /50x.html; \
    location = /50x.html { \
        root /usr/share/nginx/html; \
    } \
}' > /etc/nginx/conf.d/default.conf.template

# Replace the ${PORT} variable in the template at runtime and start Nginx
CMD ["sh", "-c", "envsubst '${PORT}' < /etc/nginx/conf.d/default.conf.template > /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]
