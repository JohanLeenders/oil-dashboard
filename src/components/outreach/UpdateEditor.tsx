'use client';

/**
 * UpdateEditor — Full-screen editor for creating/editing outreach updates.
 * Uses TiptapEditor for rich content with locked brand styling.
 *
 * Features:
 * - Template selection (structured templates with block schemas)
 * - Auto-save draft (debounced)
 * - Title editing
 * - Status indicator
 * - Back to list navigation
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import dynamic from 'next/dynamic';
import type {
  OutreachUpdate,
  OutreachTemplate,
  TiptapDocument,
  OutreachTemplateType,
} from '@/types/outreach';
import { createUpdate, saveUpdate } from '@/lib/actions/outreach';
import { prepareUpdateForDispatch } from '@/lib/actions/outreach-dispatch';

// Dynamic import: Tiptap is client-only, avoid SSR
const TiptapEditor = dynamic(
  () => import('@/components/outreach/editor/TiptapEditor'),
  { ssr: false, loading: () => <EditorSkeleton /> },
);

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface UpdateEditorProps {
  /** Existing update to edit (null = create new) */
  update: OutreachUpdate | null;
  /** Available structured templates */
  templates: OutreachTemplate[];
  /** Called when user navigates back to list */
  onBack: () => void;
  /** Called after successful save with the updated record */
  onSaved: (update: OutreachUpdate) => void;
  /** Current user name (simple text, no auth) */
  userName?: string;
}

// ---------------------------------------------------------------------------
// Template type labels and descriptions
// ---------------------------------------------------------------------------

