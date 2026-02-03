# Настройка базы данных в Railway - Краткая инструкция

## Проблема: Не могу войти в систему

Если вы не можете войти в систему, скорее всего база данных не настроена.

## ⚠️ ВАЖНО: Где запускать команды

**Переменные Railway доступны только:**
- В Railway Shell (веб-интерфейс) ✅
- Через `railway run` команду ✅
- Внутри контейнеров Railway ✅

**НЕ работают:**
- Локально без `railway run` ❌
- В обычном терминале без Railway окружения ❌

## Решение (2 шага)

### Шаг 1: Добавьте PostgreSQL в Railway

1. Откройте ваш проект в [Railway Dashboard](https://railway.app/dashboard)
2. Нажмите **"+ New"** → выберите **"Database"** → выберите **"PostgreSQL"**
3. Railway автоматически создаст переменную `DATABASE_URL`

### Шаг 2: Перезапустите деплой (таблицы создадутся автоматически!)

**⭐ Таблицы создаются автоматически при запуске Docker контейнера!**

1. В Railway Dashboard нажмите **"Redeploy"** на вашем сервисе
2. Дождитесь завершения деплоя
3. Проверьте логи - вы должны увидеть:
   ```
   Setting up PostgreSQL database and tables...
   ✓ Database "railway" created successfully
   ✓ Tables created successfully
   Database schema created/updated successfully
   ```

**Если таблицы не создались автоматически, используйте ручную настройку:**

#### ⭐ Вариант B: Через веб-интерфейс Railway (РЕКОМЕНДУЕТСЯ)

**Это самый простой и надежный способ!**

1. Откройте ваш проект в [Railway Dashboard](https://railway.app/dashboard)
2. Откройте ваш **сервис приложения** (не база данных, а сам сервис с кодом)
3. Перейдите на вкладку **"Deployments"**
4. Найдите последний деплой и нажмите на него
5. Нажмите кнопку **"Shell"** или **"Open Shell"** (откроется терминал)
6. В терминале выполните:
   ```bash
   node scripts/setup-railway-db.cjs
   ```
   или
   ```bash
   yarn railway:setup-db
   ```
   или
   ```bash
   bash scripts/setup-db-manual.sh
   ```

   **Важно:** В Railway Shell переменная `DATABASE_URL` будет автоматически доступна, и внутренние адреса (`postgres.railway.internal`) работают корректно.

#### Вариант A: Через Railway CLI (требует TCP Proxy)

**⚠️ ВАЖНО:** Для работы через `railway run` нужно включить TCP Proxy для PostgreSQL:

1. Railway Dashboard → ваш PostgreSQL сервис
2. Перейдите в **Settings** → **TCP Proxy**
3. Включите TCP Proxy
4. Запишите публичный адрес (например, `proxy.railway.app:5432`)

**Затем используйте:**
```bash
railway link  # если еще не подключено
railway run node scripts/setup-railway-db.cjs
```

или

```bash
railway run bash scripts/setup-db-manual.sh
```

**⚠️ Внимание:** Без TCP Proxy внутренние адреса Railway (`postgres.railway.internal`) недоступны локально. **Рекомендуется использовать Вариант B** (Railway Shell) - там все работает автоматически.

### Шаг 3: Перезапустите приложение

1. В Railway Dashboard нажмите **"Redeploy"** на вашем сервисе
2. Дождитесь завершения деплоя
3. Попробуйте войти в систему

## Проверка

После выполнения скрипта вы должны увидеть сообщение:
```
✅ База данных успешно настроена!
```

## Если что-то пошло не так

### Ошибка: "Environment variable not found: DATABASE_URL"

**Проблема:** Вы запускаете команду локально без Railway окружения.

**Решение:**
1. **Используйте Railway Shell (веб-интерфейс) - РЕКОМЕНДУЕТСЯ:**
   - Откройте Railway Dashboard → ваш сервис приложения
   - Откройте Shell
   - Выполните команду там - переменные будут доступны автоматически

2. **Или используйте `railway run`:**
   ```bash
   railway run npx prisma db push --schema=./prisma/schema.prisma --accept-data-loss
   ```

3. **Или экспортируйте переменную локально (для тестирования):**
   ```bash
   export DATABASE_URL="postgresql://postgres:password@host:5432/railway"
   npx prisma db push --schema=./prisma/schema.prisma --accept-data-loss
   ```

### Ошибка: "No linked project found"

**Решение:**
- Используйте **Вариант B** (через веб-интерфейс Railway) вместо CLI
- Или выполните `railway link` для подключения к проекту

### Ошибка: "DATABASE_URL is not set" или "DATABASE_URL не установлен"

**Решение:**
- **Если запускаете локально:** Переменные Railway доступны только через `railway run` или в Railway Shell
- **Используйте один из способов:**
  1. Через Railway CLI: `railway run node scripts/setup-railway-db.cjs`
  2. Через веб-интерфейс Railway Shell (Вариант B) - переменные будут доступны автоматически
- Убедитесь, что PostgreSQL сервис добавлен в Railway и переменная `DATABASE_URL` установлена в Railway variables

### Ошибка: "Can't reach database server at `postgres.railway.internal`"

**Проблема:** `postgres.railway.internal` - это внутренний адрес Railway, доступный только внутри контейнеров. При локальном запуске через `railway run` он недоступен.

**Решение:**
1. **Используйте Railway Shell (веб-интерфейс) - РЕКОМЕНДУЕТСЯ:**
   - Откройте Railway Dashboard → ваш сервис приложения
   - Откройте Shell (вкладка "Shell" или "Open Shell")
   - Выполните: `node scripts/setup-railway-db.cjs`
   - В Railway Shell внутренние адреса работают автоматически

2. **Или получите публичный URL базы данных:**
   - В Railway Dashboard откройте ваш **PostgreSQL сервис**
   - Перейдите на вкладку **"Connect"** или **"Variables"**
   - Найдите **PUBLIC_URL** или создайте публичное подключение
   - Используйте этот URL вместо внутреннего адреса

3. **Или дождитесь автоматической настройки:**
   - Railway автоматически настроит базу данных при деплое через `docker-entrypoint.sh`
   - Просто перезапустите деплой: Railway Dashboard → ваш сервис → "Redeploy"

### Ошибка: "Could not connect to database"

**Решение:**
- Проверьте, что PostgreSQL сервис запущен (зеленый индикатор)
- Убедитесь, что приложение и база данных в одном проекте Railway
- Проверьте правильность `DATABASE_URL` в переменных окружения
- **Для локального запуска:** Используйте Railway Shell вместо `railway run`

### Ошибка: "Cannot find module 'pg'" или другие модули не найдены

**Решение:**
- В Railway Shell все зависимости должны быть установлены автоматически при деплое
- Если модули не найдены, попробуйте выполнить в Railway Shell:
  ```bash
  yarn install
  ```
- Или используйте ручной скрипт: `bash scripts/setup-db-manual.sh`

### Ошибка: "yarn: command not found" или "node: command not found"

**Решение:**
- Убедитесь, что вы находитесь в Shell вашего сервиса приложения
- Попробуйте использовать полный путь: `/usr/local/bin/node` или `/usr/bin/node`
- Или используйте `npx` вместо прямого вызова

### Все еще не могу войти

1. Проверьте логи приложения в Railway (вкладка "Logs")
2. Убедитесь, что база данных настроена (выполните скрипт еще раз)
3. Проверьте, что таблицы созданы (см. раздел "Проверка таблиц" ниже)
4. Если это первый запуск, создайте первого пользователя через форму регистрации

## Проверка таблиц

Чтобы убедиться, что таблицы созданы:

1. Откройте ваш PostgreSQL сервис в Railway
2. Перейдите на вкладку **"Data"** или **"Query"**
3. Выполните SQL запрос:
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

## Дополнительная информация

Подробная инструкция: [RAILWAY_DB_SETUP.md](./RAILWAY_DB_SETUP.md)
