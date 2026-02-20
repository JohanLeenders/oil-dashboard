# Design Directive: OIL (Oranjehoen Informatie Layer) — UI Implementation Guide

**Style Target:** "Mission Control" / Sophisticated Industrialism

---

## 1. Core Philosophy & Vibe

**Objective:** Create a high-fidelity expert dashboard acting as a "Digital Twin" mission control center for a circular food supply chain.

**Keywords:**
- **Precision:** Data is presented clinically. 1px hairlines, exact alignment.
- **Authority:** Dark, heavy contrasts that feel premium and trustworthy.
- **Structured Complexity:** High data density organized rigorously on a grid.
- **Industrial yet Organic:** The container is high-tech steel/glass, but the data flowing through it represents organic life (warm accent colors).

---

## 2. Design Tokens (The DNA)

Implement these tokens as CSS variables (custom properties) for global consistency.

### 2.1 Color Palette (Deep Dark Mode)

| Role | Name | HEX Value | Usage Notes |
|------|------|-----------|-------------|
| Surface (Main) | `--color-bg-main` | `#09090b` | (Zinc-950) Main background. Deepest level. |
| Surface (Card) | `--color-bg-card` | `rgba(24, 24, 27, 0.7)` | (Zinc-900 at 70%) For glassmorphism panels. |
| Border (Subtle) | `--color-border-subtle` | `rgba(255, 255, 255, 0.1)` | For definition edges on cards. |
| Accent (Primary) | `--color-oil-orange` | `#F67E20` | Primary CTAs, active states, main data flow. |
| Data (Premium) | `--color-data-gold` | `#FFBF00` | For 'Borststroom' or high-value targets. |
| Data (Success) | `--color-data-green` | `#10B981` | Positive deltas, targets met. |
| Data (Alert) | `--color-data-red` | `#E11D48` | Errors, negative deltas, warnings. |
| Text (Primary) | `--color-text-main` | `#FFFFFF` | Headers, main values. |
| Text (Muted) | `--color-text-muted` | `#A1A1AA` | (Zinc-400) Labels, secondary info. |

### 2.2 Typography Stacks

| Role | Font Family Stack | Usage Notes |
|------|-------------------|-------------|
| Brand Headers | `"Oranienbaum", "Playfair Display", Serif` | Use for module titles to convey luxury/brand. |
| UI Body | `"Inter", "Roboto", Sans-serif` | High readability for general navigation and text. |
| Data & KPIs | `"JetBrains Mono", "Roboto Mono", Monospace` | **Crucial.** All numerical data points must be monospaced for precise vertical alignment. |

### 2.3 Shape & Structure

- **GRID:** Strict 12-column grid system.
- **CORNER RADIUS:** `12px` fixed across all cards, inputs, and buttons. (Soft Industrial).
- **STROKE WEIGHT:** `1px` hairlines for all borders and dividers. No bulky borders.

---

## 3. Component Rules

### 3.1 The "Mission Control" Card (Glassmorphism)

Every data container must adhere to this CSS recipe to achieve the frosted glass look against the dark background:

```css
.oil-card {
  background: var(--color-bg-card);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--color-border-subtle);
  border-radius: 12px;
  box-shadow: 0 4px 24px -1px rgba(0, 0, 0, 0.2);
}
```

### 3.2 Data Visualization (Sankey & Charts)

- **Sankey Diagrams:** Must look like engineered, glowing fluid pipes. Edges should be precise, not organic/wobbly. Use the accent colors (Orange/Gold) to show flow volume.
- **Radial Gauges:** Thin, precise lines. The progress arc should glow with the corresponding data color (e.g., Green for success).

### 3.3 Navigation (Sidebar)

- **Inactive state:** Muted text (`--color-text-muted`) on transparent background.
- **Active state:** Solid `--color-oil-orange` background or a distinct left-border stripe in orange, with white text.

---

## 4. Interaction Guidelines

- **Hover States:** Interactive elements (buttons, cards) should have a subtle inner glow or a slight brightening of the border color. Do not use heavy shadows for lift.
- **Data Focus:** When hovering over a specific data stream in a Sankey diagram, the rest of the diagram should dim slightly to emphasize the selected path.

---

## 5. Implementation Checklist

1. Set up the global CSS variables (Design Tokens) first.
2. Create the base layout using a dark Zinc-950 background.
3. Build the reusable `.oil-card` component with the glassmorphism CSS provided above.
4. Ensure all numerical data points are using the Monospaced font stack.
5. Apply the `12px` border-radius universally.

---

## 6. Application to All Waves

This design directive applies to **all UI components** across all waves. When building new components or modifying existing ones:

- Use the `.oil-card` glassmorphism pattern for all cards and panels
- Use monospace font for all kg, percentage, and count values
- Use the color tokens for status indicators (green = goed, red = tekort, orange = actief)
- Maintain 1px hairline borders throughout
- Dark mode is the ONLY mode — no light mode needed
