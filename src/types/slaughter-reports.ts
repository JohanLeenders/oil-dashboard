/**
 * Slaughter Reports — Technical Yield Types
 *
 * Domain: Stage A (Putten slacht: levend → griller → verwerking)
 * Extensible for future stages via report_type:
 *   - 'slacht_putten'  (current)
 *   - 'fileer_putten'  (future: breast cap → filet yields)
 *   - 'fileer_corvoet' (future: external processor yields)
 *
 * Key dimension: mester (farmer) — trends tracked per mester.
 */

// ---------------------------------------------------------------------------
// Report types (extensible)
// ---------------------------------------------------------------------------

export type ReportType = 'slacht_putten' | 'fileer_putten' | 'fileer_corvoet';

// ---------------------------------------------------------------------------
// Yield line sections & product codes
// ---------------------------------------------------------------------------

export type YieldSection = 'cat3' | 'organen' | 'verwerking' | 'in' | 'uit' | 'massabalans';

/** Known product codes for slacht_putten reports */
export type SlachtProductCode =
  // Cat3 by-products
  | 'bloed'
  | 'veren'
  | 'hoofden'
  | 'poten'
  | 'ingewanden'
  // Organen
  | 'nekken'
  | 'levers'
  | 'magen'
  | 'harten'
  // Verwerking (cut-up)
  | 'bouten'
  | 'vleugels'
  | 'b_vleugels'
  | 'c_vleugels'
  | 'vleugeltippen'
  | 'borsten'
  | 'dijen'
  | 'drum'
  | 'achterrug'
  | 'staarten'
  | 'voorrug';

// ---------------------------------------------------------------------------
// Database row types
// ---------------------------------------------------------------------------

export interface SlaughterReport {
  id: string;
  lot_number: string;
  report_type: ReportType;
  mester: string;
  breed: string | null;
  barn: string | null;
  slaughter_date: string; // ISO date string
  // Input (Aanvoer)
  live_count: number | null;
  live_weight_kg: number | null;
  avg_live_weight_kg: number | null;
  doa_count: number;
  doa_weight_kg: number;
  // Rejection (Cat2)
  rejected_count: number;
  rejected_weight_kg: number;
  cat2_pct: number | null;
  // By-products (Cat3 total)
  cat3_pct: number | null;
  // Key yields
  total_yield_pct: number | null;
  griller_count: number | null;
  griller_weight_kg: number | null;
  griller_avg_weight_kg: number | null;
  griller_yield_pct: number | null;
  // Routing
  saw_count: number;
  pack_count: number;
  cutup_count: number;
  // Metadata
  source_file: string | null;
  notes: string | null;
  uploaded_at: string;
  created_at: string;
}

export interface SlaughterReportLine {
  id: string;
  report_id: string;
  section: YieldSection;
  product_code: string;
  product_label: string;
  item_count: number | null;
  weight_kg: number | null;
  avg_weight_kg: number | null;
  yield_pct: number | null;
  sort_order: number;
  created_at: string;
}

export interface WeightDistributionBin {
  lower_g: number;
  upper_g: number;
  count: number;
  pct: number;
}

export interface WeightDistribution {
  id: string;
  report_id: string;
  flock_number: number;
  flock_location: string | null;
  rapport_number: string | null;
  weigher_number: number;
  measured_at: string | null;
  total_count: number | null;
  bins: WeightDistributionBin[];
  created_at: string;
}

// ---------------------------------------------------------------------------
// Enriched types (for UI)
// ---------------------------------------------------------------------------

export interface SlaughterReportWithLines extends SlaughterReport {
  lines: SlaughterReportLine[];
}

export interface SlaughterReportWithAll extends SlaughterReportWithLines {
  weight_distributions: WeightDistribution[];
}

// ---------------------------------------------------------------------------
// Parser types (Excel → structured data)
// ---------------------------------------------------------------------------

