---
title: ADR-017 - Broadcast unsubscribe via mailto reply (no web route)
tags: [adr, mail, mailings]
updated: 2026-07-05
---

# ADR-017: Mailto unsubscribe, BCC delivery kept

**Status**: accepted (production-plan P2.3), shipped.

## Context

Broadcasts ("Rundschreiben") need a lawful opt-out. A tokenized
web-unsubscribe route would require public unauthenticated endpoints,
token storage and expiry handling for a recipient list of workshop
customers who mostly reply by mail anyway.

## Decision

Every broadcast appends a German "Abbestellen" footer (text + HTML
variants) and sets a `List-Unsubscribe:
<mailto:...?subject=Abbestellen>` header pointing at the company email
(fallback SMTP reply-to/from). Opt-out is a **mailto reply**; the
operator flips `customers.wantsBroadcast`, which the recipient query
already filters. Delivery stays BCC in batches of 50. Ad-hoc
single-customer mails are transactional and get NO footer.

## Consequences

- No public unsubscribe endpoint to secure.
- Opt-out is manual-operator latency (acceptable at this scale).
- Details: [[mailings]], [[smtp-mail]].
