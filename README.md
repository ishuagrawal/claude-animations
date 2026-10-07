# claude-animations

Home for JS-generated animations featuring Claude the mascot.

## Layout

```
refs/       Shared reference assets every animation project can use
            (e.g. refs/claude-mascot.png). Add new canonical assets here.
projects/   One folder per animation project (projects/<name>/).
```

## Starting a new animation

1. Create `projects/<name>/` with an `index.html` entry point.
2. Reference shared assets via relative paths, e.g. `../../refs/claude-mascot.png`,
   rather than copying them in — keep `refs/` the single source of truth.
3. Open `index.html` in a browser, or serve the repo root (`npx serve .`) so
   relative paths to `refs/` resolve.
