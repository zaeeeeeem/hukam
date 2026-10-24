import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowDown, Mic, Paperclip, SendHorizontal } from 'lucide-react';
import { Badge, GITHUB_URL, GhostButton, GithubIcon, GlowButton } from './ui.jsx';
import { useInView, useReducedMotion } from '../lib/hooks.js';
import './hero.css';

const LINES = ["You don’t need", 'a laptop anymore.'];

// Real message shapes Hukam understands (see the repo README): English, Roman Urdu, Urdu, voice.
const MESSAGES = [
  { text: 'claude: add a dark mode toggle', lang: 'English', agent: 'Claude Code' },
  { text: 'codex se auth ke tests likhwao', lang: 'Roman Urdu', agent: 'Codex' },
  { voice: '0:06', text: 'Build a menu page for my chai stall', lang: 'Voice note', agent: 'Claude Code' },
  { text: 'اس لوگو کو نیلا کر دو', lang: 'اردو', agent: 'Codex' },
];

const WORD_FROM = { opacity: 0, filter: 'blur(4px)', y: 14 };
const WORD_TO = { opacity: 1, filter: 'blur(0px)', y: 0 };

function BlurWords() {
  let n = 0;
  return LINES.map((line) => (
    <span className="hero-line" key={line}>
      {line.split(' ').map((word, i, arr) => (
        <span key={i}>
          <motion.span
            className="hero-word"
            initial={WORD_FROM}
            animate={WORD_TO}
            transition={{ duration: 0.8, ease: [0, 0, 0.58, 1], delay: 0.15 + n++ * 0.07 }}
          >
            {word}
          </motion.span>
          {i < arr.length - 1 ? ' ' : null}
        </span>
      ))}
    </span>
  ));
}

// Cycles through MESSAGES: type, send, show the route Gemma picked, clear, next.
function useComposer(active, reduced) {
  const [state, setState] = useState({ i: 0, typed: 0, phase: 'typing' });
  useEffect(() => {
    if (reduced) { setState({ i: 0, typed: MESSAGES[0].text.length, phase: 'routed' }); return; }
    if (!active) return;
    let timer;
    const msg = MESSAGES[state.i];
    if (state.phase === 'typing') {
      if (msg.voice) timer = setTimeout(() => setState((s) => ({ ...s, phase: 'sent' })), 1900);
      else if (state.typed < msg.text.length) timer = setTimeout(() => setState((s) => ({ ...s, typed: s.typed + 1 })), 42 + Math.random() * 40);
      else timer = setTimeout(() => setState((s) => ({ ...s, phase: 'sent' })), 450);
    } else if (state.phase === 'sent') {
      timer = setTimeout(() => setState((s) => ({ ...s, phase: 'routed' })), 650);
    } else {
      timer = setTimeout(() => setState((s) => ({ i: (s.i + 1) % MESSAGES.length, typed: 0, phase: 'typing' })), 2600);
    }
    return () => clearTimeout(timer);
  }, [state, active, reduced]);
  return state;
}

function Composer() {
  const reduced = useReducedMotion();
  const [ref, inView] = useInView({ threshold: 0.3 });
  const { i, typed, phase } = useComposer(inView, reduced);
  const msg = MESSAGES[i];
  const recording = msg.voice && phase === 'typing';
  const hasText = !msg.voice && typed > 0 && phase === 'typing';

  return (
    <div className="composer-wrap" ref={ref}>
      <div className={`composer rim phase-${phase}`}>
        <div className="rim-inner composer-inner">
          <div className="composer-top">
            <span className="composer-to"><span className="wa-dot" aria-hidden="true" />WhatsApp · Hukam</span>
            <span className="composer-lang" key={msg.lang}>{msg.lang}</span>
          </div>
          <div className="composer-row">
            <span className="composer-icon" aria-hidden="true"><Paperclip size={18} /></span>
            <div className="composer-field" aria-hidden="true">
              {recording ? (
                <span className="composer-rec">
                  <i className="rec-dot" />
                  <span className="rec-time">{msg.voice}</span>
                  <span className="rec-wave">{Array.from({ length: 34 }, (_, k) => <i key={k} style={{ '--k': k }} />)}</span>
                </span>
              ) : (
                <span className={`composer-text${phase !== 'typing' ? ' is-sent' : ''}`} dir="auto">
                  {phase === 'typing' ? msg.text.slice(0, typed) : msg.voice ? `“${msg.text}”` : msg.text}
                  {phase === 'typing' && <i className="caret" />}
                  {phase === 'typing' && typed === 0 && <span className="composer-placeholder">Message</span>}
                </span>
              )}
            </div>
            <span className={`composer-send${hasText || phase !== 'typing' ? ' is-send' : ''}${recording ? ' is-rec' : ''}`} aria-hidden="true">
              <Mic size={19} className="i-mic" />
              <SendHorizontal size={18} className="i-send" />
            </span>
          </div>
        </div>
      </div>
      <div className={`route${phase === 'routed' ? ' is-on' : ''}`} aria-hidden="true">
        <span className="route-chip"><b>Gemma 4</b></span>
        <span className="route-line"><i /></span>
        <span className="route-chip"><b>Superset</b></span>
        <span className="route-line"><i /></span>
        <span className="route-chip is-agent" key={msg.agent + i}><i className="pulse" />{msg.agent}</span>
      </div>
      <p className="sr-only">Example: you message Hukam on WhatsApp in English, Urdu, Roman Urdu or by voice note. Gemma 4 routes it through Superset to Claude Code or Codex.</p>
    </div>
  );
}

export function Hero() {
  return (
    <section className="hero" id="top" aria-labelledby="hero-title">
      <div className="hero-art" aria-hidden="true">
        <img src="/generated/hero.webp" alt="" width="1672" height="941" fetchPriority="high" />
      </div>
      <div className="hero-glow hero-glow-a" aria-hidden="true" />
      <div className="hero-glow hero-glow-b" aria-hidden="true" />

      <div className="container hero-inner">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <Badge>WhatsApp · Gemma 4 · your agents</Badge>
        </motion.div>
        <h1 id="hero-title" className="hero-title display" aria-label="You don’t need a laptop anymore.">
          <BlurWords />
        </h1>
        <motion.p className="hero-sub" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.6 }}>
          Message WhatsApp. Your coding agents do the rest.
        </motion.p>
        <motion.div className="hero-ctas" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.75 }}>
          <GlowButton href={GITHUB_URL} external icon={<GithubIcon />}>Star on GitHub</GlowButton>
          <GhostButton href="#in-action" icon={<ArrowDown size={16} />}>See it work</GhostButton>
        </motion.div>
        <motion.div className="hero-composer" initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', stiffness: 80, damping: 30, delay: 0.9 }}>
          <Composer />
        </motion.div>
      </div>
    </section>
  );
}
