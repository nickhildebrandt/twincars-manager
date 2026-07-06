---
title: Full-page creation flow (pickers)
tags: [architecture, pickers, forms, creation-flow]
updated: 2026-07-06
---

# Full-page creation flow

When a picker needs a record that does not exist yet, the app navigates
to the entity's regular full-page create form and returns afterwards.
The inline quick-create mini-forms (`QuickCreateCustomerForm` /
`QuickCreateVehicleForm`, `createForm` snippet) were removed; one form
per entity, used everywhere.

## The store - `src/lib/stores/creation-flow.svelte.ts`

`creationFlow` is a stack store of frames:

```ts
type CreationFlowFrame = {
  entity: 'customer' | 'vehicle' | 'employee'
  returnUrl: string // path + search of the origin page
  originField: string // picker field that started the flow, e.g. 'customerId'
  draft: unknown // JSON-serializable snapshot of the origin form
  createdAt: number // epoch ms; stale flows are dropped
}
```

- Mirrored to `sessionStorage` under `twincars.creation-flow` so it
  survives the full-page navigations (SSR-guarded; quota failures
  degrade to in-memory).
- A stack untouched for **1 hour** is dropped on load as abandoned
  (all-or-nothing; pruning single levels would corrupt the chain).
- API: `start(frame)`, `finish({ id, label })` / `cancel()` (both pop
  the top frame, stash the pending return and hand back `returnUrl`),
  `pendingReturnFor(url)` (consumed exactly once, only when the URL
  matches), `top`, `depth`, `activeEntities()`, `reset()`.

## The round trip

1. **Host** form (e.g. `WorkOrderForm`, `invoices/new`, `CalendarForm`,
   `HoursForm`, `TireStorageForm`, `VehicleForm` for its Vorbesitzer /
   holder pickers): builds a JSON draft of its entire state
   (`buildDraft()`; Maps become entry arrays because a `Map` would not
   survive JSON), calls `creationFlow.start(...)`, clears `formDirty`
   and `goto`s the leaf.
2. **Leaf** pages are the regular `/customers/new`, `/vehicles/new` and
   `/employees/new`. In flow mode (`creationFlow.top?.entity === ...`)
   they show an info hint ("wird nach dem Speichern automatisch im
   vorherigen Formular ausgewählt") and call
   `creationFlow.finish({ id, label })` after create, or
   `creationFlow.cancel()`, then `goto(returnUrl)`.
3. Back on the host, `creationFlow.pendingReturnFor(currentUrl())`
   returns `{ draft, originField, result }` exactly once; the host seeds
   every `$state` from the draft, re-arms the unsaved-changes guard and
   auto-selects `result` into the picker named by `originField`
   (labels use `src/lib/utils/picker-labels.ts` formats).

Flows nest: Auftrag -> Fahrzeug -> Kunde works because each level is its
own frame. The **cycle guard** is `activeEntities()`: hosts hide "Neu
anlegen" for entity types already on the stack, so a vehicle form opened
from a vehicle flow cannot start a second vehicle flow.

## Picker dialog affordance

`SearchablePicker` and `MultiSearchablePicker` render "Neu anlegen"
**exactly once per dialog, in the header next to the close button**, and
only when the host passes both `createLabel` and `onCreateNew`. The
dialog closes before `onCreateNew` fires. No create buttons in the
result list, no inline forms.

## MultiSearchablePicker

`src/lib/components/ui/MultiSearchablePicker.svelte` is the multi-select
variant of `SearchablePicker` (first consumer: work-order assignees,
[[orders]]): same server-side search + `Pagination`, rows
carry checkboxes, the selection is kept across pages, and the dialog is
**transactional**: "Übernehmen (N)" writes back to the bindable
`values` / `valueLabels` props, "Abbrechen" or the backdrop discards.

Related: [[remote-functions]] (picker rules), [[loading-and-busy]],
`CONTRIBUTING.md` §9 and §11 for the binding long form.
