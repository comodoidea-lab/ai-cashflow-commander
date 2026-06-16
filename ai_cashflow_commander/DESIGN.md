---
name: AI Cashflow Commander
colors:
  surface: '#f8f9fb'
  surface-dim: '#d9dadc'
  surface-bright: '#f8f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f6'
  surface-container: '#edeef0'
  surface-container-high: '#e7e8ea'
  surface-container-highest: '#e1e2e4'
  on-surface: '#191c1e'
  on-surface-variant: '#45474c'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f3'
  outline: '#75777d'
  outline-variant: '#c5c6cd'
  surface-tint: '#545f73'
  primary: '#091426'
  on-primary: '#ffffff'
  primary-container: '#1e293b'
  on-primary-container: '#8590a6'
  inverse-primary: '#bcc7de'
  secondary: '#505f76'
  on-secondary: '#ffffff'
  secondary-container: '#d0e1fb'
  on-secondary-container: '#54647a'
  tertiary: '#1e1200'
  on-tertiary: '#ffffff'
  tertiary-container: '#35260c'
  on-tertiary-container: '#a38c6a'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d8e3fb'
  primary-fixed-dim: '#bcc7de'
  on-primary-fixed: '#111c2d'
  on-primary-fixed-variant: '#3c475a'
  secondary-fixed: '#d3e4fe'
  secondary-fixed-dim: '#b7c8e1'
  on-secondary-fixed: '#0b1c30'
  on-secondary-fixed-variant: '#38485d'
  tertiary-fixed: '#fadfb8'
  tertiary-fixed-dim: '#ddc39d'
  on-tertiary-fixed: '#271902'
  on-tertiary-fixed-variant: '#564427'
  background: '#f8f9fb'
  on-background: '#191c1e'
  surface-variant: '#e1e2e4'
  status-safe: '#10B981'
  status-caution: '#F59E0B'
  status-danger: '#EF4444'
  surface-white: '#FFFFFF'
  border-subtle: '#E5E7EB'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.4'
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
  numeric-data:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '700'
    lineHeight: '1'
    letterSpacing: -0.01em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  container-max: 1280px
  gutter: 24px
---

## Brand & Style

The design system is engineered for **AI Cashflow Commander**, a professional financial SaaS tailored for solo entrepreneurs. The brand personality is rooted in **expertise, calm authority, and precision**. It aims to transform the often-stressful experience of financial management into a controlled, predictable, and even satisfying administrative ritual.

The chosen design style is **Corporate / Modern with Tactile Micro-interactions**. 
- **Professionalism:** A clean, systematic foundation using heavy whitespace and a restricted palette.
- **Physicality:** Drawing from the "Tactile" philosophy, the UI employs subtle physical metaphors. Elements shouldn't just disappear; they should slide, snap, or fade with intentional weight.
- **Minimal Noise:** Every element serves a functional purpose. Layouts are stripped of decorative clutter to ensure the user can focus entirely on critical cashflow data.

## Colors

This design system utilizes a **high-contrast, professional palette** centered on Navy and Grayscale to evoke stability.

- **Primary (Professional Navy):** Used for primary actions, navigation headers, and authoritative text. It represents the "Commander" aspect of the brand.
- **Neutral (Cloud Gray/White):** The background is primarily `#F3F4F6` to reduce eye strain, while cards and containers use pure `#FFFFFF` to create a "layered paper" effect.
- **Status Colors:** These are non-negotiable semantic signals. 
    - **Safe (Green):** Indicates positive cashflow or completed tasks.
    - **Caution (Yellow):** Indicates upcoming payments or low liquidity.
    - **Danger (Red):** Indicates overdue items or negative projections.
- **Secondary:** A muted slate blue used for non-critical icons and secondary labels.

## Typography

The system uses **Inter** for its exceptional legibility in data-dense environments. The typographic hierarchy is strictly enforced to guide the user through complex financial reports.

- **Headlines:** Bold and concise. Use `display-lg` only for dashboard summaries (e.g., Total Balance).
- **Body:** `body-md` is the standard for all tooltips and descriptions.
- **Labels:** Small, uppercase labels with slightly increased letter spacing are used for table headers and metadata categories.
- **Numerical Data:** Financial figures should use a slightly heavier weight (`fontWeight: 700`) to ensure they stand out immediately against descriptive text.
- **Japanese Support:** When rendering Japanese, ensure `Noto Sans JP` is used as the fallback to maintain the clean, grotesque aesthetic across characters.

## Layout & Spacing

This design system follows a **Fixed-Fluid Hybrid Grid**. The content is centered within a maximum width of 1280px for readability on large monitors, but internal dashboard widgets utilize a fluid 12-column system.

- **Rhythm:** An 8px linear scale (4, 8, 16, 24, 40, 64).
- **Margins:** 24px page margins on desktop, scaling down to 16px on mobile.
- **Reflow Rules:** 
    - **Desktop:** Sidebar navigation is fixed at 240px width.
    - **Tablet:** Sidebar collapses into an icon-only rail or hamburger menu.
    - **Mobile:** Dashboard cards stack vertically. Data tables should transition into "Card-style" list items to maintain legibility.

## Elevation & Depth

To achieve the "FleetMetric Pro" look, depth is conveyed through **Tonal Layers** and **Ambient Shadows** rather than stark borders.

