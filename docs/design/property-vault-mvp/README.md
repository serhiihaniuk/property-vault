# Property Vault MVP Handoff

This folder contains the repo-native copy of the external design handoff for
the finance-first Property Vault MVP.

These files are reference artifacts, not implementation code.

## What is authoritative

Use this order when a UI redesign task needs visual guidance:

1. `docs/implementation/UI_REDESIGN_SPEC.md`
2. `property-vault-reference.png`
3. `Property Vault.html`

Reason:

- the redesign spec is the production interpretation for this repo,
- the screenshot is the fastest visual orientation and reviewer reference,
- the HTML is the detailed prototype source when layout or micro-details are
  ambiguous.

## Important prototype rules

- Do not copy raw HTML/CSS into the app.
- Do not treat prototype values as production tokens.
- Use shadcn/base UI, shared primitives, and semantic design tokens.
- Treat the screenshot annotations as later feedback when they conflict with
  the prototype HTML.

## MVP direction captured here

- no sidebar,
- finance-first single-surface MVP,
- dark-only dense operator console,
- snapshot-first landing page,
- English UI chrome with Polish source-derived content,
- category-level drill-down,
- evidence/provenance-friendly presentation.

## Notes about the screenshot

The screenshot is not just a pretty export. It also includes follow-up visual
comments that refine the MVP direction.

At the moment, the screenshot indicates that category cards should not rely on
expand/collapse as the main interaction and should expose richer per-category
context directly, including compact chart/trend treatment where useful.
