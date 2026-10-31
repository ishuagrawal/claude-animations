# How Claude cooks

A living infographic: one hand-inked kitchen-line poster that animates how an LLM writes a reply. Your order is
chopped into tokens, cooked through the layers, scored and spun, and plated one token per lap until the bell rings.

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

Open http://localhost:4106/projects/how-claude-cooks/ (port 4106). It plays once and ends on the finished poster;
`?static` shows the poster, `?t=17.5` freezes on one moment.

To render an MP4 preview (needs `ffmpeg` and the preinstalled Playwright + Chromium):

```bash
npm run record
```

Writes `out/how-claude-cooks.mp4`. `npm run still -- 17.5` saves `stills/t-17.5.png`.
