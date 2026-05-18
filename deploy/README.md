# Production Deployment Guide

## Deployment philosophy

Hệ thống này được đóng gói theo hướng gần với các dự án OSS self-hosted hiện đại:

- một frontend React/Vite build tĩnh
- frontend bundle được embed vào Go binary
- một binary duy nhất để chạy toàn bộ app
- một container duy nhất cho app
- reverse proxy bên ngoài để TLS/compression/certificate
- tối thiểu moving parts nhưng vẫn đủ readiness, metrics, graceful shutdown và rolling deploy

## Recommended folder structure

```text
.
├── Dockerfile
├── Makefile
├── mise.toml
├── .air.toml
├── deploy
│   ├── README.md
│   ├── caddy
│   │   └── Caddyfile
│   ├── compose
│   │   └── docker-compose.production.yml
│   ├── env
│   │   ├── app.env
│   │   ├── app.env.example
│   │   ├── postgres.env
│   │   └── postgres.env.example
│   └── k8s
│       └── base
│           ├── namespace.yaml
│           ├── configmap.yaml
│           ├── secret.example.yaml
│           ├── deployment.yaml
│           ├── service.yaml
│           ├── ingress.yaml
│           └── hpa.yaml
├── scripts
│   └── sync-web.mjs
├── server
│   ├── cmd/server
│   ├── internal
│   └── web/dist
└── src
```

## Why this approach

### Single binary + embedded SPA

- đơn giản hơn mô hình Nginx + frontend container + backend container
- giảm version drift giữa frontend bundle và backend API
- rollback gọn hơn vì mỗi release là một artifact
- hợp với self-hosted install kiểu Gitea, MinIO, Teleport

Tradeoff:

- binary lớn hơn
- muốn scale frontend tách biệt thì không phù hợp bằng kiến trúc CDN + API độc lập

### Distroless runtime

- giảm attack surface
- không có shell/package manager trong runtime
- phù hợp production hardened image

Tradeoff:

- debug trong container khó hơn
- healthcheck phải dùng chính binary thay vì `curl`

### Caddy cho self-hosted reverse proxy

- cấu hình gọn hơn Nginx
- tự động TLS/ACME
- websocket/compression hỗ trợ tốt
- hợp với philosophy “operational simplicity”

Nếu môi trường enterprise đã có ingress/nginx/traefik chuẩn thì vẫn có thể dùng các manifest K8s hiện có.

## Build pipeline

1. `npm run build:frontend:<env>`
2. `node scripts/sync-web.mjs`
3. `go build ./server/cmd/server`
4. Go embed `server/web/dist`
5. Docker multi-stage build
6. distroless final image

## Environment model

- `development`
- `staging`
- `production`

Frontend build:

- `npm run embed:web:development`
- `npm run embed:web:staging`
- `npm run embed:web:production`

Binary build:

- `make build APP_ENV=development`
- `make build APP_ENV=staging`
- `make build APP_ENV=production`

## Local production-like commands

### Build binary

```bash
make build APP_ENV=production
```

### Build image

```bash
make docker-build VERSION=v1.0.0 IMAGE=ghcr.io/owner/ams
```

### Push multi-arch image

```bash
make docker-push VERSION=v1.0.0 IMAGE=ghcr.io/owner/ams
```

### Run compose stack

```bash
make compose-up
```

### Stop compose stack

```bash
make compose-down
```

### Apply Kubernetes manifests

```bash
kubectl apply -k deploy/k8s/base
```

## Runtime endpoints

- `GET /health`: process liveness
- `GET /readyz`: readiness, checks PostgreSQL and optional Redis TCP reachability
- `GET /metrics`: Prometheus scrape endpoint
- `GET /debug/pprof/*`: optional, off by default

## SPA serving strategy

- static assets: served directly from embed FS
- `/assets/*`: `Cache-Control: public, max-age=31536000, immutable`
- `index.html`: `no-cache, no-store, must-revalidate`
- unknown non-API routes fallback về `index.html`
- unknown file-like paths trả `404`

## Docker Compose production notes

- `app`: single application container
- `postgres`: primary persistence
- `redis`: cache/session expansion point
- `caddy`: TLS + reverse proxy
- `edge` network cho public ingress
- `internal` network cô lập `postgres` và `redis`
- volumes giữ state qua restart

## Kubernetes notes

- deployment rolling update với `maxUnavailable=0`
- readiness dùng `/readyz`
- liveness dùng `/health`
- HPA theo CPU/memory
- image stateless nên horizontal scale được
- sticky session không bắt buộc vì refresh/session state đã về backend storage

## Zero-downtime rollout

- Compose:
  - pull image mới
  - start container mới
  - chờ healthy
  - switch traffic qua proxy
- Kubernetes:
  - rolling update mặc định
  - readiness gate ngăn traffic vào pod chưa sẵn sàng

## Rollback strategy

- image tag bất biến theo semantic version
- rollback compose: đổi `APP_TAG` về version cũ rồi `docker compose up -d`
- rollback k8s: `kubectl rollout undo deployment/ams -n ams`

## Migration strategy

Hiện app chạy `AutoMigrate` khi start. Với production nghiêm ngặt hơn:

- giữ migration SQL versioned ở `server/migrations`
- chạy migration job trước rollout
- chỉ rollout app khi migration thành công
- các thay đổi schema phải backward-compatible ít nhất một release

Khuyến nghị thực tế:

- phase hiện tại: giữ `AutoMigrate` + backup DB trước deploy
- phase enterprise hơn: tách migration job hoặc init container

## Security recommendations

- chạy image distroless non-root
- inject secret qua env/secret manager, không hardcode
- rotate `JWT_SECRET`, DB password, client secrets theo vòng đời vận hành
- chỉ bật `ENABLE_PPROF=true` khi có private network hoặc debug window cụ thể
- không expose `/metrics` public Internet
- để Caddy/nginx chèn HSTS và TLS chuẩn
- giữ `CORS_ALLOW_ORIGINS` explicit, không dùng wildcard ở production

## Observability

- structured logs JSON ở `staging/production`
- Prometheus scrape `/metrics`
- readiness/liveness để orchestration quyết định traffic
- có thể gắn thêm OpenTelemetry collector sau này mà không cần đổi packaging model

## Scaling recommendations

### Phù hợp hiện tại

- 1-3 replicas app
- PostgreSQL managed hoặc VM riêng
- Redis single instance cho self-hosted nhỏ

### Khi scale lớn hơn

- externalize Redis và PostgreSQL thành managed service/HA cluster
- thêm PgBouncer nếu connection fan-out cao
- dùng CDN phía trước nếu asset traffic lớn
- thêm dedicated worker/service nếu background jobs tăng mạnh

## CI/CD strategy

- `ci.yml`: verify PR và push `main`
- `release.yml`: build multi-arch image khi tag semantic version `v*.*.*`
- push image lên GHCR
- attach release binary cho self-hosted install không Docker

## Production checklist

- sửa toàn bộ secret placeholder trong `deploy/env/*.env`
- backup PostgreSQL trước rollout đầu tiên
- xác nhận DNS trỏ đúng vào reverse proxy
- xác nhận TLS cấp thành công
- xác nhận `GET /readyz` và `GET /health` đều pass
- xác nhận `client_id`, login channels và security policies đã sync đúng sau startup
- kiểm tra log structured JSON ở runtime
- kiểm tra `/metrics` chỉ internal hoặc bị chặn public
- xác nhận rollback procedure bằng staging trước production
