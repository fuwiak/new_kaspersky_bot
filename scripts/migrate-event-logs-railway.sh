#!/bin/bash

# Скрипт для применения миграции таблицы event_logs на Railway
# Использование:
#   railway run bash scripts/migrate-event-logs-railway.sh
#   или в Railway Shell:
#   bash scripts/migrate-event-logs-railway.sh

set -e

echo "🚀 Начинаю миграцию таблицы event_logs на Railway..."

# Определение строки подключения
# Приоритет: DATABASE_PUBLIC_URL > DATABASE_URL > построение из переменных
DB_URL=""

if [ -n "$DATABASE_PUBLIC_URL" ]; then
    DB_URL="$DATABASE_PUBLIC_URL"
    echo "✅ Использую DATABASE_PUBLIC_URL (публичный адрес)"
elif [ -n "$DATABASE_URL" ]; then
    # Проверяем, не является ли это внутренним адресом
    if echo "$DATABASE_URL" | grep -q "railway.internal"; then
        echo "⚠️  DATABASE_URL содержит внутренний адрес, пытаюсь использовать публичный..."

        # Пытаемся построить публичный URL из переменных окружения
        if [ -n "$RAILWAY_TCP_PROXY_DOMAIN" ] && [ -n "$RAILWAY_TCP_PROXY_PORT" ]; then
            USER="${PGUSER:-${POSTGRES_USER:-postgres}}"
            PASSWORD="${PGPASSWORD:-$POSTGRES_PASSWORD}"
            DATABASE="${PGDATABASE:-${POSTGRES_DB:-railway}}"

            if [ -n "$PASSWORD" ]; then
                DB_URL="postgresql://${USER}:${PASSWORD}@${RAILWAY_TCP_PROXY_DOMAIN}:${RAILWAY_TCP_PROXY_PORT}/${DATABASE}"
                echo "✅ Построен публичный URL из переменных окружения"
            else
                echo "⚠️  Пароль не найден в переменных, используем DATABASE_URL"
                DB_URL="$DATABASE_URL"
            fi
        else
            echo "💡 Используйте DATABASE_PUBLIC_URL или запустите скрипт в Railway Shell"
            DB_URL="$DATABASE_URL"
        fi
    else
        DB_URL="$DATABASE_URL"
        echo "✅ Использую DATABASE_URL"
    fi
else
    # Пытаемся построить из отдельных переменных
    HOST="${RAILWAY_TCP_PROXY_DOMAIN:-$PGHOST}"
    PORT="${RAILWAY_TCP_PROXY_PORT:-${PGPORT:-5432}}"
    USER="${PGUSER:-${POSTGRES_USER:-postgres}}"
    PASSWORD="${PGPASSWORD:-$POSTGRES_PASSWORD}"
    DATABASE="${PGDATABASE:-${POSTGRES_DB:-railway}}"

    if [ -n "$HOST" ] && [ -n "$PASSWORD" ]; then
        DB_URL="postgresql://${USER}:${PASSWORD}@${HOST}:${PORT}/${DATABASE}"
        echo "✅ Построен URL из переменных окружения"
    else
        echo "❌ Ошибка: Не удалось определить строку подключения"
        echo "💡 Убедитесь, что установлены:"
        echo "   - DATABASE_PUBLIC_URL, или"
        echo "   - DATABASE_URL, или"
        echo "   - RAILWAY_TCP_PROXY_DOMAIN, RAILWAY_TCP_PROXY_PORT, POSTGRES_PASSWORD"
        exit 1
    fi
fi

# Проверка наличия psql
if ! command -v psql &> /dev/null; then
    echo "⚠️  psql не найден, пытаюсь использовать node для выполнения SQL..."

    # Альтернативный способ через Node.js
    if command -v node &> /dev/null; then
        echo "📝 Выполняю миграцию через Node.js..."
        node -e "
        const { Client } = require('pg');
        const fs = require('fs');
        const sql = fs.readFileSync('server/prisma/migrations/create_event_logs_postgresql.sql', 'utf8');

        const client = new Client({
            connectionString: process.env.DATABASE_URL
        });

        client.connect()
            .then(() => {
                console.log('✅ Подключено к базе данных');
                return client.query(sql);
            })
            .then(() => {
                console.log('✅ Миграция успешно применена');
                process.exit(0);
            })
            .catch(err => {
                console.error('❌ Ошибка при применении миграции:', err.message);
                process.exit(1);
            })
            .finally(() => {
                client.end();
            });
        "
        exit $?
    else
        echo "❌ Ошибка: psql и node не найдены"
        echo "💡 Установите PostgreSQL клиент или используйте Prisma:"
        echo "   npx prisma db push"
        exit 1
    fi
fi

# Применение миграции через psql
echo "📝 Применяю миграцию через psql..."
psql "$DB_URL" -f server/prisma/migrations/create_event_logs_postgresql.sql

if [ $? -eq 0 ]; then
    echo "✅ Миграция успешно применена!"
    echo ""
    echo "📊 Проверка таблицы:"
    psql "$DB_URL" -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'event_logs';"
else
    echo "❌ Ошибка при применении миграции"
    exit 1
fi
