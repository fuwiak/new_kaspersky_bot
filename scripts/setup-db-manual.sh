#!/bin/bash
# Ручной скрипт для настройки базы данных в Railway
# Используйте этот скрипт, если основной скрипт не работает

set -e

echo "=========================================="
echo "Ручная настройка базы данных"
echo "=========================================="
echo ""

# Пытаемся построить DATABASE_URL из отдельных переменных, если он не установлен или содержит шаблоны
if [ -z "$DATABASE_URL" ] || [ -n "$(echo "$DATABASE_URL" | grep -E '\{\{|\\$\\{\{')" ]; then
    echo "⚠️  DATABASE_URL не установлен или содержит шаблоны, пытаемся построить из отдельных переменных...\n"

    # Пробуем использовать DATABASE_PUBLIC_URL (для локального подключения)
    if [ -n "$DATABASE_PUBLIC_URL" ] && [ -z "$(echo "$DATABASE_PUBLIC_URL" | grep -E '\{\{|\\$\\{\{')" ]; then
        export DATABASE_URL="$DATABASE_PUBLIC_URL"
        echo "✓ Используем DATABASE_PUBLIC_URL (для локального подключения)"
    # Или строим из отдельных переменных POSTGRES_*
    elif [ -n "$POSTGRES_USER" ] && [ -n "$POSTGRES_PASSWORD" ] && [ -n "$POSTGRES_DB" ]; then
        # Проверяем, запущены ли мы внутри Railway контейнера
        # Если RAILWAY_PRIVATE_DOMAIN установлен и не шаблон, используем внутренний адрес
        if [ -n "$RAILWAY_PRIVATE_DOMAIN" ] && [ -z "$(echo "$RAILWAY_PRIVATE_DOMAIN" | grep -E '\{\{|\\$\\{\{')" ] &&
           [ "$RAILWAY_PRIVATE_DOMAIN" != "web.railway.internal" ]; then
            # Мы внутри Railway, используем внутренний адрес
            HOST="postgres.railway.internal"
            echo "✓ Используем внутренний адрес Railway (внутри контейнера)"
        # Иначе пытаемся использовать публичный URL через TCP Proxy
        elif [ -n "$RAILWAY_TCP_PROXY_DOMAIN" ] && [ -n "$RAILWAY_TCP_PROXY_PORT" ] &&
             [ -z "$(echo "$RAILWAY_TCP_PROXY_DOMAIN" | grep -E '\{\{|\\$\\{\{')" ]; then
            HOST="$RAILWAY_TCP_PROXY_DOMAIN"
            PORT="$RAILWAY_TCP_PROXY_PORT"
            export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${HOST}:${PORT}/${POSTGRES_DB}"
            echo "✓ Используем публичный TCP Proxy URL"
        else
            # Локальный запуск - нужен публичный URL
            echo "⚠️  ВНИМАНИЕ: Вы запускаете скрипт локально!"
            echo "   Внутренний адрес 'postgres.railway.internal' недоступен локально."
            echo ""
            echo "   Решения:"
            echo "   1. Используйте Railway Shell (веб-интерфейс) - РЕКОМЕНДУЕТСЯ"
            echo "      - Railway Dashboard → ваш сервис → Shell"
            echo "      - Выполните: bash scripts/setup-db-manual.sh"
            echo ""
            echo "   2. Или включите TCP Proxy для PostgreSQL:"
            echo "      - Railway Dashboard → PostgreSQL сервис → Settings → TCP Proxy"
            echo "      - Включите TCP Proxy и перезапустите скрипт"
            echo ""
            echo "   3. Или дождитесь автоматической настройки при деплое"
            echo "      - Railway автоматически настроит БД через docker-entrypoint.sh"
            echo ""
            echo "⚠️  Пытаемся использовать внутренний адрес (НЕ РАБОТАЕТ локально)..."
            HOST="postgres.railway.internal"
            PORT="5432"
            # Не устанавливаем DATABASE_URL, чтобы скрипт завершился с ошибкой
            unset DATABASE_URL
        fi

        if [ -z "$PORT" ]; then
            PORT="5432"
        fi
        export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${HOST}:${PORT}/${POSTGRES_DB}"
        echo "✓ Построили DATABASE_URL из POSTGRES_* переменных"
    # Или используем PGUSER, PGPASSWORD и т.д. (если они не шаблоны)
    elif [ -n "$PGUSER" ] && [ -n "$PGPASSWORD" ] && [ -n "$PGDATABASE" ] && [ -n "$PGHOST" ] &&
         [ -z "$(echo "$PGHOST" | grep -E '\{\{|\\$\\{\{')" ]; then
        PG_PORT="${PGPORT:-5432}"
        export DATABASE_URL="postgresql://${PGUSER}:${PGPASSWORD}@${PGHOST}:${PG_PORT}/${PGDATABASE}"
        echo "✓ Построили DATABASE_URL из PG* переменных"
    fi
    echo ""
