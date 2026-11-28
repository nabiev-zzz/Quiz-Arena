FROM node:22-alpine AS web-build
RUN apk add --no-cache git
# Build the browser app from the current main branch so app fixes are not hidden
# behind an old hard-coded source commit.
ARG APP_SOURCE_REF=main
RUN git init /workspace \
    && git -C /workspace remote add origin https://github.com/nabiev-zzz/Quiz-Arena.git \
    && git -C /workspace fetch --depth 1 origin "${APP_SOURCE_REF}" \
    && git -C /workspace checkout --detach FETCH_HEAD
WORKDIR /workspace
RUN npm ci
RUN npx expo export --platform web --output-dir /web-dist

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY . /usr/share/nginx/html/
COPY --from=web-build /web-dist/ /usr/share/nginx/html/app/
EXPOSE 8080
