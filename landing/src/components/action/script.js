// The "See Hukam in action" storyboard. Every visual state is derived from a single step number,
// so the phone, the nodes and the wires can never drift out of sync.
// Message texts mirror what src/router.mjs really sends.

export const S = {
  IDLE: 0,
  OUT: 1, // user's message appears, one grey tick
  DELIVERED: 2, // two grey ticks
  READ: 3, // two blue ticks (Hukam marks it read)
  REACT: 4, // Hukam reacts to the message
  TO_GEMMA: 5, // wire phone -> Gemma (through Whisper for voice notes)
  ECHO: 6, // voice only: transcript echoed back in italics
  THINK: 7, // Gemma is reading
  DECIDE: 8, // Gemma's decision
  TO_SUPERSET: 9, // wire Gemma -> Superset
  SPAWN: 10, // Superset starts the agent; "Started" bubble
  TO_AGENT: 11, // wire Superset -> agent, agent node appears
  WORK: 12, // agent working
  DONE: 13, // agent finished
  RETURN: 14, // wire agent -> phone, result flies back
  REPLY: 15, // "finished" bubble
  IMAGE: 16, // image bubble
  HOLD: 17,
};

// How long each step lasts before the next one starts (ms), indexed by step.
const BASE = [500, 700, 450, 450, 400, 950, 650, 1100, 750, 700, 700, 650, 2700, 550, 1050, 650, 700, 3400];

export const SCENARIOS = [
  {
    key: 'voice',
    label: 'Voice note → live page',
    voice: { length: '0:06' },
    out: null,
    react: '🎙️',
    echo: 'Build a menu page for my chai stall',
    decision: { action: 'spawn', agent: 'claude', name: 'chai-menu', risk: 'low' },
    agent: { name: 'Claude Code', cli: 'claude', tone: 'claude' },
    log: ['Reading the request', 'Writing index.html + styles', 'Page screenshot ready'],
    finished: 'Menu page with prices, a hero photo and an order button.',
    image: 'page',
    imageCaption: 'chai-menu · live preview',
    durations: BASE,
  },
  {
    key: 'image',
    label: 'Text → generated image',
    voice: null,
    out: 'codex make a logo for my chai stall',
    react: '⚡',
    echo: null,
    decision: { action: 'spawn', agent: 'codex', name: 'chai-logo', risk: 'low' },
    agent: { name: 'Codex', cli: 'codex', tone: 'codex' },
    log: ['Generating the image', 'Saved outputs/chai-logo.png', 'Sending it back'],
    finished: 'Flat chai-glass logo in warm brown and orange.',
    image: 'logo',
    imageCaption: 'outputs/chai-logo.png',
    durations: BASE.map((d, i) => (i === S.ECHO ? 0 : d)),
  },
];

export const STEP_COUNT = S.HOLD + 1;
