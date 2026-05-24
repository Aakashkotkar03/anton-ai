// electron/handlers/documentParser.js — Document Intelligence (PRD Feature 3)
// Extracts text from PDF/DOCX/TXT/MD/CSV, chunks large documents,
// and provides TF-IDF keyword retrieval for Q&A.
//
// Architecture:
//   - PDF: pdf-parse (text extraction only, no OCR)
//   - DOCX: mammoth.js in a Worker thread (non-blocking)
//   - TXT/MD/CSV: direct fs.readFile
//   - Large docs: chunked with overlap, TF-IDF keyword index
//   - Q&A: query keywords scored against chunk keywords, top N returned
//
// 🔒 Security:
//   - filePath validated: no '..', must be absolute, resolved path checked
//   - File size capped at 100 MB
//   - Worker thread for DOCX prevents UI blocking

const path = require('path');
const fs = require('fs');
const { Worker } = require('worker_threads');

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const CHUNK_CHARS = 6000;      // ~1500 tokens per chunk
const OVERLAP_CHARS = 600;     // ~150 tokens overlap between chunks
const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB hard limit

// Common English stopwords for TF-IDF
const STOPWORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'is', 'was', 'are', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
  'used', 'not', 'no', 'nor', 'as', 'by', 'from', 'up', 'about',
  'into', 'through', 'during', 'before', 'after', 'above', 'below',
  'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
  'once', 'here', 'there', 'when', 'where', 'why', 'how', 'all', 'any',
  'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
  'than', 'too', 'very', 'just', 'also', 'now', 'so', 'if', 'its',
  'it', 'this', 'that', 'these', 'those', 'i', 'me', 'my', 'we', 'our',
  'you', 'your', 'he', 'him', 'his', 'she', 'her', 'they', 'them', 'their',
  'what', 'which', 'who', 'whom', 'while', 'only', 'own', 'same',
]);

// ---------------------------------------------------------------------------
// extractText — read text content from a file
// ---------------------------------------------------------------------------
async function extractText(filePath) {
  // 🔒 Validate path
  validateFilePath(filePath);

  const ext = path.extname(filePath).toLowerCase();
  const stat = fs.statSync(filePath);

  if (stat.size > MAX_FILE_SIZE) {
    throw new Error(`File exceeds ${MAX_FILE_SIZE / (1024 * 1024)} MB limit.`);
  }

  if (ext === '.pdf') {
    return await extractPdf(filePath);
  }

  if (ext === '.docx') {
    return await extractDocx(filePath);
  }

  if (['.txt', '.md', '.csv'].includes(ext)) {
    const text = fs.readFileSync(filePath, 'utf8');
    return { text, isScanned: false };
  }

  throw new Error(
    `UNSUPPORTED_FORMAT: '${ext}' is not supported. ` +
    'Use .pdf, .docx, .txt, .md, or .csv.'
  );
}

// ---------------------------------------------------------------------------
// PDF extraction — pdf-parse
// ---------------------------------------------------------------------------
async function extractPdf(filePath) {
  const pdfParse = require('pdf-parse');
  const buffer = fs.readFileSync(filePath);

  let result;
  try {
    result = await pdfParse(buffer);
  } catch (err) {
    throw new Error(`PDF parsing failed: ${err.message}`);
  }

  const text = (result.text || '').trim();

  // Scanned image PDFs have little or no extractable text
  if (text.length < 50) {
    return {
      text: '',
      isScanned: true,
      pageCount: result.numpages || 0,
    };
  }

  return {
    text,
    isScanned: false,
    pageCount: result.numpages || 0,
  };
}

// ---------------------------------------------------------------------------
// DOCX extraction — mammoth.js in a Worker thread
// ---------------------------------------------------------------------------
// Running in a Worker prevents blocking the main process event loop
// for large documents (mammoth can take 1-5 seconds on big files).
//
async function extractDocx(filePath) {
  return new Promise((resolve, reject) => {
    // Inline Worker code as a string — avoids needing a separate worker file
    const workerCode = `
      const { parentPort, workerData } = require('worker_threads');
      const mammoth = require('mammoth');

      (async () => {
        try {
          const result = await mammoth.extractRawText({ path: workerData.filePath });
          parentPort.postMessage({ text: result.value, isScanned: false });
        } catch (err) {
          parentPort.postMessage({ error: err.message });
        }
      })();
    `;

    const worker = new Worker(workerCode, {
      eval: true,
      workerData: { filePath },
    });

    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error('DOCX extraction timed out after 30 seconds.'));
    }, 30000);

    worker.on('message', (msg) => {
      clearTimeout(timeout);
      if (msg.error) {
        reject(new Error(`DOCX extraction failed: ${msg.error}`));
      } else {
        resolve({ text: msg.text || '', isScanned: false });
      }
    });

    worker.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`DOCX worker error: ${err.message}`));
    });

    worker.on('exit', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`DOCX worker exited with code ${code}.`));
      }
    });
  });
}

