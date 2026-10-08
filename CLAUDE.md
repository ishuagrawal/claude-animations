# claude-animations

Monorepo of JS animation projects featuring Claude the mascot.

- Each project lives in `projects/<name>/`; keep projects self-contained apart from `refs/`.
- Before building a new animation, look in `refs/` and use those assets (especially
  `refs/claude-mascot.png`) as the visual reference for the mascot's shape, proportions and colors.
- Reference `refs/` assets by relative path instead of duplicating them.
- Every project must run in its own isolated environment so sessions on different projects can
  run concurrently without interfering:
  - One git worktree + branch per project (branch `project/<name>`, worktree at
    `../claude-animations-worktrees/<name>`). Before starting work, check `git worktree list`;
    if the project's worktree exists, work there instead of creating a new one.
  - Only one session per project is active at a time. A new session on an existing project
    (usually because the previous one's cache expired) reuses the same worktree and resumes the
    previous work: read `projects/<name>/HANDOFF.md`, `git log`, and `git status` first.
  - Keep `projects/<name>/HANDOFF.md` current: status, what's done, next steps, open decisions,
    gotchas. Update it at milestones and before ending a session. It is gitignored and lives
    only in the project's worktree (which is why sessions reuse that worktree).
  - Own deps (`package.json`/`node_modules`, venv), own output/temp dirs, and a fixed dev-server
    port unique to the project (listed in its README). Never install global deps or write
    outside the project folder (other than reading `refs/`).
  - Merge the project branch into `main` when a milestone is done.
- The repo holds only what's needed to reconstruct each video: source code and the README.
  Project commits and merges contain nothing else. Never commit binaries or
  media (renders, audio, images, archives), intermediate/build output (`out/`, stills, caches,
  temp files, `node_modules`), or context/session files (`HANDOFF.md`, notes, `.claude/`).
  `.gitignore` enforces most of this; still run `git status` and review staged files before every
  commit. Mascot/reference images belong in `refs/` only.
- Each project's `README.md` contains only:
  1. The project name (title).
  2. A 1–2 line premise of what the video is about.
  3. The model used (e.g. `claude-opus-5-5`), optionally the reasoning effort and the equivalent
     API cost (sum the session transcripts' token usage × current API pricing).
  4. Instructions to generate the video (prerequisites + exact commands; preview port optional).
