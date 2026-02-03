#!/bin/bash

# Скрипт для создания всех таблиц с использованием предоставленных данных
# Использование:
#   bash scripts/setup-all-tables-with-credentials.sh

set -e

echo "🚀 Начинаю создание всех таблиц из Prisma схемы на Railway...\n"

# Данные из Railway (замените на ваши реальные значения)
PGHOST="${RAILWAY_TCP_PROXY_DOMAIN:-interchange.proxy.rlwy.net}"
PGPORT="${RAILWAY_TCP_PROXY_PORT:-31058}"
PGUSER="${POSTGRES_USER:-postgres}"
PGPASSWORD="${POSTGRES_PASSWORD:-qLBuhvfDaykvxYtkSxolXZXCzjdJrRzy}"
PGDATABASE="${POSTGRES_DB:-railway}"

# Построение строки подключения
DB_URL="postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PGPORT}/${PGDATABASE}"

echo "📡 Подключаюсь к: ${PGHOST}:${PGPORT}/${PGDATABASE}"
echo ""

cd server

# Шаг 1: Генерация Prisma Client
echo "📦 Шаг 1: Генерация Prisma Client..."
export DATABASE_URL="$DB_URL"
export CHECKPOINT_DISABLE=1
npx prisma generate --schema=./prisma/schema.prisma
echo "✅ Prisma Client сгенерирован"
echo ""

# Шаг 2: Применение схемы к базе данных (создание всех таблиц)
echo "📝 Шаг 2: Применение схемы к базе данных (создание всех таблиц)..."
echo "   Это создаст все таблицы из schema.prisma, включая:"
echo "   - users, system_settings, workspaces, event_logs и другие..."
echo ""

npx prisma db push --schema=./prisma/schema.prisma --accept-data-loss --skip-generate

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Все таблицы успешно созданы!"
    echo ""
    
    # Шаг 3: Выполнение миграций (опционально)
    echo "🔄 Шаг 3: Выполнение миграций..."
    npx prisma migrate deploy --schema=./prisma/schema.prisma || {
        echo "⚠️  Миграции не применены (это нормально, если таблицы уже созданы)"
    }
    echo ""
    
    # Проверка созданных таблиц
    echo "📊 Проверка созданных таблиц..."
    if command -v psql &> /dev/null; then
        echo ""
        psql "$DB_URL" -c "
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        "
        echo ""
        echo "📋 Проверка ключевых таблиц:"
        psql "$DB_URL" -c "
            SELECT 
                CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') 
                     THEN '✅ users' ELSE '❌ users' END as status
            UNION ALL
            SELECT 
                CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_settings') 
                     THEN '✅ system_settings' ELSE '❌ system_settings' END
            UNION ALL
            SELECT 
                CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'workspaces') 
                     THEN '✅ workspaces' ELSE '❌ workspaces' END
            UNION ALL
            SELECT 
                CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'event_logs') 
                     THEN '✅ event_logs' ELSE '❌ event_logs' END;
        "
    else
        echo "💡 Используйте Node.js скрипт для проверки:"
        echo "   node scripts/setup-all-tables-direct.js"
    fi
    
    echo ""
    echo "🎉 Настройка базы данных завершена успешно!"
    echo "💡 Теперь можно перезапустить приложение"
else
    echo "❌ Ошибка при создании таблиц"
    exit 1
fi
