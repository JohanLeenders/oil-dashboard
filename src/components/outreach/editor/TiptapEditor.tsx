'use client';

/**
 * TiptapEditor — Brand-locked rich text editor for Oranjehoen updates.
 *
 * Design constraints:
 * - No font changes (locked to Inter/JetBrains Mono/Playfair Display)
 * - No color changes (locked to OIL Design Tokens)
 * - No layout changes (locked to Premium Minimal D1 style)
 * - Users can: write text, headings, bold, italic, lists, add product blocks, add images
 * - Users cannot: change fonts, colors, layout, custom CSS
 *
 * Output: Tiptap JSON document (TiptapDocument type)
 */

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import { ProductBlockExtension } from './ProductBlock';
import type { TiptapDocument } from '@/types/outreach';
import './editorStyles.css';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface TiptapEditorProps {
  /** Initial content (Tiptap JSON) */
  content?: TiptapDocument;
  /** Called on every content change with the new JSON document */
  onChange?: (doc: TiptapDocument) => void;
  /** Placeholder text when editor is empty */
  placeholder?: string;
  /** Whether the editor is read-only (for preview) */
  readOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Toolbar Button
// ---------------------------------------------------------------------------

function ToolbarBtn({
  onClick,
  isActive,
  title,
  children,
}: {
  onClick: () => void;
  isActive?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`tiptap-toolbar-btn ${isActive ? 'is-active' : ''}`}
      title={title}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Main Editor Component
// ---------------------------------------------------------------------------

export default function TiptapEditor({
  content,
  onChange,
  placeholder = 'Begin met schrijven...',
  readOnly = false,
}: TiptapEditorProps) {
  const editor = useEditor({
    // Prevent SSR hydration mismatch — render only on client
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // Disable code block — not needed for outreach
        codeBlock: false,
        code: false,
      }),
      Image.configure({
        HTMLAttributes: {
          class: 'tiptap-image',
        },
      }),
      Placeholder.configure({
        placeholder,
      }),
      ProductBlockExtension,
    ],
    content: content ?? {
      type: 'doc',
      content: [{ type: 'paragraph' }],
    },
    editable: !readOnly,
    onUpdate: ({ editor: ed }) => {
      if (onChange) {
        onChange(ed.getJSON() as TiptapDocument);
      }
    },
  });

  if (!editor) return null;

  const charCount = editor.storage.characterCount?.characters?.() ?? editor.getText().length;

  return (
    <div className="tiptap-editor-wrapper">
      {/* Toolbar — only show when editable */}
      {!readOnly && (
        <div className="tiptap-toolbar">
          {/* Text formatting */}
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            isActive={editor.isActive('heading', { level: 2 })}
            title="Koptekst (H2)"
          >
            H2
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            isActive={editor.isActive('heading', { level: 3 })}
            title="Subkop (H3)"
          >
            H3
          </ToolbarBtn>

          <div className="tiptap-toolbar-divider" />

          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleBold().run()}
            isActive={editor.isActive('bold')}
            title="Vet (Ctrl+B)"
          >
            <strong>B</strong>
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleItalic().run()}
            isActive={editor.isActive('italic')}
            title="Cursief (Ctrl+I)"
          >
            <em>I</em>
          </ToolbarBtn>

          <div className="tiptap-toolbar-divider" />

          {/* Lists */}
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleBulletList().run()}
            isActive={editor.isActive('bulletList')}
            title="Opsomming"
          >
            •
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
            isActive={editor.isActive('orderedList')}
            title="Genummerde lijst"
          >
            1.
          </ToolbarBtn>

          <div className="tiptap-toolbar-divider" />

          {/* Block elements */}
          <ToolbarBtn
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            isActive={editor.isActive('blockquote')}
            title="Citaat"
          >
            &ldquo;
          </ToolbarBtn>
          <ToolbarBtn
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
            title="Horizontale lijn"
          >
            ―
          </ToolbarBtn>

          <div className="tiptap-toolbar-divider" />

          {/* Product block */}
          <ToolbarBtn
            onClick={() => {
              editor
                .chain()
                .focus()
                .insertContent({
                  type: 'productBlock',
                  attrs: {
                    productName: '',
                    description: '',
                    pricePerKg: null,
                    unit: 'kg',
                    imageUrl: null,
                    productId: null,
                    source: 'manual',
                  },
                })
                .run();
            }}
            title="Productblok toevoegen"
          >
            🍗
          </ToolbarBtn>

          {/* Image */}
          <ToolbarBtn
            onClick={() => {
              const url = window.prompt('Afbeelding URL (publieke link):');
              if (url) {
                editor.chain().focus().setImage({ src: url }).run();
              }
            }}
            title="Afbeelding toevoegen"
          >
            📷
          </ToolbarBtn>
        </div>
      )}

      {/* Editor content */}
      <EditorContent editor={editor} className="tiptap-content" />

      {/* Footer */}
      {!readOnly && (
        <div className="tiptap-footer">
          <span className="tiptap-char-count">{charCount} tekens</span>
          <span className="tiptap-char-count" style={{ color: 'var(--color-text-dim)' }}>
            Premium Minimal — Oranjehoen
          </span>
        </div>
      )}
    </div>
  );
}
