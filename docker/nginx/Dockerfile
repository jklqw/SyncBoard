FROM nginx:1.27-alpine

RUN rm -f /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/nginx.conf
COPY brotli.d/ /etc/nginx/brotli.d/

EXPOSE 80 443