// ---------------------------------------------------------------------------
// processDocument — extract + decide strategy + chunk if needed
// ---------------------------------------------------------------------------
async function processDocument(filePath, effectiveContextTokens) {
  // 🔒 Validate
  validateFilePath(filePath);

  if (typeof effectiveContextTokens !== 'number' || effectiveContextTokens < 512) {
    effectiveContextTokens = 4096; // safe fallback
  }

  const { text, isScanned, pageCount } = await extractText(filePath);

  if (isScanned) {
    return {
      strategy: 'scanned',
      error: 'SCANNED_PDF',
      message: 'This PDF contains scanned images. Text extraction is not possible without OCR.',
      pageCount: pageCount || 0,
    };
  }

  if (!text || text.trim().length === 0) {
    return {
      strategy: 'empty',
      error: 'EMPTY_DOCUMENT',
      message: 'No text content found in this document.',
    };
  }

  const fullTokens = Math.ceil(text.length / 4); // ~4 chars per token estimate
  const docBudget = effectiveContextTokens - 2048; // reserve for chat + response

  // Strategy: FULL — entire document fits in context
  if (fullTokens <= docBudget) {
    return {
      strategy: 'full',
      content: text,
      fullTokens,
      docBudget,
      pageCount: pageCount || 0,
    };
  }

  // Strategy: CHUNKED — document too large, build keyword index
  const chunks = splitWithOverlap(text, CHUNK_CHARS, OVERLAP_CHARS);
  const index = chunks.map((chunkText, i) => ({
    id: i,
    text: chunkText,
    keywords: tfidf(chunkText),
  }));

  console.log(
    `[docParser] Chunked: ${fullTokens} tokens → ${chunks.length} chunks ` +
    `(budget: ${docBudget} tokens).`
  );

  return {
    strategy: 'chunked',
    fullTokens,
    docBudget,
    chunkCount: chunks.length,
    index,
    pageCount: pageCount || 0,
  };
}

// ---------------------------------------------------------------------------
// getRelevantChunks — retrieve top N chunks for a query
// ---------------------------------------------------------------------------
function getRelevantChunks(query, chunkIndex, maxChunks = 5) {
  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return [];
  }
  if (!Array.isArray(chunkIndex) || chunkIndex.length === 0) {
    return [];
  }

  // 🔒 Cap maxChunks
  maxChunks = Math.min(Math.max(1, maxChunks), 10);

  const queryKws = tfidf(query);

  const scored = chunkIndex.map((chunk) => ({
    id: chunk.id,
    text: chunk.text,
    score: countOverlap(queryKws, chunk.keywords),
  }));

  // Sort by score descending, take top N
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, maxChunks);
}

// ---------------------------------------------------------------------------
// tfidf — simple keyword extraction (top 20 by frequency)
// ---------------------------------------------------------------------------
function tfidf(text) {
  if (!text || typeof text !== 'string') return [];

  // Lowercase, remove non-alphanumeric (keep spaces), split into words
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));

  // Count frequencies
  const freq = {};
  for (const word of words) {
    freq[word] = (freq[word] || 0) + 1;
  }

  // Sort by frequency descending, take top 20
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);
}

// ---------------------------------------------------------------------------
// countOverlap — count matching keywords between two arrays
// ---------------------------------------------------------------------------
function countOverlap(arrayA, arrayB) {
  if (!arrayA || !arrayB) return 0;
  const setB = new Set(arrayB);
  return arrayA.filter((w) => setB.has(w)).length;
}

// ---------------------------------------------------------------------------
// splitWithOverlap — split text into chunks with character overlap
// ---------------------------------------------------------------------------
function splitWithOverlap(text, chunkSize, overlap) {
  if (!text || text.length === 0) return [];

  const chunks = [];
  let start = 0;
  const step = chunkSize - overlap;

  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end));
    start += step;

    // Safety: prevent infinite loop if step <= 0
    if (step <= 0) break;
  }

  return chunks;
}

// ---------------------------------------------------------------------------
// Path validation
// ---------------------------------------------------------------------------
function validateFilePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    throw new Error('INVALID_PATH: filePath is required.');
  }

  if (filePath.length > 1024) {
    throw new Error('INVALID_PATH: Path too long.');
  }

  // 🔒 Block path traversal
  if (filePath.includes('..')) {
    throw new Error('INVALID_PATH: Path traversal (..) is not allowed.');
  }

  // 🔒 Must be an absolute path
  if (!path.isAbsolute(filePath)) {
    throw new Error('INVALID_PATH: Only absolute file paths are accepted.');
  }

  // 🔒 Resolve and verify the resolved path doesn't escape
  const resolved = path.resolve(filePath);
  if (resolved !== path.normalize(filePath)) {
    throw new Error('INVALID_PATH: Path contains suspicious components.');
  }

  // File must exist
  if (!fs.existsSync(filePath)) {
    throw new Error(`FILE_NOT_FOUND: ${filePath}`);
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
module.exports = {
  extractText,
  processDocument,
  getRelevantChunks,
  tfidf,
  splitWithOverlap,
};
