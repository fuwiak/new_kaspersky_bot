#!/usr/bin/env node

/**
 * Скрипт для создания всех таблиц из Prisma схемы на Railway
 * Использование:
 *   railway run node scripts/setup-all-tables-railway.js
 *   или в Railway Shell:
 *   node scripts/setup-all-tables-railway.js
 *   или локально с переменными:
 *   DATABASE_PUBLIC_URL="..." node scripts/setup-all-tables-railway.js
 */

const { execSync } = require('child_process');
const path = require('path');

function setupAllTables() {
    console.log('🚀 Начинаю создание всех таблиц из Prisma схемы...\n');

    // Определение строки подключения
    let connectionString = null;
    let dbUrl = null;
    
    if (process.env.DATABASE_PUBLIC_URL) {
        dbUrl = process.env.DATABASE_PUBLIC_URL;
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
                    dbUrl = `postgresql://${user}:${password}@${process.env.RAILWAY_TCP_PROXY_DOMAIN}:${process.env.RAILWAY_TCP_PROXY_PORT}/${database}`;
                    console.log('✅ Построен публичный URL из переменных окружения');
                } else {
                    console.log('⚠️  Пароль не найден в переменных, используем DATABASE_URL');
                    dbUrl = process.env.DATABASE_URL;
                }
            } else {
                console.log('💡 Используйте DATABASE_PUBLIC_URL или запустите скрипт в Railway Shell');
                dbUrl = process.env.DATABASE_URL;
            }
        } else {
            dbUrl = process.env.DATABASE_URL;
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
            dbUrl = `postgresql://${user}:${password}@${host}:${port}/${database}`;
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

    const serverDir = path.join(__dirname, '..', 'server');
    const schemaPath = path.join(serverDir, 'prisma', 'schema.prisma');

    console.log(`\n📋 Схема Prisma: ${schemaPath}`);
    console.log(`📡 База данных: ${dbUrl.replace(/:[^:@]+@/, ':****@')}\n`);

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

        // Шаг 3: Выполнение миграций (опционально)
        console.log('🔄 Шаг 3: Выполнение миграций...');
        try {
            execSync('npx prisma migrate deploy --schema=./prisma/schema.prisma', {
                stdio: 'inherit',
                cwd: serverDir,
                env: { ...process.env, DATABASE_URL: dbUrl }
            });
            console.log('✅ Миграции применены\n');
        } catch (migrateError) {
            console.log('⚠️  Миграции не применены (это нормально, если таблицы уже созданы)\n');
        }

        // Проверка созданных таблиц
        console.log('📊 Проверка созданных таблиц...');
        const { Client } = require('pg');
        const client = new Client({ connectionString: dbUrl });
        
        client.connect()
            .then(() => client.query(`
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_type = 'BASE TABLE'
                ORDER BY table_name
            `))
            .then(result => {
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
                
                return client.end();
            })
            .then(() => {
                console.log('\n🎉 Настройка базы данных завершена успешно!');
                console.log('💡 Теперь можно перезапустить приложение');
            })
            .catch(err => {
                console.log('\n⚠️  Не удалось проверить таблицы (это не критично)');
                console.log('   Ошибка:', err.message);
                if (client) client.end();
            });
        
    } catch (error) {
        console.error('\n❌ Ошибка при создании таблиц:');
        console.error(error.message);
        
        if (error.message.includes('P1001') || error.message.includes('Can\'t reach database')) {
            console.error('\n💡 Проблема с подключением к базе данных');
            console.error('   Проверьте правильность DATABASE_URL и доступность сервера');
        } else if (error.message.includes('P1003') || error.message.includes('database')) {
            console.error('\n💡 Проблема с базой данных');
            console.error('   Убедитесь, что база данных существует и доступна');
        }
        
        process.exit(1);
    }
}

// Запуск настройки
try {
    setupAllTables();
} catch (error) {
    console.error('❌ Критическая ошибка:', error);
    process.exit(1);
}