/** Raw parsed data from Excel before DB insert */
export interface ParsedSlaughterReport {
  // Header
  lot_number: string;
  report_type: ReportType;
  mester: string;
  breed: string | null;
  barn: string | null;
  slaughter_date: string; // YYYY-MM-DD
  // Aanvoer
  live_count: number;
  live_weight_kg: number;
  avg_live_weight_kg: number;
  doa_count: number;
  doa_weight_kg: number;
  // Slachterij
  rejected_count: number;
  rejected_weight_kg: number;
  cat2_pct: number;
  cat3_pct: number;
  // Key yields
  total_yield_pct: number;
  griller_count: number;
  griller_weight_kg: number;
  griller_avg_weight_kg: number;
  griller_yield_pct: number;
  // Routing
  saw_count: number;
  pack_count: number;
  cutup_count: number;
  // Lines
  lines: ParsedYieldLine[];
  // Source
  source_file: string;
}

export interface ParsedYieldLine {
  section: YieldSection;
  product_code: string;
  product_label: string;
  item_count: number | null;
  weight_kg: number | null;
  avg_weight_kg: number | null;
  yield_pct: number | null;
  sort_order: number;
}

/** Raw parsed weight distribution from PDF */
export interface ParsedWeightDistribution {
  flock_number: number;
  flock_location: string | null;
  rapport_number: string | null;
  weigher_number: number;
  measured_at: string | null; // ISO timestamp
  total_count: number;
  bins: WeightDistributionBin[];
}

// ---------------------------------------------------------------------------
// Trend aggregation types (for charts)
// ---------------------------------------------------------------------------

/** One data point in a mester trend chart */
export interface MesterTrendPoint {
  mester: string;
  slaughter_date: string;
  lot_number: string;
  live_count: number;
  avg_live_weight_kg: number;
  total_yield_pct: number;
  griller_yield_pct: number;
  cat2_pct: number;
  griller_avg_weight_kg: number;
}

/** Summary per mester across all reports */
export interface MesterSummary {
  mester: string;
  report_count: number;
  total_birds: number;
  avg_live_weight_kg: number;
  avg_total_yield_pct: number;
  avg_griller_yield_pct: number;
  avg_cat2_pct: number;
  latest_slaughter_date: string;
}

// ---------------------------------------------------------------------------
// Upload response types
// ---------------------------------------------------------------------------

export interface UploadResult {
  success: boolean;
  report_id: string | null;
  report: ParsedSlaughterReport | null;
  weight_distributions: ParsedWeightDistribution[];
  errors: string[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// UI display helpers
// ---------------------------------------------------------------------------

/** Dutch labels for product codes */
export const PRODUCT_LABELS: Record<string, string> = {
  // Cat3
  bloed: 'Bloed',
  veren: 'Veren',
  hoofden: 'Hoofden',
  poten: 'Poten',
  ingewanden: 'Ingewanden',
  // Organen
  nekken: 'Nekken',
  levers: 'Levers',
  magen: 'Magen',
  harten: 'Harten',
  // Verwerking
  bouten: 'Bouten',
  vleugels: 'Vleugels',
  b_vleugels: 'B Vleugels',
  c_vleugels: 'C Vleugels',
  vleugeltippen: 'Vleugeltippen',
  borsten: 'Borsten',
  dijen: 'Dijen',
  drum: 'Drum',
  achterrug: 'Achterrug',
  staarten: 'Staarten',
  voorrug: 'Voorrug',
};

/** Section display names */
export const SECTION_LABELS: Record<string, string> = {
  cat3: 'Cat3 By-products',
  organen: 'Organen',
  verwerking: 'Verwerking',
  in: 'In',
  uit: 'Uit',
  massabalans: 'Massabalans',
};

// ---------------------------------------------------------------------------
// Corvoet massabalans types
// ---------------------------------------------------------------------------

/** Parsed Corvoet massabalans report (Excel → structured data) */
export interface ParsedCorvoetReport {
  week_number: number;
  year: number;
  processing_date: string; // YYYY-MM-DD (Monday of that week)
  source_file: string;
  // Input
  borstkappen_in_kg: number;
  dijenvlees_in_kg: number;
  total_in_kg: number;
  // Output
  total_uit_kg: number;
  // Key rendement (from massabalans section)
  filet_yield_pct: number;
  vellen_yield_pct: number;
  dijenvlees_yield_pct: number | null;
  // Detail lines
  in_lines: { artikel: string; afleveradres: string; netto_kg: number }[];
  uit_lines: { artikel: string; afleveradres: string; netto_kg: number }[];
}

/** Corvoet upload result */
export interface CorvoetUploadResult {
  success: boolean;
  report_id: string | null;
  report: ParsedCorvoetReport | null;
  errors: string[];
  warnings: string[];
}
