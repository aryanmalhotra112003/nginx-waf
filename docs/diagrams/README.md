# Architecture diagrams

## Zero-trust flow (Mermaid + static export)

| File | Purpose |
|------|---------|
| `zero-trust-architecture.mmd` | Mermaid source — edit this, then export (below). |
| `zero-trust-architecture.svg` | **Ready-to-save vector image** — open in browser or Inkscape and export as PNG/PDF. |
| `zero-trust-architecture.png` | *(Optional)* Run the script below to regenerate from `.mmd`. |

### Save / export as PNG or PDF

1. **Use the committed SVG**  
   Open `zero-trust-architecture.svg` in Chrome/Firefox → Print → Save as PDF, or open in Inkscape/GIMP and export PNG.

2. **Regenerate from Mermaid (requires Node + network)**  
   From the repo root:
   ```bash
   ./scripts/export-mermaid-diagrams.sh
   ```
   Produces `zero-trust-architecture.svg` and `zero-trust-architecture.png` next to the `.mmd` file.

3. **Online (no install)**  
   Paste the contents of `zero-trust-architecture.mmd` into [Mermaid Live Editor](https://mermaid.live) → **Actions → PNG/SVG**.

### Embed in README

```markdown
![Local zero-trust architecture](./diagrams/zero-trust-architecture.svg)
```

GitHub renders SVG in markdown; for email/slides, prefer the PNG if your tool does not support SVG.
