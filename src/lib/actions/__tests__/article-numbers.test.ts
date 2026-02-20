import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Supabase
// ---------------------------------------------------------------------------

const mockData: Record<string, any[]> = {};
let lastTable = '';
let lastFilters: Record<string, any> = {};

function makeChainable(resolveData: () => any[]) {
  const obj: Record<string, any> = {};
  obj.select = (..._args: any[]) => obj;
  obj.eq = (col: string, val: any) => {
    lastFilters[col] = val;
    return obj;
  };
  obj.in = (col: string, vals: any[]) => {
    lastFilters[col] = vals;
    return obj;
  };
  obj.then = (resolve: any, reject?: any) => {
    try {
      const data = resolveData();
      return Promise.resolve({ data, error: null }).then(resolve, reject);
    } catch (e) {
      return Promise.resolve({ data: null, error: { message: String(e) } }).then(resolve, reject);
    }
  };
  return obj;
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      from: (table: string) => {
        lastTable = table;
        lastFilters = {};
        return makeChainable(() => {
          if (lastTable === 'product_article_numbers') {
            let result = mockData['product_article_numbers'] ?? [];
            if (lastFilters['location']) {
              result = result.filter((r) => r.location === lastFilters['location']);
            }
            if (lastFilters['product_id']) {
              const ids = lastFilters['product_id'];
              result = result.filter((r) => ids.includes(r.product_id));
            }
            return result;
          }
          return [];
        });
      },
    })
  ),
}));

import { getArticleNumbersForProducts, getArticleNumbersByLocation } from '@/lib/actions/article-numbers';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const PRODUCT_FILET = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const PRODUCT_DRUM = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const PRODUCT_UNKNOWN = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const ARTICLE_NUMBERS = [
  {
    id: '1',
    product_id: PRODUCT_FILET,
    location: 'nijkerk',
    article_type: 'vacuum',
    article_number: '540457',
    packaging_size: '15kg',
    created_at: '2026-02-20',
    products: { description: 'Kipfilet vacuum' },
  },
  {
    id: '2',
    product_id: PRODUCT_FILET,
    location: 'nijkerk',
    article_type: 'niet_vacuum',
    article_number: '540327',
    packaging_size: '15kg',
    created_at: '2026-02-20',
    products: { description: 'Kipfilet vacuum' },
  },
  {
    id: '3',
    product_id: PRODUCT_DRUM,
    location: 'putten',
    article_type: 'niet_vacuum',
    article_number: '442133',
    packaging_size: '10kg',
    created_at: '2026-02-20',
    products: { description: 'Drumstick 10kg bulk' },
  },
  {
    id: '4',
    product_id: PRODUCT_DRUM,
    location: 'nijkerk',
    article_type: 'niet_vacuum',
    article_number: '442140',
    packaging_size: '15kg',
    created_at: '2026-02-20',
    products: { description: 'Drumstick' },
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('article-numbers server actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockData['product_article_numbers'] = [...ARTICLE_NUMBERS];
  });

  it('returns article numbers for known product IDs', async () => {
    const result = await getArticleNumbersForProducts([PRODUCT_FILET]);
    expect(result.length).toBe(2);
    expect(result.every((r) => r.product_id === PRODUCT_FILET)).toBe(true);
  });

  it('filters by location correctly', async () => {
    const puttenResult = await getArticleNumbersByLocation('putten');
    expect(puttenResult.length).toBe(1);
    expect(puttenResult[0].article_number).toBe('442133');

    const nijkerkResult = await getArticleNumbersByLocation('nijkerk');
    expect(nijkerkResult.length).toBe(3);
  });

  it('returns both vacuum and niet_vacuum variants', async () => {
    const result = await getArticleNumbersForProducts([PRODUCT_FILET]);
    const types = result.map((r) => r.article_type);
    expect(types).toContain('vacuum');
    expect(types).toContain('niet_vacuum');
  });

  it('returns empty for unknown product IDs', async () => {
    const result = await getArticleNumbersForProducts([PRODUCT_UNKNOWN]);
    expect(result).toHaveLength(0);
  });

  it('includes product description in joined result', async () => {
    const result = await getArticleNumbersByLocation('putten');
    expect(result[0].product_description).toBe('Drumstick 10kg bulk');
  });
});
