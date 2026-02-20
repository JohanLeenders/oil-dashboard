import { describe, it, expect } from 'vitest';
import { captureFullAvailability } from '../captureFullAvailability';
import type { CascadedAvailability } from '@/lib/engine/availability/cascading';

function makeAvailability(
  overrides?: Partial<CascadedAvailability>
): CascadedAvailability {
  return {
    griller_kg: 1760,
    primary_products: [],
    secondary_products: [],
    total_sold_primary_kg: 0,
    total_forwarded_kg: 0,
    total_cascaded_kg: 0,
    total_loss_kg: 0,
    mass_balance_check: true,
    ...overrides,
  };
}

describe('captureFullAvailability', () => {
  it('nothing_sold — all products returned with full quantities', () => {
    const availability = makeAvailability({
      primary_products: [
        {
          product_id: 'p1',
          product_description: 'Borstkappen',
          primary_available_kg: 500,
          sold_primary_kg: 0,
          oversubscribed_kg: 0,
          forwarded_kg: 500,
          cascaded_children: [],
          processing_loss_kg: 0,
        },
        {
          product_id: 'p2',
          product_description: 'Drumsticks',
          primary_available_kg: 300,
          sold_primary_kg: 0,
          oversubscribed_kg: 0,
          forwarded_kg: 300,
          cascaded_children: [],
          processing_loss_kg: 0,
        },
      ],
      secondary_products: [
        {
          product_id: 'c1',
          product_description: 'Filet met haas',
          available_kg: 200,
          sold_kg: 0,
          net_available_kg: 200,
        },
      ],
    });

    const result = captureFullAvailability(availability);

    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ product_id: 'p1', product_description: 'Borstkappen', quantity_kg: 500 });
    expect(result[1]).toEqual({ product_id: 'p2', product_description: 'Drumsticks', quantity_kg: 300 });
    expect(result[2]).toEqual({ product_id: 'c1', product_description: 'Filet met haas', quantity_kg: 200 });
  });

  it('everything_sold — empty result', () => {
    const availability = makeAvailability({
      primary_products: [
        {
          product_id: 'p1',
          product_description: 'Borstkappen',
          primary_available_kg: 500,
          sold_primary_kg: 500,
          oversubscribed_kg: 0,
          forwarded_kg: 0,
          cascaded_children: [],
          processing_loss_kg: 0,
        },
      ],
      secondary_products: [
        {
          product_id: 'c1',
          product_description: 'Filet',
          available_kg: 200,
          sold_kg: 200,
          net_available_kg: 0,
        },
      ],
    });

    const result = captureFullAvailability(availability);
    expect(result).toHaveLength(0);
  });

  it('oversubscribed — excluded (remaining = 0)', () => {
    const availability = makeAvailability({
      primary_products: [
        {
          product_id: 'p1',
          product_description: 'Borstkappen',
          primary_available_kg: 500,
          sold_primary_kg: 500,
          oversubscribed_kg: 100,
          forwarded_kg: 0,
          cascaded_children: [],
          processing_loss_kg: 0,
        },
      ],
    });

    const result = captureFullAvailability(availability);
    expect(result).toHaveLength(0);
  });

  it('secondary_products_included — when net_available > 0', () => {
    const availability = makeAvailability({
      primary_products: [
        {
          product_id: 'p1',
          product_description: 'Borstkappen',
          primary_available_kg: 500,
          sold_primary_kg: 500,
          oversubscribed_kg: 0,
          forwarded_kg: 0,
          cascaded_children: [],
          processing_loss_kg: 0,
        },
      ],
      secondary_products: [
        {
          product_id: 'c1',
          product_description: 'Filet strip',
          available_kg: 100,
          sold_kg: 30,
          net_available_kg: 70,
        },
      ],
    });

    const result = captureFullAvailability(availability);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      product_id: 'c1',
      product_description: 'Filet strip',
      quantity_kg: 70,
    });
  });

  it('rounding_correct — rounds to 2 decimal places', () => {
    const availability = makeAvailability({
      primary_products: [
        {
          product_id: 'p1',
          product_description: 'Borstkappen',
          primary_available_kg: 333.3333,
          sold_primary_kg: 100.1111,
          oversubscribed_kg: 0,
          forwarded_kg: 233.2222,
          cascaded_children: [],
          processing_loss_kg: 0,
        },
      ],
      secondary_products: [
        {
          product_id: 'c1',
          product_description: 'Filet',
          available_kg: 100.5555,
          sold_kg: 0,
          net_available_kg: 100.5555,
        },
      ],
    });

    const result = captureFullAvailability(availability);

    expect(result).toHaveLength(2);
    // remaining = 333.3333 - 100.1111 = 233.2222 → rounds to 233.22
    expect(result[0].quantity_kg).toBe(233.22);
    // net_available = 100.5555 → rounds to 100.56
    expect(result[1].quantity_kg).toBe(100.56);
  });
});
