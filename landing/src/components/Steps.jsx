import { CheckCheck, FileText, Image, Mic, Sparkle, SquareTerminal, Terminal } from 'lucide-react';
import { Badge } from './ui.jsx';
import { useInView } from '../lib/hooks.js';
import './steps.css';

function SendVisual() {
  return (
    <div className="sv-send">
      <div className="sv-inputs">
        <span><Mic size={14} /> Voice</span>
        <span><Image size={14} /> Photo</span>
        <span><FileText size={14} /> PDF</span>
      </div>
      <div className="sv-bubble">claude: add a pricing section<span className="sv-meta">4:12 PM <CheckCheck size={15} className="sv-ticks" /></span></div>
    </div>
  );
}

function RouteVisual() {
  const agents = [['Claude Code', <Sparkle size={13} key="c" />], ['Codex', <SquareTerminal size={13} key="x" />], ['OpenCode', <Terminal size={13} key="o" />]];
  return (
    <div className="sv-route">
      <svg viewBox="0 0 240 132" className="sv-lines" aria-hidden="true">
        {[22, 66, 110].map((y, i) => (
          <g key={y} className={`sv-line l${i}`}>
            <path d={`M 76 66 C 108 66, 108 ${y}, 140 ${y}`} />
            <path d={`M 76 66 C 108 66, 108 ${y}, 140 ${y}`} className="sv-lit" />
          </g>
        ))}
      </svg>
      <span className="sv-gemma">Gemma 4</span>
      <div className="sv-agents">
        {agents.map(([name, icon], i) => <span key={name} className={`a${i}`}>{icon}{name}</span>)}
      </div>
    </div>
  );
}

function ResultVisual() {
  return (
    <div className="sv-result">
      <div className="sv-in">✅ <b>chai-logo</b> finished</div>
      <div className="sv-in sv-img"><img src="/generated/chai-logo.webp" alt="" width="128" height="128" /></div>
    </div>
  );
}

const STEPS = [
  { n: '01', title: 'Send a message.', note: 'Text, voice note, photo or PDF.', Visual: SendVisual },
  { n: '02', title: 'Gemma routes it.', note: 'Right agent. Risky work waits for you.', Visual: RouteVisual },
  { n: '03', title: 'Get it back.', note: 'Summary, image or live screenshot.', Visual: ResultVisual },
];

export function Steps() {
  const [ref, live] = useInView({ threshold: 0.3 });
  return (
    <section className="section steps" id="how" aria-labelledby="steps-title">
      <div className="container">
        <div className="section-head" data-reveal>
          <Badge>How it works</Badge>
          <h2 id="steps-title" className="h2">Your workflow.<br /><span className="soft">Three simple steps.</span></h2>
        </div>
        <ol ref={ref} className={`steps-list${live ? ' is-live' : ''}`}>
          {STEPS.map(({ n, title, note, Visual }, i) => (
            <li key={n} className="step" data-reveal style={{ '--d': `${i * 0.12}s`, '--i': i }}>
              <div className="step-marker" aria-hidden="true"><span>{n}</span></div>
              <div className="step-card rim">
                <div className="rim-inner">
                  <div className="step-visual" aria-hidden="true"><Visual /></div>
                  <div className="step-copy">
                    <h3><span className="sr-only">Step {i + 1}: </span>{title}</h3>
                    <p>{note}</p>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
