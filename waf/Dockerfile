FROM ghcr.io/coreruleset/coraza-crs:nginx

# Enable blocking mode
ENV PARANOIA=1
ENV EXECUTING_PARANOIA=1
ENV ENFORCE_BODYPROC_URLENCODED=1

# Native proxy settings for this image
ENV BACKEND=http://vulnerable-app:3000
ENV PROXY_TIMEOUT=60s
ENV PORT=8080

EXPOSE 8080
