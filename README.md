# FIG Studio — figstudio.vc

Marketing site for FIG Studio. **FIG = Frontier · Industry · Growth.**
An AI venture studio partnering with experienced industry leaders, technical
founders, and repeat entrepreneurs to turn deep expertise into AI-native companies.

## Stack

Static HTML — `index.html` plus an event recap page and the AI Design Makeathon pages under `events/` — zero build step, zero dependencies.
Fonts (Sora / Inter) load from Google Fonts. Deploys as-is on Vercel.

## Unlinked event pages

Four stand-alone pages are live but deliberately not linked from anywhere on the site, and are marked `noindex`
(meta tag plus an `X-Robots-Tag` header in `vercel.json`):

- `/events/ai-design-makeathon-sponsorship` (sponsor packages, prices hidden)
- `/events/ai-design-makeathon-sponsor-packages` (sponsor packages with prices; share only with sponsors you are negotiating with)
- `/events/ai-design-makeathon-university` (university partnership)
- `/events/ai-design-makeathon-partnership` (industry partnership, no pricing)

They share `events/ai-design-makeathon/` (theme, `page.css`, `page.js`, images). The prior-event figures on these pages
are read from the recap page at load time, with static fallbacks in the markup.

Blocks that must stay identical on all four pages (copy from the partnership page, which is the reference):

- Hero strip: "Hosted by FIG Studio", "Co-host Lovable" (the only co-host), then "Judges & partners" without Lovable.
- Section 01 ("AI is changing products."): one paragraph and the single "Concepts made visible" tile. Nothing that
  hints at the project theme.
- Judge grid, in the same order, ending with the full-width "University judges" TBA card.
- Audience wording: "design students and young design professionals".

The two sponsor pages are the same page apart from prices: edit both together.

## Event design system

`tools/event-theme/build.py` derives an event's colours, type, chips and pixel-mosaic motif from its poster and writes
`theme.css` next to the event page. See `tools/event-theme/README.md`.

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
- [ ] Add an OG image (`/og.png`, 1200×630) + `<meta og:image>` in `<head>`
- [ ] Verify the LinkedIn footer link
