'use client';

/**
 * ProductBlock — Custom Tiptap node extension for product cards.
 * Renders a styled product card inside the editor.
 * Products can be entered manually or selected from the database.
 *
 * Stored as a node in the Tiptap JSON document:
 * {
 *   type: 'productBlock',
 *   attrs: {
 *     productName: 'Kipfilet',
 *     description: 'Verse kipfilet, vacuüm verpakt',
 *     pricePerKg: 5.50,
 *     unit: 'kg',
 *     imageUrl: 'https://...',
 *     productId: null,
 *     source: 'manual'
 *   }
 * }
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';

// ---------------------------------------------------------------------------
// Node View Component (what renders in the editor)
// ---------------------------------------------------------------------------

function ProductBlockView({ node, updateAttributes, deleteNode, selected }: NodeViewProps) {
  const { productName, description, pricePerKg, unit, imageUrl, source } = node.attrs;

  return (
    <NodeViewWrapper className="product-block-wrapper" data-drag-handle>
      <div
        className={`product-block ${selected ? 'product-block--selected' : ''}`}
        style={{
          background: 'rgba(39, 39, 42, 0.6)',
          border: `1px solid ${selected ? 'var(--color-oil-orange)' : 'var(--color-border-subtle)'}`,
          borderRadius: '8px',
          padding: '16px',
          margin: '8px 0',
          display: 'flex',
          gap: '12px',
          alignItems: 'flex-start',
          transition: 'border-color 0.15s ease',
        }}
      >
        {/* Product image placeholder — Next.js Image not usable in Tiptap NodeView */}
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={productName || 'Product'}
            style={{
              width: '64px',
              height: '64px',
              objectFit: 'cover',
              borderRadius: '6px',
              flexShrink: 0,
            }}
          />
        ) : (
          <div
            style={{
              width: '64px',
              height: '64px',
              background: 'rgba(249, 115, 22, 0.1)',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: '24px',
            }}
          >
            🍗
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <input
            type="text"
            value={productName || ''}
            onChange={(e) => updateAttributes({ productName: e.target.value })}
            placeholder="Productnaam"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-main)',
              fontWeight: 600,
              fontSize: '14px',
              width: '100%',
              outline: 'none',
              padding: 0,
            }}
          />
          <input
            type="text"
            value={description || ''}
            onChange={(e) => updateAttributes({ description: e.target.value })}
            placeholder="Korte beschrijving..."
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-muted)',
              fontSize: '12px',
              width: '100%',
              outline: 'none',
              padding: 0,
              marginTop: '4px',
            }}
          />
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: 'var(--color-text-dim)', fontSize: '11px' }}>€</span>
              <input
                type="number"
                step="0.01"
                value={pricePerKg ?? ''}
                onChange={(e) =>
                  updateAttributes({
                    pricePerKg: e.target.value ? parseFloat(e.target.value) : null,
                  })
                }
                placeholder="0,00"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-oil-orange)',
                  fontFamily: 'var(--font-mono, monospace)',
                  fontWeight: 600,
                  fontSize: '13px',
                  width: '60px',
                  outline: 'none',
                  padding: 0,
                }}
              />
              <span style={{ color: 'var(--color-text-dim)', fontSize: '11px' }}>
                /{unit || 'kg'}
              </span>
            </div>
            {source === 'database' && (
              <span
                style={{
                  fontSize: '10px',
                  color: 'var(--color-data-green)',
                  background: 'rgba(16, 185, 129, 0.1)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                }}
              >
                uit database
              </span>
            )}
          </div>
        </div>

        {/* Delete button */}
        <button
          type="button"
          onClick={deleteNode}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--color-text-dim)',
            cursor: 'pointer',
            padding: '4px',
            fontSize: '16px',
            lineHeight: 1,
            flexShrink: 0,
          }}
          title="Verwijder productblok"
        >
          ×
        </button>
      </div>
    </NodeViewWrapper>
  );
}

// ---------------------------------------------------------------------------
// Tiptap Node Extension
// ---------------------------------------------------------------------------

export const ProductBlockExtension = Node.create({
  name: 'productBlock',
  group: 'block',
  atom: true,       // Not editable inline — uses NodeView
  draggable: true,

  addAttributes() {
    return {
      productName: { default: '' },
      description: { default: '' },
      pricePerKg: { default: null },
      unit: { default: 'kg' },
      imageUrl: { default: null },
      productId: { default: null },
      source: { default: 'manual' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-product-block]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-product-block': '' })];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ProductBlockView);
  },
});

export default ProductBlockExtension;
