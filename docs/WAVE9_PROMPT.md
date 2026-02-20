# WAVE 9 — Design System & UX Polish ("Mission Control")

**Repository (Windows):** `C:\Users\leend\A leenders\Oranjehoen - Documenten\Dashboard\oil-dashboard`

---

## CONTEXT

Wave 8 delivered:
- Storteboom-exact Excel bestelschema export (Putten + Nijkerk layout)
- Artikelnummers per product (vacuum / niet-vacuum)
- Klant bezorginfo tabel + editor
- Simulator data optioneel in export
- NL nummerformat, REST-kolom, dynamische klant-kolommen

**Wave 9 goal:** Transform the dashboard from a functional prototype into a polished "Mission Control" interface. Apply the Design Directive, build a sidebar navigation, add order status visualization, and create a Slaughter Day Intelligence Panel.

Read these reference documents first:
1. `docs/DESIGN_DIRECTIVE.md` — **THE primary reference for this wave.** All colors, fonts, glassmorphism, tokens, interaction rules.
2. `docs/FASE2_UI_IMPROVEMENT_PLAN.md` — Wave 9 section for original UX plan
3. `SYSTEM_STATE.md` — Current system status

---

## UX BEHAVIOR DIRECTIVES

These behavioral rules supplement the visual Design Directive. They define how the cockpit FEELS to use — every action must have immediate, visible, and validated consequences.

### UX-1: Progressive Disclosure in Sidebar
Reduce cognitive load. The sidebar is NOT a flat list — it uses collapsible groups based on operational frequency:
- **Dagelijks (default OPEN):** Planning, Orders, Exports — the daily workflow
- **Analyse (default COLLAPSED):** Batches, Kostprijs, Klanten, Trends — deep-dive when needed
- **Beheer (default COLLAPSED):** Locaties, Producten, Rendementen — admin/setup (future, grayed out)

Clicking a group header expands/collapses it. Persist collapse state in localStorage.

### UX-2: Simulator "Impact Zone" (Real-time Butterfly Effect)
The PlanningSimulator already has a split-view with inputs on one side and cascaded output on the other. **Enhance it:** when the user changes any input (e.g., pulls 200 chickens from 1300-1600), the output side must update in real-time with visual alerts:
- Products that **decrease significantly** (>10% drop) flash briefly with `--color-data-red` border
- Products that **increase** (higher avg weight → more kg per bird) flash with `--color-data-green`
- The "Impact Zone" label should show a delta summary: "−340 kg filet / +12 kg per dij"
This is purely visual enhancement — the existing `computeSimulatedAvailability()` already computes these values.

### UX-3: Intelligence Panel — Visual Cascade Dependency
Putten and Nijkerk are NOT independent. Visually reinforce their supply chain dependency:
- Connect the Putten progress bar to the Nijkerk progress bar with a subtle **glowing orange flow line** or directional arrow (`→`)
- Show the "rest → Nijkerk" flow in kg as a labeled connector between the two bars
- When Putten utilization changes, Nijkerk should visually respond (data updates)
This communicates at a glance: what Putten doesn't sell feeds Nijkerk.

### UX-4: Export "Launch Sequence" (Validation Guardrails)
The Storteboom Excel export is the most critical action — an error here costs real money. Transform it from a simple button into a validated launch sequence:
- The Export CTA starts in **disabled state** (muted/gray)
- Below it, show a compact **pre-flight checklist** with green/red indicators:
  - ✓ Massabalans 100%
  - ✓ Geen negatieve voorraad
  - ✓ Alle orders bevestigd
  - ✓ Artikelnummers compleet
  - ✓ Bezorginfo ingevuld
- The CTA only becomes **bright orange and clickable** when all checks pass
- Failed checks show as clickable links that scroll to the relevant section
- This uses the existing `validateStorteboomExport()` validator from Wave 8 — no new engine logic needed

### UX-5: Data Density via Drill-down Modals
Keep the Mission Control overview clean. Heavy analytical data is hidden until requested:
- On the Dashboard page: show only top-line KPI tiles (Total kg, Benutting %, Tekorten, Open orders)
- Clicking a KPI tile opens a **frosted glass modal overlay** (full-screen glassmorphism panel) with the detailed data
- Example: Click "Kostprijs" KPI → modal shows the 7-layer waterfall, Click "SVASO" → modal shows allocation table
- Modal uses OilCard styling with `backdrop-filter: blur(20px)` for extra depth
- Close with Escape, click-outside, or ✕ button
- This preserves context (underlying page visible through blur) without cluttering the primary view

