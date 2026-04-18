# UI Playbook

Read this file only when a task touches the web UI, for example:

- `apps/web/**`
- `apps/web/src/shared/ui/**`
- `apps/web/src/views/**`
- `apps/web/src/widgets/**`
- `apps/web/src/features/**`
- UI review for web tasks

Do not load this file for backend/package-only work.

## Purpose

This file keeps UI work consistent without forcing every chat to absorb extra
general context.

Use it for:

- implementer decisions on structure and styling,
- reviewer validation of UI correctness,
- keeping the app visually coherent across slices.

## Product Direction

This app is not a marketing site and not a consumer finance app.

It is a private operator console for one property owner. The UI should feel:

- serious,
- dense,
- calm,
- audit-friendly,
- evidence-oriented,
- operational rather than decorative.

The reference direction is the dashboard draft provided by Serhii:

- dark analytical workspace,
- compact cards with high information density,
- muted chrome and restrained accents,
- strong tabular and metric readability,
- visible provenance, anomalies, and time context,
- no playful SaaS hero styling.

## What We Are Building

The first useful UI is a property-operations dashboard and supporting evidence
screens, not a generic CRUD shell.

Core surfaces to optimize for:

- dashboard category breakdown cards,
- month-over-month cost and usage context,
- yearly trend and anomaly visibility,
- upcoming/open items,
- document provenance and evidence trace,
- invite-only authenticated internal access.

The UI should help answer questions like:

- what changed this month,
- what should be paid next,
- what looks anomalous,
- which document supports this number,
- what is still open or missing.

## Structure Rules

Follow the minimal FSD shape from `ARCHITECTURE.md`:

- `app/` for routing, layouts, providers, and route composition entrypoints,
- `src/shared` for cross-app primitives and infrastructure,
- `src/entities` for stable domain nouns,
- `src/features` for bounded user interactions,
- `src/widgets` for screen sections,
- `src/views` for route-level screen composition.

Keep it minimal. Do not add extra layers or ceremony.

### Import Direction

- `shared` must not import from higher layers
- `entities` must not import from `features`, `widgets`, or `views`
- `features` must not import from `widgets` or `views`
- `widgets` must not import from `views`
- sibling slices in the same layer should not import each other by default

If two slices need to work together, compose them one layer up.

If two slices need shared code, move that code downward to:

- `shared`, for generic cross-app concerns
- the right lower-level slice, for domain-specific reuse

## Design System Rules

Prefer Tailwind scale values and shadcn defaults as much as possible.

Start from existing shared primitives in `apps/web/src/shared/ui`, not ad hoc
component-local markup, when a standard UI building block already exists.

Current shared baseline includes:

- `Button`
- `Badge`
- `Card`
- `Separator`
- `ThemeProvider`

If a new primitive is needed, add it in `src/shared/ui`, ideally through
shadcn-compatible patterns, instead of inventing a page-local one-off version.

### Default Styling Approach

- prefer semantic theme variables from `apps/web/app/globals.css`
- prefer Tailwind scale spacing like `p-4`, `px-6`, `gap-3`
- prefer standard radii, borders, shadows, and text sizes
- prefer shadcn variants before custom wrapper components
- prefer composition of small shared primitives over large bespoke shells

### Avoid By Default

- arbitrary Tailwind values like `p-[38px]`, `w-[873px]`, `text-[17px]`
- one-off hex colors or inline custom color values
- custom radii, shadows, or spacing scattered across components
- page-local design tokens
- decorative gradients, glassmorphism, marketing-style hero sections
- oversized whitespace that lowers dashboard density

### When Custom Values Are Allowed

Only introduce a custom value when it is clearly justified by the product and
cannot be expressed reasonably with the existing scale.

If it becomes a recurring pattern:

- centralize it as a shared semantic token or shared primitive,
- do not duplicate the raw value across views or widgets.

## Visual Language

Use the dashboard draft as the default tone:

- dark canvas first,
- restrained contrast,
- compact card grids,
- mono-friendly metadata rows,
- small muted supporting labels,
- strong metric emphasis,
- sparse accent colors reserved for anomalies, warnings, or important status.

### Good Patterns

- cards for grouped operational facts
- compact key/value tables inside cards
- small provenance chips and source labels
- clear period context
- anomaly callouts with restrained but noticeable color
- charts and summaries that support investigation, not decoration

### Bad Patterns

- bright consumer-app palettes
- giant empty hero sections
- oversized CTA buttons as primary layout anchors
- purely decorative widgets
- visual noise that competes with the numbers

## Dashboard Rules

The dashboard should read like an operations board.

Prioritize this order:

1. period context
2. category breakdown and major changes
3. trend context
4. open items and anomalies
5. provenance/evidence hints

Each widget should justify its space with actual decision value.

Do not add filler sections just to make the page feel complete.

## Implementer Checklist

Before adding new UI code:

1. check whether the element belongs in `shared`, `entities`, `features`,
   `widgets`, or `views`
2. check whether a shared primitive already exists
3. check whether the styling can be expressed with Tailwind scale values and
   existing theme tokens
4. keep route files thin and move screen composition into `src/views/**`
5. keep business logic out of components and route handlers

## Reviewer Checklist

For UI tasks, reviewer should validate all of this explicitly:

- FSD ownership is correct, not just folder names
- import directions are correct
- no same-level cross-slice imports were introduced without a strong reason
- `app/` stays thin
- `views` compose screens instead of acting like router code
- widgets are screen sections, not pages
- features are bounded interactions, not generic infrastructure
- design-system discipline is preserved
- shadcn/shared primitives are used where appropriate
- arbitrary styling values are not spreading across the codebase
- the result still matches the serious dark analytical dashboard direction
- provenance, anomalies, and metrics remain readable and not visually buried

Reviewer should block if:

- the tree looks correct but real ownership is wrong,
- route code still owns feature logic,
- widgets act like pages,
- convenience imports cross slice boundaries,
- the UI drifts into scattered one-off styling,
- the result looks like generic SaaS chrome instead of the intended operator
  console.
