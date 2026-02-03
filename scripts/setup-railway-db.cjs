#!/usr/bin/env node
/**
 * Скрипт для создания базы данных и таблиц в Railway
 * 
 * Использование:
 * 1. Убедитесь, что DATABASE_URL установлен в Railway
 * 2. Запустите: node scripts/setup-railway-db.cjs
 * 
 * Или через Railway CLI:
 * railway run node scripts/setup-railway-db.cjs
 */

const { execSync } = require('child_process');
const url = require('url');
const path = require('path');
const fs = require('fs');

// Попытка загрузить pg из разных мест
let pg;
try {
  // Сначала попробуем из корневого node_modules
  pg = require('pg');
} catch (e) {
  try {
    // Затем из server/node_modules
    const serverPgPath = path.join(__dirname, '..', 'server', 'node_modules', 'pg');
    if (fs.existsSync(serverPgPath)) {
      pg = require(serverPgPath);
    } else {
      throw new Error('pg module not found');
    }
  } catch (e2) {
    console.error('❌ ОШИБКА: Модуль "pg" не найден!');
    console.error('');
    console.error('Установите зависимости:');
    console.error('  yarn install');
    console.error('  или');
    console.error('  cd server && yarn install');
    process.exit(1);
  }
}

const { Client } = pg;

