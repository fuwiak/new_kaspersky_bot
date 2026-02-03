# 📊 Улучшенное логирование для диагностики Collector

## ✅ Что было добавлено

### 1. Логирование в docker-entrypoint.sh

**Добавлено подробное логирование на каждом этапе:**

- ✅ Информация о портах и переменных окружения при запуске
- ✅ Логирование запуска collector процесса с PID
- ✅ Пошаговая проверка готовности collector (каждую секунду)
- ✅ Проверка, что процесс collector все еще работает
- ✅ Проверка порта через netcat и HTTP
- ✅ Детальная диагностика при ошибках (процессы, порты, логи)
- ✅ Логирование запуска server процесса
- ✅ Все логи помечены префиксами `[ENTRYPOINT]`, `[COLLECTOR]`, `[SERVER]`

**Пример логов:**
```
[ENTRYPOINT] Starting collector and server...
[ENTRYPOINT] Collector port: 8888
[ENTRYPOINT] Server port: 8080
[ENTRYPOINT] Starting collector process...
[COLLECTOR] Starting collector on port 8888...
[COLLECTOR] Working directory: /app/collector
[ENTRYPOINT] Waiting for collector to be ready (max 30 seconds)...
[ENTRYPOINT] Attempt 1/30: Checking collector on localhost:8888...
[ENTRYPOINT] ✓ Port 8888 is open (netcat check)
[ENTRYPOINT] ✓ Collector HTTP endpoint responded successfully
[ENTRYPOINT] ✓ Collector is ready and responding on port 8888
```

### 2. Логирование в CollectorApi (server/utils/collectorApi/index.js)

**Добавлено:**

- ✅ Логирование при инициализации CollectorApi (endpoint, host, port)
- ✅ Детальное логирование при проверке здоровья collector
- ✅ Логирование времени ответа
- ✅ Детальная информация об ошибках (код, сообщение, причина)
- ✅ Различие между таймаутом и другими ошибками

**Пример логов:**
```
[CollectorApi] CollectorApi initialized
[CollectorApi]   Endpoint: http://localhost:8888
[CollectorApi]   Host: localhost (NODE_ENV=production, RUNTIME=docker)
[CollectorApi]   Port: 8888 (COLLECTOR_PORT=default)
[CollectorApi] Checking collector health at: http://localhost:8888
[CollectorApi] Collector health check response: 200 OK (15ms)
[CollectorApi] ✓ Collector is online and responding
```

**При ошибке:**
```
[CollectorApi] ✗ Health check failed: fetch failed
[CollectorApi]   Error details: { name: 'TypeError', message: 'fetch failed', code: 'ECONNREFUSED' }
[CollectorApi]   Endpoint attempted: http://localhost:8888
[CollectorApi]   This usually means collector is not running or not accessible
```

### 3. Логирование в Collector (collector/index.js)

**Добавлено:**

- ✅ Логирование при запуске (порт, окружение, рабочая директория)
- ✅ Логирование успешного запуска сервера
- ✅ Логирование инициализации хранилища
- ✅ Детальное логирование ошибок при запуске
- ✅ Специальная обработка ошибки EADDRINUSE (порт занят)

**Пример логов:**
```
[COLLECTOR] Starting document processor...
[COLLECTOR] Port: 8888
[COLLECTOR] NODE_ENV: production
[COLLECTOR] Working directory: /app/collector
[COLLECTOR] Node version: v18.17.0
[COLLECTOR] ✓ Server listening on 0.0.0.0:8888
[COLLECTOR] ✓ Document processor app listening on port 8888
[COLLECTOR] ✓ Ready to accept connections
[COLLECTOR] ✓ Storage initialized
```

**При ошибке:**
```
[COLLECTOR] ✗ Error starting server: listen EADDRINUSE: address already in use :::8888
[COLLECTOR] Error code: EADDRINUSE
[COLLECTOR] Port 8888 is already in use!
[COLLECTOR] Check if another collector instance is running
```

## 🔍 Как использовать логи для диагностики

### Шаг 1: Проверьте логи Railway

1. Откройте Railway Dashboard
2. Выберите ваш проект → сервис
3. Перейдите в "Deployments" → последний деплой → "View Logs"

### Шаг 2: Ищите ключевые сообщения

**Успешный запуск:**
- ✅ `[ENTRYPOINT] ✓ Collector is ready and responding on port 8888`
- ✅ `[COLLECTOR] ✓ Document processor app listening on port 8888`
- ✅ `[CollectorApi] ✓ Collector is online and responding`

**Проблемы:**
- ❌ `[ENTRYPOINT] ✗ Collector failed to start after 30 seconds`
- ❌ `[COLLECTOR] ✗ Error starting server: listen EADDRINUSE`
- ❌ `[CollectorApi] ✗ Health check failed: fetch failed`

### Шаг 3: Анализируйте ошибки

**Если collector не запускается:**
- Проверьте логи с префиксом `[COLLECTOR]`
- Ищите ошибки при запуске (EADDRINUSE, EACCES, и т.д.)
- Проверьте, что порт 8888 свободен

**Если collector запускается, но server не может подключиться:**
- Проверьте логи `[CollectorApi]` - какой endpoint используется?
- Проверьте, что endpoint правильный (localhost:8888 в Docker)
- Проверьте логи `[ENTRYPOINT]` - прошла ли проверка готовности?

**Если проверка готовности не проходит:**
- Проверьте логи `[ENTRYPOINT]` - на каком шаге останавливается?
- Проверьте, что процесс collector все еще работает (PID)
- Проверьте, что порт действительно открыт

## 📋 Чеклист диагностики

Используйте этот чеклист при анализе логов:

- [ ] Collector процесс запустился? (`[COLLECTOR] Starting document processor...`)
- [ ] Collector слушает на правильном порту? (`[COLLECTOR] ✓ Server listening on 0.0.0.0:8888`)
- [ ] Проверка готовности прошла? (`[ENTRYPOINT] ✓ Collector is ready`)
- [ ] CollectorApi использует правильный endpoint? (`[CollectorApi] Endpoint: http://localhost:8888`)
- [ ] Health check успешен? (`[CollectorApi] ✓ Collector is online`)
- [ ] Нет ошибок EADDRINUSE? (порт занят)
- [ ] Нет ошибок ECONNREFUSED? (не может подключиться)

## 🎯 Типичные проблемы и решения

### Проблема: "Collector failed to start after 30 seconds"

**Проверьте:**
1. Логи `[COLLECTOR]` - есть ли ошибки при запуске?
2. Процесс collector все еще работает? (`ps aux | grep collector`)
3. Порт 8888 занят? (`netstat -tuln | grep 8888`)

**Решение:**
- Если порт занят - остановите другой процесс
- Если ошибка при запуске - проверьте зависимости и конфигурацию

### Проблема: "Health check failed: fetch failed"

**Проверьте:**
1. Какой endpoint использует CollectorApi? (`[CollectorApi] Endpoint: ...`)
2. Прошел ли этап проверки готовности? (`[ENTRYPOINT] ✓ Collector is ready`)
3. Collector действительно запущен? (`[COLLECTOR] ✓ Document processor app listening`)

**Решение:**
- Убедитесь, что endpoint правильный (localhost:8888 в Docker)
- Проверьте, что collector запустился до server
- Перезапустите деплой

## 📝 Примечания

- Все логи имеют префиксы для легкой фильтрации
- Логи collector и server перенаправляются с префиксами через `sed`
- В production логи могут быть менее подробными, но ключевая информация сохраняется
- Используйте Railway Dashboard для просмотра логов в реальном времени
