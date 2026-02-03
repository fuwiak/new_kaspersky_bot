const { getGitVersion } = require("../../endpoints/utils");
const { Telemetry } = require("../../models/telemetry");

function checkColumnTemplate(tablename = null, column = null) {
  if (!tablename || !column)
    throw new Error(`Migration Error`, { tablename, column });
  return `SELECT COUNT(*) AS _exists FROM pragma_table_info('${tablename}') WHERE name='${column}'`;
}

// Note (tcarambat): Since there is no good way to track migrations in Node/SQLite we use this simple system
// Each model has a `migrations` method that will return an array like...
// { colName: 'stringColName', execCmd: `SQL Command to run when`, doif: boolean },
// colName = name of column
// execCmd = Command to run when doif matches the state of the DB
// doif = condition to match that determines if execCmd will run.
// eg: Table workspace has slug column.
// execCmd: ALTER TABLE DROP COLUMN slug;
// doif: true
// => Will drop the slug column if the workspace table has a column named 'slug' otherwise nothing happens.
// If you are adding a new table column if needs to exist in the Models `colsInit` and as a migration.
// So both new and existing DBs will get the column when code is pulled in.

async function checkForMigrations(model, db) {
  if (model.migrations().length === 0) return;
  const toMigrate = [];
  for (const { colName, execCmd, doif } of model.migrations()) {
    const { _exists } = await db.get(
      checkColumnTemplate(model.tablename, colName)
    );
    const colExists = _exists !== 0;
    if (colExists !== doif) continue;

    toMigrate.push(execCmd);
  }

  if (toMigrate.length === 0) return;

  console.log(`Running ${toMigrate.length} migrations`, toMigrate);
  await db.exec(toMigrate.join(";\n"));
  return;
}

// Note(tcarambat): When building in production via Docker the SQLite file will not exist
// and if this function tries to run on boot the file will not exist
// and the server will abort and the container will exit.
// This function will run each reload on dev but on production
// it will be stubbed until the /api/migrate endpoint is GET.
async function validateTablePragmas(force = false) {
  try {
    if (process.env.NODE_ENV !== "development" && force === false) {
      console.log(
        `\x1b[34m[MIGRATIONS STUBBED]\x1b[0m Please ping /migrate once server starts to run migrations`
      );
      return;
    }
    const { SystemSettings } = require("../../models/systemSettings");
    const { User } = require("../../models/user");
    const { Workspace } = require("../../models/workspace");
    const { WorkspaceUser } = require("../../models/workspaceUsers");
    const { Document } = require("../../models/documents");
    const { DocumentVectors } = require("../../models/vectors");
    const { WorkspaceChats } = require("../../models/workspaceChats");
    const { Invite } = require("../../models/invite");
    const { WelcomeMessages } = require("../../models/welcomeMessages");
    const { ApiKey } = require("../../models/apiKeys");

    await SystemSettings.migrateTable();
    await User.migrateTable();
    await Workspace.migrateTable();
    await WorkspaceUser.migrateTable();
    await Document.migrateTable();
    await DocumentVectors.migrateTable();
    await WorkspaceChats.migrateTable();
    await Invite.migrateTable();
    await WelcomeMessages.migrateTable();
    await ApiKey.migrateTable();
  } catch (e) {
    console.error(`validateTablePragmas: Migrations failed`, e);
  }
  return;
}

// Telemetry is anonymized and your data is never read. This can be disabled by setting
// DISABLE_TELEMETRY=true in the `.env` of however you setup. Telemetry helps us determine use
// of how AnythingLLM is used and how to improve this product!
// You can see all Telemetry events by ctrl+f `Telemetry.sendTelemetry` calls to verify this claim.
async function setupTelemetry() {
  if (process.env.DISABLE_TELEMETRY === "true") {
    console.log(
      `\x1b[31m[TELEMETRY DISABLED]\x1b[0m Telemetry is marked as disabled - no events will send. Telemetry helps Mintplex Labs Inc improve AnythingLLM.`
    );
    return true;
  }

  if (Telemetry.isDev()) {
    console.log(
      `\x1b[33m[TELEMETRY STUBBED]\x1b[0m Anonymous Telemetry stubbed in development.`
    );
    return;
  }

  console.log(
    `\x1b[32m[TELEMETRY ENABLED]\x1b[0m Anonymous Telemetry enabled. Telemetry helps Mintplex Labs Inc improve AnythingLLM.`
  );
  await Telemetry.findOrCreateId();
  await Telemetry.sendTelemetry("server_boot", {
    commit: getGitVersion(),
  });
  return;
}

