# Деплой AnythingLLM на Railway

Этот документ описывает процесс деплоя AnythingLLM на Railway.

## Требования

- Аккаунт на [Railway](https://railway.app)
- Git репозиторий с кодом проекта

## Шаги для деплоя

### 1. Подготовка репозитория

Убедитесь, что все файлы закоммичены:
```bash
git add .
git commit -m "Prepare for Railway deployment"
git push
```

### 2. Создание проекта на Railway

1. Войдите в [Railway Dashboard](https://railway.app/dashboard)
2. Нажмите "New Project"
3. Выберите "Deploy from GitHub repo"
4. Выберите ваш репозиторий

### 3. Настройка переменных окружения

В настройках проекта Railway добавьте следующие переменные окружения:

**Обязательные:**
- `NODE_ENV=production`
- Railway автоматически устанавливает `PORT` - сервер будет использовать его автоматически

**Настройки LLM (выберите один):**
- `LLM_PROVIDER=openrouter` (или другой провайдер)
- `OPENROUTER_API_KEY=ваш-ключ` (если используете OpenRouter)

**Настройки базы данных:**
- Railway автоматически предоставит PostgreSQL, если добавите плагин PostgreSQL
- Или используйте SQLite (по умолчанию) - данные будут храниться в файловой системе

**Дополнительные настройки:**
- `EMBEDDING_ENGINE=inherit` (или другой)
- `VECTOR_DB=lancedb` (или другой)
- `DISABLE_TELEMETRY=true` (опционально)

### 4. Настройка базы данных (ОБЯЗАТЕЛЬНО!)

**PostgreSQL (требуется для работы)**
1. В Railway Dashboard откройте ваш проект
2. Нажмите "+ New" → выберите "Database" → выберите "PostgreSQL"
3. Railway автоматически создаст переменную окружения `DATABASE_URL`
4. Миграции Prisma будут выполнены автоматически при запуске контейнера

**Важно:**
- Без PostgreSQL приложение не запустится
- `DATABASE_URL` должен быть установлен автоматически после добавления PostgreSQL плагина
- Миграции выполняются автоматически в `docker-entrypoint.sh` перед запуском сервера

### 5. Деплой

Railway автоматически:
1. Использует Dockerfile из папки `docker/` для сборки
2. Устанавливает все зависимости (включая yarn)
3. Собирает фронтенд и бэкенд
4. Запускает сервер через Docker entrypoint

### 6. Проверка деплоя

После деплоя Railway предоставит URL вашего приложения. Откройте его в браузере.

## Структура файлов для Railway

- `railway.json` - конфигурация Railway (JSON формат) - использует Dockerfile builder
- `railway.toml` - конфигурация Railway (TOML формат) - использует Dockerfile builder
- `docker/Dockerfile` - Dockerfile для сборки образа (используется Railway)
- `docker/docker-entrypoint.sh` - скрипт запуска сервера и collector (используется через ENTRYPOINT)
- `nixpacks.toml` - альтернативная конфигурация для NIXPACKS builder (если нужно)
- `package.json` - содержит скрипты `build` и `start`

## Скрипты сборки

- `yarn build` - устанавливает зависимости, генерирует Prisma Client, собирает фронтенд
- `yarn start` - запускает продакшн сервер

## Решение проблем

### Ошибка "yarn: not found" при сборке
**Решение**: Конфигурация обновлена для использования Dockerfile вместо NIXPACKS. Dockerfile уже содержит установку yarn. Убедитесь, что в `railway.json` указан `"builder": "DOCKERFILE"`.

### Ошибка "Couldn't find a package.json file in /app" при запуске
**Решение**: Procfile был удален, так как он конфликтовал с ENTRYPOINT из Dockerfile. Теперь Railway использует `docker-entrypoint.sh`, который правильно запускает сервер из `/app/server/` и collector из `/app/collector/`.

### Ошибки при сборке
- Проверьте, что все зависимости установлены
- Убедитесь, что Node.js версия >= 18
- Проверьте, что Dockerfile находится в папке `docker/Dockerfile`

### Ошибки базы данных
- Проверьте переменные окружения
- Убедитесь, что миграции выполнены

### Проблемы с портами
- Railway автоматически устанавливает `PORT` переменную
- Убедитесь, что сервер использует `process.env.PORT || 3001`

## Дополнительные ресурсы

- [Railway Documentation](https://docs.railway.app)
- [AnythingLLM Documentation](https://docs.anythingllm.com)
