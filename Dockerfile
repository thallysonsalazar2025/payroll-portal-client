FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html /usr/share/nginx/html/index.html
COPY src /usr/share/nginx/html/src
EXPOSE 80
HEALTHCHECK --interval=10s --timeout=3s --retries=10 CMD wget -q --spider http://localhost/ || exit 1
