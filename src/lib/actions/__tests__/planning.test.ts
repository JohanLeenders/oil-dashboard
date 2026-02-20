import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase client
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockNeq = vi.fn();
const mockMaybeSingle = vi.fn();

const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  update: mockUpdate,
  delete: mockDelete,
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      from: mockFrom,
    })
  ),
}));

// Import after mocks
import { importSlaughterDays, clearSlaughterCalendar } from '@/lib/actions/planning';
import type { SlaughterDayImport } from '@/lib/utils/parseOpzetplanning';

function makeValidRow(overrides?: Partial<SlaughterDayImport>): SlaughterDayImport {
  return {
    slaughter_date: '2026-03-02',
    expected_birds: 5000,
    expected_live_weight_kg: 13250,
    mester_breakdown: [{ mester: 'Klein Hurksveld', birds: 5000, avg_weight_kg: 2.65 }],
    slaughter_location: 'Klein Hurksveld',
    notes: 'Ronde 18',
    ...overrides,
  };
}

describe('importSlaughterDays', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default chain setup for select → eq → eq → maybeSingle
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockReturnValue({ eq: mockEq, maybeSingle: mockMaybeSingle });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });

    // Default insert/update success
    mockInsert.mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: vi.fn().mockResolvedValue({ error: null }) });
  });

  it('import_new_rows_successfully — inserts new rows when no existing data', async () => {
    // select → no existing row
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockInsert.mockResolvedValue({ error: null });

    const rows = [
      makeValidRow({ slaughter_date: '2026-03-02' }),
      makeValidRow({ slaughter_date: '2026-03-09', expected_birds: 4000, expected_live_weight_kg: 10600 }),
    ];

    const result = await importSlaughterDays(rows);

    expect(result.inserted).toBe(2);
    expect(result.updated).toBe(0);
    expect(result.rejected).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('duplicate_detection_updates_existing — updates when row already exists', async () => {
    // select → existing row found
    mockMaybeSingle.mockResolvedValue({
      data: { id: 'existing-uuid-123' },
      error: null,
    });
    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: mockUpdateEq });

    const rows = [makeValidRow()];
    const result = await importSlaughterDays(rows);

    expect(result.inserted).toBe(0);
    expect(result.updated).toBe(1);
    expect(result.rejected).toBe(0);
    expect(result.errors).toHaveLength(0);
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('validation_rejects_invalid_data — rejects rows with invalid fields', async () => {
    const invalidRows = [
      {
        slaughter_date: 'not-a-date',        // bad format
        expected_birds: -100,                 // negative
        expected_live_weight_kg: 13250,
        mester_breakdown: [],
        slaughter_location: 'Test',
      },
    ] as SlaughterDayImport[];

    const result = await importSlaughterDays(invalidRows);

    expect(result.rejected).toBe(1);
    expect(result.inserted).toBe(0);
    expect(result.updated).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('empty_rows_rejected — returns error for empty array', async () => {
    const result = await importSlaughterDays([]);

    expect(result.rejected).toBe(0);
    expect(result.inserted).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('returns_correct_counts — mix of insert, update, and reject', async () => {
    // Row 1: existing → update
    // Row 2: not existing → insert
    // Row 3: not existing → insert fails
    let callCount = 0;
    mockMaybeSingle.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return Promise.resolve({ data: { id: 'existing-1' }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: mockUpdateEq });

    // First insert succeeds, second fails
    let insertCallCount = 0;
    mockInsert.mockImplementation(() => {
      insertCallCount++;
      if (insertCallCount === 1) {
        return Promise.resolve({ error: null });
      }
      return Promise.resolve({ error: { message: 'DB constraint violation' } });
    });

    const rows = [
      makeValidRow({ slaughter_date: '2026-03-02' }),
      makeValidRow({ slaughter_date: '2026-03-09' }),
      makeValidRow({ slaughter_date: '2026-03-16' }),
    ];

    const result = await importSlaughterDays(rows);

    expect(result.updated).toBe(1);
    expect(result.inserted).toBe(1);
    expect(result.rejected).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain('insert mislukt');
  });
});

describe('clearSlaughterCalendar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deletes all rows and returns count', async () => {
    mockSelect.mockReturnValue({ data: null, count: 5, error: null });
    mockDelete.mockReturnValue({ neq: mockNeq });
    mockNeq.mockResolvedValue({ error: null });

    const result = await clearSlaughterCalendar();

    expect(result.deleted).toBe(5);
    expect(result.error).toBeNull();
  });
});
