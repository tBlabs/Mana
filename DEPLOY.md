# Static deploy (Mana)

Production output is built to:

`C:\Projects\Mana\dist\`

Entry file: `C:\Projects\Mana\dist\index.html`

## Build

```bat
cd C:\Projects\Mana
npm install
npm run build
```

Vite is configured with `base: './'` so asset URLs are relative and work from any folder path (not only site root).

## Copy to server

Copy the **entire** `dist` folder contents to your web server document root (or any static folder):

- From: `C:\Projects\Mana\dist\`
- To: your server static directory (e.g. `\\server\www\mana\` or `/var/www/mana/`)

Include at least:

- `index.html`
- `favicon.svg`
- `assets\` (JS/CSS bundles)

Open `index.html` from that location (HTTP server or file share). No Node server is required at runtime.
