FROM node:22-alpine AS web-build
RUN apk add --no-cache git
ARG APP_SOURCE_BRANCH=main
RUN git clone --depth 1 --branch "${APP_SOURCE_BRANCH}" https://github.com/nabiev-zzz/Quiz-Arena.git /workspace
WORKDIR /workspace
RUN npm ci
RUN npx expo export --platform web --output-dir /web-dist

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY . /usr/share/nginx/html/
COPY --from=web-build /web-dist/ /usr/share/nginx/html/app/
EXPOSE 8080
