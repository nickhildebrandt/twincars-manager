# 05 — Die Adresssperre trifft alle hinter derselben Adresse

**Betrifft:** P-15, T-007 · **Stand:** umgesetzt wie gefordert, mit einer
Abmilderung

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
