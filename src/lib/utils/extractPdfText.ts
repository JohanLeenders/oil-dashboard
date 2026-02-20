/**
 * Client-side PDF text extraction using pdf.js
 *
 * Extracts all text content from a PDF file uploaded via <input type="file">.
 * Used by ImportSlaughterDays to parse Storteboom opzetplanning PDFs directly.
 *
 * Text items are grouped by Y-coordinate to reconstruct proper lines,
 * which is critical for the parseOpzetplanning regex to work correctly.
 */

import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

// Configure the worker — use the bundled worker from pdfjs-dist
if (typeof window !== 'undefined') {
  GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
}

/**
 * Extract all text from a PDF File object.
 *
 * Groups text items by Y-coordinate to reconstruct lines accurately.
 * Items on the same line (within 2px tolerance) are sorted by X-coordinate
 * and joined with spaces. Lines are separated by newlines.
 */
export async function extractPdfText(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: arrayBuffer }).promise;

  const pageTexts: string[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();

    // Group items by Y-coordinate (transform[5] = y position)
    // Items with close Y values (within 2px) are on the same line
    const lineMap = new Map<number, { x: number; str: string }[]>();

    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;

      const x = item.transform[4]; // x position
      const y = Math.round(item.transform[5]); // y position (rounded for grouping)

      // Find existing line within tolerance
      let lineY = y;
      for (const existingY of lineMap.keys()) {
        if (Math.abs(existingY - y) <= 2) {
          lineY = existingY;
          break;
        }
      }

      if (!lineMap.has(lineY)) {
        lineMap.set(lineY, []);
      }
      lineMap.get(lineY)!.push({ x, str: item.str });
    }

    // Sort lines by Y descending (PDF coordinates: Y=0 is bottom)
    // then items within each line by X ascending
    const sortedLines = [...lineMap.entries()]
      .sort((a, b) => b[0] - a[0]) // Y descending = top to bottom
      .map(([, items]) =>
        items
          .sort((a, b) => a.x - b.x) // X ascending = left to right
          .map(item => item.str)
          .join(' ')
      );

    pageTexts.push(sortedLines.join('\n'));
  }

  return pageTexts.join('\n\n');
}
