# Templates

openbill rendert jedes Dokument auf dem Server aus einem Template aus HTML, CSS und [Liquid](https://shopify.github.io/liquid/). Gotenberg macht daraus ein PDF. Dasselbe Rendering steckt hinter der Vorschau, dem PDF-Download und dem archivierten PDF eines abgeschlossenen Dokuments.

## Mitgelieferte Templates

![Die Template-Galerie mit Klar, Kante und Leise](/screenshots/de/templates.png)

| Template | Stil |
|---|---|
| Klar | ruhig, klassisch, klare Tabelle |
| Kante | markant: kräftiger Farbblock, große Summe, starke Linien |
| Leise | minimal: viel Weißraum, Serifenschrift, Haarlinien |

Die mitgelieferten Templates können Deutsch und Englisch (sie folgen der Sprache des Dokuments) und zeigen Zwischensummen der Gruppen, optionale Positionen, Steuerzeilen, gesetzliche Hinweise und Seitenzahlen. Sie sind schreibgeschützt und werden mit openbill aktualisiert (`php artisan migrate` legt sie an, `php artisan app:sync-templates` bringt sie auf den neuesten Stand). Zum Anpassen duplizierst du es (Templates → Duplizieren) und bearbeitest die Kopie.

## Welches Template ein Dokument nutzt

Ein Dokument nutzt sein eigenes Template, sonst das Standard-Template seines Dokumenttyps, sonst Klar. Beim Abschließen wird das Template mit den übrigen Stammdaten eingefroren und das PDF archiviert. Spätere Änderungen am Template oder sein Löschen ändern ein abgeschlossenes Dokument und sein PDF nie.

## Template-Editor

![Der Template-Editor: Code links, Vorschau rechts](/screenshots/de/template-editor.png)

**Templates** zeigt jedes Template mit einer Vorschau seiner ersten Seite (auf dem Server mit Beispieldaten gerendert). **ZIP importieren** fügt ein Template-Paket hinzu, **Duplizieren** legt eine bearbeitbare Kopie an („Klar (Kopie)“), **Löschen** entfernt eigene Templates (nicht, solange Dokumente sie benutzen).

Der Editor hat fünf Tabs – Kopfzeile, Inhalt, Fußzeile, CSS und Manifest – mit Syntax-Hervorhebung; im Manifest-Tab gibt es zusätzlich ein Formular für das Papier (Format, Höhe von Kopf- und Fußzeile, Seitenränder). Links listet die Feldleiste Kern- und eigene Felder jeder Ebene; ein Klick fügt den Ausdruck an der Cursorposition ein. Rechts rendert die Vorschau den ungespeicherten Stand 250 ms nach der letzten Änderung auf dem Server und hebt den Bereich des aktuellen Tabs hervor. **Beispieldaten** wechselt zwischen den Beispielszenarien und echten Dokumenten (auch Entwürfen). Fehler stehen über der Vorschau mit Datei und Zeile und sind im Code unterwellt; ein Klick springt hin. **Speichern** (⌘S / Strg+S) schreibt die Teile, **Exportieren** lädt den gespeicherten Stand als Paket. Mitgelieferte Templates öffnen schreibgeschützt. Assets (Schriften, Bilder) bearbeitet der Editor nicht: Sie kommen mit dem Paket oder per `PUT /api/templates/{id}/files`. Wer lieber im eigenen Editor mit Live-Vorschau arbeitet, lädt das [Template-Toolkit](/de/template-toolkit) herunter (**Toolkit** im Kopf des Editors).

## Template-Paket

Templates werden als ZIP-Datei ausgetauscht:

| Datei | Inhalt |
|---|---|
| `manifest.json` | Name, Version, Papier und mehr (Pflicht, siehe unten) |
| `template.liquid` | Inhalt des Dokuments (Pflicht) |
| `header.liquid` | Kopfzeile auf jeder Seite (optional) |
| `footer.liquid` | Fußzeile auf jeder Seite (optional) |
| `styles.css` | CSS für den Inhalt (optional, reines CSS ohne Liquid) |
| `assets/…` | Bilder (png, jpg, gif, webp, svg) und Schriften (woff, woff2, ttf, otf) |

Die Dateien dürfen auch in einem Ordner im ZIP liegen. Grenzen: 10 MB je Paket, 20 MB entpackt, 100 Dateien, 2 MB je Asset. Andere Dateien, Pfade mit `..` und absolute Pfade werden abgelehnt.

Assets verweist du mit relativem Pfad an, in HTML und in CSS:

```html
<img src="assets/logo.svg" alt="">
```

```css
@font-face { font-family: Brand; src: url(assets/brand.woff2); }
```

openbill bettet sie beim Rendern als Data-URL ein. Bilder und Schriften kommen nur auf diesem Weg ins Dokument – als Template-Assets (oder das Logo der Organisation, `org.logo`): Ein gerendertes Dokument darf nichts anderes laden. Jedes Dokument trägt eine Content-Security-Policy (`default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'`), Bilder, Schriften, Stylesheets oder Frames von `http(s)://…` und alle Skripte werden also blockiert; zusätzlich läuft Gotenberg ohne JavaScript und ohne Netzzugriff.

## manifest.json

```json
{
  "name": "Nordlicht Brief",
  "version": "1.0.0",
  "author": "Studio Nordlicht",
  "license": "MIT",
  "description": "Briefbogen mit Logo",
  "documentTypes": ["offer", "invoice"],
  "expectedFields": [
    { "scope": "document", "key": "project_name", "type": "text", "fallback": "" }
  ],
  "paper": { "format": "A4", "marginX": "20mm", "headerHeight": "30mm", "footerHeight": "20mm" },
  "translations": {
    "en": { "hotline": "Hotline" },
    "de": { "hotline": "Hotline" }
  }
}
```

| Schlüssel | Pflicht | Bedeutung |
|---|---|---|
| `name` | ja | Anzeigename (höchstens 100 Zeichen) |
| `version` | ja | Version wie `1.0.0` |
| `author`, `license`, `description` | nein | Texte |
| `documentTypes` | nein | Dokumenttypen, für die das Template gedacht ist: `offer`, `confirmation`, `invoice`, `cancellation` |
| `expectedFields` | nein | eigene Felder, die das Template nutzt (`scope`, `key`, `type`, `fallback`), als Hinweis, wenn ein Feld fehlt |
| `paper` | nein | `format` (`A4` oder `Letter`), `marginX` (links und rechts), `headerHeight`, `footerHeight`; Längen in `mm`, `cm`, `in`, `pt` oder `px`. Standard: A4, 20mm, 30mm, 20mm |
| `translations` | nein | eigene Wörter für den Filter `t`, je Sprache (`en`, `de`) |

## Seitenaufbau

Jede Seite hat drei Bereiche, genau so, wie Chromium sie druckt:

- die **Kopfzeile** füllt den oberen Rand (`headerHeight`) über die volle Seitenbreite,
- die **Fußzeile** füllt den unteren Rand (`footerHeight`),
- der **Inhalt** liegt dazwischen, `marginX` vom linken und rechten Rand entfernt, und läuft über so viele Seiten wie nötig.

Kopf- und Fußzeile sind eigene HTML-Dokumente (so breit wie die Seite und so hoch wie ihr Rand): `styles.css` gilt dort nicht, setze also ein `<style>`-Element in `header.liquid` und `footer.liquid` und gib Schriftgrößen dort ausdrücklich an. Hintergründe und Farben werden gedruckt.

::: v-pre

## Liquid-Referenz

Templates nutzen normales Liquid (`{% if %}`, `{% for %}`, `{% assign %}`, `{% capture %}`, `{% case %}`, Standardfilter wie `upcase`, `default`, `append`, `size`) und dazu den Kontext und die Filter unten.

### Kontext

Alle Beträge sind Strings mit Punkt und zwei Nachkommastellen (`"1130.50"`), Datumswerte `YYYY-MM-DD`. Alle Texte sind bereits HTML-escaped: Gib sie direkt aus, `escape` brauchst du nicht.

**`org`** – deine Organisation

| Schlüssel | Inhalt |
|---|---|
| `name`, `street`, `zip`, `city`, `country` | Anschrift (`country` als ISO-Code, `DE`) |
| `logo` | Logo als Data-URL, leer ohne Logo: `{% if org.logo != blank %}<img src="{{ org.logo }}">{% endif %}` |
| `vat_id`, `tax_number` | USt-ID, Steuernummer |
| `registration_id` | Registernummer, z. B. Handelsregister (`HRB 12345, Amtsgericht Hamburg`) |
| `iban`, `bic`, `bank_name` | Bankverbindung |
| `email`, `phone`, `website` | Kontakt |
| `taxation_mode`, `small_business` | `regular` oder `small_business`; `small_business` ist bei Kleinunternehmern (§ 19 UStG) `true` |
| `locale` | Standardsprache |

**`customer`** – leer, wenn das Dokument keinen Kunden hat: `number`, `name`, `street`, `zip`, `city`, `country`, `email`, `vat_id`, `tax_treatment` (`domestic`, `eu_reverse_charge`, `third_country`), `kind` (`business`, `consumer`), `locale`.

**`contact`** – der Ansprechpartner, kann leer sein: `salutation`, `first_name`, `last_name`, `full_name`, `position`, `email`, `phone`.

**`document`**

| Schlüssel | Inhalt |
|---|---|
| `type`, `type_label` | `offer`, `confirmation`, `invoice`, `cancellation`; der Name in der Dokumentsprache |
| `status` | `draft`, `open`, `accepted`, `paid`, … |
| `number` | Nummer; Entwürfe zeigen „Entwurf“/„Draft“ |
| `date`, `due_date`, `valid_until`, `service_date`, `service_date_end` | Datumswerte (können leer sein) |
| `locale` | Dokumentsprache (`en`, `de`) |
| `intro`, `closing` | Texte vor und nach den Positionen (dürfen selbst Liquid enthalten, siehe unten) |
| `net_total`, `tax_total`, `gross_total` | Summen |
| `optional_total` | Summe der optionalen Positionen (Angebote), nicht in den Summen enthalten |
| `tax_breakdown` | Liste der Steuerzeilen mit `category`, `percent` (`"19"`), `net`, `tax`, `gross` |
| `legal_notes` | Liste der gesetzlichen Hinweise (Kleinunternehmer, Reverse Charge, Drittland) |
| `source_number` | Nummer des Dokuments, aus dem dieses entstanden ist (Angebot → Rechnung, Rechnung → Storno) |

**`groups`** – die Positionsgruppen in Reihenfolge: `title`, `has_title` (`false` für Positionen ohne Gruppe), `total`, `optional_total`, `positions`.

**`positions`** – alle Positionen aller Gruppen in Reihenfolge (dieselben Objekte wie in `groups[].positions`):

| Schlüssel | Inhalt |
|---|---|
| `index` | laufende Nummer von Leistungen und optionalen Positionen; leer bei Textzeilen |
| `kind`, `is_item`, `is_text`, `is_optional` | `item`, `text`, `optional` und die passenden Schalter |
| `title`, `description` | Texte |
| `quantity` | Menge ohne Nullen am Ende (`"10"`, `"1.5"`) |
| `unit`, `unit_name`, `unit_code` | Kürzel (`Std.`), Name (`Stunde`), UN/ECE-Code (`HUR`) |
| `unit_price` | Einzelpreis, mindestens zwei Nachkommastellen (`"95.00"`, `"12.3456"`) |
| `tax_percent` | Steuersatz (`"19"`) |
| `total` | Nettobetrag der Zeile |
| `group` | Titel der Gruppe (leer bei Positionen ohne Gruppe) |

**`page`** – nur in `header.liquid` und `footer.liquid`: `{{ page.number }}` und `{{ page.total }}` (siehe Seitenplatzhalter).

### Eigene Felder

Eigene Felder stehen direkt an ihrem Objekt, unter ihrem Schlüssel: `{{ document.project_name }}`, `{{ customer.industry }}`, `{{ contact.department }}`, `{{ org.managing_director }}`, `{{ p.ticket }}` für eine Position `p`. Eingebaute Schlüssel sind reserviert, ein eigenes Feld verdeckt also nie eins. Ein Feld ohne Wert gibt nichts aus; mit `default` setzt du einen Ersatz: `{{ document.po_number | default: "–" }}`.

### Filter

| Filter | Beispiel | Ergebnis (de / en) |
|---|---|---|
| `money` | `{{ document.gross_total \| money }}` | `1.130,50 €` / `€1,130.50` |
| `money: Stellen` | `{{ p.unit_price \| money: 4 }}` | `12,3456 €` / `€12.3456` |
| `number: Stellen` | `{{ p.quantity \| number: 2 }}` | `1,50` / `1.50` (Standard 2 Stellen) |
| `date` | `{{ document.date \| date }}` | `04.10.2026` / `Oct 4, 2026`. Eine ganze Zahl gilt als Unix-Zeitstempel (Sekunden). |
| `date: Format` | `{{ document.date \| date: "%d.%m.%Y" }}` | strftime-Muster wie beim Standardfilter `date` |
| `nl2br` | `{{ document.intro \| nl2br }}` | Zeilenumbrüche werden zu `<br>` |
| `t` | `{{ 'total' \| t }}` | `Gesamt` / `Total` |

Formate folgen der Dokumentsprache. Beträge werden kaufmännisch gerundet. `money` und `number` geben bei Werten, die keine Zahl sind, nichts aus. Ein unbekannter Filter ist ein Fehler.

Die Rechenfilter `plus`, `minus`, `times`, `divided_by` und `round` rechnen mit exakten Dezimalzahlen und liefern einen Dezimaltext (`{{ document.net_total | times: 1.19 }}` → `"1345.2950"`, `round` rundet kaufmännisch); mit zwei ganzen Zahlen bleibt es bei Liquids Ganzzahl-Verhalten (`{{ 10 | divided_by: 4 }}` → `2`). Zwei ganze Zahlen bleiben ganze Zahlen (`divided_by` rundet ab); ein Ergebnis jenseits von ±9,2 × 10¹⁸ kommt als exakter Text zurück und rechnet danach dezimal weiter (ein folgendes `divided_by` rundet nicht mehr ab). Nutze lieber die Summen aus dem Kontext, als Beträge im Template zu rechnen.

### Escaping

Alle Texte im Kontext sind vor dem Rendern genau einmal HTML-escaped. Deshalb:

- `escape` brauchst du nicht; es arbeitet wie `escape_once` und escapt nie doppelt, ändert also nichts,
- `truncate` und `slice` zählen den escapten Text und können eine Entity zerschneiden (`&am…`); kürze nur Texte ohne `&`, `<`, `>` oder Anführungszeichen,
- in Einleitung und Schlusstext werden Filter, die HTML erzeugen (`nl2br`), mit dem Text escapt: `nl2br` im Template auf `document.intro` anwenden, nicht in der Einleitung selbst.

### Wörter in der Dokumentsprache (`t`)

`{{ 'key' | t }}` sucht das Wort zuerst in `translations` deines Manifests (Dokumentsprache), dann im Vokabular von openbill, sonst wird der Schlüssel ausgegeben. Vokabular von openbill: `amount_due`, `credit`, `customer_number`, `date`, `details`, `draft`, `due_date`, `for`, `net`, `number`, `number_short`, `of`, `offer_total`, `optional`, `optional_total`, `page`, `pos`, `price`, `project`, `quantity`, `reference`, `service`, `service_date`, `subtotal`, `sum`, `tax_number`, `total`, `unit_price`, `valid_until`, `vat`, `vat_id`, `vat_long`, `vat_on`.

### Seitenplatzhalter

In Kopf- und Fußzeile werden `{{ page.number }}` und `{{ page.total }}` zur aktuellen Seite und zur Seitenzahl:

```liquid
{{ 'page' | t }} {{ page.number }} {{ 'of' | t }} {{ page.total }}
```

Sie funktionieren nur in `header.liquid` und `footer.liquid` und nur genau so geschrieben (Filter lassen sich darauf nicht anwenden).

### Einleitung und Schlusstext

`document.intro` und `document.closing` (meist aus Textbausteinen) sind ebenfalls Liquid und werden zuerst gerendert, mit demselben Kontext: `Bitte überweise den Betrag bis zum {{ document.due_date | date }}.` Gib sie mit `nl2br` aus, damit die Zeilenumbrüche bleiben.

### Leere Texte

In Liquid sind nur `nil` und `false` falsch: Ein leerer Text wie `""` gilt als **wahr**. Texte, die leer sein können (Logo, USt-ID, Beschreibungen, Einleitung, eigene Felder), prüfst du deshalb mit `!= blank`; das ist für leere Texte und fehlende Werte falsch:

```liquid
{% if org.vat_id != blank %}{{ 'vat_id' | t }} {{ org.vat_id }}{% else %}{{ 'tax_number' | t }} {{ org.tax_number }}{% endif %}
```

Werte, die statt eines Texts leer sind (`customer`, `contact`, Datumswerte, `source_number`), und Schalter (`is_text`, `has_title`) funktionieren mit einem einfachen `{% if %}`.

### Beträge vergleichen

Beträge sind Strings. Vergleiche sie mit `>` oder `<`, die Zahlen vergleichen: `{% if document.optional_total > 0 %}`. Nutze `== 0` oder `!= 0` nicht mit Beträgen: `"0.00" != 0` ist in Liquid wahr.

## Grenzen und Fehler

Ein Template kann openbill weder kaputt machen noch blockieren:

- jeder Teil (Kopfzeile, Inhalt, Fußzeile, Styles) darf höchstens 200 KB groß sein, das gerenderte HTML eines Teils höchstens 5 MB,
- Schleifen und Ausgabe sind begrenzt (eine Schleife über einen Bereich wie `(1..n)` darf höchstens 10 000 Einträge haben; endlose oder riesige Schleifen enden mit „Render-Grenze“),
- `{% render %}` und `{% include %}` gibt es nicht, `{% tablerow %}` auch nicht,
- `styles.css` darf kein `</style>` enthalten,
- das Papier muss Platz für den Inhalt lassen: doppelter `marginX` kleiner als die Seitenbreite, `headerHeight + footerHeight` mindestens 20mm kleiner als die Seitenhöhe,
- beim Import muss jeder Teil unter 200 KB bleiben, Feldschlüssel in `expectedFields` müssen wie `project_name` aussehen, und Assets müssen wirklich das sein, was ihre Endung sagt,
- ein Rendering bricht nach 5 Sekunden ab; die Zeit wird in jedem Schleifendurchlauf und vor jedem Filteraufruf geprüft, auch eine lange Filterkette endet also rechtzeitig,
- keine Skripte und keine externen URLs: `<script>`, `<iframe>`, Bilder, Schriften und Stylesheets von `http(s)://` werden blockiert (Template-Assets nutzen), und jedes `<meta http-equiv>` (refresh, eigene Regeln) ist ein Template-Fehler,
- ein Rendering darf höchstens 128 MB Speicher nutzen; `capture` und jeder Filter, dessen Ergebnis größer als seine Eingabe werden kann (`replace`, `append`, `join`, `split`, `base64_encode`, `url_encode`, `upcase`, …), prüft die Größe vor dem Aufbau gegen die Ausgabegrenze, Arrays aus Filtern haben höchstens 100 000 Einträge, Zahlen in Rechenfiltern höchstens 1 000 Stellen.
- `file:`-URLs: Gotenberg dürfte lokale Dateien lesen, aber die Content-Security-Policy am Anfang jedes gerenderten Dokuments sperrt alles außer `data:` – ein Template mit `file:///tmp/…` oder anderen lokalen Pfaden zeigt nichts an. Verwende in Templates nie `file:`, sondern Assets.

Jeder Fehler wird mit **Bereich** (`header`, `body`, `footer`, `css`, `manifest`, `intro`, `closing`), **Datei** und **Zeile** gemeldet, zum Beispiel `body · template.liquid · Zeile 3 · Unexpected character }`. Die Vorschau zeigt den Fehler anstelle des kaputten Teils. Abschließen und Entwurfs-PDF verweigern, solange das Template Fehler hat; ein kaputtes Template landet so nie in einem archivierten PDF.

## Beispieldaten

Für Vorschauen ohne echtes Dokument hat openbill fünf Szenarien: `short_invoice`, `long_invoice` (mehrseitig, Gruppen), `small_business`, `reverse_charge` und `offer_with_options`. Sie nutzen deine Organisation (auf einer frischen Installation die fiktive Firma Studio Nordlicht), einen fiktiven Kunden, feste Daten und Beispielwerte für deine eigenen Felder. Als PDF auf der Kommandozeile:

```bash
php artisan app:render-sample klar long_invoice --locale=de
```

Das PDF landet unter `storage/app/private/samples/`.

## Beispiel

```liquid
<h1>{{ document.type_label }} {{ document.number }}</h1>
<p>{{ customer.name }}<br>{{ customer.street }}<br>{{ customer.zip }} {{ customer.city }}</p>

{% if document.intro != blank %}<p>{{ document.intro | nl2br }}</p>{% endif %}

<table>
  {% for g in groups %}
    {% if g.has_title %}<tr><th colspan="3">{{ g.title }}</th></tr>{% endif %}
    {% for p in g.positions %}
      <tr>
        <td>{{ p.index }}</td>
        <td>{{ p.title }}{% if p.is_optional %} ({{ 'optional' | t }}){% endif %}</td>
        <td>{% unless p.is_text %}{{ p.total | money }}{% endunless %}</td>
      </tr>
    {% endfor %}
  {% endfor %}
</table>

<p>{{ 'total' | t }}: {{ document.gross_total | money }}</p>
{% for note in document.legal_notes %}<p>{{ note }}</p>{% endfor %}
```

:::
