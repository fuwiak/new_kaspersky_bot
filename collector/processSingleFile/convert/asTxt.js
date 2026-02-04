const { v4 } = require("uuid");
const fs = require("fs");
const { tokenizeString } = require("../../utils/tokenizer");
const {
  createdDate,
  trashFile,
  writeToServerDocuments,
} = require("../../utils/files");
const { default: slugify } = require("slugify");

async function asTxt({
  fullFilePath = "",
  filename = "",
  options = {},
  metadata = {},
}) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const isCSV = filename.toLowerCase().endsWith('.csv');
  const fileType = isCSV ? 'CSV' : 'TXT';
  
  console.log(`[${fileType}] [${timestamp}] Starting ${fileType} file processing: ${filename}`);
  
  // Получаем размер файла
  try {
    const stats = fs.statSync(fullFilePath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`[${fileType}] [${timestamp}] File size: ${stats.size} bytes (${fileSizeMB} MB)`);
    console.log(`[${fileType}] [${timestamp}] Full path: ${fullFilePath}`);
  } catch (statError) {
    console.error(`[${fileType}] [${timestamp}] WARNING: Could not get file stats:`, statError.message);
  }
  
  let content = "";
  const readStartTime = Date.now();
  try {
    console.log(`[${fileType}] [${timestamp}] Reading file...`);
    content = fs.readFileSync(fullFilePath, "utf8");
    const readDuration = ((Date.now() - readStartTime) / 1000).toFixed(2);
    console.log(`[${fileType}] [${timestamp}] File read in ${readDuration}s`);
    console.log(`[${fileType}] [${timestamp}] Content length: ${content.length} characters`);
  } catch (err) {
    const readDuration = ((Date.now() - readStartTime) / 1000).toFixed(2);
    console.error(`[${fileType}] [${timestamp}] ERROR: Could not read file after ${readDuration}s!`);
    console.error(`[${fileType}] [${timestamp}] Error message:`, err.message);
    console.error(`[${fileType}] [${timestamp}] Error stack:`, err.stack);
    if (err.code) {
      console.error(`[${fileType}] [${timestamp}] Error code:`, err.code);
    }
    return {
      success: false,
      reason: `Could not read file: ${err.message}`,
      documents: [],
    };
  }

  if (!content?.length) {
    const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.error(`[${fileType}] [${timestamp}] ERROR: Resulting text content was empty for ${filename} after ${totalDuration}s`);
    trashFile(fullFilePath);
    return {
      success: false,
      reason: `No text content found in ${filename}.`,
      documents: [],
    };
  }

  // Для CSV файлов считаем строки
  if (isCSV) {
    const lines = content.split('\n').length;
    console.log(`[${fileType}] [${timestamp}] CSV file contains ${lines} lines`);
  }

  console.log(`[${fileType}] [${timestamp}] Processing content...`);
  const processStartTime = Date.now();
  const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
  const tokenCount = tokenizeString(content);
  const processDuration = ((Date.now() - processStartTime) / 1000).toFixed(2);
  console.log(`[${fileType}] [${timestamp}] Content processed in ${processDuration}s - ${wordCount} words, ${tokenCount} tokens`);
  
  const data = {
    id: v4(),
    url: "file://" + fullFilePath,
    title: metadata.title || filename,
    docAuthor: metadata.docAuthor || "Unknown",
    description: metadata.description || "Unknown",
    docSource: metadata.docSource || (isCSV ? "a CSV file uploaded by the user." : "a text file uploaded by the user."),
    chunkSource: metadata.chunkSource || "",
    published: createdDate(fullFilePath),
    wordCount: wordCount,
    pageContent: content,
    token_count_estimate: tokenCount,
  };

  const writeStartTime = Date.now();
  const document = writeToServerDocuments({
    data,
    filename: `${slugify(filename)}-${data.id}`,
    options: { parseOnly: options.parseOnly },
  });
  const writeDuration = ((Date.now() - writeStartTime) / 1000).toFixed(2);
  const totalDuration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  trashFile(fullFilePath);
  console.log(`[${fileType}] [${timestamp}] Document written in ${writeDuration}s`);
  console.log(`[${fileType}] [${timestamp}] [SUCCESS]: ${filename} converted & ready for embedding in ${totalDuration}s total\n`);
  return { success: true, reason: null, documents: [document] };
}

module.exports = asTxt;
