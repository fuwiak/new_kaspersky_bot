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
  const documents = [];

  try {
    // Парсим файл один раз - это может быть медленно для больших файлов,
    // но node-xlsx не поддерживает streaming, поэтому это необходимо
    console.log(`[INFO]: Parsing Excel file: ${filename}...`);
    const workSheetsFromFile = xlsx.parse(fullFilePath);
    console.log(`[INFO]: Found ${workSheetsFromFile.length} sheet(s) in ${filename}`);

    if (options.parseOnly) {
      // Обрабатываем листы параллельно для ускорения
      // Используем setImmediate для разбиения работы на части и избежания блокировки event loop
      console.log(`[INFO]: Processing ${workSheetsFromFile.length} sheet(s) in parallel...`);
      const processedSheets = await Promise.all(
        workSheetsFromFile.map((sheet) => {
          return new Promise((resolve) => {
            // Используем setImmediate для неблокирующей обработки
            setImmediate(() => {
              try {
                const processed = processSheet(sheet);
                resolve(processed);
              } catch (error) {
                console.error(`Error processing sheet "${sheet.name}":`, error);
                resolve(null);
              }
            });
          });
        })
      );

      // Фильтруем пустые листы
      const validSheets = processedSheets.filter((sheet) => sheet !== null);

      if (validSheets.length === 0) {
        console.log(`No valid sheets found in ${filename}.`);
        return {
          success: false,
          reason: `No valid sheets found in ${filename}.`,
          documents: [],
        };
      }

      // Собираем содержимое всех листов
      const allSheetContents = validSheets.map(
        (sheet) => `\nSheet: ${sheet.name}\n${sheet.content}`
      );
      const sheetNames = validSheets.map((sheet) => sheet.name);
      const totalWordCount = validSheets.reduce(
        (sum, sheet) => sum + sheet.wordCount,
        0
      );

      const combinedContent = allSheetContents.join("\n");
      const sheetListText =
        sheetNames.length > 1
          ? ` (Sheets: ${sheetNames.join(", ")})`
          : ` (Sheet: ${sheetNames[0]})`;

      const combinedData = {
        id: v4(),
        url: `file://${fullFilePath}`,
        title: metadata.title || `${filename}${sheetListText}`,
        docAuthor: metadata.docAuthor || "Unknown",
        description:
          metadata.description ||
          `Spreadsheet data from ${filename} containing ${sheetNames.length} ${
            sheetNames.length === 1 ? "sheet" : "sheets"
          }`,
        docSource: metadata.docSource || "an xlsx file uploaded by the user.",
        chunkSource: metadata.chunkSource || "",
        published: createdDate(fullFilePath),
        wordCount: totalWordCount,
        pageContent: combinedContent,
        token_count_estimate: tokenizeString(combinedContent),
      };

      const document = writeToServerDocuments({
        data: combinedData,
        filename: `${slugify(path.basename(filename))}-${combinedData.id}`,
        destinationOverride: null,
        options: { parseOnly: true },
      });
      documents.push(document);
      console.log(`[SUCCESS]: ${filename} converted & ready for embedding.`);
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
      console.log(`[INFO]: Processing ${workSheetsFromFile.length} sheet(s) in parallel...`);
      const processedSheets = await Promise.all(
        workSheetsFromFile.map((sheet) => {
          return new Promise((resolve) => {
            setImmediate(() => {
              try {
                const processed = processSheet(sheet);
                if (!processed) {
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

                const document = writeToServerDocuments({
                  data: sheetData,
                  filename: `sheet-${slugify(name)}`,
                  destinationOverride: outFolderPath,
                  options: { parseOnly: options.parseOnly },
                });
                console.log(
                  `[SUCCESS]: Sheet "${name}" converted & ready for embedding.`
                );
                resolve(document);
              } catch (error) {
                console.error(`Error processing sheet "${sheet.name}":`, error);
                resolve(null);
              }
            });
          });
        })
      );

      // Фильтруем null значения и добавляем в documents
      const validDocuments = processedSheets.filter((doc) => doc !== null);
      documents.push(...validDocuments);
    }
  } catch (err) {
    console.error("Could not process xlsx file!", err);
    return {
      success: false,
      reason: `Error processing ${filename}: ${err.message}`,
      documents: [],
    };
  } finally {
    trashFile(fullFilePath);
  }

  if (documents.length === 0) {
    console.error(`No valid sheets found in ${filename}.`);
    return {
      success: false,
      reason: `No valid sheets found in ${filename}.`,
      documents: [],
    };
  }

  console.log(
    `[SUCCESS]: ${filename} fully processed. Created ${documents.length} document(s).\n`
  );
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
    const content = convertToCSV(data);

    if (!content?.length) {
      console.log(`Sheet "${name}" is empty. Skipping.`);
      return null;
    }

    console.log(`-- Processing sheet: ${name} --`);
    return {
      name,
      content,
      wordCount: content.split(/\s+/).length,
    };
  } catch (err) {
    console.error(`Error processing sheet "${sheet.name}":`, err);
    return null;
  }
}

module.exports = asXlsx;
