const { v4 } = require("uuid");
const xlsx = require("node-xlsx").default;
const path = require("path");
const fs = require("fs");
const {
  createdDate,
  trashFile,
  writeToServerDocuments,
  documentsFolder,
} = require("../../utils/files");
const { tokenizeString } = require("../../utils/tokenizer");
const { default: slugify } = require("slugify");

/**
 * Конвертирует данные листа в CSV формат
 * Оптимизировано для больших объемов данных
 * @param {Array<Array<string|number|null|undefined>>} data - 2D массив данных листа
 * @returns {string} CSV строка
 */
function convertToCSV(data) {
  if (!data || data.length === 0) return "";

  // Используем более эффективный подход для больших массивов
  const rows = [];
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) {
      rows.push("");
      continue;
    }

    const cells = [];
    for (let j = 0; j < row.length; j++) {
      const cell = row[j];
      if (cell === null || cell === undefined) {
        cells.push("");
      } else if (typeof cell === "string" && (cell.includes(",") || cell.includes('"') || cell.includes("\n"))) {
        // Экранируем кавычки и оборачиваем в кавычки если нужно
        cells.push(`"${cell.replace(/"/g, '""')}"`);
      } else {
        cells.push(String(cell));
      }
    }
    rows.push(cells.join(","));
  }

  return rows.join("\n");
}

