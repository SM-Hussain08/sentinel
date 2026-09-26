# ============================================================
# SENTINEL Frontend
# Production multi-stage image
# ============================================================


# ------------------------------------------------------------
# Stage 1 - Build the React application
# ------------------------------------------------------------

FROM node:22-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

COPY . .

# Production uses same-origin API requests through Nginx.
#
# Developers can still override this build argument if a
# different API origin is intentionally required.
ARG VITE_API_BASE_URL=/api/v1

ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}

RUN npm run build


# ------------------------------------------------------------
# Stage 2 - Serve the compiled application with Nginx
# ------------------------------------------------------------

FROM nginx:alpine AS runtime

ARG SENTINEL_VERSION=1.0.0

LABEL org.opencontainers.image.title="SENTINEL Frontend" \
      org.opencontainers.image.description="Production React and Nginx frontend for the SENTINEL security operations platform" \
      org.opencontainers.image.version="${SENTINEL_VERSION}" \
      org.opencontainers.image.source="https://github.com/SM-Hussain08/sentinel" \
      org.opencontainers.image.vendor="SENTINEL"

# Apply available security fixes to the runtime XML parser.
RUN apk upgrade --no-cache libexpat

COPY nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build \
    /app/dist \
    /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