---

## HARD CONSTRAINTS

- No protected files may be modified (**10 files**):
  ```
  src/lib/engine/svaso.ts
  src/lib/engine/cherry-picker.ts
  src/lib/engine/tht.ts
  src/lib/engine/mass-balance.ts
  src/lib/engine/sankey.ts
  src/lib/engine/true-up.ts
  src/lib/actions/batches.ts
  src/lib/actions/scenarios.ts
  src/lib/engine/availability/cascading.ts
  src/lib/engine/availability/simulator.ts
  ```
- Dark mode is the **DEFAULT and ONLY mode** — remove light mode toggle, always dark
- No functional logic changes — this wave is purely visual/UX
- All existing tests must keep passing
- Build must stay clean

---

## PRE-FLIGHT (MANDATORY)

Run before ANY code changes:

```bash
npm run build
npm test -- --run
git diff HEAD -- src/lib/engine/svaso.ts src/lib/engine/cherry-picker.ts src/lib/engine/tht.ts src/lib/engine/mass-balance.ts src/lib/engine/sankey.ts src/lib/engine/true-up.ts src/lib/actions/batches.ts src/lib/actions/scenarios.ts src/lib/engine/availability/cascading.ts src/lib/engine/availability/simulator.ts
git status
```

**Stop if not clean.**

---

## SPRINTLET C1 — Design Tokens & Global Styles

**Doel:** Implementeer het Design Directive kleurenpalet en typography als CSS custom properties. Dit is de basis voor alles in deze wave.

### C1a. Update globals.css

Replace the current `:root` color variables with the Design Directive tokens:

```css
:root {
  /* Surface */
  --color-bg-main: #09090b;
  --color-bg-card: rgba(24, 24, 27, 0.7);
  --color-bg-elevated: rgba(39, 39, 42, 0.5);

  /* Borders */
  --color-border-subtle: rgba(255, 255, 255, 0.1);
  --color-border-hover: rgba(255, 255, 255, 0.2);

  /* Accent */
  --color-oil-orange: #F67E20;
  --color-oil-orange-hover: #FB923C;

  /* Data */
  --color-data-gold: #FFBF00;
  --color-data-green: #10B981;
  --color-data-red: #E11D48;

  /* Text */
  --color-text-main: #FFFFFF;
  --color-text-muted: #A1A1AA;
  --color-text-dim: #71717A;

  /* Shape */
  --radius-card: 12px;
  --blur-glass: 12px;
}
```

### C1b. Update tailwind.config.ts

Extend the Tailwind theme to use the new tokens:

```typescript
theme: {
  extend: {
    colors: {
      'oil-bg': 'var(--color-bg-main)',
      'oil-card': 'var(--color-bg-card)',
      'oil-border': 'var(--color-border-subtle)',
      'oil-orange': 'var(--color-oil-orange)',
      'oil-gold': 'var(--color-data-gold)',
      'oil-green': 'var(--color-data-green)',
      'oil-red': 'var(--color-data-red)',
    },
    borderRadius: {
      'oil': '12px',
    },
    backdropBlur: {
      'oil': '12px',
    },
  }
}
```

Keep existing `oranje` and `status` colors for backward compatibility — don't remove them yet.

### C1c. Font loading

Update `src/app/layout.tsx` to load fonts from Google Fonts via `next/font`:

```typescript
import { Inter, JetBrains_Mono, Playfair_Display } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const jetbrains = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });
const playfair = Playfair_Display({ subsets: ['latin'], variable: '--font-brand' });
```

Apply to `<body>` className: `${inter.variable} ${jetbrains.variable} ${playfair.variable}`

Update tailwind font families to reference these variables.

### C1d. Remove dark mode toggle

