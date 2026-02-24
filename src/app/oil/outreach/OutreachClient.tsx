'use client';

/**
 * OutreachClient — Wave 10 Outreach tab shell
 * Three tabs: Campagnes / Templates / Klanten
 * Manages local template state for optimistic updates after create/edit.
 */

import { useState } from 'react';
import type { OutreachCampaignWithTemplates, OutreachTemplate } from '@/types/outreach';
import type { OutreachCustomer } from '@/lib/actions/outreach';
import { CampaignCard } from '@/components/outreach/CampaignCard';
import { TemplateForm } from '@/components/outreach/TemplateForm';

type Tab = 'campaigns' | 'templates' | 'customers';

interface OutreachClientProps {
  campaigns: OutreachCampaignWithTemplates[];
  templates: OutreachTemplate[];
  customers: OutreachCustomer[];
}

export default function OutreachClient({ campaigns, templates, customers }: OutreachClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>('campaigns');
  const [localTemplates, setLocalTemplates] = useState<OutreachTemplate[]>(templates);
  const [showNewForm, setShowNewForm] = useState(false);
  const [editTemplate, setEditTemplate] = useState<OutreachTemplate | null>(null);

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

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'campaigns',  label: 'Campagnes',  count: campaigns.length },
    { key: 'templates',  label: 'Templates',  count: localTemplates.length },
    { key: 'customers',  label: 'Klanten',    count: customers.length },
  ];

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
