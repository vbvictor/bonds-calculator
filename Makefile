# Makefile проекта bond-rate-calculator.
# Все длительные процессы (дев-сервер, превью) запускаются в фоне, их PID лежат
# в .run/, останавливаются одной целью `make down`.

SHELL := /bin/bash
.DEFAULT_GOAL := help

DEV_PORT     ?= 5173
PREVIEW_PORT ?= 4173
BASE_PATH    := /bonds-calculator/

RUN_DIR      := .run
DEV_PID      := $(RUN_DIR)/dev.pid
PREVIEW_PID  := $(RUN_DIR)/preview.pid
DEV_LOG      := $(RUN_DIR)/dev.log
PREVIEW_LOG  := $(RUN_DIR)/preview.log

# Запускаем бинарники напрямую, а не через npm run: тогда в PID-файле лежит сам
# сервер, а не обёртка npm, и `make down` гасит именно его, не оставляя сироту
# держать порт.
VITE := ./node_modules/.bin/vite

.PHONY: help up down restart status logs dev preview stop-dev stop-preview \
        install test watch typecheck build check ref clean distclean

help: ## Показать этот список
	@echo "bond-rate-calculator"
	@echo
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-14s\033[0m %s\n", $$1, $$2}'
	@echo
	@echo "  порты: dev=$(DEV_PORT) preview=$(PREVIEW_PORT), переопределяются так:"
	@echo "    make up DEV_PORT=3000"

# ── запуск и остановка ───────────────────────────────────────────────────────

up: dev ## Поднять всё: зависимости и дев-сервер

down: stop-dev stop-preview ## Остановить всё

restart: down up ## Перезапустить

dev: node_modules ## Дев-сервер в фоне
	@mkdir -p $(RUN_DIR)
	@if [ -f $(DEV_PID) ] && kill -0 $$(cat $(DEV_PID)) 2>/dev/null; then \
		echo "дев-сервер уже поднят, pid $$(cat $(DEV_PID))"; \
	else \
		$(VITE) --port $(DEV_PORT) --strictPort > $(DEV_LOG) 2>&1 & \
		echo $$! > $(DEV_PID); \
		$(MAKE) -s wait-port PORT=$(DEV_PORT) LOG=$(DEV_LOG) PIDFILE=$(DEV_PID) \
			&& echo "дев-сервер: http://localhost:$(DEV_PORT)$(BASE_PATH)"; \
	fi

preview: build ## Собрать и поднять превью продакшен-сборки в фоне
	@mkdir -p $(RUN_DIR)
	@if [ -f $(PREVIEW_PID) ] && kill -0 $$(cat $(PREVIEW_PID)) 2>/dev/null; then \
		echo "превью уже поднято, pid $$(cat $(PREVIEW_PID))"; \
	else \
		$(VITE) preview --port $(PREVIEW_PORT) --strictPort > $(PREVIEW_LOG) 2>&1 & \
		echo $$! > $(PREVIEW_PID); \
		$(MAKE) -s wait-port PORT=$(PREVIEW_PORT) LOG=$(PREVIEW_LOG) PIDFILE=$(PREVIEW_PID) \
			&& echo "превью: http://localhost:$(PREVIEW_PORT)$(BASE_PATH)"; \
	fi

stop-dev: ## Остановить только дев-сервер
	@$(MAKE) -s kill-one NAME="дев-сервер" PIDFILE=$(DEV_PID) PORT=$(DEV_PORT)

stop-preview: ## Остановить только превью
	@$(MAKE) -s kill-one NAME="превью" PIDFILE=$(PREVIEW_PID) PORT=$(PREVIEW_PORT)

status: ## Что сейчас запущено
	@$(MAKE) -s status-one NAME="дев-сервер" PIDFILE=$(DEV_PID) PORT=$(DEV_PORT)
	@$(MAKE) -s status-one NAME="превью    " PIDFILE=$(PREVIEW_PID) PORT=$(PREVIEW_PORT)

logs: ## Хвост лога дев-сервера
	@test -f $(DEV_LOG) || { echo "лога нет, дев-сервер не запускали"; exit 0; }
	@tail -f $(DEV_LOG)

# ── проверки и сборка ────────────────────────────────────────────────────────

install: node_modules ## Поставить зависимости

node_modules: package-lock.json
	@npm ci
	@touch node_modules

test: node_modules ## Тесты один раз
	@npm test

watch: node_modules ## Тесты в режиме наблюдения
	@npx vitest

typecheck: node_modules ## Проверка типов
	@npm run typecheck

build: node_modules ## Продакшен-сборка в dist/
	@npm run build

check: typecheck test build ## Всё, что гоняет CI перед деплоем

ref: ## Напечатать эталонные числа из референсной реализации
	@python3 reference/ref.py

# ── уборка ───────────────────────────────────────────────────────────────────

clean: ## Убрать сборку, логи и кеши
	@rm -rf dist $(RUN_DIR) *.tsbuildinfo reference/__pycache__
	@echo "убрано"

distclean: down clean ## Убрать всё, включая node_modules
	@rm -rf node_modules
	@echo "node_modules снесён"

# ── внутренние цели ──────────────────────────────────────────────────────────

.PHONY: wait-port kill-one status-one

# Ждём, пока порт займёт ИМЕННО наш процесс. Проверять просто «порт занят»
# нельзя: если на нём уже сидит чужой сервер, vite со --strictPort умрёт, а
# make отрапортует успех и отправит человека на чужую страницу.
wait-port:
	@PID=$$(cat $(PIDFILE)); \
	for i in $$(seq 1 60); do \
		if ! kill -0 $$PID 2>/dev/null; then \
			echo "процесс не поднялся, последние строки лога:"; tail -20 $(LOG); \
			rm -f $(PIDFILE); exit 1; \
		fi; \
		if lsof -ti tcp:$(PORT) 2>/dev/null | grep -qx "$$PID"; then exit 0; fi; \
		sleep 0.25; \
	done; \
	echo "порт $(PORT) так и не занялся за 15 секунд, лог:"; tail -20 $(LOG); \
	kill $$PID 2>/dev/null || true; rm -f $(PIDFILE); exit 1

# Гасим строго то, что запускали сами. Порт подчищаем только если PID-файл был:
# без него процесс на порту нам не принадлежит, и добивать его нельзя — на 5173
# вполне может сидеть чужой проект.
kill-one:
	@if [ ! -f $(PIDFILE) ]; then \
		echo "$(NAME): не запущен"; \
		exit 0; \
	fi; \
	PID=$$(cat $(PIDFILE)); \
	if kill -0 $$PID 2>/dev/null; then \
		kill $$PID 2>/dev/null || true; \
		for i in $$(seq 1 20); do kill -0 $$PID 2>/dev/null || break; sleep 0.1; done; \
		kill -9 $$PID 2>/dev/null || true; \
		echo "$(NAME): остановлен"; \
	else \
		echo "$(NAME): уже не работал"; \
	fi; \
	rm -f $(PIDFILE); \
	ORPHANS=$$(lsof -ti tcp:$(PORT) 2>/dev/null || true); \
	if [ -n "$$ORPHANS" ]; then \
		kill -9 $$ORPHANS 2>/dev/null || true; \
		echo "$(NAME): подчищен осиротевший процесс на порту $(PORT)"; \
	fi

status-one:
	@if [ -f $(PIDFILE) ] && kill -0 $$(cat $(PIDFILE)) 2>/dev/null; then \
		echo "$(NAME)  поднят   pid $$(cat $(PIDFILE))  http://localhost:$(PORT)$(BASE_PATH)"; \
	elif lsof -ti tcp:$(PORT) >/dev/null 2>&1; then \
		echo "$(NAME)  порт $(PORT) занят чужим процессом: $$(lsof -ti tcp:$(PORT) | tr '\n' ' ')"; \
	else \
		echo "$(NAME)  не запущен"; \
	fi
