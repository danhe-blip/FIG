#!/usr/bin/env python3
"""Poster -> event design system.

Reads an event poster (+ an optional poster-profile.json that records what the
eye sees but pixels can't: typefaces, motifs, voice) and writes, into --out:

  theme.css          design tokens (--ev-*), type, chips, motif (data URI)
  motif-field.svg    the poster's pixel-mosaic + rings, redrawn in its palette
  theme.json         the extracted tokens and a WCAG contrast report
  design-system.html a specimen page showing all of the above

Pages link theme.css and use only --ev-* tokens, so re-running this script on a
new poster re-themes them. Needs Pillow and numpy.
"""
import argparse, colorsys, hashlib, json, random, sys, urllib.parse
from pathlib import Path
import numpy as np
from PIL import Image

# ---------- colour helpers ----------
def hx(rgb): return '#%02x%02x%02x' % tuple(int(round(c)) for c in rgb)
def rgb(h): h = h.lstrip('#'); return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))
def lum(c):
    f = lambda v: (v/255/12.92) if v/255 <= .03928 else ((v/255+.055)/1.055)**2.4
    r, g, b = map(f, c); return .2126*r + .7152*g + .0722*b
def contrast(a, b):
    la, lb = sorted((lum(a), lum(b)), reverse=True); return (la+.05)/(lb+.05)
def mix(a, b, t): return tuple(a[i]*t + b[i]*(1-t) for i in range(3))   # t of a over b