async function asXlsx({
  fullFilePath = "",
  filename = "",
  options = {},
  metadata = {},
}) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const documents = [];

  try {
    // Получаем размер файла
    const stats = fs.statSync(fullFilePath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`[XLSX] [${timestamp}] Starting Excel file processing: ${filename}`);
    console.log(`[XLSX] [${timestamp}] File size: ${stats.size} bytes (${fileSizeMB} MB)`);
    console.log(`[XLSX] [${timestamp}] Full path: ${fullFilePath}`);
    console.log(`[XLSX] [${timestamp}] Options: parseOnly=${options.parseOnly || false}`);

    // Парсим файл один раз - это может быть медленно для больших файлов,
    // но node-xlsx не поддерживает streaming, поэтому это необходимо
    console.log(`[XLSX] [${timestamp}] Parsing Excel file...`);
    const parseStartTime = Date.now();
    const workSheetsFromFile = xlsx.parse(fullFilePath);
    const parseDuration = ((Date.now() - parseStartTime) / 1000).toFixed(2);
    console.log(`[XLSX] [${timestamp}] Excel file parsed in ${parseDuration}s`);
    console.log(`[XLSX] [${timestamp}] Found ${workSheetsFromFile.length} sheet(s) in ${filename}`);

    // Логируем информацию о каждом листе
    workSheetsFromFile.forEach((sheet, index) => {
      const rowCount = sheet.data ? sheet.data.length : 0;
      const colCount = sheet.data && sheet.data[0] ? sheet.data[0].length : 0;
      console.log(`[XLSX] [${timestamp}] Sheet ${index + 1}: "${sheet.name}" - ${rowCount} rows x ${colCount} cols`);
    });

    if (options.parseOnly) {
      // Для больших файлов обрабатываем листы батчами с паузами, чтобы не блокировать приложение
      // Определяем размер батча в зависимости от количества листов
      const BATCH_SIZE = workSheetsFromFile.length > 20 ? 3 : workSheetsFromFile.length > 10 ? 5 : 10;
      const BATCH_DELAY_MS = 50; // Пауза между батчами в миллисекундах

      console.log(`[XLSX] [${timestamp}] Processing ${workSheetsFromFile.length} sheet(s) in batches of ${BATCH_SIZE}...`);
      const processStartTime = Date.now();

      // Функция для обработки одного листа с неблокирующей задержкой
      const processSheetAsync = (sheet, index) => {
        return new Promise((resolve) => {
          setImmediate(() => {
            const sheetStartTime = Date.now();
            try {
              console.log(`[XLSX] [${timestamp}] Processing sheet ${index + 1}/${workSheetsFromFile.length}: "${sheet.name}"...`);
        const processed = processSheet(sheet);
              const sheetDuration = ((Date.now() - sheetStartTime) / 1000).toFixed(2);
              if (processed) {
                console.log(`[XLSX] [${timestamp}] Sheet "${sheet.name}" processed in ${sheetDuration}s - ${processed.wordCount} words`);
              } else {
                console.log(`[XLSX] [${timestamp}] Sheet "${sheet.name}" is empty, skipped`);
              }
              resolve(processed);
            } catch (error) {
              const sheetDuration = ((Date.now() - sheetStartTime) / 1000).toFixed(2);
              console.error(`[XLSX] [${timestamp}] ERROR processing sheet "${sheet.name}" after ${sheetDuration}s:`, error);
              console.error(`[XLSX] [${timestamp}] Error stack:`, error.stack);
              resolve(null);
            }
          });
        });
      };

      // Функция для паузы между батчами
      const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

      // Обрабатываем листы последовательно и создаем документы сразу после обработки каждого листа
      // Это позволяет задавать вопросы по уже обработанным листам, пока остальные еще обрабатываются
      console.log(`[XLSX] [${timestamp}] Processing sheets sequentially - creating documents immediately after each sheet...`);
      
      let totalWordCount = 0;
      let processedCount = 0;
      
      for (let i = 0; i < workSheetsFromFile.length; i++) {
        const sheet = workSheetsFromFile[i];
        const sheetStartTime = Date.now();
        
        try {
          console.log(`[XLSX] [${timestamp}] Processing sheet ${i + 1}/${workSheetsFromFile.length}: "${sheet.name}"...`);
          const processed = processSheet(sheet);
          
          if (!processed) {
            console.log(`[XLSX] [${timestamp}] Sheet "${sheet.name}" is empty, skipped`);
            continue;
          }
          
          const sheetDuration = ((Date.now() - sheetStartTime) / 1000).toFixed(2);
          console.log(`[XLSX] [${timestamp}] Sheet "${sheet.name}" processed in ${sheetDuration}s - ${processed.wordCount} words`);
          
          // Создаем отдельный документ для каждого листа сразу после обработки
          const sheetData = {
            id: v4(),
            url: `file://${fullFilePath}`,
            title: metadata.title || `${filename} - Sheet: ${processed.name}`,
            docAuthor: metadata.docAuthor || "Unknown",
            description:
              metadata.description || `Sheet "${processed.name}" from ${filename}`,
            docSource: metadata.docSource || "an xlsx file uploaded by the user.",
            chunkSource: metadata.chunkSource || processed.name,
            published: createdDate(fullFilePath),
            wordCount: processed.wordCount,
            pageContent: `Sheet: ${processed.name}\n${processed.content}`,
            token_count_estimate: tokenizeString(processed.content),
          };

          const writeStartTime = Date.now();
          const document = writeToServerDocuments({
            data: sheetData,
            filename: `${slugify(path.basename(filename))}-${slugify(processed.name)}-${sheetData.id}`,
            destinationOverride: null,
            options: { parseOnly: true },
          });
          const writeDuration = ((Date.now() - writeStartTime) / 1000).toFixed(2);
          
          documents.push(document);
          totalWordCount += processed.wordCount;
          processedCount++;
          
          console.log(`[XLSX] [${timestamp}] Document for sheet "${processed.name}" created in ${writeDuration}s (${processedCount}/${workSheetsFromFile.length} ready)`);
          console.log(`[XLSX] [${timestamp}] ✓ Sheet "${processed.name}" is now available for queries!`);
          
          // Небольшая пауза после каждого листа, чтобы дать event loop обработать другие запросы
          if (i < workSheetsFromFile.length - 1) {
            await delay(BATCH_DELAY_MS);
          }
        } catch (error) {
          const sheetDuration = ((Date.now() - sheetStartTime) / 1000).toFixed(2);
          console.error(`[XLSX] [${timestamp}] ERROR processing sheet "${sheet.name}" after ${sheetDuration}s:`, error);
          console.error(`[XLSX] [${timestamp}] Error stack:`, error.stack);
          // Продолжаем обработку остальных листов даже при ошибке
        }
      }

      const processDuration = ((Date.now() - processStartTime) / 1000).toFixed(2);
      console.log(`[XLSX] [${timestamp}] All sheets processed in ${processDuration}s`);
      
      if (documents.length === 0) {
        console.log(`[XLSX] [${timestamp}] No valid sheets found in ${filename}.`);
        return {
          success: false,
          reason: `No valid sheets found in ${filename}.`,
          documents: [],
        };
      }
      
      const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`[XLSX] [${timestamp}] [SUCCESS]: ${filename} converted - ${documents.length} document(s) created in ${totalDuration}s total`);
      console.log(`[XLSX] [${timestamp}] Total word count: ${totalWordCount}, Documents ready: ${documents.length}/${workSheetsFromFile.length}`);
    } else {
      const folderName = slugify(
        `${path.basename(filename)}-${v4().slice(0, 4)}`,
        {
          lower: true,
          trim: true,
        }
      );
      const outFolderPath = path.resolve(documentsFolder, folderName);
      if (!fs.existsSync(outFolderPath))
        fs.mkdirSync(outFolderPath, { recursive: true });

      // Обрабатываем листы параллельно
      // Используем setImmediate для разбиения работы на части и избежания блокировки event loop
      console.log(`[XLSX] [${timestamp}] Processing ${workSheetsFromFile.length} sheet(s) in parallel...`);
      const processStartTime = Date.now();
      const processedSheets = await Promise.all(
        workSheetsFromFile.map((sheet, index) => {
          return new Promise((resolve) => {
            setImmediate(() => {
              const sheetStartTime = Date.now();
              try {
                console.log(`[XLSX] [${timestamp}] Processing sheet ${index + 1}/${workSheetsFromFile.length}: "${sheet.name}"...`);
        const processed = processSheet(sheet);
                if (!processed) {
                  console.log(`[XLSX] [${timestamp}] Sheet "${sheet.name}" is empty, skipped`);
                  resolve(null);
                  return;
                }

        const { name, content, wordCount } = processed;
        const sheetData = {
          id: v4(),
          url: `file://${path.join(outFolderPath, `${slugify(name)}.csv`)}`,
          title: metadata.title || `${filename} - Sheet:${name}`,
          docAuthor: metadata.docAuthor || "Unknown",
          description:
            metadata.description || `Spreadsheet data from sheet: ${name}`,
          docSource: metadata.docSource || "an xlsx file uploaded by the user.",
          chunkSource: metadata.chunkSource || "",
          published: createdDate(fullFilePath),
          wordCount: wordCount,
          pageContent: content,
          token_count_estimate: tokenizeString(content),
        };

                const writeStartTime = Date.now();
        const document = writeToServerDocuments({
          data: sheetData,
          filename: `sheet-${slugify(name)}`,
          destinationOverride: outFolderPath,
          options: { parseOnly: options.parseOnly },
        });
                const writeDuration = ((Date.now() - writeStartTime) / 1000).toFixed(2);
                const sheetDuration = ((Date.now() - sheetStartTime) / 1000).toFixed(2);
                console.log(`[XLSX] [${timestamp}] Sheet "${name}" processed in ${sheetDuration}s (write: ${writeDuration}s) - ${wordCount} words`);
                console.log(`[XLSX] [${timestamp}] [SUCCESS]: Sheet "${name}" converted & ready for embedding.`);
                resolve(document);
              } catch (error) {
                const sheetDuration = ((Date.now() - sheetStartTime) / 1000).toFixed(2);
                console.error(`[XLSX] [${timestamp}] ERROR processing sheet "${sheet.name}" after ${sheetDuration}s:`, error);
                console.error(`[XLSX] [${timestamp}] Error stack:`, error.stack);
                resolve(null);
              }
            });
          });
        })
      );
      const processDuration = ((Date.now() - processStartTime) / 1000).toFixed(2);
      console.log(`[XLSX] [${timestamp}] All sheets processed in ${processDuration}s`);

      // Фильтруем null значения и добавляем в documents
      const validDocuments = processedSheets.filter((doc) => doc !== null);
      documents.push(...validDocuments);
    }
  } catch (err) {
    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`[XLSX] [${timestamp}] ERROR: Could not process xlsx file after ${totalDuration}s!`);
    console.error(`[XLSX] [${timestamp}] Error message:`, err.message);
    console.error(`[XLSX] [${timestamp}] Error stack:`, err.stack);
    console.error(`[XLSX] [${timestamp}] Error name:`, err.name);
    if (err.code) {
      console.error(`[XLSX] [${timestamp}] Error code:`, err.code);
    }
    return {
      success: false,
      reason: `Error processing ${filename}: ${err.message}`,
      documents: [],
    };
  } finally {
    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`[XLSX] [${timestamp}] Cleaning up temporary file...`);
    trashFile(fullFilePath);
    console.log(`[XLSX] [${timestamp}] Total processing time: ${totalDuration}s`);
  }

  if (documents.length === 0) {
    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`[XLSX] [${timestamp}] ERROR: No valid sheets found in ${filename} after ${totalDuration}s`);
    return {
      success: false,
      reason: `No valid sheets found in ${filename}.`,
      documents: [],
    };
  }

  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`[XLSX] [${timestamp}] [SUCCESS]: ${filename} fully processed in ${totalDuration}s. Created ${documents.length} document(s).\n`);
  return { success: true, reason: null, documents };
}

