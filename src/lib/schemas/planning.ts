import { z } from 'zod';

export const slaughterDayImportRowSchema = z.object({
  slaughter_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expected_birds: z.number().int().min(0).max(200_000),
  expected_live_weight_kg: z.number().positive().max(600_000),
  mester_breakdown: z.array(z.object({
    mester: z.string(),
    birds: z.number().int().min(0),
    avg_weight_kg: z.number().positive(),
  })).default([]),
  slaughter_location: z.string().max(200).optional(),
  notes: z.string().max(500).optional(),
});

export const importSlaughterDaysSchema = z.object({
  rows: z.array(slaughterDayImportRowSchema).min(1).max(100),
});

export type SlaughterDayImportRow = z.infer<typeof slaughterDayImportRowSchema>;
