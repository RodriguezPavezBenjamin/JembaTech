FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
ARG RAILWAY_GIT_COMMIT_SHA
RUN npm run build && node scripts/write-version.mjs

FROM nginx:1.30-alpine
RUN apk upgrade --no-cache libexpat libx11
ENV BACKEND_HOST=backend \
    BACKEND_PORT=3000 \
    PORT=80 \
    NGINX_ENTRYPOINT_LOCAL_RESOLVERS=1 \
    NGINX_ENVSUBST_FILTER="^(BACKEND_HOST|BACKEND_PORT|PORT|NGINX_LOCAL_RESOLVERS)$"
COPY nginx.conf /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/jemba-cotiza/browser /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
