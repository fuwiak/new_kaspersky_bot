#!/usr/bin/env node

/**
 * Скрипт для применения миграции таблицы event_logs на Railway
 * Использование:
 *   railway run node scripts/migrate-event-logs-railway.js
 *   или в Railway Shell:
 *   node scripts/migrate-event-logs-railway.js
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

async function migrateEventLogs() {
    console.log('🚀 Начинаю миграцию таблицы event_logs на Railway...\n');

    // Определение строки подключения
    // Приоритет: DATABASE_PUBLIC_URL > DATABASE_URL > построение из переменных
    let connectionString = null;
    
    if (process.env.DATABASE_PUBLIC_URL) {
        connectionString = process.env.DATABASE_PUBLIC_URL;
        console.log('✅ Использую DATABASE_PUBLIC_URL (публичный адрес)');
    } else if (process.env.DATABASE_URL) {
        // Проверяем, не является ли это внутренним адресом
        if (process.env.DATABASE_URL.includes('railway.internal')) {
            console.log('⚠️  DATABASE_URL содержит внутренний адрес, пытаюсь использовать публичный...');
            
            // Пытаемся построить публичный URL из переменных окружения
            if (process.env.RAILWAY_TCP_PROXY_DOMAIN && process.env.RAILWAY_TCP_PROXY_PORT) {
                const user = process.env.PGUSER || process.env.POSTGRES_USER || 'postgres';
                const password = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD;
                const database = process.env.PGDATABASE || process.env.POSTGRES_DB || 'railway';
                
                if (password) {
                    connectionString = `postgresql://${user}:${password}@${process.env.RAILWAY_TCP_PROXY_DOMAIN}:${process.env.RAILWAY_TCP_PROXY_PORT}/${database}`;
                    console.log('✅ Построен публичный URL из переменных окружения');
                } else {
                    console.log('⚠️  Пароль не найден в переменных, используем DATABASE_URL');
                    connectionString = process.env.DATABASE_URL;
                }
            } else {
                // Используем прямой адрес, если предоставлен пользователем
                console.log('💡 Используйте DATABASE_PUBLIC_URL или запустите скрипт в Railway Shell');
                connectionString = process.env.DATABASE_URL;
            }
        } else {
            connectionString = process.env.DATABASE_URL;
            console.log('✅ Использую DATABASE_URL');
        }
    } else {
        // Пытаемся построить из отдельных переменных
        const host = process.env.RAILWAY_TCP_PROXY_DOMAIN || process.env.PGHOST;
        const port = process.env.RAILWAY_TCP_PROXY_PORT || process.env.PGPORT || '5432';
        const user = process.env.PGUSER || process.env.POSTGRES_USER || 'postgres';
        const password = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD;
        const database = process.env.PGDATABASE || process.env.POSTGRES_DB || 'railway';
        
        if (host && password) {
            connectionString = `postgresql://${user}:${password}@${host}:${port}/${database}`;
            console.log('✅ Построен URL из переменных окружения');
        } else {
            console.error('❌ Ошибка: Не удалось определить строку подключения');
            console.error('💡 Убедитесь, что установлены:');
            console.error('   - DATABASE_PUBLIC_URL, или');
            console.error('   - DATABASE_URL, или');
            console.error('   - RAILWAY_TCP_PROXY_DOMAIN, RAILWAY_TCP_PROXY_PORT, POSTGRES_PASSWORD');
            process.exit(1);
        }
    }

    // Чтение SQL скрипта
    const sqlPath = path.join(__dirname, '../server/prisma/migrations/create_event_logs_postgresql.sql');
    let sql;
    try {
        sql = fs.readFileSync(sqlPath, 'utf8');
    } catch (error) {
        console.error(`❌ Ошибка при чтении SQL файла: ${error.message}`);
        process.exit(1);
    }

    const client = new Client({
        connectionString: connectionString,
    });

    try {
        // Подключение к базе данных
        console.log('📡 Подключаюсь к базе данных...');
        await client.connect();
        console.log('✅ Подключено к базе данных\n');

        // Выполнение миграции
        console.log('📝 Применяю миграцию...');
        await client.query(sql);
        console.log('✅ Миграция успешно применена!\n');

        // Проверка существования таблицы
        console.log('📊 Проверка таблицы:');
        const result = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'event_logs'
        `);

        if (result.rows.length > 0) {
            console.log('✅ Таблица event_logs существует\n');

            // Проверка структуры таблицы
            const columns = await client.query(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = 'event_logs'
                ORDER BY ordinal_position
            `);

            console.log('📋 Структура таблицы:');
            columns.rows.forEach(col => {
                console.log(`   - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
            });

            // Проверка индексов
            const indexes = await client.query(`
                SELECT indexname
                FROM pg_indexes
                WHERE schemaname = 'public'
                AND tablename = 'event_logs'
            `);

            console.log('\n📇 Индексы:');
            indexes.rows.forEach(idx => {
                console.log(`   - ${idx.indexname}`);
            });
        } else {
            console.log('⚠️  Таблица event_logs не найдена после миграции');
        }

        console.log('\n✅ Миграция завершена успешно!');
    } catch (error) {
        console.error('\n❌ Ошибка при применении миграции:');
        console.error(error.message);
        
        // Если таблица уже существует, это не критическая ошибка
        if (error.message.includes('already exists') || error.message.includes('уже существует')) {
            console.log('\n💡 Таблица уже существует, это нормально');
            process.exit(0);
        } else {
            process.exit(1);
        }
    } finally {
        await client.end();
    }
}

// Запуск миграции
migrateEventLogs().catch(error => {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
});
