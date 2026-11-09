// Registry of shot modules (lazy, so ?only=<name> builds a single world).
export const MODULES = {
  room: () => import('./room.js'),        // the room, the screen, the cord, the reply, the ending
  outlet: () => import('./outlet.js'),    // the spark wakes inside the wall outlet
  tunnel: () => import('./tunnel.js'),    // inside the copper of the cord
  psu: () => import('./psu.js'),          // the power supply cavern
  board: () => import('./board.js'),      // the motherboard vista and the run
  chip: () => import('./chip.js'),        // inside the processor: Claude
  lookdev: () => import('./lookdev.js'),
};
