SHELL := /bin/bash

# One-shot demo bootstrap. Use only on macOS or Linux; on Windows follow
# docs/QUICKSTART.md step by step.
#
#   make demo       — full pipeline: infra + install + seed + start back & front
#   make stack      — start the docker stack (postgres, redis, minio, orthanc, vault)
#   make down       — stop the docker stack (keep volumes)
#   make reset      — stop the docker stack and drop all volumes (clean slate)
#   make seed       — run the demo seed in apps/back
#   make back       — run the API in the foreground
#   make front      — run the SPA in the foreground

.PHONY: demo stack down reset install seed back front help

help:
	@echo "Telerady — common commands"
	@echo "  make demo         Bootstrap everything (one-time setup + run)"
	@echo "  make stack        Start Postgres, Redis, MinIO, Orthanc and Vault"
	@echo "  make down         Stop the docker stack (volumes preserved)"
	@echo "  make reset        Stop and remove volumes (clean slate)"
	@echo "  make install      npm install for back + front"
	@echo "  make seed         Run apps/back seed:demo"
	@echo "  make back         Run the NestJS API in the foreground"
	@echo "  make front        Run the Angular SPA in the foreground"

stack:
	docker compose -f infra/docker-compose.dev.yml up -d

down:
	docker compose -f infra/docker-compose.dev.yml down

reset:
	docker compose -f infra/docker-compose.dev.yml down -v

install:
	cd apps/back && npm install
	cd apps/front && npm install

seed:
	cd apps/back && npm run seed:demo

back:
	cd apps/back && npm run start:dev

front:
	cd apps/front && npm start

demo: stack install seed
	@echo ""
	@echo "✅  Infra arriba y datos demo creados."
	@echo "   Credenciales:"
	@echo "     admin@telerady.test      /  AdminDemo!2026"
	@echo "     pepa@telerady.test       /  RadDemo!2026"
	@echo "     hospital@telerady.test   /  HospitalDemo!2026"
	@echo ""
	@echo "Ahora abre DOS terminales:"
	@echo "   1)  make back     (deja el API en marcha)"
	@echo "   2)  make front    (deja el SPA en marcha)"
	@echo ""
	@echo "Y entra en http://localhost:4200/login"
