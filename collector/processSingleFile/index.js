const path = require("path");
const fs = require("fs");
const {
  WATCH_DIRECTORY,
  SUPPORTED_FILETYPE_CONVERTERS,
} = require("../utils/constants");
const {
  trashFile,
  isTextType,
  normalizePath,
  isWithin,
} = require("../utils/files");
const RESERVED_FILES = ["__HOTDIR__.md"];

/**
 * Process a single file and return the documents
 * @param {string} targetFilename - The filename to process
 * @param {Object} options - The options for the file processing
 * @param {boolean} options.parseOnly - If true, the file will not be saved as a document even when `writeToServerDocuments` is called in the handler. Must be explicitly set to true to use.
 * @param {Object} metadata - The metadata for the file processing
 * @returns {Promise<{success: boolean, reason: string, documents: Object[]}>} - The documents from the file processing
 */
async function processSingleFile(targetFilename, options = {}, metadata = {}) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  console.log(`[FILE_PROCESS] [${timestamp}] Starting file processing: ${targetFilename}`);
  console.log(`[FILE_PROCESS] [${timestamp}] Options:`, JSON.stringify(options));
  console.log(`[FILE_PROCESS] [${timestamp}] Metadata:`, JSON.stringify(metadata));
  
  const fullFilePath = path.resolve(
    WATCH_DIRECTORY,
    normalizePath(targetFilename)
  );
  
  console.log(`[FILE_PROCESS] [${timestamp}] Full file path: ${fullFilePath}`);
  console.log(`[FILE_PROCESS] [${timestamp}] Watch directory: ${WATCH_DIRECTORY}`);
  
  if (!isWithin(path.resolve(WATCH_DIRECTORY), fullFilePath)) {
    console.error(`[FILE_PROCESS] [${timestamp}] ERROR: Filename is not a valid path to process`);
    return {
      success: false,
      reason: "Filename is a not a valid path to process.",
      documents: [],
    };
  }

  if (RESERVED_FILES.includes(targetFilename)) {
    console.error(`[FILE_PROCESS] [${timestamp}] ERROR: Filename is reserved: ${targetFilename}`);
    return {
      success: false,
      reason: "Filename is a reserved filename and cannot be processed.",
      documents: [],
    };
  }
  
  if (!fs.existsSync(fullFilePath)) {
    console.error(`[FILE_PROCESS] [${timestamp}] ERROR: File does not exist: ${fullFilePath}`);
    return {
      success: false,
      reason: "File does not exist in upload directory.",
      documents: [],
    };
  }

  // Получаем информацию о файле
  try {
    const stats = fs.statSync(fullFilePath);
    const fileSizeMB = (stats.size / (1024 * 1024)).toFixed(2);
    console.log(`[FILE_PROCESS] [${timestamp}] File size: ${stats.size} bytes (${fileSizeMB} MB)`);
    console.log(`[FILE_PROCESS] [${timestamp}] File created: ${stats.birthtime.toISOString()}`);
    console.log(`[FILE_PROCESS] [${timestamp}] File modified: ${stats.mtime.toISOString()}`);
  } catch (statError) {
    console.error(`[FILE_PROCESS] [${timestamp}] WARNING: Could not get file stats:`, statError.message);
  }

  const fileExtension = path.extname(fullFilePath).toLowerCase();
  console.log(`[FILE_PROCESS] [${timestamp}] File extension: ${fileExtension}`);
  
  if (fullFilePath.includes(".") && !fileExtension) {
    console.error(`[FILE_PROCESS] [${timestamp}] ERROR: No file extension found`);
    return {
      success: false,
      reason: `No file extension found. This file cannot be processed.`,
      documents: [],
    };
  }

  let processFileAs = fileExtension;
  if (!SUPPORTED_FILETYPE_CONVERTERS.hasOwnProperty(fileExtension)) {
    if (isTextType(fullFilePath)) {
      console.log(
        `[FILE_PROCESS] [${timestamp}] The provided filetype of ${fileExtension} does not have a preset and will be processed as .txt.`
      );
      processFileAs = ".txt";
    } else {
      console.error(`[FILE_PROCESS] [${timestamp}] ERROR: File extension ${fileExtension} not supported`);
      trashFile(fullFilePath);
      return {
        success: false,
        reason: `File extension ${fileExtension} not supported for parsing and cannot be assumed as text file type.`,
        documents: [],
      };
    }
  }

  const processorPath = SUPPORTED_FILETYPE_CONVERTERS[processFileAs];
  console.log(`[FILE_PROCESS] [${timestamp}] Using processor: ${processorPath} for extension: ${processFileAs}`);
  
  try {
    const FileTypeProcessor = require(processorPath);
    console.log(`[FILE_PROCESS] [${timestamp}] Processor loaded, starting file conversion...`);
    
    const result = await FileTypeProcessor({
      fullFilePath,
      filename: targetFilename,
      options,
      metadata,
    });
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`[FILE_PROCESS] [${timestamp}] File processing completed in ${duration}s`);
    console.log(`[FILE_PROCESS] [${timestamp}] Result: success=${result.success}, documents=${result.documents?.length || 0}`);
    
    if (!result.success) {
      console.error(`[FILE_PROCESS] [${timestamp}] ERROR: Processing failed - ${result.reason}`);
    }
    
    return result;
  } catch (processorError) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.error(`[FILE_PROCESS] [${timestamp}] ERROR: Processor failed after ${duration}s:`, processorError);
    console.error(`[FILE_PROCESS] [${timestamp}] Error stack:`, processorError.stack);
    return {
      success: false,
      reason: `Processor error: ${processorError.message}`,
      documents: [],
    };
  }
}

module.exports = {
  processSingleFile,
};
