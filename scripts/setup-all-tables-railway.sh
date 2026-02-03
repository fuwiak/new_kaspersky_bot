#!/bin/bash

# Скрипт для создания всех таблиц из Prisma схемы на Railway
# Использование:
#   railway run bash scripts/setup-all-tables-railway.sh
#   или в Railway Shell:
#   bash scripts/setup-all-tables-railway.sh

set -e

echo "🚀 Начинаю создание всех таблиц из Prisma схемы..."

# Определение строки подключения
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

echo ""
echo "📋 Схема Prisma: server/prisma/schema.prisma"
echo "📡 База данных: $(echo $DB_URL | sed 's/:[^:@]*@/:****@/')"
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
        psql "$DB_URL" -c "
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name;
        "
    else
        echo "💡 Используйте psql для проверки таблиц или запустите:"
        echo "   node scripts/setup-all-tables-railway.js"
    fi
    
    echo ""
    echo "🎉 Настройка базы данных завершена успешно!"
    echo "💡 Теперь можно перезапустить приложение"
else
    echo "❌ Ошибка при создании таблиц"
    exit 1
fi
