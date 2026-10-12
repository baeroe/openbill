# Templates

openbill renders every document on the server from a template written in HTML, CSS and [Liquid](https://shopify.github.io/liquid/). Gotenberg turns the result into a PDF. The same rendering drives the preview, the PDF download and the archived PDF of a finalized document.

## Built-in templates

| Template | Look |
|---|---|
| Klar | calm, classic layout with a clear table |
| Kante | bold: a strong colour band, a large total, heavy rules |
| Leise | minimal: lots of white space, a serif typeface, hairlines |

The built-in templates speak English and German (they follow the language of the document), show group subtotals, optional items, tax rows, legal notes and page numbers. They are read-only and are updated with openbill (`php artisan migrate` creates them, `php artisan app:sync-templates` brings them up to date). To change one, duplicate it (Templates → Duplicate) and edit the copy.

## Which template a document uses

A document uses its own template if it has one, else the default template of its document type, else Klar. When a document is finalized, the template is frozen together with the other master data and the PDF is archived. Changing or deleting the template later never changes a finalized document or its PDF.

## Template editor

**Templates** shows every template with a preview of its first page (rendered on the server with sample data). **Import ZIP** adds a template package, **Duplicate** creates an editable copy (“Klar (copy)”), **Delete** removes your own templates (not while documents still use them).

The editor has five tabs – header, content, footer, CSS and manifest – with syntax highlighting; the manifest tab also has a form for the paper (format, header and footer height, side margins). On the left, the field bar lists the core and custom fields of every level; a click inserts the expression at the cursor. On the right, the preview renders the unsaved state on the server 250 ms after the last change and highlights the area of the current tab. **Sample data** switches between the sample scenarios and real documents (also drafts). Errors appear above the preview with file and line and are underlined in the code; a click jumps there. **Save** (⌘S / Ctrl+S) writes the parts, **Export** downloads the saved state as package. Built-in templates open read-only. Assets (fonts, images) are not edited here: import them with the package or upload them with `PUT /api/templates/{id}/files`. To work in your own editor with a live preview, download the [template toolkit](/en/template-toolkit) (**Toolkit** in the editor header).

## Template package

A template is exchanged as a ZIP file:

| File | Content |
|---|---|
| `manifest.json` | name, version, paper and more (required, see below) |
| `template.liquid` | the document body (required) |
| `header.liquid` | header on every page (optional) |
| `footer.liquid` | footer on every page (optional) |
| `styles.css` | CSS for the body (optional, plain CSS without Liquid) |
| `assets/…` | images (png, jpg, gif, webp, svg) and fonts (woff, woff2, ttf, otf) |

The files may also sit in one folder inside the ZIP. Limits: 10 MB per package, 20 MB unpacked, 100 files, 2 MB per asset. Other files, paths with `..` and absolute paths are refused.

Reference assets with a relative path, in HTML and in CSS:

```html
<img src="assets/logo.svg" alt="">
```

```css
@font-face { font-family: Brand; src: url(assets/brand.woff2); }
```

openbill embeds them as data URLs while rendering. Images and fonts can only come this way – as template assets (or the organization logo, `org.logo`): a rendered document may not load anything else. Every document carries a Content-Security-Policy (`default-src 'none'; img-src data:; font-src data:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'`), so links to `http(s)://…` images, fonts, stylesheets or frames and all scripts are blocked, and Gotenberg runs without JavaScript and without network access as a second line of defence.

## manifest.json

```json
{
  "name": "Nordlicht Letter",
  "version": "1.0.0",
  "author": "Studio Nordlicht",
  "license": "MIT",
  "description": "Letterhead with logo",
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

| Key | Required | Meaning |
|---|---|---|
| `name` | yes | display name (at most 100 characters) |
| `version` | yes | version like `1.0.0` |
| `author`, `license`, `description` | no | texts |
| `documentTypes` | no | document types the template is meant for: `offer`, `confirmation`, `invoice`, `cancellation` |
| `expectedFields` | no | custom fields the template uses (`scope`, `key`, `type`, `fallback`), shown as hints when a field is missing |
| `paper` | no | `format` (`A4` or `Letter`), `marginX` (left and right), `headerHeight`, `footerHeight`; lengths in `mm`, `cm`, `in`, `pt` or `px`. Default: A4, 20mm, 30mm, 20mm |
| `translations` | no | your own words for the `t` filter, per language (`en`, `de`) |

## Page layout

Every page has three areas, exactly like Chromium prints them:

- the **header** fills the top margin (`headerHeight`) across the full page width,
- the **footer** fills the bottom margin (`footerHeight`),
- the **body** sits in between, `marginX` away from the left and right edge, and flows over as many pages as it needs.

Header and footer are separate HTML documents (as wide as the page and as high as their margin): `styles.css` does not apply to them, so put a `<style>` element into `header.liquid` and `footer.liquid`. Set font sizes there explicitly. Backgrounds and colours are printed.

::: v-pre

## Liquid reference

Templates use standard Liquid (`{% if %}`, `{% for %}`, `{% assign %}`, `{% capture %}`, `{% case %}`, standard filters like `upcase`, `default`, `append`, `size`) plus the context and filters below.

### Context

All amounts are strings with a dot and two decimals (`"1130.50"`), dates are `YYYY-MM-DD`. All texts are already HTML-escaped: print them as they are, `escape` is not needed.

**`org`** – your organization

| Key | Content |
|---|---|
| `name`, `street`, `zip`, `city`, `country` | address (`country` as ISO code, `DE`) |
| `logo` | logo as data URL, empty when there is none: `{% if org.logo != blank %}<img src="{{ org.logo }}">{% endif %}` |
| `vat_id`, `tax_number` | VAT ID, tax number |
| `registration_id` | register number, e.g. the commercial register (`HRB 12345, Amtsgericht Hamburg`) |
| `iban`, `bic`, `bank_name` | bank account |
| `email`, `phone`, `website` | contact |
| `taxation_mode`, `small_business` | `regular` or `small_business`; `small_business` is `true` for small businesses (§ 19 UStG) |
| `locale` | default language |

**`customer`** – empty when the document has no customer: `number`, `name`, `street`, `zip`, `city`, `country`, `email`, `vat_id`, `tax_treatment` (`domestic`, `eu_reverse_charge`, `third_country`), `kind` (`business`, `consumer`), `locale`.

**`contact`** – the contact person, may be empty: `salutation`, `first_name`, `last_name`, `full_name`, `position`, `email`, `phone`.

**`document`**

| Key | Content |
|---|---|
| `type`, `type_label` | `offer`, `confirmation`, `invoice`, `cancellation`; the name in the document language |
| `status` | `draft`, `open`, `accepted`, `paid`, … |
| `number` | number; drafts show "Draft"/"Entwurf" |
| `date`, `due_date`, `valid_until`, `service_date`, `service_date_end` | dates (may be empty) |
| `locale` | document language (`en`, `de`) |
| `intro`, `closing` | texts before and after the items (may contain Liquid themselves, see below) |
| `net_total`, `tax_total`, `gross_total` | totals |
| `optional_total` | sum of optional items (offers), not part of the totals |
| `tax_breakdown` | list of rows with `category`, `percent` (`"19"`), `net`, `tax`, `gross` |
| `legal_notes` | list of legal notes (small business, reverse charge, third country) |
| `source_number` | number of the document this one was created from (offer → invoice, invoice → cancellation) |

**`groups`** – the item groups in order: `title`, `has_title` (`false` for items without group), `total`, `optional_total`, `positions`.

**`positions`** – all items of all groups in order (the same objects as in `groups[].positions`):

| Key | Content |
|---|---|
| `index` | running number of items and optional items; empty for text lines |
| `kind`, `is_item`, `is_text`, `is_optional` | `item`, `text`, `optional` and the matching flags |
| `title`, `description` | texts |
| `quantity` | quantity without trailing zeros (`"10"`, `"1.5"`) |
| `unit`, `unit_name`, `unit_code` | symbol (`h`), name (`Hour`), UN/ECE code (`HUR`) |
| `unit_price` | price per unit, at least two decimals (`"95.00"`, `"12.3456"`) |
| `tax_percent` | tax rate (`"19"`) |
| `total` | net amount of the line |
| `group` | title of the group (empty for items without group) |

**`page`** – only in `header.liquid` and `footer.liquid`: `{{ page.number }}` and `{{ page.total }}` (see page placeholders).

### Custom fields

Custom fields sit directly on their object, with their key: `{{ document.project_name }}`, `{{ customer.industry }}`, `{{ contact.department }}`, `{{ org.managing_director }}`, `{{ p.ticket }}` for a position `p`. Built-in keys are reserved, so a custom field never hides one. A field without value prints nothing; use `default` for a fallback: `{{ document.po_number | default: "–" }}`.

### Filters

| Filter | Example | Result (de / en) |
|---|---|---|
| `money` | `{{ document.gross_total \| money }}` | `1.130,50 €` / `€1,130.50` |
| `money: decimals` | `{{ p.unit_price \| money: 4 }}` | `12,3456 €` / `€12.3456` |
| `number: decimals` | `{{ p.quantity \| number: 2 }}` | `1,50` / `1.50` (default 2 decimals) |
| `date` | `{{ document.date \| date }}` | `04.10.2026` / `Oct 4, 2026` |
| `date: format` | `{{ document.date \| date: "%Y-%m-%d" }}` | strftime pattern like Liquid's standard `date` |
| `nl2br` | `{{ document.intro \| nl2br }}` | line breaks become `<br>` |
| `t` | `{{ 'total' \| t }}` | `Gesamt` / `Total` |

Formats follow the document language. Amounts are rounded commercially. `money` and `number` print nothing for values that are not numbers. An unknown filter is an error.

The math filters `plus`, `minus`, `times`, `divided_by` and `round` compute with exact decimals and return a decimal text (`{{ document.net_total | times: 1.19 }}` → `"1345.2950"`, `round` rounds half up); with two integers they keep Liquid's integer behaviour (`{{ 10 | divided_by: 4 }}` → `2`). Prefer the totals of the context over computing amounts in the template.

### Escaping

All texts of the context are HTML-escaped exactly once before rendering, so:

- don't add `escape`; it works like `escape_once` and never escapes twice, so it changes nothing,
- `truncate` and `slice` count the escaped text and may cut an entity (`&am…`); shorten texts only when they contain no `&`, `<`, `>` or quotes,
- inside intro and closing texts, filters that produce HTML (`nl2br`) are escaped with the text: use `nl2br` on `document.intro` in the template, not inside the intro.

### Words in the document language (`t`)

`{{ 'key' | t }}` looks the word up in `translations` of your manifest (document language), then in openbill's vocabulary, else prints the key. openbill's vocabulary: `amount_due`, `credit`, `customer_number`, `date`, `details`, `draft`, `due_date`, `for`, `net`, `number`, `number_short`, `of`, `offer_total`, `optional`, `optional_total`, `page`, `pos`, `price`, `project`, `quantity`, `reference`, `service`, `service_date`, `subtotal`, `sum`, `tax_number`, `total`, `unit_price`, `valid_until`, `vat`, `vat_id`, `vat_long`, `vat_on`.

### Page placeholders

In the header and the footer, `{{ page.number }}` and `{{ page.total }}` become the current page and the number of pages:

```liquid
{{ 'page' | t }} {{ page.number }} {{ 'of' | t }} {{ page.total }}
```

They only work in `header.liquid` and `footer.liquid`, written exactly like this (filters can't be applied to them).

### Intro and closing

`document.intro` and `document.closing` (usually from text blocks) are Liquid too and are rendered first, with the same context: `Please transfer the amount by {{ document.due_date | date }}.` Print them with `nl2br` to keep the line breaks.

### Empty texts

In Liquid only `nil` and `false` are false: an empty text like `""` counts as **true**. Texts that may be empty (logo, VAT ID, descriptions, intro, custom fields) are therefore tested with `!= blank`, which is false for empty texts and for missing values:

```liquid
{% if org.vat_id != blank %}{{ 'vat_id' | t }} {{ org.vat_id }}{% else %}{{ 'tax_number' | t }} {{ org.tax_number }}{% endif %}
```

Values that are empty instead of texts (`customer`, `contact`, dates, `source_number`) and flags (`is_text`, `has_title`) work with a plain `{% if %}`.

### Comparing amounts

Amounts are strings. Compare them with `>` or `<`, which compare numbers: `{% if document.optional_total > 0 %}`. Don't use `== 0` or `!= 0` with amounts: `"0.00" != 0` is true in Liquid.

## Limits and errors

A template can never break openbill or block it:

- each part (header, body, footer, styles) may be at most 200 KB, the rendered HTML of a part at most 5 MB,
- loops and output are limited (a loop over a range like `(1..n)` may have at most 10 000 items; endless or huge loops stop with "render limit"),
- `{% render %}` and `{% include %}` are not available, `{% tablerow %}` neither,
- `styles.css` must not contain `</style>`,
- the paper must leave room for the body: twice `marginX` less than the page width, `headerHeight + footerHeight` at least 20mm less than the page height,
- on import, every part must stay within the 200 KB, field keys in `expectedFields` must look like `project_name`, and assets must really be what their extension says,
- a rendering stops after 5 seconds; the clock is checked in every loop iteration and before every filter call, so a long filter chain stops in time as well,
- no scripts and no external URLs: `<script>`, `<iframe>`, `http(s)://` images, fonts and stylesheets are blocked (use template assets), and every `<meta http-equiv>` (refresh, own policies) is a template error,
- a rendering may use at most 128 MB of memory; `capture` and every filter that can make its result larger than its input (`replace`, `append`, `join`, `split`, `base64_encode`, `url_encode`, `upcase`, …) check the size of the result against the output limit before building it, arrays from filters have at most 100 000 items, and numbers in math filters at most 1 000 digits.
- `file:` URLs: Gotenberg may read local files, but the content security policy at the top of every rendered document blocks everything except `data:` – a template referring to `file:///tmp/…` or other local paths shows nothing. Never use `file:` in templates; use assets.

Every problem is reported with the **part** (`header`, `body`, `footer`, `css`, `manifest`, `intro`, `closing`), the **file** and the **line**, for example `body · template.liquid · line 3 · Unexpected character }`. The preview shows the error in place of the broken part. Finalizing and the draft PDF refuse to run while the template has errors, so a broken template never ends up in an archived PDF.

## Sample data

For previews without a real document openbill has five sample scenarios: `short_invoice`, `long_invoice` (several pages, groups), `small_business`, `reverse_charge` and `offer_with_options`. They use your organization (or the fictional Studio Nordlicht on a fresh installation), a fictional customer, fixed dates and sample values for your custom fields. To get one as PDF on the command line:

```bash
php artisan app:render-sample klar long_invoice --locale=en
```

The PDF is written to `storage/app/private/samples/`.

## Example

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
