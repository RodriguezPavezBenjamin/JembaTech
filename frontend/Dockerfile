FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.30-alpine
RUN apk upgrade --no-cache libexpat libx11
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist/jemba-cotiza/browser /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
