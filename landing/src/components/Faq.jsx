import { useState } from 'react';
import { Plus } from 'lucide-react';
import { Badge } from './ui.jsx';
import './faq.css';

const FAQS = [
  ['What is Hukam?', 'A WhatsApp front door for your coding agents: you message, Gemma 4 routes, agents do the work.'],
  ['Do I still need a laptop?', 'Hukam runs on a machine you leave on, like a laptop, desktop or server. You don’t need to sit at it.'],
  ['Which agents does it run?', 'Claude Code, Codex and OpenCode, started and followed through Superset.'],
  ['Which languages can I use?', 'English, Urdu or Roman Urdu, typed or spoken. Voice notes are transcribed on your machine.'],
  ['Is it safe?', 'Only allowlisted numbers get through, agents stay in a sandboxed worktree, and risky tasks wait for your “yes”.'],
  ['Can my team use it?', 'Yes. Add Hukam to a WhatsApp group; anyone can ask, only the owner approves risky work.'],
  ['What does it cost?', 'Hukam is free and open source under Apache-2.0.'],
];

export function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section className="section faq" id="faq" aria-labelledby="faq-title">
      <div className="container faq-grid">
        <div className="faq-head" data-reveal>
          <Badge>FAQ</Badge>
          <h2 id="faq-title" className="h2">Good questions.<br /><span className="soft">Short answers.</span></h2>
        </div>
        <ul className="faq-list" data-reveal style={{ '--d': '0.1s' }}>
          {FAQS.map(([q, a], i) => {
            const isOpen = open === i;
            return (
              <li key={q} className={`faq-item${isOpen ? ' is-open' : ''}`}>
                <h3>
                  <button id={`faq-q${i}`} aria-expanded={isOpen} aria-controls={`faq-a${i}`} onClick={() => setOpen(isOpen ? -1 : i)}>
                    <span>{q}</span>
                    <Plus size={18} className="faq-icon" aria-hidden="true" />
                  </button>
                </h3>
                <div id={`faq-a${i}`} role="region" aria-labelledby={`faq-q${i}`} className="faq-a" inert={!isOpen}>
                  <div><p>{a}</p></div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