- Remove `DarkModeToggle.tsx` component (or keep file but don't render it)
- Remove the dark mode toggle button from the header/layout
- Set `<html>` to always have class `dark`
- Remove the dark mode initialization script from layout.tsx — just hardcode `dark` class
- Keep `darkMode: 'class'` in tailwind config (we need it, we just always apply it)

### C1e. Base body styling

Update body to use new tokens:

```css
body {
  background-color: var(--color-bg-main);
  color: var(--color-text-main);
  font-family: var(--font-inter), 'Inter', system-ui, sans-serif;
}
```

---

## SPRINTLET C2 — OIL Card Component & Utility Classes

**Doel:** Bouw de herbruikbare glassmorphism card en utility classes.

### C2a. OilCard component

Create: `src/components/oil/ui/OilCard.tsx`

```typescript
interface OilCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';    // default: 'md'
  header?: React.ReactNode;
  headerAction?: React.ReactNode;
}

export function OilCard({ children, className, padding, header, headerAction }: OilCardProps)
```

CSS recipe (from Design Directive):
```css
background: var(--color-bg-card);
backdrop-filter: blur(var(--blur-glass));
-webkit-backdrop-filter: blur(var(--blur-glass));
border: 1px solid var(--color-border-subtle);
border-radius: var(--radius-card);
box-shadow: 0 4px 24px -1px rgba(0, 0, 0, 0.2);
```

Hover interaction: border color transitions to `var(--color-border-hover)` on interactive cards.

### C2b. KPI Tile component

Create: `src/components/oil/ui/KpiTile.tsx`

```typescript
interface KpiTileProps {
  label: string;
  value: string | number;
  unit?: string;           // "kg", "%", "stuks"
  trend?: 'up' | 'down' | 'flat';
  trendValue?: string;     // "+3,2%"
  color?: 'orange' | 'gold' | 'green' | 'red' | 'default';
}
```

- Value always in monospace font (`font-mono`)
- Uses OilCard as base
- Compact size, suitable for top-bar or grid layout

### C2c. DataBadge component

Create: `src/components/oil/ui/DataBadge.tsx`

```typescript
interface DataBadgeProps {
  label: string;
  variant: 'green' | 'orange' | 'red' | 'gold' | 'muted';
  size?: 'sm' | 'md';
}
```

Small status indicators for order states, deficit/surplus, etc.

### C2d. Update globals.css utility classes

Replace or supplement existing `.card`, `.badge-*`, `.kpi-tile` classes with new ones that reference the design tokens. Keep old classes as aliases for backward compatibility until all components are migrated.

---

## SPRINTLET C3 — Sidebar Navigation

**Doel:** Vervang de horizontale top-navbar door een verticale sidebar.

### C3a. Create Sidebar component

Create: `src/components/oil/layout/Sidebar.tsx`

**Structure:**
```
┌──────────────────┐
│  🐔 OIL          │  ← Brand logo + name
│  Oranjehoen      │
│  Intelligence     │
│  Layer            │
├──────────────────┤
│  OPERATIONEEL    │  ← Section header (muted, uppercase, small)
│  ◈ Dashboard     │
│  ◈ Planning      │
│  ◈ Orders        │
│  ◈ Verwerking    │
│  ◈ Exports       │
├──────────────────┤
│  DATA            │  ← Section header
│  ◈ Batches       │
│  ◈ Kostprijs     │
│  ◈ Klanten       │
│  ◈ Trends        │
├──────────────────┤
│  BEHEER          │  ← Section header
│  ◈ Locaties      │  (future)
│  ◈ Producten     │  (future)
│  ◈ Rendementen   │  (future)
├──────────────────┤
│                  │
│  OIL v0.9        │  ← Version footer
│  Oranjehoen B.V. │
└──────────────────┘
```

**Progressive Disclosure (UX-1):**
Groups are collapsible. Persist open/closed state in localStorage (`oil-sidebar-state`).
- **DAGELIJKS** section: default OPEN (Planning, Orders, Exports)
- **ANALYSE** section: default COLLAPSED (Batches, Kostprijs, Klanten, Trends)
- **BEHEER** section: default COLLAPSED, items grayed out (Locaties, Producten, Rendementen — toekomstig)

Clicking a section header toggles expand/collapse with a subtle height animation.

**Styling per Design Directive:**
- Inactive: `color: var(--color-text-muted)` on transparent
- Active: `background: var(--color-oil-orange)` with white text, OR left border stripe in orange
- Hover: subtle background brightening
- Width: ~240px fixed
- Background: slightly elevated from main (`var(--color-bg-card)` or slightly less transparent)
- Section headers: `text-xs uppercase tracking-wider` in `--color-text-dim`

**Active detection:** Use Next.js `usePathname()` — exact match for `/oil`, startsWith for others.

### C3b. Update oil/layout.tsx

- Remove the current horizontal header nav
- Wrap content in a flex layout: `[Sidebar][MainContent]`
- MainContent gets `flex-1 overflow-y-auto`
- Keep the brand name in sidebar, remove from header
- Keep any page-level header (breadcrumb / page title) in the main area

```tsx
<div className="flex h-screen" style={{ background: 'var(--color-bg-main)' }}>
  <Sidebar />
  <main className="flex-1 overflow-y-auto p-6">
    {children}
  </main>
</div>
```

### C3c. Mobile responsive

- On screens < 1024px: sidebar collapses to icon-only (48px wide)
- Hamburger menu to expand
- On screens < 768px: sidebar fully hidden, show top hamburger button

---

## SPRINTLET C4 — Order Status Visualization

**Doel:** Kleurcodering en status-badges voor orders.

### C4a. Order status styling

Create: `src/lib/ui/orderStatusConfig.ts`

```typescript
export const ORDER_STATUS_CONFIG = {
  draft:     { label: 'Concept',    color: 'muted',  icon: '✎' },
  submitted: { label: 'Ingediend',  color: 'orange', icon: '→' },
  confirmed: { label: 'Bevestigd',  color: 'green',  icon: '✓' },
  cancelled: { label: 'Geannuleerd', color: 'red',   icon: '✗' },
} as const;

export const SLAUGHTER_STATUS_CONFIG = {
  planned:      { label: 'Gepland',      color: 'muted',  icon: '📅' },
  orders_open:  { label: 'Orders open',  color: 'orange', icon: '🔓' },
  finalized:    { label: 'Definitief',   color: 'gold',   icon: '🔒' },
  slaughtered:  { label: 'Geslacht',     color: 'green',  icon: '✓' },
  completed:    { label: 'Afgerond',     color: 'green',  icon: '✓✓' },
} as const;
```

### C4b. OrderStatusBadge component

Create: `src/components/oil/ui/OrderStatusBadge.tsx`

Uses DataBadge internally. Shows status label + optional icon.

### C4c. Update OrderList.tsx

Add status badges to each order in the list. Show `DataBadge` next to customer name.

### C4d. Slaughter day progress bar

Create: `src/components/oil/ui/AvailabilityProgressBar.tsx`

```typescript
interface AvailabilityProgressBarProps {
  availableKg: number;
  orderedKg: number;
}
```

- Shows horizontal bar: green fill for ordered %, gray for remaining
- If > 100%: red overshoot indicator
- Percentage label (`78% verkocht`)
- Compact, fits in a table cell or card

### C4e. Add progress bars to planning calendar

Update `SlaughterCalendarList.tsx` to show `AvailabilityProgressBar` per slaughter day.

---

## SPRINTLET C5 — Slaughter Day Intelligence Panel

**Doel:** Een overzichtspanel dat toont hoe een slachtdag benut wordt.

### C5a. Intelligence Panel component

Create: `src/components/oil/orders/IntelligencePanel.tsx`

```typescript
interface IntelligencePanelProps {
  slaughterId: string;
  availability: CascadedAvailability;
  orders: CustomerOrderWithLines[];
}
```

**Layout (OilCard based):**

```
┌─────────────────────────────────────┐
│  📊 Slachtdag Overzicht             │
├─────────────────────────────────────┤
│                                     │
│  ┌────────┐ ┌────────┐ ┌────────┐  │
│  │ 29.762 │ │ 18.430 │ │  78%   │  │
│  │ kg     │ │ kg     │ │ benut  │  │
│  │ totaal │ │verkocht│ │        │  │
│  └────────┘ └────────┘ └────────┘  │
│                                     │
│  Putten (Dag 0)                     │
│  ████████████████░░░░░░  65%        │
│  19.320 kg beschikbaar              │
│  12.580 kg verkocht                 │
│           │                         │
│     6.740 kg ──→ cascade            │  ← glowing orange flow connector
│           │                         │
│  Nijkerk (Dag +1)                   │
│  ██████████████████████░  92%       │
│  10.442 kg beschikbaar              │
│  9.607 kg verkocht                  │
│  835 kg onverkocht                  │
│                                     │
└─────────────────────────────────────┘
```

- KPI tiles at top: Total kg, Sold kg, Utilization %
- Per-location breakdown with progress bars
- **Cascade flow connector (UX-3):** A subtle glowing orange line/arrow connecting Putten "rest" to Nijkerk "beschikbaar", labeled with the kg that flows through. This visually reinforces that Nijkerk depends on what Putten doesn't sell. Implement with a CSS border-left or SVG arrow in `--color-oil-orange` with a subtle glow (`box-shadow: 0 0 8px var(--color-oil-orange)`)
- Color-coded: green if > 80% benut, orange 50-80%, red < 50%
- Uses ONLY existing data from `CascadedAvailability` + orders — NO new engine logic

### C5b. Place in orders page

Add `IntelligencePanel` to `SlaughterOrdersClient.tsx` — show it above the orders/availability tabs, or as a collapsible panel at the top.

---

## SPRINTLET C6 — Simulator Impact Zone (UX-2)

**Doel:** Maak de gevolgen van simulatorwijzigingen direct zichtbaar met visuele feedback.

### C6a. Delta tracking

In `PlanningSimulator.tsx`, track the previous simulation result alongside the current one. When inputs change:

1. Compute new `SimulatedAvailability`
2. Compare each product's `available_kg` with the previous result
3. Calculate delta per product: `delta_kg = new_kg - previous_kg`

### C6b. Visual flash feedback

When a product's availability changes significantly (>10% shift):
- **Decrease:** Brief red border flash (`--color-data-red`) on that product row, fades after 1s
- **Increase:** Brief green border flash (`--color-data-green`)
- Use CSS `@keyframes` for the flash animation (border-color transition)

### C6c. Impact summary banner

Add a compact summary line above the cascaded output when pulls change:

```
⚡ Impact: −340 kg filet Nijkerk / +18 kg per dij / 200 hele hoenen 1500g eruit
```

- Show only when `whole_bird_pulls` total > 0
- Use `--color-data-red` for decreases, `--color-data-green` for increases
- Compute from delta between "no pulls" baseline and current simulation

---

## SPRINTLET C7 — Export Launch Sequence (UX-4)

**Doel:** Maak de Excel export een gevalideerde "launch sequence" in plaats van een simpele knop.

### C7a. Pre-flight checklist component

Create: `src/components/oil/orders/ExportPreflightChecklist.tsx`

```typescript
interface PreflightCheck {
  label: string;
  passed: boolean;
  link?: string;  // scroll-to anchor if failed
}

interface ExportPreflightChecklistProps {
  checks: PreflightCheck[];
  onExport: () => void;
  isExporting: boolean;
}
```

**Visual layout:**
```
┌─────────────────────────────────┐
│  🚀 Export Bestelschema         │
├─────────────────────────────────┤
│  ✓ Massabalans 100%            │  ← green check
│  ✓ Geen negatieve voorraad     │  ← green check
│  ✗ 2 orders nog concept        │  ← red, clickable link to orders
│  ✓ Artikelnummers compleet     │  ← green check
│  ⚠ Bezorginfo ontbreekt (2x)  │  ← orange warning, clickable
├─────────────────────────────────┤
│  [ Genereer Storteboom Excel ] │  ← DISABLED (gray) until all pass
│                                 │  ← or ORANGE when ready
└─────────────────────────────────┘
```

### C7b. Wire into ExportButton

Replace the current simple ExportButton with ExportPreflightChecklist:
- Run `validateStorteboomExport()` (from Wave 8) to get check results
- Map validation errors/warnings to `PreflightCheck[]` items
- Failed checks that are warnings: button enabled but shows orange warning state
- Failed checks that are errors: button disabled (gray)
- When all pass: button bright orange, full confidence

### C7c. Clickable failed checks

Each failed check shows a small link icon. Clicking it scrolls the page to the relevant section:
- "Orders nog concept" → scrolls to order list
- "Bezorginfo ontbreekt" → scrolls to DeliveryInfoEditor
- "Artikelnummers missen" → shows which products

---

## SPRINTLET C8 — Drill-down Modals (UX-5) & Component Migration

**Doel:** Bouw drill-down modals voor data density management + migreer bestaande componenten.

### C8a. OilModal component

Create: `src/components/oil/ui/OilModal.tsx`

```typescript
interface OilModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'md' | 'lg' | 'xl' | 'full';  // default: 'lg'
}
```

- Full-screen overlay with `backdrop-filter: blur(20px)` for extra depth (more blur than cards)
- Content area uses OilCard styling
- Close on Escape, click-outside, or ✕ button
- Smooth open/close animation (opacity + scale transition)
- Underlying page visible through blur → preserves context

### C8b. KPI tile drill-down pattern

On the Dashboard page (`/oil`), clicking a KPI tile opens an OilModal:
- **Total kg** KPI → modal with per-product availability breakdown
- **Benutting %** KPI → modal with Putten/Nijkerk split detail
- **Open orders** KPI → modal with order list
- **Tekorten** KPI → modal with deficit products

If these detail views don't exist yet as components, show a placeholder with "Detail view coming in Phase 3" — the pattern is what matters, not the content.

### C8c. Priority components to update

Migrate these existing components to use `OilCard` wrapper and new tokens:

1. **AvailabilityPanel.tsx** — Wrap sections in OilCard, use monospace for all kg values, apply color tokens for surplus/deficit
2. **PlanningSimulator.tsx** — Wrap in OilCard, use KpiTile for summary stats
3. **OrderLineEditor.tsx** — Subtle glassmorphism for edit mode, hover states per directive
4. **SlaughterCalendarList.tsx** — OilCard per slachtdag, add status badges + progress bars
5. **ExportButton.tsx** — Orange accent styling for primary CTA

### C8d. Heading hierarchy

Apply consistent heading styles:
- **Page title:** `text-2xl font-brand` (Playfair Display) — e.g., "Orders — 24 november 2025"
- **Section title:** `text-lg font-semibold` (Inter) — e.g., "Beschikbaarheid Putten"
- **Card title:** `text-sm font-medium text-muted` (Inter) — e.g., "Griller overzicht"

### C8e. Numbers always monospace

Audit ALL components that display kg, percentages, counts, or prices. Ensure they use `font-mono tabular-nums`. Key files to check:
- AvailabilityPanel.tsx
- PlanningSimulator.tsx
- OrderLineEditor.tsx
- SlaughterCalendarList.tsx
- Bovenbalk.tsx
- All Level*.tsx components

---

## SPRINTLET C9 — QA & Regression

### 1. Protected files check

```bash
git diff HEAD -- src/lib/engine/svaso.ts src/lib/engine/cherry-picker.ts src/lib/engine/tht.ts src/lib/engine/mass-balance.ts src/lib/engine/sankey.ts src/lib/engine/true-up.ts src/lib/actions/batches.ts src/lib/actions/scenarios.ts src/lib/engine/availability/cascading.ts src/lib/engine/availability/simulator.ts
```

Expected: empty.

### 2. Test + Build

```bash
npm test -- --run
npm run build
```

- Zero failures
- Build clean
- Test count: same as Wave 8 end (no new engine tests, this is UI-only)

### 3. Visual verification checklist

**Design System:**
- [ ] Background is #09090b (deep dark, not gray)
- [ ] All cards have glassmorphism (backdrop blur, subtle border)
- [ ] 12px border radius on all cards, inputs, buttons
- [ ] 1px hairline borders everywhere (no thick borders)
- [ ] Orange accent (#F67E20) on active nav, CTAs, highlights
- [ ] All numbers in monospace font (JetBrains Mono)
- [ ] Page titles in Playfair Display (serif)
- [ ] Dark mode is permanent and only mode (no toggle)
- [ ] Hover states: subtle glow, no heavy shadows

**Sidebar (UX-1):**
- [ ] Sidebar shows grouped, collapsible sections
- [ ] Dagelijks section default open
- [ ] Analyse/Beheer sections default collapsed
- [ ] Collapse state persists in localStorage
- [ ] Sidebar collapses on mobile
- [ ] Active state shows orange highlight

**Intelligence Panel (UX-3):**
- [ ] Putten/Nijkerk utilization split visible
- [ ] Orange flow connector between Putten rest → Nijkerk input
- [ ] KPI tiles at top with monospace values

**Simulator Impact Zone (UX-2):**
- [ ] Product rows flash red/green on significant change
- [ ] Impact summary banner shows delta when pulls active
- [ ] Updates in real-time as inputs change

**Export Launch Sequence (UX-4):**
- [ ] Pre-flight checklist visible before export
- [ ] Export button disabled until checks pass
- [ ] Failed checks are clickable links to relevant sections
- [ ] Button turns bright orange when all pass

**Drill-down Modals (UX-5):**
- [ ] OilModal component with backdrop blur
- [ ] KPI tiles on dashboard open detail modals on click
- [ ] Modal closes on Escape, click-outside, or ✕

**No regressions:**
- [ ] Order status badges show with correct colors
- [ ] Slaughter calendar shows progress bars
- [ ] Existing pages (batches, kostprijs, klanten) still work

### 4. QA Report

Write `docs/qa-report-wave9.md` with:
- Visual verification (screenshot descriptions)
- Test counts
- Protected files status
- Build status
- Browser tested (Chrome + Edge)
- Decision: GO / NO-GO

### 5. Update SYSTEM_STATE.md

Add Wave 9 deliverables.

---

## GATE CRITERIA

```
□ Build clean
□ All tests pass (same count as Wave 8 end)
□ 10 protected files unchanged
□ Design tokens implemented in CSS + Tailwind
□ Fonts loaded (Inter, JetBrains Mono, Playfair Display)
□ Dark mode is only mode (no toggle)
□ Background is #09090b
□ Glassmorphism cards throughout (OilCard component)
□ 12px radius universal
□ 1px hairline borders
□ Sidebar with progressive disclosure (collapsible groups)
□ Sidebar responsive (collapse on mobile)
□ Sidebar collapse state persists in localStorage
□ Order status badges visible
□ Progress bars on slaughter calendar
□ Intelligence panel with Putten→Nijkerk cascade flow connector
□ Simulator Impact Zone: flash feedback + delta summary
□ Export Launch Sequence: pre-flight checklist + disabled-until-valid CTA
□ OilModal component for drill-down overlays
□ KPI drill-down modals on dashboard
□ All numbers monospace
□ No visual regressions on existing pages
□ QA report written
□ SYSTEM_STATE.md updated
```

---

## FINAL STEPS

```bash
git add -A
git commit -m "feat: Wave 9 — Mission Control Design System & UX Polish

- Design tokens: color palette, typography, shape tokens as CSS custom properties
- Glassmorphism OilCard component (backdrop-blur, subtle borders, 12px radius)
- Sidebar with progressive disclosure (collapsible groups, localStorage persist)
- Font loading: Inter (body), JetBrains Mono (data), Playfair Display (brand)
- Dark mode as permanent only mode
- Order status badges (concept/ingediend/bevestigd/geannuleerd)
- Availability progress bars on slaughter calendar
- Intelligence Panel with Putten→Nijkerk cascade flow connector
- Simulator Impact Zone: real-time flash feedback + delta summary
- Export Launch Sequence: pre-flight checklist, disabled-until-valid CTA
- OilModal drill-down component for KPI detail overlays
- KpiTile and DataBadge reusable UI components
- All numbers in monospace font throughout
- No functional logic changes — pure visual/UX wave"
git tag v0.9-wave9
```

---

## END CONDITION

The dashboard now looks and feels like a premium Mission Control cockpit:
- Deep dark background (#09090b) with frosted glass cards
- Sidebar with progressive disclosure (daily ops open, analytics collapsed)
- Monospace numbers for precise data reading
- Status badges and progress bars for operational awareness
- Intelligence panel with visible Putten→Nijkerk cascade dependency
- Simulator shows real-time "butterfly effect" when pulling whole chickens
- Export is a validated "launch sequence" — not clickable until pre-flight passes
- KPI drill-down modals keep overview clean, detail one click away
- Consistent heading hierarchy (brand serif for titles, Inter for body)
- All 1px hairlines, 12px radius, no visual clutter
- No functional regressions

**Start with Pre-flight. Then execute sprintlets sequentially (C1 → C2 → C3 → C4 → C5 → C6 → C7 → C8 → C9).**
