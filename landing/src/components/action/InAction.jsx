import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { Badge } from '../ui.jsx';
import { useInView, useReducedMotion } from '../../lib/hooks.js';
import { S, SCENARIOS } from './script.js';
import { Phone } from './Phone.jsx';
import { CANVAS, Canvas, Strip } from './Nodes.jsx';
import './whatsapp.css';
import './action.css';

// Scales a fixed-size drawing down to the available width, so wires and nodes keep exact positions.
function useFit(baseW) {
  const ref = useRef(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setScale(Math.min(1, entry.contentRect.width / baseW)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [baseW]);
  return [ref, scale];
}

function useWide() {
  const q = '(min-width: 1000px)';
  const [wide, setWide] = useState(() => window.matchMedia(q).matches);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setWide(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

function Stage({ sc, step, wide, fading }) {
  const baseW = wide ? CANVAS.w : 372;
  const baseH = wide ? CANVAS.h : 720 + 96;
  const [ref, scale] = useFit(baseW);
  return (
    <div className="stage-fit" ref={ref} style={{ height: baseH * scale }}>
      <div className={`stage ${wide ? 'is-wide' : 'is-narrow'}${fading ? ' is-fading' : ''}`} style={{ width: baseW, height: baseH, transform: `scale(${scale})` }}>
        <div className="stage-phone"><Phone scenario={sc} step={step} /></div>
        {wide ? <Canvas sc={sc} step={step} /> : <Strip sc={sc} step={step} />}
      </div>
    </div>
  );
}

// ?story=<scenario>-<step> freezes the storyboard on one frame (used for screenshots).
const FROZEN = (() => {
  const m = /[?&]story=(\d)-(\d+)/.exec(window.location.search);
  return m ? { scenario: Number(m[1]) % SCENARIOS.length, step: Math.min(Number(m[2]), S.HOLD) } : null;
})();

export function InAction() {
  const reduced = useReducedMotion() || !!FROZEN;
  const wide = useWide();
  const [viewRef, inView] = useInView({ threshold: 0.25 });
  const [scenario, setScenario] = useState(FROZEN ? FROZEN.scenario : 0);
  const [step, setStep] = useState(S.IDLE);
  const [paused, setPaused] = useState(false);
  const [fading, setFading] = useState(false);
  const sc = SCENARIOS[scenario];
  const running = inView && !paused && !reduced;

  useEffect(() => {
    if (!running) return;
    if (step === S.HOLD) {
      // Fade the whole stage out, swap to the next story, fade back in.
      const t1 = setTimeout(() => setFading(true), sc.durations[S.HOLD]);
      const t2 = setTimeout(() => {
        setScenario((s) => (s + 1) % SCENARIOS.length);
        setStep(S.IDLE);
        setFading(false);
      }, sc.durations[S.HOLD] + 450);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    let next = step + 1;
    while (next < S.HOLD && sc.durations[next] === 0) next++;
    const t = setTimeout(() => setStep(next), sc.durations[step]);
    return () => clearTimeout(t);
  }, [running, step, sc]);

  const pick = (i) => { setScenario(i); setStep(reduced ? S.HOLD : S.IDLE); setFading(false); };
  const shownStep = FROZEN ? FROZEN.step : reduced ? S.HOLD : step;

  return (
    <section className="section in-action" id="in-action" aria-labelledby="action-title">
      <div className="container">
        <div className="section-head" data-reveal>
          <Badge>See Hukam in action</Badge>
          <h2 id="action-title" className="h2">One message.<br /><span className="soft">Real work back.</span></h2>
        </div>

        <div className="stage-wrap" ref={viewRef} data-reveal>
          <p className="sr-only">
            {sc.voice
              ? 'You send Hukam a WhatsApp voice note asking for a menu page for a chai stall. Whisper transcribes it on your machine, Gemma 4 decides to start Claude Code, Superset spawns the agent in a sandboxed worktree, and when it finishes Hukam replies on WhatsApp with a summary and a screenshot of the new page.'
              : 'You text Hukam “codex make a logo for my chai stall”. Gemma 4 picks Codex, Superset starts it, Codex generates the image, and Hukam sends the logo back in the chat.'}
          </p>
          <Stage sc={sc} step={shownStep} wide={wide} fading={fading} />
        </div>

        <div className="stage-controls">
          <div className="stage-tabs" role="group" aria-label="Choose an example">
            {SCENARIOS.map((s, i) => (
              <button key={s.key} className={i === scenario ? 'is-on' : ''} aria-pressed={i === scenario} onClick={() => pick(i)}>
                {s.label}
              </button>
            ))}
          </div>
          {!reduced && (
            <button className="stage-pause" onClick={() => setPaused(!paused)} aria-label={paused ? 'Play animation' : 'Pause animation'}>
              {paused ? <Play size={14} fill="currentColor" /> : <Pause size={14} fill="currentColor" />}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
