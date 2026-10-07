# Event theme generator

Turns an event poster into a design system and applies it to the event's page.

```bash
python3 tools/event-theme/build.py \
  events/ai-design-makeathon/img/poster.jpg \
  --profile events/ai-design-makeathon/poster-profile.json \
  --out events/ai-design-makeathon
```

Needs Python 3, Pillow and numpy. Output is deterministic: the same poster gives the same files.

## What it writes (into `--out`)

| File | What |
| --- | --- |
| `theme.css` | `--ev-*` tokens (paper, ink, accent, highlight, neutrals, fonts, radius), the poster's pixel-mosaic as `--ev-motif-field`, and `.ev-display`, `.ev-label`, `.ev-mark`, `.ev-chip` |
| `motif-field.svg` | the mosaic + rings, redrawn in the poster's palette |
| `theme.json` | extracted colours and a WCAG contrast report |
| `design-system.html` | specimen page (open it to review the system) |

The event page links `theme.css` and uses only `--ev-*` tokens, so a new poster re-themes it.

## Two inputs

1. **The poster's pixels** (automatic): paper, ink, the dominant hue family's flat tone (accent) and vivid tone (highlight), and the pale wash. The accent is darkened if it would fall under 4.5:1 on paper; a low ink-on-bright ratio is reported.
2. **`poster-profile.json`** (judgement): what pixels can't tell you, namely the typefaces, the motifs, the voice and the corner radius. It was written by looking at the poster; when the artwork changes, re-read the poster and update it.

## New poster (e.g. with the corrected dates)

Replace `img/poster.jpg`, run the command above, check `design-system.html`, commit the regenerated files.
