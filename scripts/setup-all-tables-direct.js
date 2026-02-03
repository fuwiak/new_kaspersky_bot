#!/usr/bin/env node

/**
 * Прямое создание всех таблиц с использованием публичного адреса
 * Использование:
 *   export PGPASSWORD="ваш_пароль"
 *   node scripts/setup-all-tables-direct.js
 */

const { execSync } = require('child_process');
const path = require('path');

// Параметры подключения (можно передать через переменные окружения)
const DB_CONFIG = {
    host: process.env.RAILWAY_TCP_PROXY_DOMAIN || process.env.PGHOST || 'interchange.proxy.rlwy.net',
    port: process.env.RAILWAY_TCP_PROXY_PORT || process.env.PGPORT || '31058',
    user: process.env.POSTGRES_USER || process.env.PGUSER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || process.env.PGPASSWORD || '',
    database: process.env.POSTGRES_DB || process.env.PGDATABASE || 'railway',
};

async function setupAllTables() {
    console.log('🚀 Начинаю создание всех таблиц из Prisma схемы...\n');

    // Используем DATABASE_PUBLIC_URL если доступен
    let dbUrl = process.env.DATABASE_PUBLIC_URL;
    
    if (!dbUrl) {
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
        
        dbUrl = `postgresql://${DB_CONFIG.user}:${DB_CONFIG.password}@${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}`;
    }

    console.log(`📡 Подключаюсь к: ${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}`);

    const serverDir = path.join(__dirname, '..', 'server');
    const schemaPath = path.join(serverDir, 'prisma', 'schema.prisma');

    console.log(`\n📋 Схема Prisma: ${schemaPath}\n`);

    try {
        // Шаг 1: Генерация Prisma Client
        console.log('📦 Шаг 1: Генерация Prisma Client...');
        execSync('npx prisma generate --schema=./prisma/schema.prisma', {
            stdio: 'inherit',
            cwd: serverDir,
            env: { ...process.env, DATABASE_URL: dbUrl, CHECKPOINT_DISABLE: '1' }
        });
        console.log('✅ Prisma Client сгенерирован\n');

        // Шаг 2: Применение схемы к базе данных (создание всех таблиц)
        console.log('📝 Шаг 2: Применение схемы к базе данных (создание всех таблиц)...');
        console.log('   Это создаст все таблицы из schema.prisma, включая:');
        console.log('   - users, system_settings, workspaces, event_logs и другие...\n');
        
        execSync('npx prisma db push --schema=./prisma/schema.prisma --accept-data-loss --skip-generate', {
            stdio: 'inherit',
            cwd: serverDir,
            env: { ...process.env, DATABASE_URL: dbUrl }
        });
        console.log('\n✅ Все таблицы успешно созданы!\n');

        // Проверка созданных таблиц
        console.log('📊 Проверка созданных таблиц...');
        const { Client } = require('pg');
        const client = new Client({ connectionString: dbUrl });
        
        await client.connect();
        const result = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);
        
        console.log(`\n✅ Найдено таблиц: ${result.rows.length}`);
        console.log('\n📋 Список таблиц:');
        result.rows.forEach(row => {
            console.log(`   - ${row.table_name}`);
        });
        
        // Проверка ключевых таблиц
        const keyTables = ['users', 'system_settings', 'workspaces', 'event_logs'];
        const existingTables = result.rows.map(r => r.table_name);
        const missingTables = keyTables.filter(t => !existingTables.includes(t));
        
        if (missingTables.length === 0) {
            console.log('\n✅ Все ключевые таблицы созданы!');
        } else {
            console.log(`\n⚠️  Отсутствуют таблицы: ${missingTables.join(', ')}`);
        }
        
        await client.end();
        
        console.log('\n🎉 Настройка базы данных завершена успешно!');
        console.log('💡 Теперь можно перезапустить приложение');
        
    } catch (error) {
        console.error('\n❌ Ошибка при создании таблиц:');
        console.error(error.message);
        process.exit(1);
    }
}

// Запуск настройки
setupAllTables().catch(error => {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
});
