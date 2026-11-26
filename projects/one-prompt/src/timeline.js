// THE cue sheet. Times derive from the narration script; VO (line id -> measured seconds) later overrides the estimates
// and the whole film re-times itself. C.id = line start, C['id'+'e'] = end of speech, C['id'+'n'] = start of next line.
import { WORDS } from './vo_words.js';
export const CAPTIONS = false;
export const VO = {a1: 3.75, a2: 7.31, a3: 2.01, a31: 8.19, a32: 1.8, a33: 1.78, a34: 6.74, a4: 9.0, a5: 7.46, a9: 5.32, b1: 3.65, b2: 11.07, b3: 6.58, b4: 11.9, b5: 9.91, c1: 2.92, c2: 9.33, c3: 7.69, d1: 4.79, d2: 5.26, d3: 11.92, d4: 10.0, e1: 6.32, e2: 10.82, e3: 12.47, f1: 4.02, f2: 15.36, f3: 21.41, f4: 13.12, f5: 8.16, g1: 4.83, g2: 12.82, g3: 4.6, r1: 5.69, r2: 4.38};
export const SAY = {
  r1: "It's late, you're tired, and your login page is broken — so you open a coding agent.",
  r2: "You're about to type four words — and you won't see most of what leaves with them.",
  a1: "Before you type your prompt, the agent wakes up — and starts checking in.",
  a2: "Everything it sends is one of three kinds: what it needs to help you, what's collected on top, and what leaves only if you choose.",
  a9: "No single tool does all of this — and a few, like Goose and Aider, ask first.",
  a3: "First, it signs in to your account.",
  a31: "Then it notes an ID for this device. Codex, Cline and Gemini CLI all do — no pop-up, no question.",
  a32: "Which operating system you're running.",
  a33: "Which terminal you opened it in.",
  a34: "And its own version. Codex sends all four; Cline sends most of them — even when you use your own API key.",
  a4: "Every connection carries your IP address. opencode logs it when it checks for updates. And it shows roughly where you are — Cursor says it may use it to locate you.",
  a5: "Then it checks in. Claude Code asks for updates, and Cline asks which features are switched on — even with usage data turned off.",
  b1: "Still haven't typed — and now it dives into your project.",
  b2: "It reads your file names, your Git branch, which files you've changed, and your recent commits. Claude Code includes your branch, changed files and commits; Codex adds your repo's address.",
  b3: "It loads instruction files like AGENTS.md, and memories from past sessions, which Claude Code keeps on by default.",
  b4: "Some tools index your whole codebase, cutting it into chunks and turning them into numbers. GitHub Copilot does this automatically for repos on GitHub; Cursor uploaded code for it until mid-2026.",
  b5: "And in one case, in July 2026, a researcher caught Grok Build uploading an entire repository, Git history included, until a server-side switch shut it off.",
  c1: "And now — finally — you actually type.",
  c2: "But your four words are the smallest part of what's sent. They ride with the tool's own instructions, the conversation so far, your project's details, and anything you attach.",
  c3: "With your own key, Cline sends all of it straight to the AI model. Cursor routes it through its own servers first, even with your own key.",
  d1: "The model can't see your laptop, so it asks — and the agent runs laps back and forth.",
  d2: "Each lap carries more — the actual contents of your files, then whatever your commands print.",
  d3: "When it opens a web page, Claude Code checks the site's name with Anthropic first. Tools you connect, like an issue tracker or a database, see whatever is sent to them, and Codex passes along your repo's address.",
  d4: "Meanwhile, usage data keeps count: which tools ran, how long they took, and what you allowed or refused. Codex logs exactly that, though not the commands themselves.",
  e1: "Then the answer lands. One line of code changes, your login works, and you're done. Right?",
  e2: "Not quite. Codex logs how many tokens it used, how fast it went, and any errors. And when you click Keep or Undo, Zed and GitHub Copilot note which one you chose.",
  e3: "If something crashes, Claude Code can send an error report on its Pro, Max and Ultra plans. Rate an answer in Zed, and the whole conversation goes with it. Send feedback in Claude Code, and it's kept for five years.",
  f1: "You close the laptop for the night. Copies of your session? Still out there.",
  f2: "How long they're kept depends on the tool. Claude Code: thirty days, or five years if you allow training. Kiro's free tier: up to sixty days. Antigravity, with sharing on: until you ask Google to delete it. Devin Desktop: as long as you're a customer.",
  f3: "GitHub Copilot, Codex, Kiro and Devin Desktop train on your conversations by default — and Devin's free plan has no opt-out. Claude Code does too, unless you opt out when Anthropic asks. And sometimes people read them: Google's reviewers, in Antigravity with sharing on or with a free Gemini key, and GitHub and Microsoft staff who build Copilot's models.",
  f4: "Share a session in Kilo Code, and anyone with the link can read it — and once you sign in, Kilo uploads every session. Cloud agents like Devin keep a copy of your project. And Claude Code keeps transcripts on your own disk for thirty days.",
  f5: "Then there's everything around the app: Cline's website says it may record your mouse and typing, plus your billing details and your messages to support.",
  g1: "Open source helps — anyone can check what leaves. It just doesn't mean nothing does.",
  g2: "Four words. One line of code changed — and forty-six kinds of data. Seventeen needed to answer you. Twenty-two collected on top. Only seven waited for you to choose.",
  g3: 'All of that, for one small bug fix. And you never saw most of it leave.',
};
// old beat word -> spoken word, per line: the pictures were keyed to the first draft's words, the voice says the new ones
export const ANCHOR = {r1: [[4, 6], [10, 13]], r2: [[4, 4], [6, 7], [10, 14]], a1: [[6, 6], [10, 12]], a2: [[0, 8], [2, 10], [4, 13], [5, 14], [7, 15], [9, 17], [10, 19], [11, 20], [15, 24]], a9: [[7, 8]], a3: [[1, 2], [5, 6]], a31: [[1, 2], [3, 4], [6, 7]], a32: [[1, 2]], a33: [[1, 1]], a34: [[0, 1], [2, 3], [3, 4]], a4: [[5, 4], [6, 5], [7, 6], [8, 14], [9, 17], [10, 18], [11, 19], [12, 20]], a5: [[3, 3], [4, 4], [5, 10], [6, 12], [7, 13], [8, 15], [9, 23]], b1: [[2, 7]], b2: [[3, 3], [6, 4], [8, 6], [9, 7], [11, 9], [12, 11], [14, 14], [15, 15]], b3: [[2, 2], [3, 3], [5, 7], [8, 10]], b4: [[2, 2], [5, 5], [6, 6], [8, 9], [10, 11], [12, 14]], b5: [[2, 5], [3, 6], [5, 8], [6, 9], [8, 10], [9, 12], [11, 14], [12, 15], [13, 17], [15, 19], [17, 21], [18, 22], [21, 25]], c1: [[2, 7]], c2: [[1, 2], [2, 3], [5, 10], [6, 11], [23, 28]], c3: [[2, 5], [5, 9], [6, 10], [9, 13], [10, 14], [11, 15], [13, 17], [16, 20], [17, 21]], d1: [[5, 5], [8, 8], [12, 13]], d2: [[7, 10], [10, 14]], d3: [[2, 2], [4, 5], [5, 14], [6, 15], [8, 17], [11, 24], [12, 25], [14, 30]], d4: [[11, 11], [12, 13], [14, 15], [18, 17]], e1: [[2, 2], [5, 4], [7, 8], [10, 10], [11, 11]], e2: [[0, 2], [3, 6], [4, 10], [5, 15], [6, 20], [9, 21], [10, 22], [12, 23], [14, 25], [15, 27], [17, 31]], e3: [[1, 1], [2, 2], [3, 6], [4, 8], [5, 9], [7, 17], [9, 19], [10, 20], [11, 21], [13, 22], [15, 24], [16, 29], [20, 39]], f1: [[3, 3], [6, 7], [9, 12]], f2: [[0, 8], [3, 10], [4, 11], [6, 12], [9, 14]], f3: [[3, 2], [5, 7], [7, 10], [8, 12], [9, 21], [10, 25], [11, 27], [12, 28], [13, 32], [14, 34], [15, 37], [16, 40]], f4: [[1, 10], [3, 24], [6, 30], [9, 33], [10, 34], [11, 37], [14, 42]], f5: [[3, 5], [6, 7], [8, 15], [10, 18], [11, 21], [12, 22], [14, 24]], g1: [[4, 6], [7, 9], [10, 13]], g2: [[2, 2], [4, 8], [5, 9], [7, 12]]};