async function setupDatabase() {
  let dbUrl = process.env.DATABASE_URL;
  
  console.log('==========================================');
  console.log('Настройка базы данных для Railway');
  console.log('==========================================\n');
  
  // Если DATABASE_URL содержит шаблоны или не установлен, попробуем построить из отдельных переменных
  if (!dbUrl || dbUrl.includes('{{') || dbUrl.includes('${{')) {
    console.log('⚠️  DATABASE_URL содержит шаблоны или не установлен, пытаемся построить из отдельных переменных...\n');
    
    // Пробуем использовать DATABASE_PUBLIC_URL (для локального подключения)
    if (process.env.DATABASE_PUBLIC_URL && !process.env.DATABASE_PUBLIC_URL.includes('{{')) {
      dbUrl = process.env.DATABASE_PUBLIC_URL;
      console.log('✓ Используем DATABASE_PUBLIC_URL');
    }
    // Или строим из отдельных переменных POSTGRES_*
    else if (process.env.POSTGRES_USER && process.env.POSTGRES_PASSWORD && process.env.POSTGRES_DB) {
      // Пробуем найти хост из разных источников
      let host = process.env.RAILWAY_PRIVATE_DOMAIN || 
                 process.env.PGHOST || 
                 (process.env.PGHOST && !process.env.PGHOST.includes('{{') ? process.env.PGHOST : null) ||
                 'postgres.railway.internal'; // fallback для Railway
      
      // Если хост тоже шаблон, используем fallback
      if (host && (host.includes('{{') || host.includes('${{'))) {
        host = 'postgres.railway.internal';
        console.log('⚠️  Хост содержит шаблоны, используем fallback: postgres.railway.internal');
      }
      
      dbUrl = `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${host}:5432/${process.env.POSTGRES_DB}`;
      console.log('✓ Построили DATABASE_URL из POSTGRES_* переменных');
    }
    // Или используем PGUSER, PGPASSWORD и т.д. (если они не шаблоны)
    else if (process.env.PGUSER && process.env.PGPASSWORD && 
             process.env.PGDATABASE && process.env.PGHOST &&
             !process.env.PGHOST.includes('{{') && !process.env.PGHOST.includes('${{')) {
      const pgPort = process.env.PGPORT || '5432';
      dbUrl = `postgresql://${process.env.PGUSER}:${process.env.PGPASSWORD}@${process.env.PGHOST}:${pgPort}/${process.env.PGDATABASE}`;
      console.log('✓ Построили DATABASE_URL из PG* переменных');
    }
    else {
      console.error('❌ ОШИБКА: Не удалось построить DATABASE_URL!');
      console.error('');
      console.error('Доступные переменные:');
      console.error('  DATABASE_URL:', process.env.DATABASE_URL || '(не установлено)');
      console.error('  DATABASE_PUBLIC_URL:', process.env.DATABASE_PUBLIC_URL || '(не установлено)');
      console.error('  POSTGRES_USER:', process.env.POSTGRES_USER || '(не установлено)');
      console.error('  POSTGRES_PASSWORD:', process.env.POSTGRES_PASSWORD ? '***' : '(не установлено)');
      console.error('  POSTGRES_DB:', process.env.POSTGRES_DB || '(не установлено)');
      console.error('  RAILWAY_PRIVATE_DOMAIN:', process.env.RAILWAY_PRIVATE_DOMAIN || '(не установлено)');
      console.error('  PGHOST:', process.env.PGHOST || '(не установлено)');
      console.error('');
      console.error('В Railway:');
      console.error('1. Убедитесь, что PostgreSQL сервис добавлен в проект');
      console.error('2. Railway должен автоматически предоставить DATABASE_URL');
      console.error('3. Проверьте переменные сервиса в панели Railway');
      console.error('4. Переменная должна быть автоматически связана, а не шаблоном');
      console.error('');
      console.error('Или используйте Railway Shell (веб-интерфейс), где переменные подставляются автоматически');
      process.exit(1);
    }
    console.log('');
  }
  
  if (!dbUrl.includes('postgresql://')) {
    console.error('❌ ОШИБКА: DATABASE_URL не является строкой подключения PostgreSQL!');
    console.error('Текущее значение:', dbUrl.substring(0, 50) + '...');
    process.exit(1);
  }

  try {
    const parsed = url.parse(dbUrl);
    const dbName = parsed.pathname?.slice(1)?.split('?')[0];
    
    if (!dbName) {
      console.error('❌ ОШИБКА: Не удалось извлечь имя базы данных из DATABASE_URL');
      process.exit(1);
    }

    console.log(`📊 Настройка базы данных: ${dbName}\n`);

    // Подключение к postgres для создания базы данных
    const adminUrl = dbUrl.replace('/' + dbName, '/postgres');
    console.log('🔌 Подключение к PostgreSQL серверу...');
    const adminClient = new Client({ connectionString: adminUrl });
    
    await adminClient.connect();
    console.log('✓ Подключено к PostgreSQL серверу\n');

    // Проверка существования базы данных
    const dbCheck = await adminClient.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName]
    );

    if (dbCheck.rows.length === 0) {
      console.log(`📦 База данных "${dbName}" не существует, создание...`);
      await adminClient.query(`CREATE DATABASE "${dbName.replace(/"/g, '""')}"`);
      console.log(`✓ База данных "${dbName}" успешно создана\n`);
    } else {
      console.log(`✓ База данных "${dbName}" уже существует\n`);
    }

    await adminClient.end();

    // Создание таблиц с помощью Prisma
    console.log('📋 Создание таблиц с помощью Prisma...\n');
    const serverDir = path.join(__dirname, '..', 'server');
    
    try {
      // Генерация Prisma Client
      console.log('1. Генерация Prisma Client...');
      execSync('npx prisma generate --schema=./prisma/schema.prisma', {
        stdio: 'inherit',
        cwd: serverDir,
        env: { ...process.env, DATABASE_URL: dbUrl, CHECKPOINT_DISABLE: '1' }
      });
      console.log('✓ Prisma Client сгенерирован\n');

      // Применение схемы к базе данных
      console.log('2. Применение схемы к базе данных...');
      execSync('npx prisma db push --schema=./prisma/schema.prisma --accept-data-loss --skip-generate', {
        stdio: 'inherit',
        cwd: serverDir,
        env: { ...process.env, DATABASE_URL: dbUrl }
      });
      console.log('✓ Таблицы успешно созданы\n');

      // Выполнение миграций
      console.log('3. Выполнение миграций...');
      try {
        execSync('npx prisma migrate deploy --schema=./prisma/schema.prisma', {
          stdio: 'inherit',
          cwd: serverDir,
          env: { ...process.env, DATABASE_URL: dbUrl }
        });
        console.log('✓ Миграции успешно применены\n');
      } catch (migrateError) {
        console.log('⚠️  Предупреждение: Не удалось выполнить миграции (это нормально, если схема уже применена)\n');
      }

      console.log('==========================================');
      console.log('✅ База данных успешно настроена!');
      console.log('==========================================');
      console.log('');
      console.log('Теперь вы можете:');
      console.log('1. Перезапустить приложение в Railway');
      console.log('2. Попробовать войти в систему');
      console.log('');

    } catch (error) {
      console.error('❌ ОШИБКА: Не удалось создать таблицы:', error.message);
      console.error('');
      console.error('Попробуйте выполнить вручную:');
      console.error(`cd server && npx prisma db push --schema=./prisma/schema.prisma --accept-data-loss`);
      process.exit(1);
    }

  } catch (error) {
    console.error('❌ ОШИБКА при настройке базы данных:', error.message);
    console.error('');
    console.error('Проверьте:');
    console.error('1. Правильность DATABASE_URL');
    console.error('2. Доступность PostgreSQL сервера');
    console.error('3. Права доступа к базе данных');
    process.exit(1);
  }
}

setupDatabase();
