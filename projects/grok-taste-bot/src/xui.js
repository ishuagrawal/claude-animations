// The X app, light theme: left nav, search header with result tabs, posts with an action row, right sidebar.
// Layout is in X's own CSS px (600 px timeline column) scaled by S to fill a 1080p frame. Icons are simple line
// drawings in the same spirit, not X's artwork; posts never carry invented text, names or counts — only the
// creators' real handles and media, with skeleton bars standing in for everything else.

export const S = 1.75;                 // screen px per X px
export const COL = { x: 960 - 300 * S, w: 600 * S };
export const HT = 56;                  // top of the search header (room above it for the bot to perch)
export const FIELD = { y: HT + 26.5 * S, w: 488 * S, h: 42 * S }; // search field, centred on the column
export const TABS_Y = HT + 53 * S;     // top of the tab row
export const FEED_TOP = HT + 106 * S;  // first post starts under the header

export const C = {
  ink: '#0F1419', muted: '#536471', line: '#EFF3F4', border: '#CFD9DE', blue: '#1D9BF0',
  field: '#EFF3F4', panel: '#F7F9F9', skel: '#E7ECF0', skelDark: '#D5DDE3', avatar: '#CFD9DE',
};
export const FONT = '"SF Pro Text", "SF Pro", system-ui, sans-serif';

const X_LOGO = new Path2D('M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z');
export function xLogo(ctx, x, y, size, color = C.ink) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.fillStyle = color;
  ctx.fill(X_LOGO);
  ctx.restore();
}

// 24×24 line icons
const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z',
  search: 'M10.5 4a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13zM15.5 15.5 21 21',
  bell: 'M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 20.5a2 2 0 0 0 4 0',
  mail: 'M3 5.5h18v13H3zM3.5 6.5 12 13l8.5-6.5',
  bookmark: 'M6 3.5h12V21l-6-4.5L6 21z',
  person: 'M12 4a4 4 0 1 1 0 8 4 4 0 0 1 0-8zM4 21a8 8 0 0 1 16 0',
  reply: 'M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5h-8l-5 4v-4H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5z',
  repost: 'M4.5 8.5l3-3 3 3M7.5 5.5V16a1.5 1.5 0 0 0 1.5 1.5h5M19.5 15.5l-3 3-3-3M16.5 18.5V8A1.5 1.5 0 0 0 15 6.5h-5',
  like: 'M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z',
  views: 'M5 20v-7M10 20V5M15 20v-10M20 20v-4',
  share: 'M12 3.5v12M7.5 8 12 3.5 16.5 8M5 13.5V20h14v-6.5',
  back: 'M20 12H5M11 5.5 4.5 12l6.5 6.5',
};
const ICON_PATHS = Object.fromEntries(Object.entries(ICONS).map(([k, d]) => [k, new Path2D(d)]));
export function icon(ctx, name, x, y, size, color = C.ink, width = 2) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke(ICON_PATHS[name]);
  ctx.restore();
}
function dots(ctx, x, y, s, color = C.muted) {
  ctx.fillStyle = color;
  for (const dx of [-6, 0, 6]) { ctx.beginPath(); ctx.arc(x + dx * s, y, 1.7 * s, 0, Math.PI * 2); ctx.fill(); }
}
const bar = (ctx, x, y, w, h, color) => { ctx.fillStyle = color; ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill(); };