const PACE = 0.36, BASE = 0.45, CALM = 0.45;
export const SCRIPT = [
  ['r1', 'It’s late, and your login page is broken. So you open a coding agent.', 0.5],
  ['r2', 'You’re about to type four words. Let’s follow everything that leaves with them.', 0.5],
  ['rt', '', 2.6],
  ['a1', 'Before you type a thing, the agent wakes up and checks in.', 0.15],
  ['a2', 'Green light helps answer you. Gold is collected on top. Pink leaves only if you choose.', 0.5],
  ['a9', 'No single tool does all of this. We’re following many.', 0.5],
  ['a3', 'It signs in to your account.', 1.0],
  ['a31', 'It notes an ID for this device.', 0.9],
  ['a32', 'Your system.', 1.25],
  ['a33', 'Your terminal.', 1.1],
  ['a34', 'Its own version.', 3.2],
  ['a4', 'Its signal leaves from your internet address, which shows roughly where you are.', 0.6],
  ['a5', 'And it asks home: any updates? Which features are on?', 1.0],
  ['b1', 'Then it dives into your project.', 0.7],
  ['b2', 'It reads the names of your files. Your Git branch, your uncommitted changes, your latest commits.', 0.7],
  ['b3', 'It gathers instruction files, and memories from past sessions.', 0.6],
  ['b4', 'Some tools chart the whole codebase: cut into chunks, then turned into numbers.', 0.9],
  ['b5', 'And in July 2026, a researcher caught one tool sending a whole repository, history included, until a server switch shut it off.', 1.0],
  ['c1', 'Now, you type.', 1.0],
  ['c2', 'Your four words don’t travel alone. They ride with the tool’s own instructions, the conversation so far, your project’s details, and anything you attach.', 0.9],
  ['c3', 'Some tools send it all straight to the AI model. Others pass it through their own servers first.', 0.9],
  ['d1', 'The model can’t see your computer. So it asks, and the agent goes back, again and again.', 0.6],
  ['d2', 'Each lap carries more: what’s inside your files, what your commands print.', 0.6],
  ['d3', 'Some laps reach the web, or tools you’ve connected, and those services see it too.', 0.6],
  ['d4', 'And every lap sheds gold: which tools ran, how long they took, what you allowed, and what you refused.', 0.9],
  ['e1', 'Then the answer comes home. One line changes, and the login works.', 0.9],
  ['e2', 'More gold falls: tokens, speed, errors. Keep the change or undo it, and some tools note that too.', 0.7],
  ['e3', 'If it crashes, a report can leave. Rate an answer or send feedback, and the whole conversation can go with it.', 0.9],
  ['f1', 'You close the laptop. But the copies are still out there.', 0.8],
  ['f2', 'Some fade after thirty days. Some are kept for years.', 0.8],
  ['f3', 'On some plans they help grow the next model, unless you opt out. Sometimes, people read them.', 0.8],
  ['f4', 'Shared links and cloud agents keep copies of their own. So does your own disk.', 0.6],
  ['f5', 'And outside the app, there’s the website you visited, your billing, your messages to support.', 0.9],
  ['g1', 'Open code lets anyone check what’s sent. It doesn’t mean nothing is.', 0.8],
  ['g2', 'Four words. One line. And all of this.', 2.0],
  ['g3', 'All of that, for one small bug fix. And you never saw most of it leave.', 7.4],
];
export const C = {}, LINES = [];
let t = 1.2;
for (const [id, s, hold] of SCRIPT) { const say = SAY[id] ?? s, n = say ? say.split(/\s+/).length : 0, d = VO[id] ?? (say ? BASE + n * PACE : 0); C[id] = t; C[id + 'e'] = t + d; const h = hold + (say ? CALM : 0); C[id + 'n'] = t + d + h; LINES.push({ id, s: say, t, end: t + d, hold: Math.min(h, 0.6) }); t += d + h; }
C.end = t + 0.3;
// time at fraction f of a line's speech; word(id, k) = time the k-th word (0-based) starts
export const at = (id, f) => C[id] + (C[id + 'e'] - C[id]) * f;
// word(id, k): when the k-th word (0-based, fractional ok) of the line's BEAT text is spoken. Beats map to spoken words through
// ANCHOR, and spoken words are placed by their length (dashes count as a short pause).
const CUM = {};
const cum = id => CUM[id] ??= (() => { const w = SAY[id].split(/\s+/).map(q => (q === '—' ? 5 : q.length + 1)); const c = [0]; w.forEach(q => c.push(c[c.length - 1] + q)); return c; })();
export const word = (id, k) => {
  const beat = SCRIPT.find(l => l[0] === id)[1].split(/\s+/).length; if (!SAY[id]) return at(id, k / beat);
  const c = cum(id), nN = c.length - 1, base = ANCHOR[id] || [], A = [...(base.some(a => a[0] === 0) ? [] : [[0, 0]]), ...base, [beat, nN]]; let j = 0; while (j < A.length - 2 && k > A[j + 1][0]) j++;
  const [o0, n0] = A[j], [o1, n1] = A[j + 1], ni = Math.max(0, Math.min(nN, n0 + (n1 - n0) * (o1 > o0 ? (k - o0) / (o1 - o0) : 0))), i = Math.min(nN - 1, Math.floor(ni)), f = ni - i;
  const ws = WORDS[id]; if (ws && ws.length === nN) { const s0 = ws[Math.min(i, nN - 1)], s1 = i + 1 < nN ? ws[i + 1] : C[id + 'e'] - C[id]; return C[id] + s0 + (s1 - s0) * f; }
  return at(id, (c[i] + (c[i + 1] - c[i]) * f) / c[nN]);
};
// Acts in order: [file in src/acts, start, end]. Neighbours overlap by SEAM and are cross-dissolved/matched as each act's spec says.
export const SEAM = 0.3;
export const SEGMENTS = [
  ['opening', 0, C.a34e + 2.75 + SEAM], ['orbit', C.a34e + 2.75, C.b1 - 0.2 + SEAM], ['vault', C.b1 - 0.2, C.c1 - 0.3 + SEAM], ['send', C.c1 - 0.3, C.d1 - 0.25 + SEAM], ['loop', C.d1 - 0.25, C.e1 - 0.25 + SEAM], ['answer', C.e1 - 0.25, C.f1 - 0.25 + SEAM], ['after', C.f1 - 0.25, C.g1 - 0.3 + SEAM], ['finale', C.g1 - 0.3, C.end + 1],
];
