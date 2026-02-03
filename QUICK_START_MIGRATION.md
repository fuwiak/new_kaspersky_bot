# ⚡ Быстрый старт - Миграция event_logs

## 🎯 Самый простой способ (с вашими данными)

Используйте скрипт с встроенными данными:

```bash
bash scripts/migrate-event-logs-with-credentials.sh
```

Или через Node.js:

```bash
export PGPASSWORD="qLBuhvfDaykvxYtkSxolXZXCzjdJrRzy"
node scripts/migrate-event-logs-direct.js
```

## 🔧 Через Railway CLI (обновленный скрипт)

Обновленные скрипты теперь автоматически определяют публичный адрес:

```bash
railway run node scripts/migrate-event-logs-railway.js
```

или

```bash
railway run bash scripts/migrate-event-logs-railway.sh
```

Скрипты автоматически:
- ✅ Используют `DATABASE_PUBLIC_URL` если доступен
- ✅ Определяют внутренний адрес и строят публичный URL
- ✅ Используют переменные окружения для построения подключения

## 📝 Прямое подключение через psql

```bash
psql "postgresql://postgres:qLBuhvfDaykvxYtkSxolXZXCzjdJrRzy@interchange.proxy.rlwy.net:31058/railway" \
  -f scripts/apply-event-logs-migration-direct.sql
```

## ✅ Проверка

После миграции проверьте:

```bash
psql "postgresql://postgres:qLBuhvfDaykvxYtkSxolXZXCzjdJrRzy@interchange.proxy.rlwy.net:31058/railway" \
  -c "SELECT * FROM information_schema.tables WHERE table_name = 'event_logs';"
```
