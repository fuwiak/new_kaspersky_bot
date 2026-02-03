# 🚀 Быстрая миграция таблицы event_logs на Railway

## Публичный адрес PostgreSQL
```
interchange.proxy.rlwy.net:31058
```

## ⚡ Быстрый способ (рекомендуется)

### Вариант 1: Через Railway Shell (самый простой)

1. Откройте [Railway Dashboard](https://railway.app/dashboard)
2. Откройте ваш сервис приложения
3. Нажмите **"Shell"** или **"Open Shell"**
4. Выполните:
```bash
node scripts/migrate-event-logs-railway.js
```

### Вариант 2: Прямое подключение через psql

Если у вас есть пароль от базы данных:

```bash
# Замените ВАШ_ПАРОЛЬ на реальный пароль из Railway
psql "postgresql://postgres:ВАШ_ПАРОЛЬ@interchange.proxy.rlwy.net:31058/railway" \
  -f scripts/apply-event-logs-migration-direct.sql
```

Или через переменную окружения:

```bash
export PGPASSWORD=ВАШ_ПАРОЛЬ
psql -h interchange.proxy.rlwy.net \
     -p 31058 \
     -U postgres \
     -d railway \
     -f scripts/apply-event-logs-migration-direct.sql
```

## 📋 Что создается

Таблица `event_logs` со следующими полями:
- `id` - автоинкремент (PRIMARY KEY)
- `event` - тип события (TEXT, NOT NULL)
- `metadata` - дополнительные данные (TEXT, nullable)
- `userId` - ID пользователя (INTEGER, nullable)
- `occurredAt` - время события (TIMESTAMP, DEFAULT NOW())

**Индекс:** `event_logs_event_idx` на поле `event`

## ✅ Проверка

После миграции проверьте:

```sql
-- Подключитесь к базе
psql "postgresql://postgres:ПАРОЛЬ@interchange.proxy.rlwy.net:31058/railway"

-- Проверьте таблицу
SELECT * FROM information_schema.tables WHERE table_name = 'event_logs';

-- Проверьте структуру
\d event_logs
```

## 📚 Подробная инструкция

См. [MIGRATE_EVENT_LOGS_RAILWAY_RU.md](./MIGRATE_EVENT_LOGS_RAILWAY_RU.md) для детальной информации.
