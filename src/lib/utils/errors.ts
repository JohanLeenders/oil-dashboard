/**
 * Error Logging Utilities
 *
 * Provides structured error logging for Supabase operations
 * to improve debugging without changing runtime behavior.
 */

import type { PostgrestError } from '@supabase/supabase-js';

/**
 * Log Supabase error with structured context
 *
 * @param error - Supabase error object
 * @param context - Context string (e.g., "Failed to fetch customers")
 */
export function logSupabaseError(error: PostgrestError, context: string): void {
  console.error(`[Supabase Error] ${context}`, {
    message: error.message,
    code: error.code,
    details: error.details,
    hint: error.hint,
  });
}
