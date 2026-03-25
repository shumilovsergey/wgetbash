# Build context: repo root (../)
# docker-compose sets context: ..

FROM golang:1.22-bookworm AS builder
WORKDIR /build

# Copy module file and download deps first (layer cache)
COPY go/go.mod ./go.mod
ENV GONOSUMDB=* GOFLAGS=-mod=mod

# Copy source and static files
COPY go/*.go ./
COPY go/static/ ./static/

# Build static binary for linux/amd64
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 \
    go build -ldflags="-w -s" -o wgetbash .

# ── Binary export (used by: docker build --target binary --output go/bin/) ──
FROM scratch AS binary
COPY --from=builder /build/wgetbash .

# ── Final image ──
FROM alpine:3.19
RUN apk add --no-cache ca-certificates tzdata
WORKDIR /app
COPY --from=builder /build/wgetbash .
EXPOSE 8000
ENTRYPOINT ["./wgetbash"]
