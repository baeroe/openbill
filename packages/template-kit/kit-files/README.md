# openbill template toolkit

Develop this openbill template in your own editor with a live preview. Every time you save a file in `template/`, your openbill instance renders it and the preview shows the result – laid out in pages like the PDF, without reloading the page.

## Requirements

- Node.js 24 or newer and pnpm (`corepack enable` sets pnpm up).
- Your openbill instance must be reachable from this computer. It renders the preview; without it there is no preview.

## Start

```bash
pnpm install
pnpm dev
```

Open http://localhost:5180 . Choose the data on top (sample scenarios or one of your recent documents), switch **Areas** to see header, content and footer, and click a field on the left to copy its Liquid expression.

## Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Preview at http://localhost:5180 (`pnpm dev --port 5181` for another port). |
| `pnpm push` | Writes all files of `template/` to openbill: the parts, `manifest.json` and the complete `assets/` folder. Checked first: only package files, parts up to 200 KB each, assets png/jpg/jpeg/gif/webp/svg/woff/woff2/ttf/otf up to 2 MB each, 20 MB in total, at most 100 files, no symbolic links. |
| `pnpm pull` | Fetches the template saved in openbill into `template/` and the field schema into `schema.json`. Stops when local files differ; `pnpm pull --force` overwrites them. |
| `pnpm run pack` | Packs `template/` as template package (`<name>-<version>.zip`, or `--out file.zip`) for **Templates → Import ZIP**. |

Use `pnpm run pack`, not `pnpm pack`: `pnpm pack` is pnpm's own command (it builds npm tarballs) and fails here.

## Files

- `template/` – your template: `template.liquid` (content), `header.liquid`, `footer.liquid`, `styles.css`, `manifest.json`, `assets/`.
- `.env.local` – `OPENBILL_URL`, `OPENBILL_TOKEN`, `OPENBILL_TEMPLATE_ID`. Listed in `.gitignore`.
- `AGENTS.md` – instructions for coding agents.
- `index.html`, `assets/`, `tooling/`, `vite.config.js` – the toolkit itself.

Assets: the preview uses the assets saved in openbill. New or changed files in `template/assets/` appear after `pnpm push`.

## With an AI agent

Coding agents like Claude Code or Codex can design the template for you: start them in this folder while `pnpm dev` runs and describe what you want. `AGENTS.md` tells them which files to edit, how to read render errors and the Liquid rules that matter. Review the preview, then run `pnpm push` yourself (or let the agent do it). The agent sees this folder, so it can read `.env.local` with its token: only use agents you trust with read access to your documents.

## Keep the token private

`.env.local` holds a token made for this template. It can render every document of your openbill instance in the preview (read access to customers, addresses, positions and amounts) and change only this template. It cannot change documents or settings. Do not commit or share it. You find it in openbill under **Settings → API & MCP** as *Toolkit · <template>*; **Revoke** ends it at once. Downloading the toolkit again creates a new token.

## Troubleshooting

| Message | What to do |
|---|---|
| Cannot reach … | Start openbill, or fix `OPENBILL_URL` in `.env.local`. |
| Node does not trust the certificate … | Local instance with its own CA (DDEV, mkcert): `NODE_OPTIONS=--use-system-ca pnpm dev` (also for push and pull). |
| openbill refused the token (401) | The token was revoked. Download the toolkit again in the template editor, or put a new token into `.env.local`. |
| The token may not do this (403) | `OPENBILL_TEMPLATE_ID` points to another template than the token. |
| Built-in templates are read-only | Duplicate the template in openbill and download the toolkit of the copy. |
| Missing OPENBILL_URL … | `.env.local` is missing or incomplete. |
| OPENBILL_URL must use https:// | openbill's `APP_URL` is a plain `http://` address. Ask the operator to set `APP_URL` to the https address, then download the toolkit again. |
