---
title: ADR-019 - better-auth bleibt, das Rollenmodell auch
kategorie: decisions
status: umgesetzt
updated: 2026-09-13
---

# ADR-019: better-auth bleibt, das eigene Rollenmodell auch

**Status:** angenommen, umgesetzt in Arbeitspaket T-007.

## Zusammenhang

Der Umbau auf Nuxt hätte die Gelegenheit geboten, die Anmeldung neu zu wählen.
Verglichen wurden better-auth, `nuxt-auth-utils` und `sidebase/nuxt-auth`
([Untersuchung](../rewrite/inventar/research-auth.md)).

Die harten Anforderungen: serverseitige Sitzungen, die sich zurückziehen
lassen; eine Drossel gegen Durchprobieren; kein Rückschluss auf vorhandene
Benutzernamen; später vielleicht Passkeys oder zweiter Faktor.

## Entscheidung

**better-auth bleibt.** Gleiche Tabellen, gleiches Geheimnis, gleicher
Cookie-Präfix. Das Rollenmodell mit `roles`, `user_roles` und
`role_permissions` bleibt ebenfalls — das `admin`-Zusatzmodul der Bibliothek
wird **nicht** übernommen.

## Warum

`nuxt-auth-utils` ist schlanker, verlangt aber genau für Zurückziehen,
Untätigkeits-Abmeldung, Drossel und Hash-Verträglichkeit Eigenbau. Das Ergebnis
wäre der heutige Code in Nuxt-Form, ohne dessen Vorteile. `sidebase` scheidet
wegen der offenen Nuxt-4-Frage und des fehlenden Serverkerns aus.

Das `admin`-Zusatzmodul führt Rollen als kommagetrennte Zeichenkette in einer
Spalte. Drei Tabellen können mehr und kosten nichts.

## Was daraus folgt

- **Die Id-Form der Bibliothek bleibt.** `users`, `sessions`, `accounts` und
  `verifications` führen Text-Ids, alle anderen Tabellen `uuid`. Das gegen
  `uuid` zu tauschen hieße, bei jedem Update der Bibliothek dagegen zu
  arbeiten. Die Grenze verläuft sauber und wird geprüft (B-582).
- **Nur vier Endpunkte sind erreichbar.** Siehe
  [Anmeldung und Berechtigungen](../architecture/auth.md).
- **Die eingebaute Drossel ist aus.** Sie liest `x-forwarded-for` von sich aus,
  was ohne Proxy davor genau den Schutz aushebelt, den sie bieten soll (B-003).
- **Der Cookie-Zwischenspeicher ist aus**, damit eine zurückgezogene Sitzung
  sofort endet.

## Was dagegen spricht

Die Bibliothek ist groß und bringt mehr mit, als hier gebraucht wird. Die
Zulassungsliste hält das im Zaum, muss aber bei einem Versionssprung mit
geprüft werden — dafür gibt es einen Test.
