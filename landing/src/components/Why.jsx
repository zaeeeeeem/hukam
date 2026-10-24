import { Check, CheckCheck, Play, ShieldCheck } from 'lucide-react';
import { Badge } from './ui.jsx';
import { useInView } from '../lib/hooks.js';
import './why.css';

function VoiceDemo() {
  return (
    <div className="mini mini-voice">
      <div className="mv-bubble">
        <span className="mv-play"><Play size={13} fill="currentColor" /></span>
        <span className="mv-wave">{Array.from({ length: 26 }, (_, k) => <i key={k} style={{ '--k': k, '--h': [4, 7, 11, 6, 13, 9, 15, 8, 5, 12, 16, 10, 7, 13, 6, 11, 14, 8, 5, 9, 12, 6, 10, 7, 4, 6][k] }} />)}</span>
        <span className="mv-time">0:06</span>
      </div>
      <div className="mv-langs">
        <span>English</span><span lang="ur">اردو</span><span>Roman Urdu</span>
      </div>
    </div>
  );
}

function GemmaDemo() {
  const rows = [['action', 'spawn'], ['agent', 'codex'], ['name', 'auth-tests'], ['risk', 'low']];
  return (
    <div className="mini mini-gemma">
      <div className="mg-head"><span className="mg-dot" />Gemma 4 · decision</div>
      <div className="mg-code">
        <span className="mg-brace">{'{'}</span>
        {rows.map(([k, v], i) => (
          <span className="mg-row" key={k} style={{ '--i': i }}>
            <span className="mg-k">"{k}"</span>: <span className={`mg-v${k === 'risk' ? ' is-low' : ''}`}>"{v}"</span>{i < rows.length - 1 ? ',' : ''}
          </span>
        ))}
        <span className="mg-brace">{'}'}</span>
      </div>
    </div>
  );
}

function AgentsDemo() {
  const agents = [['Claude Code', 'dark-mode-toggle', 'a'], ['Codex', 'auth-tests', 'b'], ['OpenCode', 'menu-page', 'c']];
  return (
    <div className="mini mini-agents">
      {agents.map(([name, task, k]) => (
        <div className={`ma-row ma-${k}`} key={name}>
          <span className="ma-name">{name}</span>
          <span className="ma-task">{task}</span>
          <span className="ma-bar"><i /></span>
          <span className="ma-state"><Check size={13} strokeWidth={3} /></span>
        </div>
      ))}
    </div>
  );
}

function SafeDemo() {
  return (
    <div className="mini mini-safe">
      <div className="ms-in">Deploy to production? Reply <b>yes k3f9</b></div>
      <div className="ms-out">yes k3f9 <CheckCheck size={15} className="ms-ticks" /></div>
      <div className="ms-ok"><ShieldCheck size={14} /> Approved by owner</div>
    </div>
  );
}

const CARDS = [
  { key: 'voice', title: 'Type it. Say it.', note: 'English, Urdu or Roman Urdu. Voice stays on your machine.', img: 'card-voice', alt: 'Glass sound-wave sculpture glowing violet and amber', Demo: VoiceDemo, from: '20deg' },
  { key: 'gemma', title: 'An open model decides.', note: 'Gemma 4 reads text, photos and PDFs, then picks the agent.', img: 'card-gemma', alt: 'Faceted glowing crystal with light filaments inside', Demo: GemmaDemo, from: '140deg' },
  { key: 'agents', title: 'Real agents. Real code.', note: 'Claude Code, Codex and OpenCode, in a sandboxed worktree.', img: 'card-agents', alt: 'Three glowing glass cubes linked by threads of light', Demo: AgentsDemo, from: '250deg' },
  { key: 'safe', title: 'Nothing risky without you.', note: 'Deploys, deletes and secrets wait for your yes.', img: 'card-safe', alt: 'Frosted glass padlock with a glowing keyhole', Demo: SafeDemo, from: '320deg' },
];

function Card({ card, index }) {
  const [ref, live] = useInView({ threshold: 0.35 });
  const { Demo } = card;
  return (
    <article ref={ref} className={`why-card why-${card.key} rim${live ? ' is-live' : ''}`} style={{ '--rim-from': card.from, '--d': `${(index % 2) * 0.12}s` }} data-reveal>
      <div className="rim-inner">
        <div className="why-media">
          <img src={`/generated/${card.img}.webp`} alt={card.alt} loading="lazy" width="1100" height="825" />
          <div className="why-demo" aria-hidden="true"><Demo /></div>
        </div>
        <div className="why-copy">
          <h3>{card.title}</h3>
          <p>{card.note}</p>
        </div>
      </div>
    </article>
  );
}

export function Why() {
  return (
    <section className="section why" id="why" aria-labelledby="why-title">
      <div className="container">
        <div className="section-head" data-reveal>
          <Badge>Why Hukam</Badge>
          <h2 id="why-title" className="h2">Your agents.<br /><span className="soft">Not tied to a desk.</span></h2>
        </div>
        <div className="why-grid">
          {CARDS.map((card, i) => <Card key={card.key} card={card} index={i} />)}
        </div>
      </div>
    </section>
  );
}
