/**
 * POST /api/slaughter-reports/upload-corvoet
 *
 * Accepts a Corvoet massabalans xlsx file, parses it,
 * validates, and inserts into Supabase using the existing
 * slaughter_reports + slaughter_report_lines tables
 * with report_type = 'fileer_corvoet'.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  parseCorvoetReport,
  validateCorvoetReport,
} from '@/lib/engine/corvoet-parser';
import type { CorvoetUploadResult } from '@/types/slaughter-reports';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, report_id: null, report: null, errors: ['Geen bestand ontvangen'], warnings: [] } satisfies CorvoetUploadResult,
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json(
        { success: false, report_id: null, report: null, errors: ['Ongeldig bestandstype. Upload een .xlsx bestand.'], warnings: [] } satisfies CorvoetUploadResult,
        { status: 400 }
      );
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, report_id: null, report: null, errors: ['Bestand te groot (max 10MB)'], warnings: [] } satisfies CorvoetUploadResult,
        { status: 400 }
      );
    }

    // Parse xlsx
    const buffer = await file.arrayBuffer();
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'array' });

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json(
        { success: false, report_id: null, report: null, errors: ['Excel bevat geen werkbladen'], warnings: [] } satisfies CorvoetUploadResult,
        { status: 400 }
      );
    }

    const sheet = workbook.Sheets[sheetName];
    const rows: (string | number | null)[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      raw: false,
    });

    // Parse the Corvoet report
    const report = parseCorvoetReport(rows, file.name);

    // Validate
    const { errors, warnings } = validateCorvoetReport(report);

    if (errors.length > 0) {
      return NextResponse.json(
        { success: false, report_id: null, report, errors, warnings } satisfies CorvoetUploadResult,
        { status: 422 }
      );
    }

    // Insert into Supabase using existing tables
    const supabase = await createClient();

    const lotNumber = `W${String(report.week_number).padStart(2, '0')}-${report.year}`;

    // 1. Insert report header (reusing slaughter_reports with report_type='fileer_corvoet')
    const { data: insertedReport, error: reportError } = await supabase
      .from('slaughter_reports')
      .insert({
        lot_number: lotNumber,
        report_type: 'fileer_corvoet' as const,
        mester: 'Cor Voet',
        slaughter_date: report.processing_date,
        live_weight_kg: report.total_in_kg,
        total_yield_pct: report.total_uit_kg > 0
          ? Math.round((report.total_uit_kg / report.total_in_kg) * 1000) / 10
          : null,
        griller_yield_pct: report.filet_yield_pct, // Repurpose: filet rendement
        source_file: report.source_file,
        notes: `Corvoet massabalans week ${report.week_number}`,
      })
      .select('id')
      .single();

    if (reportError) {
      if (reportError.code === '23505') {
        return NextResponse.json(
          { success: false, report_id: null, report, errors: [`Rapport al geüpload: ${lotNumber}`], warnings } satisfies CorvoetUploadResult,
          { status: 409 }
        );
      }
      throw reportError;
    }

    const reportId = insertedReport.id;

    // 2. Insert massabalans lines
    const lines = [
      {
        report_id: reportId,
        section: 'massabalans',
        product_code: 'borstkappen_in',
        product_label: 'Borstkappen in',
        weight_kg: report.borstkappen_in_kg,
        yield_pct: null,
        sort_order: 0,
      },
      {
        report_id: reportId,
        section: 'massabalans',
        product_code: 'filet_haasjes_uit',
        product_label: 'Filet / haasjes uit',
        weight_kg: report.total_uit_kg - (report.uit_lines.find(l => l.artikel.toLowerCase().includes('vellen'))?.netto_kg ?? 0) - (report.uit_lines.find(l => l.artikel.toLowerCase().includes('dij'))?.netto_kg ?? 0) - (report.uit_lines.find(l => l.artikel.toLowerCase().includes('kwaliteit'))?.netto_kg ?? 0),
        yield_pct: report.filet_yield_pct,
        sort_order: 1,
      },
      {
        report_id: reportId,
        section: 'massabalans',
        product_code: 'vellen_uit',
        product_label: 'Vellen uit',
        weight_kg: report.uit_lines.find(l => l.artikel.toLowerCase().includes('vellen'))?.netto_kg ?? null,
        yield_pct: report.vellen_yield_pct,
        sort_order: 2,
      },
      {
        report_id: reportId,
        section: 'massabalans',
        product_code: 'dijenvlees_in',
        product_label: 'Dijenvlees in',
        weight_kg: report.dijenvlees_in_kg,
        yield_pct: null,
        sort_order: 3,
      },
      {
        report_id: reportId,
        section: 'massabalans',
        product_code: 'dijenvlees_uit',
        product_label: 'Dijenvlees uit',
        weight_kg: report.uit_lines.find(l => l.artikel.toLowerCase().includes('dij'))?.netto_kg ?? null,
        yield_pct: report.dijenvlees_yield_pct,
        sort_order: 4,
      },
    ];

    const { error: linesError } = await supabase
      .from('slaughter_report_lines')
      .insert(lines.map(l => ({
        ...l,
        item_count: null,
        avg_weight_kg: null,
      })));

    if (linesError) throw linesError;

    return NextResponse.json({
      success: true,
      report_id: reportId,
      report,
      errors: [],
      warnings,
    } satisfies CorvoetUploadResult);
  } catch (error) {
    console.error('Corvoet upload error:', error);
    return NextResponse.json(
      {
        success: false,
        report_id: null,
        report: null,
        errors: [`Server error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: [],
      } satisfies CorvoetUploadResult,
      { status: 500 }
    );
  }
}
