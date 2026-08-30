FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY privacy.html /usr/share/nginx/html/privacy.html
COPY point.html /usr/share/nginx/html/point.html
COPY manifest.webmanifest /usr/share/nginx/html/manifest.webmanifest
COPY service-worker.js /usr/share/nginx/html/service-worker.js
COPY src /usr/share/nginx/html/src
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=10 CMD wget -q --spider http://localhost/ || exit 1
