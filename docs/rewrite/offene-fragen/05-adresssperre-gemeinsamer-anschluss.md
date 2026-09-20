# 05 — Die Adresssperre trifft alle hinter derselben Adresse

**Betrifft:** P-15, T-007, P-22 · **Stand:** **entschieden am 20.09.2026**,
umgesetzt

## Worum es geht

Sie haben festgelegt: ein Fehlversuch auf einen **unbekannten** Benutzernamen
sperrt die **Adresse**; ein falsches Passwort auf ein **bekanntes** Konto
sperrt **beides**, Konto und Adresse.

Im Haus sitzen alle hinter **derselben** Adresse.

## Was das im Alltag bedeutet

Drei Fehlversuche auf ein bekanntes Konto sperren nach der Staffel für zehn
Minuten — das Konto **und** den Anschluss. Damit kann sich in diesen zehn
Minuten **niemand im Betrieb** neu anmelden.

## Die Abmilderung, die ich eingebaut habe

Eine Adresssperre gilt **nur für neue Anmeldungen**. Wer bereits angemeldet
ist, arbeitet weiter — keine laufende Sitzung wird beendet. Ein Tippfehler legt
also niemanden lahm, der schon am Rechner sitzt; er trifft den, der sich gerade
anmelden will.

Dazu kommt: der Administrator entsperrt das Konto sofort. Die **Adresssperre**
löst er damit allerdings **nicht** mit auf — sie läuft von selbst ab.

## Was zur Wahl steht

**A — so lassen.** Streng, und im Ernstfall zehn Minuten Wartezeit für alle,
die sich neu anmelden wollen.

**B — die Adresse nur bei unbekannten Benutzernamen zählen.** Das ist das
Muster, das einen Angriff wirklich verrät: jemand probiert Namen durch. Ein
falsches Passwort auf ein bekanntes Konto sperrt dann nur dieses Konto. Im Haus
merkt davon niemand etwas außer dem Betroffenen.

**C — wie A, aber der Administrator kann auch die Adresse entsperren.** Ein
zweiter Knopf auf der Benutzerseite.

## Empfehlung

**B**, ergänzt um **C** für den seltenen Fall. Der Fehlversuch auf ein
bekanntes Konto sagt über die Adresse wenig aus — hinter ihr sitzen acht Leute,
von denen sich jeder mal vertippt. Der Fehlversuch auf einen *erfundenen* Namen
sagt viel.

Umgesetzt ist derzeit **A**, weil Sie es so gesagt haben.


---

## Entschieden am 20.09.2026 — und umgesetzt

> „Gesperrt wird bei beidem — unbekannter Benutzername und falsches Passwort
> auf ein bekanntes Konto — aber gestaffelt: stimmt der Benutzername, 10
> Fehlversuche; sonst 5. Der Betrieb muss sowohl am Standort im internen
> Netzwerk als auch von außen möglich sein. Intern muss korrekt erkannt
> werden, dass die internen IP-Adressen genommen werden; diese dürfen sehr
> wohl gesperrt werden. In den Einstellungen kann ein sicherer
> IP-Adressbereich eingetragen werden, aus dem niemals geblockt wird. Der
> Administrator bekommt einen Knopf, um eine IP-Sperre sofort aufzuheben. In
> den Einstellungen muss genau sichtbar sein, was wo wie wann gesperrt wurde.
> Das läuft außerdem ins globale Protokoll. Fehlversuche zählen nur innerhalb
> eines Zeitfensters: fünf Fehlanmeldungen über ein Jahr verteilt dürfen nicht
> zur Sperre führen."

**Was daraufhin entstand.**

| Zusage | Wo sie steht |
| --- | --- |
| Zwei Staffeln — Konto 10/20/40, Adresse 5/10/20 | `ACCOUNT_STEPS`, `ADDRESS_STEPS` in `server/utils/account-lock.ts` |
| Sicherer Adressbereich, leer als Voreinstellung | `company_settings.safe_ip_ranges`, Rechnung in `shared/ip-range.ts` |
| Einzelne Adresse, Netz (`/24`) und Bereich (`.10-50`) werden verstanden | `matchesEntry`, 49 Unit-Tests |
| Ein unverständlicher Eintrag wird beim Speichern abgewiesen | `safeIpRangesSchema` |
| Knopf „Adresssperre aufheben" | `unlockAddress`, Tabelle `address_locks` |
| Übersicht „was wann von wo gesperrt" | `lockedAddresses`, Oberfläche in T-034 |
| Zeitfenster von 24 Stunden | `LOCK_WINDOW_MS`, Test über ein Jahr verteilter Versuche |

**Eine Lücke wurde dabei geschlossen.** Die dauerhafte Adresssperre war
gerechnet — und wäre nach 24 Stunden von selbst weg gewesen, weil die
Fehlversuche aus dem Zählfenster fallen. Derselbe Fehler war beim Konto schon
einmal drin. Sie steht jetzt als Datum in `address_locks.locked_at`.

**Die Reihenfolge ist wichtig:** der sichere Bereich wird **zuerst** geprüft,
vor jeder festgehaltenen Sperre. Sonst bliebe eine Adresse gesperrt, die
jemand nachträglich in den sicheren Bereich aufgenommen hat — und niemand käme
mehr herein.
