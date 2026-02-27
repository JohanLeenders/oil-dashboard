'use client';

/**
 * OutreachClient — Wave 10 + Wave 11 Outreach tab shell
 * Tabs: Updates | Campagnes | Templates | Klanten
 * Wave 11: "Updates" tab is now the primary view with the Update Engine.
 */

import { useState, useCallback, useEffect } from 'react';
import type { OutreachCampaignWithTemplates, OutreachTemplate, OutreachUpdate, OutreachUpdateWithDetails } from '@/types/outreach';
import type { OutreachCustomer } from '@/lib/actions/outreach';
import { CampaignCard } from '@/components/outreach/CampaignCard';
import { TemplateForm } from '@/components/outreach/TemplateForm';
import { UpdateCard } from '@/components/outreach/UpdateCard';
import { UpdateEditor } from '@/components/outreach/UpdateEditor';

type Tab = 'updates' | 'campaigns' | 'templates' | 'customers';

interface OutreachClientProps {
  campaigns: OutreachCampaignWithTemplates[];
  templates: OutreachTemplate[];
  customers: OutreachCustomer[];
  updates: OutreachUpdateWithDetails[];
  structuredTemplates: OutreachTemplate[];
}

export default function OutreachClient({
  campaigns,
  templates,
  customers,
  updates: initialUpdates,
  structuredTemplates,
}: OutreachClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>('updates');
  const [localTemplates, setLocalTemplates] = useState<OutreachTemplate[]>(templates);
  const [localUpdates, setLocalUpdates] = useState<OutreachUpdateWithDetails[]>(initialUpdates);
  const [showNewForm, setShowNewForm] = useState(false);
  const [editTemplate, setEditTemplate] = useState<OutreachTemplate | null>(null);

  // Update editor state
  const [editingUpdateId, setEditingUpdateId] = useState<string | null>(null);
  const [creatingNew, setCreatingNew] = useState(false);

  // Team tracking: simple localStorage-persisted username
  const [userName, setUserName] = useState('');
  useEffect(() => {
    const stored = localStorage.getItem('oil-outreach-username');
    if (stored) setUserName(stored);
  }, []);
  function handleUserNameChange(name: string) {
    setUserName(name);
    localStorage.setItem('oil-outreach-username', name);
  }

  function handleTemplateSuccess(t: OutreachTemplate) {
    setLocalTemplates((prev) => {
      const idx = prev.findIndex((x) => x.id === t.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = t;
        return next;
      }
      return [t, ...prev];
    });
    setShowNewForm(false);
    setEditTemplate(null);
  }

  const handleUpdateSaved = useCallback((saved: OutreachUpdate) => {
    setLocalUpdates((prev) => {
      const idx = prev.findIndex((u) => u.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], ...saved };
        return next;
      }
      // New update — add to top
      return [{
        ...saved,
        template: null,
        recipient_count: 0,
        dispatched_count: 0,
        delivered_count: 0,
        failed_count: 0,
      } as OutreachUpdateWithDetails, ...prev];
    });
  }, []);

  function handleBackFromEditor() {
    setEditingUpdateId(null);
    setCreatingNew(false);
  }

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'updates',    label: 'Updates',    count: localUpdates.length },
    { key: 'campaigns',  label: 'Campagnes',  count: campaigns.length },
    { key: 'templates',  label: 'Templates',  count: localTemplates.length },
    { key: 'customers',  label: 'Klanten',    count: customers.length },
  ];

  // ── If editing an update, show the editor full-width ──
  if (editingUpdateId || creatingNew) {
    const existingUpdate = editingUpdateId
      ? (localUpdates.find((u) => u.id === editingUpdateId) as OutreachUpdate | undefined) ?? null
      : null;

    return (
      <UpdateEditor
        update={existingUpdate}
        templates={structuredTemplates}
        onBack={handleBackFromEditor}
        onSaved={handleUpdateSaved}
        userName={userName || undefined}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab bar */}
      <div className="flex gap-1 border-b" style={{ borderColor: 'var(--color-border-subtle)' }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className="px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px"
            style={{
              borderColor: activeTab === tab.key ? 'var(--color-oil-orange)' : 'transparent',
              color: activeTab === tab.key ? 'var(--color-oil-orange)' : 'var(--color-text-muted)',
            }}
          >
            {tab.label}
            <span
              className="ml-2 text-xs px-1.5 py-0.5 rounded-full"
              style={{ background: 'var(--color-bg-elevated)', color: 'var(--color-text-dim)' }}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── UPDATES TAB (Wave 11) ─────────────────────────────── */}
      {activeTab === 'updates' && (
        <div className="space-y-4">
          {/* Performance overview + team */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <PerformanceStat
              label="Concepten"
              value={localUpdates.filter((u) => u.status === 'draft').length}
              icon="📝"
            />
            <PerformanceStat
              label="Klaar"
              value={localUpdates.filter((u) => u.status === 'ready' || u.status === 'sending').length}
              icon="📤"
            />
            <PerformanceStat
              label="Verzonden"
              value={localUpdates.filter((u) => u.status === 'sent').length}
              icon="✅"
              color="var(--color-data-green)"
            />
            <PerformanceStat
              label="Afgeleverd"
              value={localUpdates.reduce((sum, u) => sum + u.delivered_count, 0)}
              icon="📬"
              color="var(--color-data-green)"
            />
          </div>

          {/* Team user name */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <label className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
                Naam:
              </label>
              <input
                type="text"
                value={userName}
                onChange={(e) => handleUserNameChange(e.target.value)}
                placeholder="Jouw naam..."
                className="text-xs px-2 py-1 rounded-lg bg-transparent border"
                style={{
                  borderColor: 'var(--color-border-subtle)',
                  color: 'var(--color-text-main)',
                  width: '140px',
                }}
              />
            </div>
            <button
              type="button"
              onClick={() => setCreatingNew(true)}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg"
              style={{ background: 'var(--color-oil-orange)' }}
            >
              + Nieuwe update
            </button>
          </div>

          {localUpdates.length === 0 ? (
            <div className="oil-card p-8 text-center">
              <p className="text-3xl mb-2">✨</p>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-main)' }}>
                Nog geen updates
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                Maak je eerste premium update met de knop hierboven.
              </p>
            </div>
          ) : (
            <div className="grid gap-3">
              {localUpdates.map((u) => (
                <UpdateCard
                  key={u.id}
                  update={u}
                  onEdit={(id) => setEditingUpdateId(id)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CAMPAIGNS TAB ─────────────────────────────────────── */}
      {activeTab === 'campaigns' && (
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Cron loopt elke maandag 08:00 en maakt automatisch campagnes aan.
          </p>
          {campaigns.length === 0 ? (
            <div className="oil-card p-8 text-center">
              <p className="text-3xl mb-2">📬</p>
              <p className="text-sm font-medium" style={{ color: 'var(--color-text-main)' }}>
                Geen campagnes
              </p>
              <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                Zodra de maandag-cron draait verschijnen campagnes hier.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {campaigns.map((c) => (
                <CampaignCard key={c.id} campaign={c} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TEMPLATES TAB ─────────────────────────────────────── */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              {localTemplates.filter((t) => t.is_active).length} actieve templates
            </p>
            <button
              type="button"
              onClick={() => { setEditTemplate(null); setShowNewForm(true); }}
              className="px-4 py-2 text-sm font-medium text-white rounded-lg"
              style={{ background: 'var(--color-oil-orange)' }}
            >
              + Nieuw template
            </button>
          </div>
          {(showNewForm || editTemplate) && (
            <div className="oil-card p-5">
              <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--color-text-main)' }}>
                {editTemplate ? 'Template bewerken' : 'Nieuw template'}
              </h3>
              <TemplateForm
                template={editTemplate ?? undefined}
                onSuccess={handleTemplateSuccess}
                onCancel={() => { setShowNewForm(false); setEditTemplate(null); }}
              />
            </div>
          )}
          {localTemplates.length === 0 && !showNewForm ? (
            <div className="oil-card p-8 text-center">
              <p className="text-3xl mb-2">📝</p>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Nog geen templates. Maak er een aan met de knop hierboven.
              </p>
            </div>
          ) : (
            <div className="oil-card divide-y" style={{ borderColor: 'var(--color-border-subtle)' }}>
              {localTemplates.map((t) => (
                <div key={t.id} className="px-5 py-4 flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-sm font-medium"
                        style={{ color: t.is_active ? 'var(--color-text-main)' : 'var(--color-text-dim)' }}
                      >
                        {t.name}
                      </span>
                      <span className="badge badge-gray text-[10px]">{t.channel}</span>
                      <span className="badge badge-gray text-[10px]">{t.message_type}</span>
                      {t.template_type && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(249, 115, 22, 0.1)', color: 'var(--color-oil-orange)' }}
                        >
                          {t.template_type}
                        </span>
                      )}
                      {!t.is_active && (
                        <span className="badge badge-gray text-[10px]">inactief</span>
                      )}
                    </div>
                    {t.subject && (
                      <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--color-text-dim)' }}>
                        {t.subject}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setEditTemplate(t); setShowNewForm(false); }}
                    className="text-xs shrink-0 px-3 py-1.5 rounded-lg"
                    style={{ color: 'var(--color-oil-orange)', background: 'rgba(249,115,22,0.1)' }}
                  >
                    Bewerken
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── CUSTOMERS TAB ─────────────────────────────────────── */}
      {activeTab === 'customers' && (
        <div className="space-y-4">
          <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Actieve klanten met outreach contactgegevens.
          </p>
          <div className="oil-card overflow-hidden">
            <table className="min-w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-subtle)' }}>
                  {['Klant', 'Email', 'WhatsApp', 'Kanalen'].map((h) => (
                    <th
                      key={h}
                      className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider"
                      style={{ color: 'var(--color-text-dim)' }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {customers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-5 py-10 text-center text-sm"
                      style={{ color: 'var(--color-text-muted)' }}
                    >
                      Geen klanten. Voeg contactgegevens toe via de Klanten pagina.
                    </td>
                  </tr>
                ) : (
                  customers.map((c) => (
                    <tr
                      key={c.id}
                      className="hover:bg-[var(--color-bg-elevated)] transition-colors"
                      style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
                    >
                      <td className="px-5 py-3">
                        <p className="text-sm font-medium" style={{ color: 'var(--color-text-main)' }}>
                          {c.name}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--color-text-dim)' }}>
                          {c.customer_code}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-sm"
                        style={{ color: c.email ? 'var(--color-text-main)' : 'var(--color-text-dim)' }}>
                        {c.email ?? '—'}
                      </td>
                      <td className="px-5 py-3 text-sm"
                        style={{ color: c.whatsapp_number ? 'var(--color-text-main)' : 'var(--color-text-dim)' }}>
                        {c.whatsapp_number ?? '—'}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex gap-1 flex-wrap">
                          {c.email && <span className="badge badge-green text-[10px]">email</span>}
                          {c.whatsapp_number && <span className="badge badge-green text-[10px]">whatsapp</span>}
                          {!c.email && !c.whatsapp_number && <span className="badge badge-gray text-[10px]">geen</span>}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helper components
// ---------------------------------------------------------------------------

function PerformanceStat({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: string;
  color?: string;
}) {
  return (
    <div className="oil-card p-4 flex items-center gap-3">
      <span className="text-xl">{icon}</span>
      <div>
        <p
          className="text-lg font-semibold"
          style={{
            color: color ?? 'var(--color-text-main)',
            fontFamily: 'var(--font-mono, monospace)',
          }}
        >
          {value}
        </p>
        <p className="text-[11px] uppercase tracking-wider" style={{ color: 'var(--color-text-dim)' }}>
          {label}
        </p>
      </div>
    </div>
  );
}
