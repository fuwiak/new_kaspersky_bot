-- Прямое применение миграции таблицы event_logs
-- Использование:
--   psql "postgresql://user:password@interchange.proxy.rlwy.net:31058/railway" -f scripts/apply-event-logs-migration-direct.sql
--   или
--   PGPASSWORD=password psql -h interchange.proxy.rlwy.net -p 31058 -U postgres -d railway -f scripts/apply-event-logs-migration-direct.sql

-- Создание таблицы event_logs для PostgreSQL
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'event_logs'
    ) THEN
        CREATE TABLE "event_logs" (
            "id" SERIAL PRIMARY KEY,
            "event" TEXT NOT NULL,
            "metadata" TEXT,
            "userId" INTEGER,
            "occurredAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
        );

        -- Создание индекса на поле event
        CREATE INDEX "event_logs_event_idx" ON "event_logs"("event");

        RAISE NOTICE 'Таблица event_logs успешно создана';
    ELSE
        RAISE NOTICE 'Таблица event_logs уже существует';
    END IF;
END $$;

-- Проверка создания таблицы
SELECT
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'event_logs') as column_count
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name = 'event_logs';
