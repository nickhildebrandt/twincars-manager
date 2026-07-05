---
title: ADR-009 - No in-process scheduler
tags: [adr, architecture, jobs]
updated: 2026-07-05
---

# ADR-009: No in-process scheduler

**Status**: accepted, enforced.

## Context

Several jobs recur: payment reminders, seasonal tire mails, recurring
ledger entries, future eBay reconciliation polling. An in-process
scheduler (setInterval/cron lib) couples job execution to web-server
uptime, complicates the single-container deployment and risks duplicate
runs across restarts.

## Decision

The web process only serves HTTP. Recurring work is exposed as
idempotent, operator-triggered actions in the UI ("Jetzt prüfen"
buttons) - e.g. `autoSendDuePaymentRemindersRemote` ([[reminders]]),
`sendTireReminders` ([[tire-storage]]) - designed so a future external
cron (systemd timer, like the deploy timers in [[deployment]]) can call
the same code path. Idempotency guards live in the data model
(`tire_reminder_log` unique tuple, reminder due-date logic).

## Consequences

- Nothing happens while nobody clicks - acceptable for a small
  workshop; the operator workflow includes the buttons.
- Wiring an external trigger later needs no app redesign.
- Every job must stay idempotent and re-runnable.
