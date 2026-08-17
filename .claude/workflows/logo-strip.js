export const meta = {
  name: 'logo-strip',
  description: 'Find, verify, integrate & visually QA partner logos for the "Backed by & building with" strip',
  whenToUse: 'When replacing the text-only partner row in index.html with real, provenance-checked, visually normalized logos',
  phases: [
    { title: 'Find', detail: 'one finder per company — official press kit / Wikimedia, provenance required' },
    { title: 'Verify', detail: 'independent check: right brand + legible at 26px grayscale on parchment' },
    { title: 'Integrate', detail: 'deterministic normalize + inline into index.html (text fallback for failures)' },
    { title: 'Design QA', detail: 'screenshot review loop until the row sits calm (max rounds)' },
  ],
}

// args: { companies: [{name, slug, domain}], workdir, scratchpad, maxRounds }
const companies = args.companies
const WORK = args.workdir            // e.g. <scratchpad>/logos — downloaded assets land here
const SCRATCH = args.scratchpad      // has fonts/fonts.css + node_modules/playwright-core + a local server on :8123
const MAX_ROUNDS = args.maxRounds ?? 3

const FIND_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['slug', 'found', 'file', 'kind', 'source_url', 'confidence', 'notes'],
  properties: {
    slug: { type: 'string' },
    found: { type: 'boolean' },
    file: { type: 'string', description: 'absolute path of the saved asset, empty if not found' },
    kind: { enum: ['wordmark', 'lockup', 'icon', 'none'] },
    source_url: { type: 'string' },
    confidence: { enum: ['official', 'wikimedia', 'aggregator'] },
    notes: { type: 'string' },
  },
}

const VERIFY_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['slug', 'pass', 'reason'],
  properties: {
    slug: { type: 'string' },
    pass: { type: 'boolean' },
    reason: { type: 'string' },
    suggested_scale: { type: 'number', description: 'optical size correction, 0.7–1.3, default 1' },
  },
}

const REVIEW_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['pass', 'summary', 'fixes'],
  properties: {
    pass: { type: 'boolean' },
    summary: { type: 'string' },
    fixes: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['slug', 'action'],
        properties: {
          slug: { type: 'string' },
          action: { enum: ['scale', 'text-fallback', 'row-all-text'] },
          value: { type: 'number', description: 'for scale: multiplier like 0.85' },
          why: { type: 'string' },
        },
      },
    },
  },
}

const SHOT_RECIPE = `
To screenshot: cd ${SCRATCH} && node - <<'EOF' with playwright-core, executablePath '/opt/pw-browsers/chromium'.
Intercept '**fonts.googleapis.com/**' and fulfill with the contents of ${SCRATCH}/fonts/fonts.css (contentType text/css);
intercept '**localhost:8124/**' and fulfill with the matching file bytes from ${SCRATCH}/fonts/ plus header
Access-Control-Allow-Origin: * (font/woff2). Page is served at http://localhost:8123/index.html (server already runs
from /home/user/FIG). Wait for document.fonts.ready, add class 'on' to every .rv element, small settle delay, screenshot.`

// ---------- Phase 1+2: find, then independently verify, per company (no barrier) ----------
phase('Find')
const results = await pipeline(
  companies,
  c => agent(`Find the official logo of "${c.name}" (likely domain: ${c.domain}) for a marketing-site partner strip.
PREFER a horizontal wordmark/lockup (SVG best, else PNG with transparent background, rendered width >= 300px).
Source priority — stop at the first that yields a usable asset:
 1. The company's own site: /press, /brand, /media, page assets (inspect HTML for the header logo asset URL).
 2. Wikimedia Commons / Wikipedia infobox SVG.
 3. Aggregator fallback ONLY if the above fail: https://logo.clearbit.com/<domain> (mark confidence 'aggregator').
First confirm the domain really belongs to "${c.name}" (WebSearch/WebFetch) — beware same-name companies.
Download with curl through the configured proxy. Save to ${WORK}/${c.slug}.<ext>. If the best you can find is a square
icon with no wordmark, still save it but set kind 'icon'. If nothing trustworthy exists, set found=false, kind 'none'.
Return only the structured result.`,
    { label: `find:${c.slug}`, phase: 'Find', schema: FIND_SCHEMA }),

  (f, c) => {
    if (!f || !f.found) return { find: f, verify: { slug: c.slug, pass: false, reason: 'no asset found' } }
    return agent(`Independently verify a logo candidate. Company: "${c.name}" (domain ${c.domain}).
File: ${f.file} — claimed source: ${f.source_url} (confidence: ${f.confidence}, kind: ${f.kind}).
You are the skeptic: assume it may be the WRONG company (same-name trap) or unusable at strip size.
1. Open ${c.domain} (WebFetch or curl) and compare its actual branding with the candidate file (Read the image).
2. Build a tiny HTML page: parchment #f6f3f1 background, the candidate at height 26px with CSS filter grayscale(1)
   opacity .62, next to the text "${c.name}" in monospace. Screenshot it headlessly
   (use ${SCRATCH}/node_modules/playwright-core with executablePath '/opt/pw-browsers/chromium'; a local file:// page is fine).
3. Judge: correct brand? legible and recognizable at 26px grayscale? wordmark preferred — an 'icon' passes only if
   it is widely recognizable alone (e.g. the AWS smile is not; the Stripe wordmark is required, not an S).
Fail closed: when uncertain, pass=false with the reason. Optionally suggest an optical scale (0.7–1.3) if the mark
renders visually heavier/lighter than a typical wordmark at 26px.`,
      { label: `verify:${c.slug}`, phase: 'Verify', schema: VERIFY_SCHEMA })
      .then(v => ({ find: f, verify: v }))
  },
)

