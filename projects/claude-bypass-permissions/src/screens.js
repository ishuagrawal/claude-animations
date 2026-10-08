// What the monitor shows during the night: Claude's transcript accumulating tool calls.
import { P } from './palette.js';
import * as T from './terminal.js';
import { C } from './timeline.js';
import { clamp, ease, seg } from './core.js';

const TASK = 'clean up my machine and make the tests pass. going to bed';
export const CALLS = [
  { at: C.lampOn, name: 'Bash', args: 'lights --scene showtime', res: ['scene "showtime" applied to 3 lights'] },
  { at: C.s1Hit, name: 'Bash', args: 'rm -rf ~/Documents ~/Desktop ~/Pictures', res: ['(No content)'] },
  { at: C.s2Last, name: 'Bash', args: 'git push --force origin main', res: ['+ 9f2c1e7...a04b3d1 main -> main (forced update)'] },
  { at: C.green, name: 'Bash', args: 'rm tests/auth.test.ts tests/payments.test.ts tests/checkout.test.ts', res: ['Tests: 212 passed, 212 total'] },
  { at: C.s4Jump + 0.5, name: 'Bash', args: 'psql -c "DROP DATABASE production;"', res: ['DROP DATABASE'] },
  { at: C.s5Launch, name: 'Bash', args: 'aws ec2 run-instances --count 500 --instance-type p5.48xlarge', res: ['Launched 500 instances (us-east-1)'] },
];
const VERBS = ['Freelancing', 'Showboating', 'Hot-dogging', 'Freewheeling', 'Grandstanding', 'Razzle-dazzling'];

export function showScreen(t, o = {}) {
  return (s, w, h) => {
    T.bg(s, w, h);
    const done = CALLS.filter(c => t >= c.at);
    // scroll: each call takes ~2 rows; keep the newest visible
    const rows = 2 + done.length * 2.4;
    const scroll = Math.max(0, rows - 11.5) * T.LH;
    s.save();
    s.translate(0, -scroll);
    s.globalAlpha = 0.5;
    T.line(s, 60, 80, [['> ', P.termDim], [TASK, P.termDim]]);
    s.globalAlpha = 1;
    let y = 170;
    done.forEach((c, i) => {
      const age = t - c.at;
      s.save();
      const newest = i === done.length - 1 && age < 2.2;
      s.globalAlpha = clamp(age / 0.08) * (newest ? 1 : 0.42);
      T.toolCall(s, 60, y, c.name, c.args, c.res);
      s.restore();
      y += T.LH * 2.4;
    });
    s.restore();
    // bottom: spinner + input + status
    s.fillStyle = P.term; s.fillRect(0, 600, w, 300);
    const vi = Math.floor(Math.max(0, t - C.land) / 4) % VERBS.length;
    T.spinner(s, 60, 650, t, o.verb || VERBS[vi]);
    T.inputBox(s, 40, 700, 1520, '', t);
    T.statusLine(s, 50, 826, 'bypass', 0.4);
  };
}
