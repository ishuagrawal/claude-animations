# How Claude cooks

A living infographic: one hand-inked kitchen-line poster that shows how an LLM writes a reply. The prompt is
chopped into tokens, run through the layers, scored, and sampled, one token per lap, until the bell rings.

## Model

- **Model:** Claude Opus 5.5 (`claude-opus-5-5`) in Claude Code

## View it

Requires Node 22+. From this folder:

```bash
npm install
```

```bash
npm run serve
```

Then open http://localhost:4106/projects/how-claude-cooks/ (port 4106).

To save a PNG still (uses the preinstalled Playwright + Chromium), run `npm run still`; it writes `stills/poster.png`.