// X's default avatar: a grey disc with a white head-and-shoulders.
function avatar(ctx, cx, cy, r) {
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = C.avatar; ctx.fill(); ctx.clip();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(cx, cy - r * 0.18, r * 0.34, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.78, r * 0.68, r * 0.52, 0, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ---------- side columns (fixed; they zoom with the camera but never scroll) ----------
export function drawNav(ctx) {
  const x = COL.x - 250 * S;
  xLogo(ctx, x + 12 * S, HT + 6 * S, 30 * S);
  const items = [['home', 'Home'], ['search', 'Explore'], ['bell', 'Notifications'], ['mail', 'Messages'], ['bookmark', 'Bookmarks'], ['person', 'Profile']];
  ctx.textBaseline = 'middle';
  items.forEach(([ic, label], i) => {
    const y = HT + 72 * S + i * 54 * S;
    const active = label === 'Explore';
    icon(ctx, ic, x + 12 * S, y - 13 * S, 26 * S, C.ink, active ? 2.8 : 1.8);
    ctx.font = `${active ? 700 : 400} ${20 * S}px ${FONT}`;
    ctx.fillStyle = C.ink;
    ctx.fillText(label, x + 56 * S, y + S);
  });
  const py = HT + 72 * S + items.length * 54 * S + 6 * S;
  ctx.fillStyle = C.ink;
  ctx.beginPath(); ctx.roundRect(x + 4 * S, py, 226 * S, 52 * S, 26 * S); ctx.fill();
  ctx.font = `700 ${17 * S}px ${FONT}`;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.fillText('Post', x + 117 * S, py + 27 * S);
  ctx.textAlign = 'left';
}
export function drawSidebar(ctx) {
  const x = COL.x + COL.w + 30 * S, w = 350 * S;
  const box = (y, h, title, rows) => {
    ctx.fillStyle = C.panel;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 16 * S); ctx.fill();
    ctx.font = `800 ${20 * S}px ${FONT}`;
    ctx.fillStyle = C.ink;
    ctx.textBaseline = 'middle';
    ctx.fillText(title, x + 16 * S, y + 28 * S);
    rows.forEach((r, i) => {
      const ry = y + 62 * S + i * 64 * S;
      bar(ctx, x + 16 * S, ry, (90 + r * 9) * S, 9 * S, C.skel);
      bar(ctx, x + 16 * S, ry + 18 * S, (170 + r * 17) * S, 12 * S, C.skelDark);
      bar(ctx, x + 16 * S, ry + 38 * S, (70 + r * 11) * S, 9 * S, C.skel);
    });
  };
  box(HT + 6 * S, 330 * S, "What's happening", [3, 0, 5, 1]);
  box(HT + 352 * S, 250 * S, 'Who to follow', [2, 4, 1]);
}

// ---------- posts ----------
// Post geometry in X px: 16 padding, 40 avatar, content column from 68 to 584.
export const POST = { pad: 12, content: 68, mediaW: 516, maxMediaH: 420 };
export function postHeights(p) {
  const textH = p.id ? 0 : 2 * 20 + 4;           // results are media-only posts; placeholders carry skeleton text
  p.mediaTop = (POST.pad + 22 + 6 + textH) * S;  // from the post's top edge
  p.h = p.mediaTop + p.mh + (12 + 20 + 12) * S;  // media, action row, bottom padding
}
export function mediaBox(p, top) {
  return { x: COL.x + POST.content * S, y: top + p.mediaTop, w: POST.mediaW * S, h: p.mh };
}
// Header row + skeleton text + action row; the media itself is drawn by the caller (it may be a video frame).
export function drawPostChrome(ctx, p, top) {
  const L = COL.x;
  avatar(ctx, L + 36 * S, top + (POST.pad + 20) * S, 20 * S);
  const ny = top + (POST.pad + 11) * S;
  ctx.textBaseline = 'middle';
  if (p.id) {
    // a skeleton where the display name goes, then the real handle in X's grey
    bar(ctx, L + POST.content * S, ny - 7 * S, (64 + (p.i * 23) % 40) * S, 14 * S, C.skelDark);
    ctx.font = `400 ${15 * S}px ${FONT}`;
    ctx.fillStyle = C.muted;
    ctx.fillText('@' + p.id, L + (POST.content + 76 + (p.i * 23) % 40) * S, ny + S);
  } else {
    bar(ctx, L + POST.content * S, ny - 7 * S, (80 + (p.i * 31) % 50) * S, 14 * S, C.skelDark);
    bar(ctx, L + (POST.content + 92 + (p.i * 31) % 50) * S, ny - 6 * S, 70 * S, 12 * S, C.skel);
    bar(ctx, L + POST.content * S, top + (POST.pad + 32) * S, (440 - (p.i * 41) % 120) * S, 12 * S, C.skel);
    bar(ctx, L + POST.content * S, top + (POST.pad + 52) * S, (300 - (p.i * 29) % 110) * S, 12 * S, C.skel);
  }
  dots(ctx, L + 572 * S, ny, S);
  const ay = top + p.mediaTop + p.mh + 12 * S;
  ['reply', 'repost', 'like', 'views'].forEach((n, i) => icon(ctx, n, L + (POST.content + i * 112) * S, ay, 19 * S, C.muted, 1.6));
  icon(ctx, 'bookmark', L + 520 * S, ay, 19 * S, C.muted, 1.6);
  icon(ctx, 'share', L + 552 * S, ay, 19 * S, C.muted, 1.6);
  ctx.fillStyle = C.line;
  ctx.fillRect(L, top + p.h - S, COL.w, S);
}
export function drawMediaBorder(ctx, r, radius) {
  ctx.strokeStyle = C.border;
  ctx.lineWidth = S * 0.8;
  ctx.beginPath(); ctx.roundRect(r.x, r.y, r.w, r.h, radius); ctx.stroke();
}

// ---------- header ----------
// The sticky search header: back arrow, the field (drawn by the caller — it is the bot's body), more, and the
// Top · Latest · People · Media · Lists tabs with Top selected. a = 0..1 fades it in.
export function drawHeader(ctx, a) {
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha *= a;
  ctx.fillStyle = 'rgba(255,255,255,0.96)';
  ctx.fillRect(COL.x, 0, COL.w, FEED_TOP);
  icon(ctx, 'back', COL.x + 16 * S, FIELD.y - 11 * S, 22 * S, C.ink, 2.2);
  dots(ctx, COL.x + COL.w - 30 * S, FIELD.y, S, C.ink);
  const tabs = ['Top', 'Latest', 'People', 'Media', 'Lists'];
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  tabs.forEach((label, i) => {
    const cx = COL.x + (60 + i * 120) * S, cy = TABS_Y + 26.5 * S;
    const active = i === 0;
    ctx.font = `${active ? 700 : 500} ${15 * S}px ${FONT}`;
    ctx.fillStyle = active ? C.ink : C.muted;
    ctx.fillText(label, cx, cy);
    if (active) {
      const w = ctx.measureText(label).width + 6 * S;
      ctx.fillStyle = C.blue;
      ctx.beginPath(); ctx.roundRect(cx - w / 2, TABS_Y + 49 * S, w, 4 * S, 2 * S); ctx.fill();
    }
  });
  ctx.textAlign = 'left';
  ctx.fillStyle = C.line;
  ctx.fillRect(COL.x, FEED_TOP - S, COL.w, S);
  ctx.restore();
}
// Contents of the search field: magnifier, then the query (or the grey "Search" placeholder) and a caret.
export function drawFieldContents(ctx, r, text, { focus = 0, caret = false } = {}) {
  const s = r.h / (42 * S);
  const x0 = r.x - r.w / 2;
  const iconColor = focus > 0.5 ? C.blue : C.muted;
  icon(ctx, 'search', x0 + 16 * S * s, r.y - 9.5 * S * s, 19 * S * s, iconColor, 2);
  ctx.font = `400 ${15 * S * s}px ${FONT}`;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = text ? C.ink : C.muted;
  const tx = x0 + 48 * S * s;
  ctx.fillText(text || 'Search', tx, r.y + S * s);
  if (caret) {
    ctx.fillStyle = C.blue;
    ctx.fillRect(tx + (text ? ctx.measureText(text).width + 2 : 0), r.y - 10 * S * s, 1.6 * S * s, 20 * S * s);
  }
}
