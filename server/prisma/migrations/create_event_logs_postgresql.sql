-- Создание таблицы event_logs для PostgreSQL
-- Этот скрипт можно безопасно запускать несколько раз (проверяет существование таблицы)

-- Проверка и создание таблицы event_logs
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
