#!/bin/bash
# Скрипт для проверки переменных окружения Railway

echo "=========================================="
echo "Проверка переменных окружения Railway"
echo "=========================================="
echo ""

if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL не установлен!"
    echo ""
    echo "Это нормально, если вы запускаете скрипт локально."
    echo "Переменные Railway доступны только:"
    echo "  1. Через 'railway run' команду"
    echo "  2. В Railway Shell (веб-интерфейс)"
    echo ""
    echo "Для настройки базы данных используйте:"
    echo "  railway run node scripts/setup-railway-db.cjs"
    echo ""
    echo "Или откройте Railway Shell и выполните:"
    echo "  node scripts/setup-railway-db.cjs"
    exit 1
else
    echo "✓ DATABASE_URL установлен"
    echo "  Значение: ${DATABASE_URL:0:50}..."
    echo ""
    echo "Можно запускать скрипт настройки базы данных!"
fi
