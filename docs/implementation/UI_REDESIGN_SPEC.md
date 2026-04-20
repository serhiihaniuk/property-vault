# Property Vault UI Redesign Spec

**Status:** Approved implementation target
**Last updated:** 2026-04-19

This document binds the external Property Vault handoff to the live app
backlog. It is the production-facing interpretation of the design bundle, not a
copy of the prototype.

This is a durable redesign reference, not an automatic authority for every UI
task. A task file may list this document as primary context, secondary context,
or explicitly non-authoritative for exception-heavy work such as exact-fidelity
transplants.

## 1. Current binding to the repo

This redesign starts from the current app state:

- data/API foundations are already implemented,
- dashboard, documents, provenance, reconciliation, anomalies, and effective
  charge schedule logic already exist,
- redesign work is the next major wave,
- access/invite UI should land on top of the redesign system, not before it.

The redesign must preserve the approved app architecture:

- Next.js App Router
- shadcn/Base UI
- REST + OpenAPI
- no Server Actions
- no direct DB reads in components
- minimal FSD

## 2. Default redesign reference order

Use this order only when a task file does not declare a narrower authority
stack.

Default precedence order:

1. this file
2. `docs/design/property-vault-mvp/property-vault-reference.png`
3. `docs/design/property-vault-mvp/Property Vault.html`

Interpretation rule:

- this spec defines production behavior and design-system intent,
- the screenshot is the first visual reference,
- the HTML is a detailed prototype source,
- when screenshot annotations conflict with the HTML, prefer the screenshot and
  this spec.

## 3. Product direction

The app is a private property-operations console, not a marketing site and not
 a generic consumer finance app.

The redesign must feel:

- dense,
- serious,
- calm,
- evidence-oriented,
- operator-friendly,
- shadcn-faithful rather than bespoke.

MVP direction:

- no sidebar,
- finance-first landing surface,
- open-the-app-and-see-the-latest-state immediately,
- per-category financial breakdown,
- clear links between current state, monthly drift, evidence, and anomalies,
- English chrome and product labels,
- Polish source-derived text preserved verbatim where it comes from records.

## 4. Layout and information hierarchy

### 4.1 Shell

Use a compact finance-first shell:

- sticky top bar,
- app mark and product identity,
- current property/unit context,
- compact sync/status controls,
- no persistent left navigation in v1.

### 4.2 Dashboard hierarchy

The dashboard must prioritize:

1. current month snapshot,
2. balance / recent ledger context,
3. per-category breakdown,
4. monthly trend,
5. anomalies and upcoming/open items,
6. recent evidence sources.

### 4.3 Category breakdown behavior

Do not make category cards depend on expand/collapse for essential information.

The screenshot feedback indicates the redesign should move away from expandable
cards as the primary interaction. The production direction is:

- each category card should expose meaningful state immediately,
- last month vs this month should be visible by default,
- readings, rates, and charge context should be visible or nearly visible
  without hiding the card's usefulness behind disclosure,
- compact per-card visual context such as a sparkline or mini chart is welcome
  when it improves scanning.

Inline expansion can still exist for secondary details, but the card must be
useful in its default collapsed state.

## 5. Design system

### 5.1 Tokens

Implement the redesign through semantic tokens, not page-local values.

Required token layers:

- foundation tokens for spacing, radius, typography, borders, shadows, and
  motion
- semantic surface tokens for app background, card background, elevated card,
  border, muted border, primary text, secondary text, subtle text
- status tokens for success, warning, danger, info, pending, missing-data
- data-view tokens for positive delta, negative delta, neutral delta, review
  needed

### 5.2 Typography

Use:

- Geist Sans for UI text
- Geist Mono for money, hashes, references, meter readings, rates, and dates
- tabular numerals for all metrics and money values

### 5.3 Surfaces and density

The app should stay dark-only in this phase.

Visual rules:

- near-black background
- neutral monochrome surfaces
- restrained borders
- compact spacing
- limited semantic color usage
- avoid decorative gradients and marketing-style flourish

### 5.4 Shared primitives

The redesign should produce or refine shared UI primitives for:

- app shell
- page headers
- surface cards
- dense cards
- money values
- delta values
- status badges
- key/value rows
- dense tables
- loading / empty / error states
- document chips / provenance blocks
- sparkline or mini-trend treatments where needed

These belong in shared UI and should be reused across dashboard, documents,
detail, reconciliation, anomalies, and access screens.

## 6. Surface-specific requirements

### 6.1 Dashboard

Must present:

- current month total and payment context,
- account balance / recent ledger,
- category cards with visible comparison context,
- trend section,
- anomalies / open items,
- recent evidence sources.

### 6.2 Documents catalog

Must feel dense and operational:

- scannable list/table structure,
- strong metadata readability,
- clear type/status/provenance cues,
- no generic admin-table styling drift.

### 6.3 Document detail and provenance

Must keep evidence trust high:

- extracted facts readable first,
- provenance clearly grouped,
- financial rows and supporting details visually calm,
- hashes, dates, and source refs easy to scan in mono styling.

### 6.4 Reconciliation and anomalies

Must feel like finance analysis surfaces, not secondary leftovers:

- shared card rhythm and typography,
- explicit deltas and status states,
- strong evidence linkage,
- no bespoke visual language.

### 6.5 Access and invite flows

Must inherit the redesign system after token/primitives work is done:

- same shell language,
- same surface/badge/input treatment,
- simpler density than finance views,
- no parallel auth-only style system.

## 7. Responsive target

First wave is desktop-first and tablet-safe.

That means:

- optimize for laptop/desktop dense workflows,
- keep tablet layouts coherent and readable,
- do not treat mobile as the primary first-wave target,
- avoid fixed-width prototype assumptions that block later responsive work.

## 8. Reviewer fidelity rules

Reviewer should validate redesign work against:

1. this spec,
2. the screenshot,
3. the HTML when needed.

Reviewer should block when:

- prototype CSS is copied instead of translated,
- page-local token systems appear,
- cards hide too much critical information behind expansion,
- the result drifts into generic SaaS chrome,
- evidence/provenance becomes visually buried,
- desktop/tablet layout falls apart,
- loading/error/empty states are missing on redesigned surfaces.