// Миграция для PostgreSQL - создание таблицы event_logs
async function migratePostgreSQL() {
  try {
    const dbUrl = process.env.DATABASE_URL;
    
    // Проверяем, что это PostgreSQL
    if (!dbUrl || !dbUrl.startsWith('postgresql://')) {
      console.log('\x1b[33m[POSTGRESQL MIGRATION SKIPPED]\x1b[0m DATABASE_URL не является PostgreSQL');
      return { success: true, skipped: true };
    }

    // Определение строки подключения
    let connectionString = dbUrl;
    
    // Если это внутренний адрес Railway, пытаемся использовать публичный
    if (dbUrl.includes('railway.internal')) {
      if (process.env.DATABASE_PUBLIC_URL) {
        connectionString = process.env.DATABASE_PUBLIC_URL;
        console.log('✅ Использую DATABASE_PUBLIC_URL для миграции');
      } else if (process.env.RAILWAY_TCP_PROXY_DOMAIN && process.env.RAILWAY_TCP_PROXY_PORT) {
        const user = process.env.PGUSER || process.env.POSTGRES_USER || 'postgres';
        const password = process.env.PGPASSWORD || process.env.POSTGRES_PASSWORD;
        const database = process.env.PGDATABASE || process.env.POSTGRES_DB || 'railway';
        
        if (password) {
          connectionString = `postgresql://${user}:${password}@${process.env.RAILWAY_TCP_PROXY_DOMAIN}:${process.env.RAILWAY_TCP_PROXY_PORT}/${database}`;
          console.log('✅ Построен публичный URL из переменных окружения');
        }
      }
    }
    // Если DATABASE_URL уже содержит публичный адрес (например, mainline.proxy.rlwy.net), используем его
    else if (dbUrl.includes('.proxy.rlwy.net') || dbUrl.includes('.railway.app')) {
      console.log('✅ DATABASE_URL содержит публичный адрес Railway, используем его');
      connectionString = dbUrl;
    }

    const { Client } = require('pg');
    const fs = require('fs');
    const path = require('path');

    // Чтение SQL скрипта
    const sqlPath = path.join(__dirname, '../../prisma/migrations/create_event_logs_postgresql.sql');
    let sql;
    try {
      sql = fs.readFileSync(sqlPath, 'utf8');
    } catch (error) {
      console.error(`\x1b[31m[POSTGRESQL MIGRATION ERROR]\x1b[0m Ошибка при чтении SQL файла: ${error.message}`);
      return { success: false, error: error.message };
    }

    // Настройка клиента с поддержкой SSL для Railway PostgreSQL
    // Railway использует postgres-ssl образ, который требует SSL соединения
    // Определяем, нужен ли SSL по адресу подключения
    const needsSSL = connectionString.includes('.proxy.rlwy.net') || 
                     connectionString.includes('.railway.app') ||
                     process.env.RAILWAY_TCP_PROXY_DOMAIN ||
                     process.env.DATABASE_PUBLIC_URL;
    
    const clientConfig = {
      connectionString: connectionString,
      // Включаем SSL для публичных адресов Railway (postgres-ssl образ)
      ssl: needsSSL ? {
          rejectUnauthorized: false, // Railway использует самоподписанные сертификаты
        } : undefined,
    };
    
    if (needsSSL) {
      console.log('🔒 Использую SSL соединение для Railway PostgreSQL');
    }

    const client = new Client(clientConfig);

    try {
      console.log('\x1b[34m[POSTGRESQL MIGRATION]\x1b[0m Подключаюсь к базе данных...');
      await client.connect();
      console.log('✅ Подключено к базе данных');

      console.log('📝 Применяю миграцию event_logs...');
      await client.query(sql);
      console.log('✅ Миграция успешно применена!');

      // Проверка существования таблицы
      const result = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'event_logs'
      `);

      if (result.rows.length > 0) {
        console.log('✅ Таблица event_logs существует');
      } else {
        console.log('⚠️  Таблица event_logs не найдена после миграции');
      }

      return { success: true, skipped: false };
    } catch (error) {
      // Если таблица уже существует, это не критическая ошибка
      if (error.message.includes('already exists') || error.message.includes('уже существует')) {
        console.log('💡 Таблица event_logs уже существует, это нормально');
        return { success: true, skipped: false, alreadyExists: true };
      } else {
        console.error(`\x1b[31m[POSTGRESQL MIGRATION ERROR]\x1b[0m ${error.message}`);
        return { success: false, error: error.message };
      }
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error(`\x1b[31m[POSTGRESQL MIGRATION ERROR]\x1b[0m ${error.message}`);
    return { success: false, error: error.message };
  }
}

module.exports = {
  checkForMigrations,
  validateTablePragmas,
  setupTelemetry,
  migratePostgreSQL,
};
