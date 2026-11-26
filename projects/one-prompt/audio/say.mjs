// Prints the subtitle text of every narrated line as JSON ({line id: text}), for audio/scribe_words.py.
globalThis.OffscreenCanvas = class {};
const { LINES } = await import('../src/timeline.js');
console.log(JSON.stringify(Object.fromEntries(LINES.filter(l => l.s).map(l => [l.id, l.s]))));
