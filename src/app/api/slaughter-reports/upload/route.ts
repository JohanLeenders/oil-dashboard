/**
 * POST /api/slaughter-reports/upload
 *
 * Accepts an xlsx file, parses it into a SlaughterReport,
 * validates, and inserts into Supabase.
 *
 * Returns the parsed report + validation results.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  parseSlaughterReport,
  validateSlaughterReport,
} from '@/lib/engine/slaughter-report-parser';
import type {
  UploadResult,
  ReportType,
} from '@/types/slaughter-reports';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const reportType = (formData.get('report_type') as ReportType) || 'slacht_putten';

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'Geen bestand ontvangen' },
        { status: 400 }
      );
    }

    // Check file type
    const fileName = file.name.toLowerCase();
    if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls')) {
      return NextResponse.json(
        { success: false, error: 'Ongeldig bestandstype. Upload een .xlsx bestand.' },
        { status: 400 }
      );
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { success: false, error: 'Bestand te groot (max 10MB)' },
        { status: 400 }
      );
    }

    // Parse xlsx to rows
    const buffer = await file.arrayBuffer();
    // Dynamic import to keep xlsx out of client bundle
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'array' });

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json(
        { success: false, error: 'Excel bestand bevat geen werkbladen' },
        { status: 400 }
      );
    }

    const sheet = workbook.Sheets[sheetName];
    const rows: (string | number | null)[][] = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      raw: false, // Get formatted strings for proper number parsing
    });

    // Parse the report
    const report = parseSlaughterReport(rows, file.name, reportType);

    // Validate
    const { errors, warnings } = validateSlaughterReport(report);

    if (errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          report_id: null,
          report,
          weight_distributions: [],
          errors,
          warnings,
        } satisfies UploadResult,
        { status: 422 }
      );
    }

    // Insert into Supabase
    const supabase = await createClient();

    // 1. Insert report header
    const { data: insertedReport, error: reportError } = await supabase
      .from('slaughter_reports')
      .insert({
        lot_number: report.lot_number,
        report_type: report.report_type,
        mester: report.mester,
        breed: report.breed,
        barn: report.barn,
        slaughter_date: report.slaughter_date,
        live_count: report.live_count,
        live_weight_kg: report.live_weight_kg,
        avg_live_weight_kg: report.avg_live_weight_kg,
        doa_count: report.doa_count,
        doa_weight_kg: report.doa_weight_kg,
        rejected_count: report.rejected_count,
        rejected_weight_kg: report.rejected_weight_kg,
        cat2_pct: report.cat2_pct,
        cat3_pct: report.cat3_pct,
        total_yield_pct: report.total_yield_pct,
        griller_count: report.griller_count,
        griller_weight_kg: report.griller_weight_kg,
        griller_avg_weight_kg: report.griller_avg_weight_kg,
        griller_yield_pct: report.griller_yield_pct,
        saw_count: report.saw_count,
        pack_count: report.pack_count,
        cutup_count: report.cutup_count,
        source_file: report.source_file,
      })
      .select('id')
      .single();

    if (reportError) {
      // Check for duplicate
      if (reportError.code === '23505') {
        return NextResponse.json(
          {
            success: false,
            report_id: null,
            report,
            weight_distributions: [],
            errors: [`Rapport al geüpload: ${report.lot_number} op ${report.slaughter_date}`],
            warnings,
          } satisfies UploadResult,
          { status: 409 }
        );
      }
      throw reportError;
    }

    const reportId = insertedReport.id;

    // 2. Insert yield lines
    if (report.lines.length > 0) {
      const { error: linesError } = await supabase
        .from('slaughter_report_lines')
        .insert(
          report.lines.map(line => ({
            report_id: reportId,
            section: line.section,
            product_code: line.product_code,
            product_label: line.product_label,
            item_count: line.item_count,
            weight_kg: line.weight_kg,
            avg_weight_kg: line.avg_weight_kg,
            yield_pct: line.yield_pct,
            sort_order: line.sort_order,
          }))
        );

      if (linesError) throw linesError;
    }

    return NextResponse.json({
      success: true,
      report_id: reportId,
      report,
      weight_distributions: [],
      errors: [],
      warnings,
    } satisfies UploadResult);

  } catch (error) {
    console.error('Slaughter report upload error:', error);
    return NextResponse.json(
      {
        success: false,
        report_id: null,
        report: null,
        weight_distributions: [],
        errors: [`Server error: ${error instanceof Error ? error.message : 'Unknown error'}`],
        warnings: [],
      } satisfies UploadResult,
      { status: 500 }
    );
  }
}