/**
 * Processes a single sheet and returns its content and metadata
 * @param {{name: string, data: Array<Array<string|number|null|undefined>>}} sheet - Parsed sheet with name and 2D array of cell values
 * @returns {{name: string, content: string, wordCount: number}|null} - Object with name, CSV content, and word count, or null if sheet is empty
 */
function processSheet(sheet) {
  try {
    const { name, data } = sheet;
    const rowCount = data ? data.length : 0;

    // Для очень больших листов (>10000 строк) предупреждаем о возможной задержке
    if (rowCount > 10000) {
      console.log(`[XLSX] WARNING: Sheet "${name}" has ${rowCount} rows - processing may take longer`);
    }

    const content = convertToCSV(data);

    if (!content?.length) {
      console.log(`Sheet "${name}" is empty. Skipping.`);
      return null;
    }

    console.log(`-- Processing sheet: ${name} --`);

    // Для больших листов считаем слова более эффективно
    const wordCount = rowCount > 5000
      ? content.split(/\s+/).filter(word => word.length > 0).length
      : content.split(/\s+/).length;

    return {
      name,
      content,
      wordCount,
    };
  } catch (err) {
    console.error(`Error processing sheet "${sheet.name}":`, err);
    return null;
  }
}

module.exports = asXlsx;
