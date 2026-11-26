FROM node:22-alpine AS web-build
RUN apk add --no-cache git
# Pin the app source to the repository commit being deployed. Bump this value
# whenever the Expo app changes; otherwise Docker may reuse a cached git-fetch layer.
ARG APP_SOURCE_COMMIT=d2b2d51eaf1815c9b32e83157cd493f064ed8814
RUN git init /workspace \
    && git -C /workspace remote add origin https://github.com/nabiev-zzz/Quiz-Arena.git \
    && git -C /workspace fetch --depth 1 origin "${APP_SOURCE_COMMIT}" \
    && git -C /workspace checkout --detach FETCH_HEAD
WORKDIR /workspace
RUN npm ci
RUN npx expo export --platform web --output-dir /web-dist

FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY . /usr/share/nginx/html/
COPY --from=web-build /web-dist/ /usr/share/nginx/html/app/
EXPOSE 8080
