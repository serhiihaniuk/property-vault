import { constants } from 'node:fs';
import { access, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFParse } from 'pdf-parse';
import { isSha256Hex, normalizeSha256 } from './hash.ts';
import { getVaultPaths, resolveRepoRoot, type VaultPaths } from './paths.ts';

export type PdfInput = string | Buffer | Uint8Array;

export type PdfInspection = {
  pageCount: number;
  textPreview: string;
  textLength: number;
  hasTextLayer: boolean;
  needsVision: boolean;
};

export type RenderedPdfPage = {
  page: number;
  path: string;
};

export type RenderPdfOptions = {
  root?: string;
  scale?: number;
  desiredWidth?: number;
};

const TEXT_LAYER_MIN_CHARS = 40;
const TEXT_PREVIEW_MAX_CHARS = 4000;

export async function inspectPdf(input: PdfInput): Promise<PdfInspection> {
  const bytes = await readPdfInput(input);
  const parser = new PDFParse({ data: bytes });

  try {
    const info = await parser.getInfo();
    const text = await parser.getText();
    const normalizedText = normalizeExtractedText(text.text);
    const textPreview = normalizedText.slice(0, TEXT_PREVIEW_MAX_CHARS);
    const textLength = countMeaningfulTextChars(normalizedText);
    const hasTextLayer = textLength >= TEXT_LAYER_MIN_CHARS;

    return {
      pageCount: info.total,
      textPreview,
      textLength,
      hasTextLayer,
      needsVision: !hasTextLayer,
    };
  } finally {
    await parser.destroy();
  }
}

export async function renderPdfPages(
  hash: string,
  options: RenderPdfOptions = {},
): Promise<RenderedPdfPage[]> {
  const root = options.root ?? resolveRepoRoot();
  const paths = getVaultPaths(root);
  const normalizedHash = normalizeSha256(hash);
  const documentPath = await findCanonicalDocumentPath(paths, normalizedHash);
  const outputDir = path.join(paths.rendersDir, normalizedHash);

  assertInsideDirectory(outputDir, paths.rendersDir);
  await rm(outputDir, { force: true, recursive: true });
  await mkdir(outputDir, { recursive: true });

  const bytes = await readFile(documentPath);
  const parser = new PDFParse({ data: bytes });

  try {
    const result = await parser.getScreenshot({
      scale: options.scale ?? 1.5,
      desiredWidth: options.desiredWidth,
      imageBuffer: true,
      imageDataUrl: false,
    });
    const renderedPages: RenderedPdfPage[] = [];

    for (const page of result.pages) {
      const pageNumber = page.pageNumber;
      const filename = `page-${String(pageNumber).padStart(3, '0')}.png`;
      const pagePath = path.join(outputDir, filename);

      await writeFile(pagePath, page.data);
      renderedPages.push({
        page: pageNumber,
        path: pagePath,
      });
    }

    return renderedPages.sort((left, right) => left.page - right.page);
  } finally {
    await parser.destroy();
  }
}

export async function resolvePdfPathOrHash(
  pathOrHash: string,
  root = resolveRepoRoot(),
): Promise<string> {
  const trimmed = pathOrHash.trim();

  if (isSha256Hex(trimmed.toLowerCase())) {
    return findCanonicalDocumentPath(getVaultPaths(root), normalizeSha256(trimmed));
  }

  return path.resolve(trimmed);
}

async function readPdfInput(input: PdfInput): Promise<Uint8Array> {
  if (typeof input === 'string') {
    return readFile(input);
  }

  return input;
}

async function findCanonicalDocumentPath(paths: VaultPaths, hash: string): Promise<string> {
  const entries = await readdir(paths.documentsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name);
    const entryHash = path.basename(entry.name, extension).toLowerCase();

    if (entryHash === hash) {
      const candidate = path.join(paths.documentsDir, entry.name);
      await access(candidate, constants.R_OK);
      return candidate;
    }
  }

  throw new Error(`No canonical document found for hash ${hash}`);
}

function normalizeExtractedText(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
}

function countMeaningfulTextChars(text: string): number {
  return text.replace(/\s+/g, '').length;
}

function assertInsideDirectory(filePath: string, directory: string): void {
  const resolvedFile = path.resolve(filePath);
  const resolvedDirectory = path.resolve(directory);
  const relative = path.relative(resolvedDirectory, resolvedFile);

  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`Refusing to operate outside ${resolvedDirectory}: ${resolvedFile}`);
  }
}