1.  **Level 0 (Background):** `#F3F4F6`. Used for the main canvas.
2.  **Level 1 (Cards/Surface):** White `#FFFFFF` with a very soft, diffused shadow (`0 4px 6px -1px rgba(0, 0, 0, 0.05)`). This creates a "resting" state.
3.  **Level 2 (Interaction/Active):** When a user interacts with a card or button, the shadow deepens and the element subtly scales (1.02x), simulating a physical lift.
4.  **Glassmorphism:** Reserved exclusively for navigation overlays and modals. Use a 12px backdrop blur with 80% opacity white background to maintain context of the underlying data.

## Shapes

The shape language is **Soft (0.25rem / 4px)**. This choice strikes a balance between the clinical sharpness of traditional finance tools and the approachability of modern SaaS.

- **Primary Elements (Buttons, Inputs):** 4px corner radius.
- **Containers (Cards, Modals):** 8px (`rounded-lg`) for a distinct structural feel.
- **Status Badges:** Fully rounded (pill-shaped) to distinguish them from interactive buttons.
- **Visual Metaphor:** Elements should feel like high-quality stationery—precise, clean, and slightly tactile.

## Components

### Buttons & Inputs
- **Primary Button:** Solid Professional Navy with white text. On click, it should "depress" via a 2px vertical offset.
- **Inputs:** White background, 1px border (`#E5E7EB`). On focus, the border transitions to Primary Navy with a subtle outer glow.

### Financial Cards
- Minimalist containers with a 1px top border tinted by the status color (e.g., a "Danger" card has a 2px red top-line) to provide immediate context without overwhelming the layout.

### Progress Bars
- Use a "Track and Fill" metaphor. The track is a light gray (`#E5E7EB`), and the fill uses the semantic status colors. The fill should animate with a "spring" easing function to feel physical.

### Status Badges
- High-contrast: Use a light tint of the status color for the background and the full-saturation color for the text (e.g., Light Green background with Dark Green text).

### Micro-interactions & Feedback
- **Magnetic Snapping:** Toggles and switches should feel "pulled" into their state once they pass the 50% threshold.
- **Micro-haptics:** If used on mobile, a subtle vibration should accompany the completion of a financial entry.
- **Onboarding:** Use "Coach Marks" (pulsing circles) that guide users through their first cashflow entry. These should be accompanied by a 10% dark overlay on the rest of the screen to focus attention.

## Product Architecture — FleetMetric Pro Integration

AI Cashflow Commander is **not** a standalone bookkeeping app. It is the **financial decision layer** of a solo-entrepreneur OS, paired with **FleetMetric Pro** (revenue management).

| FleetMetric Pro | AI Cashflow Commander |
|---|---|
| Revenue input (SSOT) | Expense management |
| Work logs & daily revenue | Credit card statements |
| Hourly / time-slot analysis | Subscription audit |
| Revenue truth source | Tax reserve, Safety Score, Runway, Gap to Safety |
| "How to earn" | "How to survive on what you earn" |

**Principles**
- FleetMetric Pro is the **only** revenue input source — no manual revenue entry in ACC.
- ACC is a **decision OS**, not a clone of accounting software.
- Lead with **what to do next**, not what already happened.
- Daily-use AI with both **accelerator** (SAFE offensive proposals) and **brake** (CAUTION/DANGER gap warnings).

### Integration Roadmap

| Phase | FleetMetric Pro | AI Cashflow Commander |
|---|---|---|
| **1** | CSV export | CSV import of revenue |
| **2** | "Send to AI CFO" button | JSON semi-auto sync |
| **3** | Auto-sync via Cloudflare Workers + D1 | Real-time analysis |
| **4** | Bidirectional interaction | e.g. "2 more work days → safe zone", "Take Sunday off", "Increase AI dev budget" |

### Screen Roles (Updated)

**Dashboard (`_7` / `_3`)**
- **SAFE:** Offensive proposals — surplus, investment candidates, tax reserve, AI dev budget.
- **CAUTION / DANGER:** Gap to Safety first — amount needed, work days needed (FleetMetric), days until next large payment.

**Import (`_9`)**
- Removed Premium promo slot.
- Shows **FleetMetric Pro sync status**: last sync, row count, health, method (CSV / JSON / Cloudflare Sync).
- Expense/card import remains here; revenue comes from FleetMetric.

**AI Insights (`ai_3` / `ai_1`)**
- **Simulation-only** — no overlap with Dashboard status cards.
- What-if scenarios: cancel subscription, extra work days, tax reserve rate changes.

## Responsive Layout (`responsive.css`)

Shared shell class: `.acc-app` (flex row, no fixed `ml-60` push).

| Breakpoint | Behavior |
|---|---|
| **≥1280px** | Full sidebar (240px) + desktop multi-column cards |
| **768–1279px** | Icon rail sidebar (72px), cards ≤2 columns |
| **≤767px** | Off-canvas sidebar, bottom nav, full-width CTAs, table horizontal scroll |

Rules:
- Never compress main content with a fixed sidebar — use off-canvas on mobile.
- Main content: `min-width: 0`, no excessive `min-width`.
- Tables: `.acc-table-wrap { overflow-x: auto }`.
- Long Japanese copy: wrap/ellipsis — never vertical `writing-mode`.
- Footer CTAs: sticky + full-width on mobile.

Preview scenarios:
- SAFE: `/_7/code.html`
- CAUTION: `/_7/code.html?scenario=caution`
- DANGER: `/_7/code.html?scenario=danger`