fi

# Проверка DATABASE_URL после попытки построения
if [ -z "$DATABASE_URL" ] || [ -n "$(echo "$DATABASE_URL" | grep -E '\{\{|\\$\\{\{')" ]; then
    echo "❌ ОШИБКА: DATABASE_URL не установлен или содержит шаблоны!"
    echo ""
    echo "Доступные переменные:"
    echo "  DATABASE_URL: ${DATABASE_URL:-не установлено}"
    echo "  DATABASE_PUBLIC_URL: ${DATABASE_PUBLIC_URL:-не установлено}"
    echo "  POSTGRES_USER: ${POSTGRES_USER:-не установлено}"
    echo "  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:+***}"
    echo "  POSTGRES_DB: ${POSTGRES_DB:-не установлено}"
    echo "  RAILWAY_PRIVATE_DOMAIN: ${RAILWAY_PRIVATE_DOMAIN:-не установлено}"
    echo "  PGHOST: ${PGHOST:-не установлено}"
    echo ""
    echo "Это нормально, если вы запускаете скрипт локально."
    echo "Переменные Railway доступны только:"
    echo "  1. Через 'railway run' команду"
    echo "  2. В Railway Shell (веб-интерфейс)"
    echo ""
    echo "Для настройки базы данных используйте:"
    echo ""
    echo "1. Railway Shell (РЕКОМЕНДУЕТСЯ):"
    echo "   - Откройте Railway Dashboard → ваш сервис → Shell"
    echo "   - Выполните: bash scripts/setup-db-manual.sh"
    echo ""
    echo "2. Или включите TCP Proxy для PostgreSQL:"
    echo "   - Railway Dashboard → PostgreSQL сервис → Settings → TCP Proxy"
    echo "   - Включите TCP Proxy и используйте публичный адрес"
    echo ""
    echo "3. Или дождитесь автоматической настройки при деплое"
    echo "   - Railway автоматически настроит БД через docker-entrypoint.sh"
    exit 1
fi

echo "✓ DATABASE_URL установлен: ${DATABASE_URL:0:50}..."
echo ""

# Экспортируем DATABASE_URL если он не установлен, но есть отдельные переменные
if [ -z "$DATABASE_URL" ] || [ -n "$(echo "$DATABASE_URL" | grep -E '\{\{|\\$\\{\{')" ]; then
    if [ -n "$POSTGRES_USER" ] && [ -n "$POSTGRES_PASSWORD" ] && [ -n "$POSTGRES_DB" ]; then
        # Пробуем использовать PGHOST или RAILWAY_PRIVATE_DOMAIN
        HOST="${RAILWAY_PRIVATE_DOMAIN:-${PGHOST:-postgres.railway.internal}}"
        # Если хост содержит шаблоны, используем fallback
        if echo "$HOST" | grep -qE '\{\{|\\$\\{\{'; then
            HOST="postgres.railway.internal"
        fi
        export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${HOST}:5432/${POSTGRES_DB}"
        echo "✓ Построили DATABASE_URL из POSTGRES_* переменных"
    fi
fi

# Переход в папку server
cd server || {
    echo "❌ ОШИБКА: Не удалось перейти в папку server"
    exit 1
}

echo "Шаг 1: Генерация Prisma Client..."
export CHECKPOINT_DISABLE=1
npx prisma generate --schema=./prisma/schema.prisma

if [ $? -ne 0 ]; then
    echo "❌ ОШИБКА: Не удалось сгенерировать Prisma Client"
    exit 1
fi

echo "✓ Prisma Client сгенерирован"
echo ""

echo "Шаг 2: Применение схемы к базе данных..."
npx prisma db push --schema=./prisma/schema.prisma --accept-data-loss --skip-generate

if [ $? -ne 0 ]; then
    echo "❌ ОШИБКА: Не удалось применить схему"
    exit 1
fi

echo "✓ Схема применена"
echo ""

echo "Шаг 3: Выполнение миграций..."
npx prisma migrate deploy --schema=./prisma/schema.prisma || {
    echo "⚠️  Предупреждение: Миграции не выполнены (это нормально, если схема уже применена)"
}

echo ""
echo "=========================================="
echo "✅ База данных настроена!"
echo "=========================================="
