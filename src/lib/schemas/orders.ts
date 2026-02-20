/**
 * Zod Validation Schemas — Orders Module
 * Sprint: Wave 4 — A6-S3 (Input Validation Audit)
 *
 * Validates all WRITE action inputs in src/lib/actions/orders.ts
 * READ actions do not need input validation (params are UUIDs only).
 */

import { z } from 'zod';

// ============================================================================
// Shared primitives
// ============================================================================

/** UUID v4 format */
const uuidSchema = z.string().uuid();

// ============================================================================
// createCustomerOrder
// ============================================================================

export const createCustomerOrderSchema = z.object({
  slaughterId: uuidSchema,
  customerId: uuidSchema,
  notes: z.string().max(2000).optional(),
});

export type CreateCustomerOrderInput = z.infer<typeof createCustomerOrderSchema>;

// ============================================================================
// addOrderLine
// ============================================================================

export const addOrderLineSchema = z.object({
  orderId: uuidSchema,
  productId: uuidSchema,
  quantityKg: z.number().positive().max(100_000),
});

export type AddOrderLineInput = z.infer<typeof addOrderLineSchema>;

// ============================================================================
// removeOrderLine
// ============================================================================

export const removeOrderLineSchema = z.object({
  lineId: uuidSchema,
});

export type RemoveOrderLineInput = z.infer<typeof removeOrderLineSchema>;

// ============================================================================
// createDraftSnapshot
// ============================================================================

export const createDraftSnapshotSchema = z.object({
  slaughterId: uuidSchema,
});

export type CreateDraftSnapshotInput = z.infer<typeof createDraftSnapshotSchema>;

// ============================================================================
// finalizeSnapshot
// ============================================================================

export const finalizeSnapshotSchema = z.object({
  slaughterId: uuidSchema,
  draftSnapshotId: uuidSchema,
});

export type FinalizeSnapshotInput = z.infer<typeof finalizeSnapshotSchema>;

// ============================================================================
// READ action param schemas (UUID-only, for consistency)
// ============================================================================

export const getOrdersForSlaughterSchema = z.object({
  slaughterId: uuidSchema,
});

export const getOrderLinesSchema = z.object({
  orderId: uuidSchema,
});

export const getSnapshotsForSlaughterSchema = z.object({
  slaughterId: uuidSchema,
});

export const getSlaughterDetailSchema = z.object({
  id: uuidSchema,
});

// ============================================================================
// updateOrderLine
// ============================================================================

export const updateOrderLineSchema = z.object({
  lineId: uuidSchema,
  quantityKg: z.number().positive().max(100_000),
});

export type UpdateOrderLineInput = z.infer<typeof updateOrderLineSchema>;
