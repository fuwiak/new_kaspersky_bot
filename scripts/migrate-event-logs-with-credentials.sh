#!/bin/bash

# Скрипт для применения миграции с использованием предоставленных данных
# Использование:
#   bash scripts/migrate-event-logs-with-credentials.sh

set -e

echo "🚀 Начинаю миграцию таблицы event_logs на Railway...\n"

# Данные из Railway (замените на ваши реальные значения)
PGHOST="${RAILWAY_TCP_PROXY_DOMAIN:-interchange.proxy.rlwy.net}"
PGPORT="${RAILWAY_TCP_PROXY_PORT:-31058}"
PGUSER="${POSTGRES_USER:-postgres}"
PGPASSWORD="${POSTGRES_PASSWORD:-qLBuhvfDaykvxYtkSxolXZXCzjdJrRzy}"
PGDATABASE="${POSTGRES_DB:-railway}"

# Построение строки подключения
DB_URL="postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}"

echo "📡 Подключаюсь к: ${PGHOST}:${PGPORT}/${PGDATABASE}"

# Проверка наличия psql
if ! command -v psql &> /dev/null; then
    echo "⚠️  psql не найден, использую Node.js..."
    
    if ! command -v node &> /dev/null; then
        echo "❌ Ошибка: psql и node не найдены"
        echo "💡 Установите PostgreSQL клиент или Node.js"
        exit 1
    fi
    
    # Используем Node.js скрипт
    export PGHOST PGPORT PGUSER PGPASSWORD PGDATABASE
    node scripts/migrate-event-logs-direct.js
    exit $?
fi

# Применение миграции через psql
echo "📝 Применяю миграцию через psql..."
psql "$DB_URL" -f server/prisma/migrations/create_event_logs_postgresql.sql

if [ $? -eq 0 ]; then
    echo "\n✅ Миграция успешно применена!"
    echo ""
    echo "📊 Проверка таблицы:"
    psql "$DB_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_logs';"
    echo ""
    echo "📋 Структура таблицы:"
    psql "$DB_URL" -c "\d event_logs"
else
    echo "❌ Ошибка при применении миграции"
    exit 1
fi
