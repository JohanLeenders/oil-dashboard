import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/extract-pdf
 *
 * Receives a PDF file via FormData, extracts text server-side using pdf-parse.
 * This is a pure API route — runs entirely on the server, zero client bundle impact.
 *
 * pdf-parse v1 has a quirk: at import time it tries to load a test PDF file.
 * We work around this by importing only the inner lib/pdf-parse.js directly,
 * which skips the test file loading in index.js.
 *
 * Returns: { text: string } with extracted text content.
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: 'Geen PDF bestand ontvangen' },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Import the inner module directly to skip pdf-parse's test file loading quirk
    // pdf-parse/lib/pdf-parse.js exports the actual parser function without loading test data
    const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
    const result = await pdfParse(buffer);

    return NextResponse.json({ text: result.text });
  } catch (err) {
    console.error('PDF extraction error:', err);
    return NextResponse.json(
      { error: `PDF kon niet worden gelezen: ${err instanceof Error ? err.message : 'onbekende fout'}` },
      { status: 500 }
    );
  }
}
