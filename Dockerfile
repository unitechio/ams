# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22.15.0
ARG GO_VERSION=1.25.0

FROM node:${NODE_VERSION}-bookworm-slim AS frontend-deps
WORKDIR /workspace
COPY package.json package-lock.json .npmrc ./
RUN --mount=type=cache,target=/root/.npm npm ci

FROM frontend-deps AS frontend-build
WORKDIR /workspace
COPY tsconfig.json tsconfig.app.json tsconfig.node.json vite.config.ts index.html eslint.config.js ./
COPY public ./public
COPY src ./src
RUN npm run build:frontend:production

FROM golang:${GO_VERSION}-bookworm AS go-build
WORKDIR /src/server
COPY server/go.mod server/go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
COPY server ./
COPY --from=frontend-build /workspace/dist /src/server/web/dist

ARG TARGETOS
ARG TARGETARCH
ARG VERSION=dev
ARG COMMIT=local
ARG BUILD_DATE=unknown

RUN --mount=type=cache,target=/go/pkg/mod \
    --mount=type=cache,target=/root/.cache/go-build \
    CGO_ENABLED=0 GOOS=${TARGETOS:-linux} GOARCH=${TARGETARCH:-amd64} \
    go build -trimpath \
      -ldflags="-s -w -X main.version=${VERSION} -X main.commit=${COMMIT} -X main.date=${BUILD_DATE}" \
      -o /out/ams-server ./cmd/server

FROM gcr.io/distroless/base-debian12:nonroot
WORKDIR /app

COPY --from=go-build /out/ams-server /app/ams-server
COPY --from=go-build /usr/share/zoneinfo /usr/share/zoneinfo

ENV HOST=0.0.0.0 \
    PORT=8080 \
    ENV=production \
    TZ=UTC \
    ENABLE_METRICS=true \
    ENABLE_PPROF=false \
    ENABLE_SECURITY_HEADERS=true \
    HTTP_READ_HEADER_TIMEOUT=5s \
    HTTP_READ_TIMEOUT=15s \
    HTTP_WRITE_TIMEOUT=30s \
    HTTP_IDLE_TIMEOUT=60s \
    SHUTDOWN_TIMEOUT=20s

EXPOSE 8080
USER nonroot:nonroot

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD ["/app/ams-server", "healthcheck"]

ENTRYPOINT ["/app/ams-server"]
