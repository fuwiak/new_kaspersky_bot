#!/usr/bin/env node

/**
 * Прямое применение миграции с использованием публичного адреса
 * Использование:
 *   node scripts/migrate-event-logs-direct.js
 * 
 * Или с параметрами:
 *   DATABASE_PUBLIC_URL="postgresql://postgres:password@host:port/db" node scripts/migrate-event-logs-direct.js
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Параметры подключения (можно передать через переменные окружения)
// Значения по умолчанию из Railway переменных
const DB_CONFIG = {
    host: process.env.RAILWAY_TCP_PROXY_DOMAIN || process.env.PGHOST || 'interchange.proxy.rlwy.net',
    port: process.env.RAILWAY_TCP_PROXY_PORT || process.env.PGPORT || '31058',
    user: process.env.POSTGRES_USER || process.env.PGUSER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD || '',
    database: process.env.POSTGRES_DB || process.env.PGDATABASE || 'railway',
};

async function migrateEventLogs() {
    console.log('🚀 Начинаю миграцию таблицы event_logs...\n');

    // Используем DATABASE_PUBLIC_URL если доступен
    let connectionString = process.env.DATABASE_PUBLIC_URL;
    
    if (!connectionString) {
        // Строим строку подключения из параметров
        if (!DB_CONFIG.password) {
            console.error('❌ Ошибка: Пароль не указан');
            console.error('💡 Установите переменную окружения:');
            console.error('   export PGPASSWORD=ваш_пароль');
            console.error('   или');
            console.error('   export POSTGRES_PASSWORD=ваш_пароль');
            console.error('\n📋 Текущие параметры:');
            console.error(`   Host: ${DB_CONFIG.host}`);
            console.error(`   Port: ${DB_CONFIG.port}`);
            console.error(`   User: ${DB_CONFIG.user}`);
            console.error(`   Database: ${DB_CONFIG.database}`);
            process.exit(1);
        }
        
        connectionString = `postgresql://${DB_CONFIG.user}:${DB_CONFIG.password}@${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}`;
    }

    console.log(`📡 Подключаюсь к: ${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}`);

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
        
        if (error.code === 'ENOTFOUND' || error.message.includes('could not translate host name')) {
            console.error('\n💡 Проблема с подключением к хосту');
            console.error('   Проверьте правильность адреса и доступность сервера');
        } else if (error.code === '28P01' || error.message.includes('password authentication failed')) {
            console.error('\n💡 Ошибка аутентификации');
            console.error('   Проверьте правильность пароля');
        } else if (error.message.includes('already exists') || error.message.includes('уже существует')) {
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
