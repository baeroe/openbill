# AGENTS.md – openbill template toolkit

Instructions for coding agents (Claude Code, Codex, …) working in this folder. It holds one openbill template plus a small toolkit that renders it on the user's openbill instance and shows a live preview. The human-facing guide is `README.md`; the full reference is https://openbill.dev/en/templates (Liquid, context, filters, limits) and https://openbill.dev/en/template-toolkit.

## Layout

| Path | Edit? | Content |
|---|---|---|
| `template/template.liquid` | yes | the document body (HTML + Liquid), flows over as many pages as needed |
| `template/header.liquid`, `template/footer.liquid` | yes | header and footer on every page – separate HTML documents (see below) |
| `template/styles.css` | yes | plain CSS for the body (no Liquid, must not contain `</style>`) |
| `template/manifest.json` | yes, carefully | name, version, paper, `expectedFields`, `translations`, `documentTypes` |
| `template/assets/` | yes | images (png, jpg, jpeg, gif, webp, svg) and fonts (woff, woff2, ttf, otf) |
| `schema.json` | read only | every field a template can use (written by `pnpm pull`) |
| `.env.local` | never | URL, token and template id. Never print, copy, commit or send the token. |
| `index.html`, `assets/`, `tooling/`, `vite.config.js`, `package.json` | no | the toolkit itself (prebuilt) |

`template/assets/` belongs to the template; the top-level `assets/` is the toolkit's preview page. Don't mix them up.

## Workflow

```bash
pnpm install
pnpm dev                 # preview at http://localhost:5180, re-renders on every save in template/
pnpm push                # write template/ to openbill when the user is happy
pnpm pull                # fetch the saved template (stops if local files differ; --force overwrites)
pnpm run pack            # template package ZIP for Templates → Import ZIP (never `pnpm pack`)
```

- Rendering happens on the openbill instance, so `pnpm dev` needs it reachable. With a local development certificate (DDEV, mkcert) prefix commands with `NODE_OPTIONS=--use-system-ca`.
- While `pnpm dev` runs, read the result of the newest render as JSON: `curl -s http://localhost:5180/__openbill/state`. `event.errors` lists template errors with `part`, `file`, `line`, `message` and the lines around it; `event.failure` explains a render that did not happen (instance unreachable, token refused, broken `manifest.json`). The terminal only prints a short summary.
- The preview uses the assets saved in openbill: new or changed files in `template/assets/` show up after `pnpm push`.
- `pnpm push` replaces the whole template in openbill, assets included: assets missing locally are deleted there. It checks everything first and sends nothing if a file would be refused.
- Push only when the user asks for it; it changes the template every new draft and PDF of that template uses.

## Liquid rules that bite

- **Amounts are strings** with a dot and two decimals (`"1130.50"`). Compare them with `>` or `<` only: `{% if document.optional_total > 0 %}`. Never `== 0` / `!= 0`: `"0.00" != 0` is true.
- **Empty texts are true.** Only `nil` and `false` are false. Test texts that may be empty (logo, VAT ID, descriptions, intro, custom fields) with `!= blank`: `{% if org.logo != blank %}<img src="{{ org.logo }}">{% endif %}`.
- **GiroCode:** `document.payment_qr` is an SVG data URL of an EPC QR code for finalized invoices, empty otherwise: `{% if document.payment_qr != blank %}<img src="{{ document.payment_qr }}" alt="">{% endif %}`.
- **Values are already HTML-escaped.** Print them as they are; don't add `escape`.
- **Filters:** `money` (`{{ document.gross_total | money }}`, `money: 4` for unit prices), `number: 2`, `date` / `date: "%Y-%m-%d"`, `nl2br` (intro, closing, descriptions), `iban` (IBAN in groups of four), `t` for words in the document language (`{{ 'total' | t }}`, own words in `manifest.json` → `translations`). Formats follow the document language. An unknown filter is an error.
- **Loops:** positions are read inside `{% for g in groups %}{% for p in g.positions %}` (or `{% for p in positions %}`). Text lines have `p.is_text`, optional items `p.is_optional`.
- **Not available:** `{% render %}`, `{% include %}`, `{% tablerow %}`.
- **Header and footer** are separate HTML documents as wide as the page and as high as their margin: `styles.css` does not apply there, put a `<style>` element into `header.liquid` / `footer.liquid` and set font sizes explicitly. Page numbers only there, written exactly `{{ page.number }}` and `{{ page.total }}`.
- **No scripts, no external URLs.** A content security policy allows only `data:`: `<script>`, iframes and `http(s)://` images, fonts or stylesheets are blocked, `<meta http-equiv>` is an error. Use assets with a relative path (`<img src="assets/logo.svg">`, `url(assets/brand.woff2)`); openbill inlines them.
- **Paper** comes from `manifest.json` → `paper` (`format` A4 or Letter, `marginX`, `headerHeight`, `footerHeight`). Leave room for the body: `headerHeight + footerHeight` at least 20mm less than the page height.

## Limits

Parts up to 200 KB each; assets up to 2 MB each, 20 MB in total, at most 100 files, no symbolic links; a packed ZIP at most 10 MB. A rendering stops after 5 seconds, loops over ranges have at most 10 000 items. Errors always name part, file and line.
