# Carnatic Notation Typesetter - web version
# Stage 1 builds the static site with Node; stage 2 serves it with nginx.
#   docker build -t cmnt .
#   docker run --rm -p 8080:10000 cmnt      -> http://localhost:8080

FROM node:22-alpine AS build
WORKDIR /app
# The desktop app's Electron binary is not needed to build the website
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . .
RUN npm test && npm run build

FROM nginx:1.27-alpine
# Render (and most hosts) tell the container which port to listen on via $PORT
ENV PORT=10000
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY deploy/security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 10000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- "http://127.0.0.1:${PORT}/healthz" || exit 1
