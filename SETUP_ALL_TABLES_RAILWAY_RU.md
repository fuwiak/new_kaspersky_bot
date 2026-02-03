# 🗄️ Создание всех таблиц на Railway

## Проблема

Ошибки типа:
```
The table `public.users` does not exist in the current database.
The table `public.system_settings` does not exist in the current database.
```

Это означает, что в базе данных отсутствуют необходимые таблицы.

## ⚡ Быстрое решение

### Способ 1: Простой скрипт с вашими данными (РЕКОМЕНДУЕТСЯ) ⭐

```bash
bash scripts/setup-all-tables-with-credentials.sh
```

Этот скрипт использует ваши данные из Railway и создаст **все таблицы** из Prisma схемы.

### Способ 2: Через Railway Shell

1. Откройте [Railway Dashboard](https://railway.app/dashboard)
2. Откройте ваш сервис приложения
3. Нажмите **"Shell"** или **"Open Shell"**
4. Выполните:

```bash
node scripts/setup-all-tables-railway.js
```

или

```bash
bash scripts/setup-all-tables-railway.sh
```

### Способ 3: Через Railway CLI

```bash
railway run node scripts/setup-all-tables-railway.js
```

или

```bash
railway run bash scripts/setup-all-tables-railway.sh
```

### Способ 4: Прямое подключение (локально)

```bash
export PGPASSWORD="qLBuhvfDaykvxYtkSxolXZXCzjdJrRzy"
node scripts/setup-all-tables-direct.js
```

## 📋 Что создается

Скрипт создаст **все таблицы** из `server/prisma/schema.prisma`, включая:

### Основные таблицы:
- ✅ `users` - пользователи системы
- ✅ `system_settings` - настройки системы
- ✅ `workspaces` - рабочие пространства
- ✅ `workspace_documents` - документы в рабочих пространствах
- ✅ `workspace_chats` - чаты
- ✅ `workspace_users` - связь пользователей и рабочих пространств

### Дополнительные таблицы:
- ✅ `event_logs` - логи событий
- ✅ `api_keys` - API ключи
- ✅ `invites` - приглашения
- ✅ `recovery_codes` - коды восстановления
- ✅ `password_reset_tokens` - токены сброса пароля
- ✅ `embed_configs` - конфигурации встраивания
- ✅ `embed_chats` - чаты встраивания
- ✅ `workspace_threads` - потоки обсуждений
- ✅ `workspace_suggested_messages` - предложенные сообщения
- ✅ `workspace_agent_invocations` - вызовы агентов
- ✅ `cache_data` - кэш данных
- ✅ `document_vectors` - векторы документов
- ✅ `welcome_messages` - приветственные сообщения
- ✅ `slash_command_presets` - пресеты команд
- ✅ `document_sync_queues` - очереди синхронизации документов
- ✅ `document_sync_executions` - выполнения синхронизации
- ✅ `browser_extension_api_keys` - API ключи расширения браузера
- ✅ `temporary_auth_tokens` - временные токены аутентификации
- ✅ `system_prompt_variables` - переменные системных промптов
- ✅ `prompt_history` - история промптов
- ✅ `desktop_mobile_devices` - устройства desktop/mobile
- ✅ `workspace_parsed_files` - разобранные файлы

**Всего: ~25 таблиц**

## 🔍 Как это работает

Скрипт использует `prisma db push`, который:
1. Читает схему из `server/prisma/schema.prisma`
2. Создает все таблицы, индексы и связи
3. Применяет все миграции
4. Проверяет созданные таблицы

## ✅ Проверка после выполнения

После выполнения скрипта проверьте:

```bash
# Подключитесь к базе данных
psql "postgresql://postgres:ПАРОЛЬ@interchange.proxy.rlwy.net:31058/railway"

# Проверьте все таблицы
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

# Проверьте ключевые таблицы
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
```

## 🛠️ Устранение проблем

### Ошибка: "DATABASE_URL не установлен"

**Решение:**
- Используйте **Способ 1** (скрипт с данными) или **Способ 2** (Railway Shell)
- Или установите переменные окружения:
  ```bash
  export PGPASSWORD="ваш_пароль"
  export RAILWAY_TCP_PROXY_DOMAIN="interchange.proxy.rlwy.net"
  export RAILWAY_TCP_PROXY_PORT="31058"
  ```

### Ошибка: "Could not connect to database"

**Решение:**
- Проверьте правильность пароля и адреса
- Убедитесь, что PostgreSQL сервис запущен в Railway
- Используйте публичный адрес (`RAILWAY_TCP_PROXY_DOMAIN`)

### Ошибка: "prisma: command not found"

**Решение:**
- Установите зависимости: `yarn install` или `npm install`
- Или используйте `npx prisma` вместо `prisma`

### Таблицы не создаются

**Решение:**
- Проверьте логи выполнения скрипта
- Убедитесь, что `DATABASE_URL` правильный
- Попробуйте выполнить в Railway Shell (там все переменные доступны автоматически)

## 📚 Дополнительная информация

- Схема Prisma: `server/prisma/schema.prisma`
- Скрипт настройки: `scripts/setup-railway-db.cjs` (альтернативный способ)
- Документация Prisma: https://www.prisma.io/docs

## 🎯 После успешного создания таблиц

1. **Перезапустите приложение** в Railway
2. **Проверьте логи** - ошибки о несуществующих таблицах должны исчезнуть
3. **Создайте первого пользователя** через форму регистрации