const merged = results.map((r, i) => ({ company: companies[i], ...(r || { find: null, verify: { slug: companies[i].slug, pass: false, reason: 'agent failed' } }) }))
const passed = merged.filter(r => r.verify && r.verify.pass)
const failed = merged.filter(r => !r.verify || !r.verify.pass)
log(`verified ${passed.length}/${companies.length} logos; text fallback for: ${failed.map(f => f.company.slug).join(', ') || 'none'}`)

if (passed.length < 4) {
  return { outcome: 'kept-text-row', reason: `only ${passed.length} logos survived verification — a mixed row would look patchy`, details: merged.map(m => ({ slug: m.company.slug, pass: !!(m.verify && m.verify.pass), reason: m.verify?.reason })) }
}

// ---------- Phase 3: deterministic integration (one agent runs the scripted steps) ----------
phase('Integrate')
const manifest = JSON.stringify(passed.map(p => ({ slug: p.company.slug, name: p.company.name, file: p.find.file, kind: p.find.kind, scale: p.verify.suggested_scale ?? 1 })))
const textOnly = JSON.stringify(failed.map(f => f.company.name))

const INTEGRATE_INSTRUCTIONS = `
Integrate these verified logos into /home/user/FIG/index.html (single-file static site, assets are inlined):
${manifest}
Keep these as text spans (verification failed): ${textOnly}
Steps — deterministic, use a python script, do not hand-edit the huge file:
 1. Normalize each asset: rasterize/scale so the rendered height is 26px * scale at 2x DPI; SVGs stay SVG (minified);
    PNGs re-encoded with transparency, max height 64px source. Compute each logo's "ink area" (non-transparent pixel
    count after grayscale) at its final size; if any logo's ink area exceeds 1.4x the median, multiply its scale down
    to bring it to ~1.2x median.
 2. In index.html's .logo-row, replace the matching <span>NAME</span> with
    <img class="plogo" src="data:..." alt="NAME" style="height:<26*scale>px"> keeping the original order; leave
    text spans for the fallback names.
 3. Add CSS once (after the .logo-row span rules):
    .logo-row img.plogo{width:auto;filter:grayscale(1);opacity:.62;transition:filter .18s,opacity .18s}
    .logo-row img.plogo:hover{filter:none;opacity:1}
    and vertically center both types: .logo-row{align-items:center}.
 4. Sanity: python re-check that the file's tag balance is unchanged and total size grew by < 400KB.
Return a one-paragraph summary of what changed (sizes, scales applied).`

await agent(INTEGRATE_INSTRUCTIONS, { label: 'integrate', phase: 'Integrate' })

// ---------- Phase 4: QA loop — screenshot, review, apply fixes, repeat ----------
let round = 0, verdict = null
while (round < MAX_ROUNDS) {
  round++
  verdict = await agent(`You are the design reviewer for the partner logo strip ("Backed by & building with") on a
warm-parchment editorial page (Monad system: calm, desaturated, hairline borders, mono type).
${SHOT_RECIPE}
Take TWO screenshots: viewport 1440x900 scrolled to the .logos section, and 390x844 likewise. Read both images.
Checklist — the row must read as ONE quiet line, not a collection of competing marks:
 - no single logo visually louder than the rest (ink density, height, or color bleeding through grayscale)
 - optical baseline/center alignment consistent between images and text spans
 - spacing rhythm even; wrap on mobile stays tidy
 - grayscale uniform (no logo still reading as colored)
If it passes, say so. If not, return concrete per-logo fixes: scale (with multiplier), text-fallback (drop the image,
restore the text span), or row-all-text (the whole experiment fails, restore every span) — use row-all-text only if
the mixed row fundamentally cannot sit calm.`,
    { label: `qa:round${round}`, phase: 'Design QA', schema: REVIEW_SCHEMA })

  if (!verdict) { log(`QA round ${round} died; stopping`); break }
  log(`QA round ${round}: ${verdict.pass ? 'PASS' : verdict.fixes.length + ' fixes'} — ${verdict.summary}`)
  if (verdict.pass) break

  if (verdict.fixes.some(f => f.action === 'row-all-text')) {
    await agent(`Restore the original text-only .logo-row spans in /home/user/FIG/index.html (git diff shows the
original markup; use git show HEAD:index.html to recover the span list) and remove the .plogo CSS. Verify tag balance.`,
      { label: 'revert-row', phase: 'Design QA' })
    return { outcome: 'reverted-to-text', rounds: round, verdict }
  }

  await agent(`Apply these reviewer fixes to the logo strip in /home/user/FIG/index.html, deterministically via python:
${JSON.stringify(verdict.fixes)}
For 'scale': adjust that img's inline height (base 26px * multiplier). For 'text-fallback': replace the img with the
original <span>NAME</span>. Keep everything else untouched; re-check tag balance.`,
    { label: `fix:round${round}`, phase: 'Design QA' })
}

return {
  outcome: verdict && verdict.pass ? 'pass' : 'max-rounds-reached',
  rounds: round,
  integrated: passed.map(p => p.company.slug),
  textFallback: failed.map(f => f.company.slug),
  finalVerdict: verdict,
}
