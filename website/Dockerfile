FROM node:22-alpine AS web-build
WORKDIR /workspace

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx expo export --platform web --output-dir /web-dist

FROM nginx:1.27-alpine
COPY website/nginx.conf /etc/nginx/conf.d/default.conf
COPY website/ /usr/share/nginx/html/
COPY --from=web-build /web-dist/ /usr/share/nginx/html/app/
EXPOSE 8080
