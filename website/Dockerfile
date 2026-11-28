# Build the browser app from the same repository commit Railway is deploying.
# The repository root is the build context (Railway root directory: /), so
# Docker never fetches `main` in a cacheable RUN layer and cannot ship a stale app.
FROM node:22-alpine AS web-build
WORKDIR /workspace
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx expo export --platform web --output-dir /web-dist

FROM nginx:1.27-alpine
COPY website/nginx.conf /etc/nginx/conf.d/default.conf
COPY website/index.html website/styles.css website/script.js website/learn.html website/learn.css website/learn.js website/robots.txt website/sitemap.xml /usr/share/nginx/html/
COPY --from=web-build /web-dist/ /usr/share/nginx/html/app/
EXPOSE 8080
