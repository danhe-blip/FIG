# FIG Studio — figstudio.vc

Marketing site for FIG Studio. **FIG = Frontier · Industry · Growth.**
An AI venture studio partnering with experienced industry leaders, technical
founders, and repeat entrepreneurs to turn deep expertise into AI-native companies.

## Stack

Single static `index.html` — zero build step, zero dependencies.
Fonts (Bitter / Inter / Caveat) load from Google Fonts. Deploys as-is on Vercel.

## Local preview

Just open `index.html` in a browser, or:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Deploy (Vercel)

1. Push this repo to GitHub (see below).
2. On vercel.com → **Add New → Project** → import this repo → Deploy.
3. **Settings → Domains** → add `figstudio.vc`, then set the DNS records
   Vercel shows at your registrar:
   - `A   @   76.76.21.21`
   - `CNAME   www   cname.vercel-dns.com`
4. Wait for the domain to turn green — SSL is issued automatically.

## Email

`hello@figstudio.vc` via Cloudflare Email Routing (free forwarding) for MVP;
upgrade to Google Workspace / Zoho for real send/receive later.

## TODO before public launch

- [ ] One-line descriptions for the 8 portfolio companies (currently "Description forthcoming")
- [ ] Real LinkedIn URL on the Stealth card (Hongxia Jin)
- [ ] Replace the 3 event placeholder tiles with real photos
- [ ] Add an OG image (`/og.png`, 1200×630) + `<meta og:image>` in `<head>`
- [ ] Verify the LinkedIn footer link
