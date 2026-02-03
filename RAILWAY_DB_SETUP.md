# Настройка базы данных в Railway

Если вы не можете войти в систему, скорее всего база данных не настроена. Следуйте этим инструкциям.

## Быстрое решение

### Вариант 1: Автоматическая настройка (рекомендуется)

1. **Добавьте PostgreSQL в Railway:**
   - Откройте ваш проект в Railway Dashboard
   - Нажмите "+ New" → выберите "Database" → выберите "PostgreSQL"
   - Railway автоматически создаст переменную `DATABASE_URL`

2. **Запустите скрипт настройки:**

   Через Railway CLI:
   ```bash
   railway run node scripts/setup-railway-db.cjs
   ```
   или
   ```bash
   railway run yarn railway:setup-db
   ```

   Или через веб-интерфейс Railway:
   - Откройте ваш сервис приложения
   - Перейдите в "Deployments" → выберите последний деплой
   - Откройте "Shell" или "Logs"
   - Выполните команду: `node scripts/setup-railway-db.cjs` или `yarn railway:setup-db`

3. **Перезапустите приложение:**
   - В Railway Dashboard нажмите "Redeploy" на вашем сервисе

### Вариант 2: Ручная настройка через Railway Shell

1. **Откройте Railway Shell:**
   - В Railway Dashboard откройте ваш сервис приложения
   - Нажмите на вкладку "Shell" или используйте Railway CLI: `railway shell`

2. **Выполните команды:**
   ```bash
   cd server
   npx prisma generate --schema=./prisma/schema.prisma
   npx prisma db push --schema=./prisma/schema.prisma --accept-data-loss --skip-generate
   npx prisma migrate deploy --schema=./prisma/schema.prisma
   ```

3. **Перезапустите приложение**

## Проверка настройки

### Проверка переменных окружения

Убедитесь, что в Railway установлены следующие переменные:

1. **DATABASE_URL** (обязательно)
   - Должен быть установлен автоматически при добавлении PostgreSQL
   - Формат: `postgresql://user:password@host:port/database`
   - Проверьте в разделе "Variables" вашего сервиса

2. **Другие переменные:**
   - `NODE_ENV=production`
   - `STORAGE_DIR=/app/server/storage` (или другой путь)
   - Настройки LLM (например, `LLM_PROVIDER`, `OPENROUTER_API_KEY`)

### Проверка подключения к базе данных

Выполните в Railway Shell:
```bash
cd server
npx prisma db pull --schema=./prisma/schema.prisma
```

Если команда выполнилась без ошибок, база данных настроена правильно.

### Проверка таблиц

Выполните SQL запрос через Railway PostgreSQL:
```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Должны быть созданы следующие таблицы:
- `users`
- `workspaces`
- `workspace_documents`
- `workspace_chats`
- `workspace_users`
- `system_settings`
- И другие таблицы из схемы Prisma

## Решение проблем

### Ошибка: "DATABASE_URL is not set"

**Решение:**
1. Убедитесь, что PostgreSQL сервис добавлен в проект
2. Проверьте, что `DATABASE_URL` установлен в переменных окружения
3. Если переменная имеет вид `${{Postgres.DATABASE_URL}}`, это шаблон - Railway должен автоматически подставить значение
4. Перезапустите деплой после добавления PostgreSQL

### Ошибка: "Could not connect to database"

**Решение:**
1. Проверьте, что PostgreSQL сервис запущен (зеленый индикатор в Railway)
2. Проверьте правильность `DATABASE_URL`
3. Убедитесь, что приложение и база данных находятся в одном проекте Railway

### Ошибка: "Table does not exist"

**Решение:**
1. Выполните скрипт настройки: `node scripts/setup-railway-db.cjs` или `yarn railway:setup-db`
2. Или выполните вручную: `npx prisma db push --schema=./prisma/schema.prisma --accept-data-loss`

### Ошибка при входе: "Invalid credentials" или "User not found"

**Решение:**
1. Убедитесь, что база данных настроена (выполните скрипт настройки)
2. Проверьте, что таблица `users` существует
3. Если это первый запуск, возможно нужно создать первого пользователя через интерфейс регистрации

## Создание первого пользователя

Если база данных настроена, но нет пользователей:

1. Откройте веб-интерфейс приложения
2. Должна появиться форма регистрации первого пользователя
3. Создайте учетную запись администратора

Если форма регистрации не появляется, проверьте логи приложения в Railway.

## Дополнительная информация

- Схема базы данных: `server/prisma/schema.prisma`
- Миграции: `server/prisma/migrations/`
- Скрипт автоматической настройки: `docker/docker-entrypoint.sh`

## Полезные команды Railway CLI

```bash
# Подключиться к проекту
railway link

# Просмотреть переменные окружения
railway variables

# Запустить команду в окружении Railway
railway run <команда>

# Открыть shell
railway shell

# Просмотреть логи
railway logs
```
