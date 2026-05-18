APP_NAME ?= ams
APP_ENV ?= production
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo dev)
COMMIT ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo local)
BUILD_DATE ?= $(shell date -u +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || echo unknown)
IMAGE ?= ghcr.io/owner/ams
PLATFORMS ?= linux/amd64,linux/arm64
COMPOSE_FILE ?= deploy/compose/docker-compose.production.yml
ENV_FILE ?= deploy/env/app.env

.PHONY: frontend embed-web server build test docker-build docker-push compose-up compose-down k8s-apply clean

frontend:
	npm run build:frontend:$(APP_ENV)

embed-web:
	npm run embed:web:$(APP_ENV)

server: embed-web
	cd server && go build -trimpath -ldflags="-s -w -X main.version=$(VERSION) -X main.commit=$(COMMIT) -X main.date=$(BUILD_DATE)" -o ../bin/$(APP_NAME) ./cmd/server

build: server

test:
	cd server && go test ./...
	npm run build:frontend

docker-build:
	docker buildx build --load \
		--build-arg VERSION=$(VERSION) \
		--build-arg COMMIT=$(COMMIT) \
		--build-arg BUILD_DATE=$(BUILD_DATE) \
		-t $(IMAGE):$(VERSION) \
		-t $(IMAGE):latest .

docker-push:
	docker buildx build --push \
		--platform $(PLATFORMS) \
		--build-arg VERSION=$(VERSION) \
		--build-arg COMMIT=$(COMMIT) \
		--build-arg BUILD_DATE=$(BUILD_DATE) \
		-t $(IMAGE):$(VERSION) \
		-t $(IMAGE):latest .

compose-up:
	docker compose --env-file $(ENV_FILE) -f $(COMPOSE_FILE) up -d

compose-down:
	docker compose --env-file $(ENV_FILE) -f $(COMPOSE_FILE) down

k8s-apply:
	kubectl apply -k deploy/k8s/base

clean:
	rm -rf dist bin tmp