# ---------- palette extraction ----------
def extract(path):
    im = Image.open(path).convert('RGB'); im.thumbnail((360, 360))
    px = np.asarray(im).reshape(-1, 3).astype(float)
    p = px/255; mx, mn = p.max(1), p.min(1)
    v = mx; s = np.where(mx > 0, (mx-mn)/np.maximum(mx, 1e-9), 0)
    h = np.array([colorsys.rgb_to_hsv(*q)[0]*360 for q in p])
    med = lambda m: np.median(px[m], axis=0)

    paper = med((v > .93) & (s < .12))
    ink = med(v < .22)
    # dominant chromatic hue family (15-degree bins, circular-smoothed)
    chroma = (s > .35) & (v > .3)
    if chroma.sum() < 200: sys.exit('No chromatic accent found in the poster.')
    hist = np.bincount((h[chroma]//15).astype(int) % 24, minlength=24).astype(float)
    hist = hist + np.roll(hist, 1) + np.roll(hist, -1)
    centre = hist.argmax()*15 + 7.5
    dh = np.abs((h-centre+180) % 360 - 180)
    fam = chroma & (dh < 30)

    def modal(mask):
        idx = np.where(mask)[0]
        if len(idx) < 30: sys.exit('Poster has too few pixels for a palette role.')
        keys = (np.round(s[idx]*8)*100 + np.round(v[idx]*16)).astype(int)
        top = np.bincount(keys - keys.min()).argmax() + keys.min()
        return np.median(px[idx[keys == top]], axis=0)

    deep = modal(fam & (v > .3) & (v < .6))          # flat text / chip colour
    bright = modal(fam & (s > .55) & (v > .65))      # vivid highlight
    tint = med((v > .9) & (s > .03) & (s < .2) & (dh < 45))   # the poster's pale wash
    if np.isnan(tint).any(): tint = mix(tuple(paper), (255, 255, 255), .5)
    return dict(paper=tuple(paper), tint=tuple(tint), ink=tuple(ink), deep=tuple(deep),
                bright=tuple(bright), hue=centre)

def fit(p):
    """Make the roles legible: accent >= 4.5:1 on paper, ink >= 4.5:1 on the bright accent."""
    notes = []
    d = p['deep']
    for _ in range(40):
        if contrast(d, p['paper']) >= 4.5: break
        d = mix(d, (0, 0, 0), .94); notes.append('accent darkened for 4.5:1 on paper')
    p['deep'] = d
    if contrast(p['ink'], p['bright']) < 4.5: notes.append('WARNING: ink on bright accent is below 4.5:1')
    return p, sorted(set(notes))

# ---------- motif: the poster's pixel mosaic + rings ----------
def motif_svg(p, profile, seed):
    rnd = random.Random(seed)
    N, U = 20, 40
    occ = [[False]*N for _ in range(N)]
    fills = [(hx(p['ink']), .30), (hx(p['deep']), .26), (hx(p['bright']), .30), (hx(p['tint']), .14)]
    sizes = profile.get('motifs', {}).get('pixel_field', {}).get('sizes', [1, 2, 3])
    out = []
    for y in range(N):
        for x in range(N):
            if occ[y][x]: continue
            dens = ((x/(N-1))**1.3) * (1 - .55*(y/(N-1))) + rnd.uniform(-.12, .12)
            if rnd.random() > max(0, dens)*1.15: continue
            sz = min(rnd.choice(sizes), N-x, N-y)
            while sz > 1 and any(occ[y+j][x+i] for j in range(sz) for i in range(sz)): sz -= 1
            for j in range(sz):
                for i in range(sz): occ[y+j][x+i] = True
            r = rnd.random(); acc = 0
            for col, w in fills:
                acc += w
                if r <= acc: break
            out.append(f'<rect x="{x*U}" y="{y*U}" width="{sz*U}" height="{sz*U}" fill="{col}"/>')
            if col == hx(p['bright']) and sz >= 2 and rnd.random() < .6:     # halftone inside a block
                for jj in range(sz*2):
                    for ii in range(sz*2):
                        out.append(f'<circle cx="{x*U+ii*U/2+U/4}" cy="{y*U+jj*U/2+U/4}" r="{3.2 if (ii+jj)%2 else 1.6}" fill="{hx(p["ink"])}" opacity=".55"/>')
    rings = profile.get('motifs', {}).get('rings', {}).get('count', 2)
    for k in range(rings):
        out.append(f'<circle cx="640" cy="760" r="{330+k*150}" fill="none" stroke="{hx(p["deep"])}" stroke-width="2" opacity="{.55-k*.2}"/>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800">{"".join(out)}</svg>'

# ---------- outputs ----------
def theme_css(p, profile, motif):
    t = profile.get('typography', {})
    fam = lambda k, d: t.get(k, {}).get('family', d)
    disp, label, head, body = fam('display', 'JetBrains Mono'), fam('label', 'JetBrains Mono'), fam('heading', 'Sora'), fam('body', 'Inter')
    mono_w = ";".join(str(w) for w in sorted(set(t.get('display', {}).get('weights', [700, 800]) + t.get('label', {}).get('weights', [600]))))
    q = lambda f: f.replace(' ', '+')
    uri = 'data:image/svg+xml,' + urllib.parse.quote(motif, safe="/:=' ")
    uri = uri.replace("'", '%27')
    radius = profile.get('motifs', {}).get('chips', {}).get('radius', 0)
    return f"""/* GENERATED by tools/event-theme/build.py from the event poster. Do not edit by hand:
   change poster-profile.json or the poster and run the script again. */
@import url('https://fonts.googleapis.com/css2?family={q(disp)}:wght@{mono_w}&family={q(head)}:wght@400;500;600;700&family={q(body)}:wght@400;500;600;700&display=swap');
:root{{
  /* colour: measured from the poster */
  --ev-paper:{hx(p['paper'])};
  --ev-paper-tint:{hx(p['tint'])};
  --ev-ink:{hx(p['ink'])};
  --ev-accent:{hx(p['deep'])};
  --ev-accent-bright:{hx(p['bright'])};
  --ev-white:#ffffff;
  /* derived neutrals */
  --ev-ink-soft:color-mix(in srgb,var(--ev-ink) 76%,var(--ev-paper));
  --ev-muted:color-mix(in srgb,var(--ev-ink) 64%,var(--ev-paper));
  --ev-faint:color-mix(in srgb,var(--ev-ink) 50%,var(--ev-paper));
  --ev-line:color-mix(in srgb,var(--ev-ink) 14%,transparent);
  --ev-line-strong:color-mix(in srgb,var(--ev-ink) 22%,transparent);
  --ev-on-dark:var(--ev-paper);
  --ev-on-dark-muted:color-mix(in srgb,var(--ev-paper) 74%,transparent);
  --ev-on-dark-line:color-mix(in srgb,var(--ev-paper) 18%,transparent);
  /* shape + type */
  --ev-radius:{radius}px;
  --ev-font-display:'{disp}',ui-monospace,Menlo,monospace;
  --ev-font-label:'{label}',ui-monospace,Menlo,monospace;
  --ev-font-heading:'{head}',-apple-system,sans-serif;
  --ev-font-body:'{body}',-apple-system,sans-serif;
  /* motif: the poster's pixel mosaic, as an image */
  --ev-motif-field:url("{uri}");
}}
.ev-display{{font-family:var(--ev-font-display);font-weight:800;text-transform:uppercase;letter-spacing:-.04em;text-shadow:.045em .055em 0 var(--ev-accent-bright)}}
.ev-label{{font-family:var(--ev-font-label);font-weight:600;font-size:.75rem;line-height:1.5;letter-spacing:.1em;text-transform:uppercase;font-variant-numeric:tabular-nums}}
.ev-mark:before{{content:"";display:inline-block;width:.62em;height:.62em;background:var(--ev-accent-bright);margin-right:.9em;vertical-align:.04em}}
.ev-chip{{display:inline-flex;align-items:center;gap:.6em;padding:.5em .75em;font:600 .75rem/1 var(--ev-font-label);letter-spacing:.08em;text-transform:uppercase;background:var(--ev-accent);color:var(--ev-white);border-radius:var(--ev-radius)}}
.ev-chip--ink{{background:var(--ev-ink);color:var(--ev-paper)}}
.ev-chip--pin:before{{content:"";width:.95em;height:.95em;background:var(--ev-accent-bright);-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z'/%3E%3C/svg%3E") center/contain no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath d='M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 9.5A2.5 2.5 0 1 1 12 6.5a2.5 2.5 0 0 1 0 5z'/%3E%3C/svg%3E") center/contain no-repeat}}
.ev-field{{background:var(--ev-motif-field) right top/contain no-repeat}}
"""

PAIRS = [('Ink on paper', 'ink', 'paper'), ('Accent on paper', 'deep', 'paper'), ('White on accent (chips)', 'white', 'deep'),
         ('Ink on bright accent', 'ink', 'bright'), ('Bright accent on ink', 'bright', 'ink'), ('Paper on ink', 'paper', 'ink')]

def report(p):
    c = dict(p, white=(255, 255, 255)); rows = []
    for name, a, b in PAIRS:
        r = float(contrast(c[a], c[b])); rows.append(dict(pair=name, fg=hx(c[a]), bg=hx(c[b]), ratio=round(r, 2), aa=bool(r >= 4.5)))
    return rows

def specimen(p, profile, rep, poster_rel, motif_svg_text, notes):
    sw = [('paper', 'Ground', p['paper']), ('tint', 'Paper tint', p['tint']), ('ink', 'Ink', p['ink']), ('deep', 'Accent', p['deep']), ('bright', 'Accent bright', p['bright'])]
    swatches = ''.join(f'<div class="sw"><i style="background:{hx(c)}"></i><b>{n}</b><span>--ev-{k if k not in ("deep","bright","tint") else {"deep":"accent","bright":"accent-bright","tint":"paper-tint"}[k]}</span><code>{hx(c)}</code></div>' for k, n, c in sw)
    rows = ''.join(f'<tr><td><span style="display:inline-block;width:2.2em;text-align:center;padding:.15em 0;background:{r["bg"]};color:{r["fg"]}">Aa</span> {r["pair"]}</td><td>{r["ratio"]}:1</td><td>{"AA" if r["aa"] else "below AA"}</td></tr>' for r in rep)
    voice = profile.get('voice', '')
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{profile.get('event', 'Event')} — Design system</title><link rel="stylesheet" href="theme.css">
<style>
*{{box-sizing:border-box}}body{{margin:0;background:var(--ev-paper);color:var(--ev-ink);font-family:var(--ev-font-body);line-height:1.6}}
.w{{max-width:1180px;margin:auto;padding:0 clamp(20px,5vw,64px)}}section{{padding:64px 0;border-top:1px solid var(--ev-line-strong)}}
h1,h2{{font-family:var(--ev-font-heading);font-weight:500;letter-spacing:-.03em;margin:0}}h2{{font-size:2rem;margin-bottom:8px}}h1{{font-size:clamp(2.4rem,5vw,4rem);line-height:1}}
.lead{{color:var(--ev-muted);max-width:640px}}.grid{{display:grid;gap:24px}}.g2{{grid-template-columns:1fr 1fr}}.sws{{display:grid;grid-template-columns:repeat(5,1fr);gap:14px;margin-top:24px}}
.sw i{{display:block;height:92px;border:1px solid var(--ev-line-strong)}}.sw b{{display:block;margin-top:10px;font-weight:600}}.sw span,.sw code{{display:block;font-size:.8125rem;color:var(--ev-muted)}}
table{{border-collapse:collapse;width:100%;margin-top:20px}}td{{padding:10px 8px;border-bottom:1px solid var(--ev-line);font-size:.9375rem}}
.dark{{background:var(--ev-ink);color:var(--ev-on-dark);padding:28px}}.dark p{{color:var(--ev-on-dark-muted);margin:8px 0 0}}
.mot{{background:var(--ev-paper-tint);border:1px solid var(--ev-line);aspect-ratio:1;max-width:420px}}.mot svg{{width:100%;height:100%;display:block}}
.btn{{display:inline-block;padding:12px 22px;background:var(--ev-accent-bright);color:var(--ev-ink);font:600 .875rem var(--ev-font-body);border-radius:var(--ev-radius)}}
@media(max-width:760px){{.g2{{grid-template-columns:1fr}}.sws{{grid-template-columns:repeat(2,1fr)}}}}
</style></head><body>
<header class="w" style="padding-top:56px;padding-bottom:48px"><p class="ev-label ev-mark">Event design system · generated from the poster</p>
<h1 class="ev-display" style="margin-top:18px;font-size:clamp(2.2rem,6vw,4.6rem)">{profile.get('event', 'Event')}</h1>
<p class="lead">{voice}</p></header>
<section><div class="w"><h2>1. Source → palette</h2><p class="lead">Roles are measured from the poster's pixels: the dominant chromatic hue family, its flat mid-tone and vivid tone, the paper, the ink and the pale wash.</p>
<div class="grid g2" style="margin-top:24px;align-items:start"><img src="{poster_rel}" alt="Source poster" style="width:100%;max-width:460px;border:1px solid var(--ev-line-strong)"><div><div class="sws" style="grid-template-columns:repeat(2,1fr)">{swatches}</div></div></div></div></section>
<section><div class="w"><h2>2. Contrast</h2><p class="lead">Checked on every build. The accent is darkened automatically if it falls under 4.5:1 on paper.{(' Notes: ' + '; '.join(notes) + '.') if notes else ''}</p><table>{rows}</table></div></section>
<section><div class="w"><h2>3. Type</h2><div class="grid g2" style="margin-top:20px"><div><p class="ev-label">Display · {profile.get('typography',{}).get('display',{}).get('family','')}</p><div class="ev-display" style="font-size:3rem;line-height:1">AI Design<br>Makeathon.</div></div>
<div><p class="ev-label">Heading · {profile.get('typography',{}).get('heading',{}).get('family','')}</p><div style="font-family:var(--ev-font-heading);font-size:2.2rem;line-height:1.1;letter-spacing:-.03em">Design must catch up.</div><p style="margin-top:14px">Body · {profile.get('typography',{}).get('body',{}).get('family','')}. Participants will tackle emerging AI interaction and product challenges.</p></div></div></div></section>
<section><div class="w"><h2>4. Components</h2><div class="grid" style="margin-top:20px;gap:18px"><div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center"><span class="ev-chip">Online</span><span class="ev-chip">Winner demo</span><span class="ev-chip ev-chip--ink ev-chip--pin">Venue, City</span><a class="btn" href="#">Work with us</a></div>
<div class="dark"><p class="ev-label ev-mark" style="margin:0">On dark ground</p><p>Muted text on ink keeps its contrast.</p></div></div></div></section>
<section><div class="w"><h2>5. Motif</h2><p class="lead">The poster's pixel mosaic and rings, redrawn in its own palette (seeded from the poster, so the same poster always gives the same field). Used as <code>--ev-motif-field</code>.</p><div class="mot" style="margin-top:20px">{motif_svg_text}</div></div></section>
</body></html>"""

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('poster'); ap.add_argument('--profile'); ap.add_argument('--out', required=True)
    a = ap.parse_args()
    out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
    profile = json.loads(Path(a.profile).read_text()) if a.profile else {}
    p, notes = fit(extract(a.poster))
    seed = int(hashlib.sha1(Path(a.poster).read_bytes()).hexdigest()[:8], 16)
    svg = motif_svg(p, profile, seed)
    rep = report(p)
    (out/'motif-field.svg').write_text(svg)
    (out/'theme.css').write_text(theme_css(p, profile, svg))
    (out/'theme.json').write_text(json.dumps({'hue': int(round(float(p['hue']))), 'tokens': {k: hx(v) for k, v in p.items() if k != 'hue'}, 'contrast': rep, 'notes': notes}, indent=2) + '\n')
    rel = Path(a.poster).resolve().relative_to(out.resolve()) if out.resolve() in Path(a.poster).resolve().parents else Path(a.poster).resolve()
    (out/'design-system.html').write_text(specimen(p, profile, rep, str(rel), svg, notes))
    print('hue', round(p['hue']), {k: hx(v) for k, v in p.items() if k != 'hue'})
    for r in rep: print(f"  {r['ratio']:>5}:1  {'AA ' if r['aa'] else 'LOW'}  {r['pair']}")
    for n in notes: print('  note:', n)

if __name__ == '__main__': main()