const TEMPLATE_PRESETS: Record<OutreachTemplateType, { label: string; description: string; icon: string }> = {
  wekelijkse_update: {
    label: 'Wekelijkse update',
    description: 'Standaard weekbericht met productaanbod en nieuws',
    icon: '📋',
  },
  batch_spotlight: {
    label: 'Batch spotlight',
    description: 'Uitgelichte batch met productdetails en beschikbaarheid',
    icon: '🔦',
  },
  persoonlijke_followup: {
    label: 'Persoonlijke follow-up',
    description: 'Persoonlijk bericht naar een specifieke klant',
    icon: '✉️',
  },
};

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function UpdateEditor({
  update: initialUpdate,
  templates,
  onBack,
  onSaved,
  userName,
}: UpdateEditorProps) {
  const [update, setUpdate] = useState(initialUpdate);
  const [title, setTitle] = useState(initialUpdate?.title ?? '');
  const [content, setContent] = useState<TiptapDocument>(
    initialUpdate?.content ?? { type: 'doc', content: [{ type: 'paragraph' }] },
  );
  const [selectedTemplateId, setSelectedTemplateId] = useState(initialUpdate?.template_id ?? null);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showTemplateSelect, setShowTemplateSelect] = useState(!initialUpdate);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchError, setDispatchError] = useState<string | null>(null);

  // Debounced auto-save
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSave = useCallback(async (
    titleVal: string,
    contentVal: TiptapDocument,
    templateId: string | null,
  ) => {
    setSaving(true);
    try {
      if (update) {
        // Update existing
        const saved = await saveUpdate(update.id, {
          title: titleVal,
          content: contentVal,
          modified_by: userName,
        });
        setUpdate(saved);
        onSaved(saved);
      } else {
        // Create new
        const created = await createUpdate({
          template_id: templateId ?? undefined,
          title: titleVal || 'Nieuw concept',
          content: contentVal,
          target_type: 'bulk',
          created_by: userName,
        });
        setUpdate(created);
        onSaved(created);
      }
      setLastSaved(new Date());
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  }, [update, userName, onSaved]);

  // Auto-save on content change (debounced 2s)
  const scheduleAutoSave = useCallback((titleVal: string, contentVal: TiptapDocument) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      doSave(titleVal, contentVal, selectedTemplateId);
    }, 2000);
  }, [doSave, selectedTemplateId]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  function handleTitleChange(newTitle: string) {
    setTitle(newTitle);
    scheduleAutoSave(newTitle, content);
  }

  function handleContentChange(newContent: TiptapDocument) {
    setContent(newContent);
    scheduleAutoSave(title, newContent);
  }

  function handleSelectTemplate(template: OutreachTemplate) {
    setSelectedTemplateId(template.id);
    setShowTemplateSelect(false);
    // Load default content from template
    if (template.default_content) {
      setContent(template.default_content);
    }
    // Set title based on template type
    if (template.template_type) {
      const preset = TEMPLATE_PRESETS[template.template_type];
      if (preset && !title) {
        setTitle(`${preset.label} — ${new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}`);
      }
    }
  }

  function handleStartBlank() {
    setShowTemplateSelect(false);
    if (!title) {
      setTitle(`Update — ${new Date().toLocaleDateString('nl-NL', { day: 'numeric', month: 'long' })}`);
    }
  }

  async function handleManualSave() {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    await doSave(title, content, selectedTemplateId);
  }

  async function handlePrepareDispatch() {
    if (!update) return;
    // First save current content
    await handleManualSave();
    setDispatching(true);
    setDispatchError(null);
    try {
      const result = await prepareUpdateForDispatch(update.id, userName);
      if (result.success) {
        // Refresh update state to reflect status change
        setUpdate((prev) => prev ? { ...prev, status: 'ready' as const } : prev);
        if (update) {
          onSaved({ ...update, status: 'ready' as const });
        }
      } else {
        setDispatchError(result.error ?? 'Onbekende fout');
      }
    } catch (err) {
      setDispatchError(err instanceof Error ? err.message : 'Onbekende fout');
    } finally {
      setDispatching(false);
    }
  }

  // ── Template selection screen ──
  if (showTemplateSelect) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onBack}
            className="text-sm px-3 py-1.5 rounded-lg"
            style={{ color: 'var(--color-text-muted)', background: 'var(--color-bg-elevated)' }}
          >
            ← Terug
          </button>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--color-text-main)' }}>
            Nieuwe update
          </h2>
        </div>

        <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Kies een template als startpunt, of begin met een leeg canvas.
        </p>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {/* Structured templates from DB */}
          {templates.filter((t) => t.template_type).map((t) => {
            const preset = t.template_type ? TEMPLATE_PRESETS[t.template_type] : null;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleSelectTemplate(t)}
                className="oil-card oil-card-interactive p-5 text-left"
              >
                <div className="text-2xl mb-2">{preset?.icon ?? '📄'}</div>
                <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-main)' }}>
                  {preset?.label ?? t.name}
                </h3>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  {preset?.description ?? 'Template'}
                </p>
              </button>
            );
          })}

          {/* Blank option — always available */}
          <button
            type="button"
            onClick={handleStartBlank}
            className="oil-card oil-card-interactive p-5 text-left"
            style={{ borderStyle: 'dashed' }}
          >
            <div className="text-2xl mb-2">✨</div>
            <h3 className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text-main)' }}>
              Leeg canvas
            </h3>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Begin met een leeg document en schrijf vrij
            </p>
          </button>
        </div>
      </div>
    );
  }

  // ── Editor screen ──
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="text-sm px-3 py-1.5 rounded-lg"
            style={{ color: 'var(--color-text-muted)', background: 'var(--color-bg-elevated)' }}
          >
            ← Terug
          </button>

          {/* Status */}
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-medium"
            style={{
              background: update?.status === 'sent'
                ? 'rgba(16, 185, 129, 0.15)'
                : 'rgba(161, 161, 170, 0.15)',
              color: update?.status === 'sent'
                ? 'var(--color-data-green)'
                : 'var(--color-text-muted)',
            }}
          >
            {update?.status === 'sent'
              ? 'Verzonden'
              : update?.status === 'ready'
                ? 'Klaar voor verzenden'
                : 'Concept'}
          </span>

          {/* Save indicator */}
          <span className="text-[11px]" style={{ color: 'var(--color-text-dim)' }}>
            {saving
              ? 'Opslaan...'
              : lastSaved
                ? `Opgeslagen ${lastSaved.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit' })}`
                : ''}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleManualSave}
            disabled={saving || update?.status === 'sent'}
            className="px-4 py-2 text-sm font-medium rounded-lg"
            style={{
              background: 'var(--color-bg-elevated)',
              color: 'var(--color-text-main)',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Opslaan...' : 'Opslaan'}
          </button>

          {update && update.status === 'draft' && (
            <button
              type="button"
              onClick={handlePrepareDispatch}
              disabled={dispatching || saving}
              className="px-4 py-2 text-sm font-medium rounded-lg"
              style={{
                background: 'var(--color-oil-orange)',
                color: 'white',
                opacity: dispatching ? 0.6 : 1,
              }}
            >
              {dispatching ? 'Klaarzetten...' : '📤 Klaarzetten'}
            </button>
          )}
        </div>
      </div>

      {/* Dispatch error */}
      {dispatchError && (
        <div
          className="px-4 py-3 rounded-lg text-sm"
          style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444' }}
        >
          {dispatchError}
        </div>
      )}

      {/* Title */}
      <input
        type="text"
        value={title}
        onChange={(e) => handleTitleChange(e.target.value)}
        placeholder="Titel van je update..."
        className="w-full text-xl font-semibold bg-transparent border-none outline-none"
        style={{ color: 'var(--color-text-main)' }}
      />

      {/* Editor */}
      <TiptapEditor
        content={content}
        onChange={handleContentChange}
        placeholder="Begin met schrijven... Gebruik de toolbar voor productblokken en opmaak."
        readOnly={update?.status === 'sent'}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function EditorSkeleton() {
  return (
    <div
      className="animate-pulse rounded-xl"
      style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-border-subtle)',
        height: '400px',
      }}
    >
      <div className="p-4 space-y-3">
        <div className="h-8 rounded" style={{ background: 'var(--color-bg-elevated)', width: '60%' }} />
        <div className="h-4 rounded" style={{ background: 'var(--color-bg-elevated)', width: '90%' }} />
        <div className="h-4 rounded" style={{ background: 'var(--color-bg-elevated)', width: '75%' }} />
        <div className="h-4 rounded" style={{ background: 'var(--color-bg-elevated)', width: '40%' }} />
      </div>
    </div>
  );
}

export default UpdateEditor;
