import { AnimatePresence, motion } from 'motion/react';
import { Camera, ChevronLeft, Mic, Phone as PhoneIcon, Play, Plus, Video } from 'lucide-react';
import { S } from './script.js';
import { HukamMark } from '../ui.jsx';

// WhatsApp's own tick glyphs (single / double), drawn to match the 16x11 originals.
function Ticks({ state }) {
  if (state === 'sent') {
    return (
      <svg className="wa-ticks" viewBox="0 0 16 11" width="16" height="11" aria-hidden="true">
        <path d="M11.07.65 4.98 8.15 2.4 5.42l-.84.8 3.47 3.67 6.94-8.5z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg className={`wa-ticks${state === 'read' ? ' is-read' : ''}`} viewBox="0 0 16 11" width="16" height="11" aria-hidden="true">
      <path d="M11.07.65 4.98 8.15 2.4 5.42l-.84.8 3.47 3.67 6.94-8.5z" fill="currentColor" />
      <path d="M15.07.65 8.98 8.15l-1.2-1.27-.8.97 2.05 2.04 6.94-8.5z" fill="currentColor" />
    </svg>
  );
}

const WAVE = [5, 9, 14, 8, 17, 11, 6, 13, 19, 10, 7, 15, 12, 18, 9, 5, 11, 16, 8, 13, 6, 10, 15, 7, 12, 9, 5, 8, 11, 6];

function VoiceBody({ length, playing }) {
  return (
    <div className="wa-voice">
      <span className="wa-voice-avatar">
        <span>Z</span>
        <i><Mic size={9} strokeWidth={3} /></i>
      </span>
      <span className="wa-voice-play"><Play size={18} fill="currentColor" strokeWidth={0} /></span>
      <span className={`wa-voice-track${playing ? ' is-playing' : ''}`}>
        <span className="wa-voice-wave">{WAVE.map((h, i) => <i key={i} style={{ height: h }} />)}</span>
        <span className="wa-voice-dot" />
      </span>
      <span className="wa-voice-len">{length}</span>
    </div>
  );
}

function MiniPage() {
  return (
    <div className="mini-page" role="img" aria-label="Screenshot of the generated chai stall menu page">
      <div className="mp-nav"><b>Chai Wala</b><span>Menu</span><span>Visit</span></div>
      <div className="mp-hero">
        <img src="/generated/chai-photo.webp" alt="" />
        <div className="mp-hero-copy">
          <small>Lahore · since 1998</small>
          <strong>Doodh patti,<br />done right.</strong>
          <span className="mp-btn">Order now</span>
        </div>
      </div>
      <ul className="mp-menu">
        <li><span>Doodh patti</span><b>Rs 80</b></li>
        <li><span>Kashmiri chai</span><b>Rs 150</b></li>
        <li><span>Aloo paratha</span><b>Rs 120</b></li>
      </ul>
    </div>
  );
}

const pop = {
  initial: { opacity: 0, y: 10, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, transition: { duration: 0.2 } },
  transition: { type: 'spring', stiffness: 420, damping: 32 },
};

function Bubble({ dir, tail, time, ticks, children, className = '', reaction, flush }) {
  return (
    <motion.div layout="position" className={`wa-row ${dir}${tail ? ' has-tail' : ''}${reaction ? ' has-reaction' : ''}`} {...pop}>
      <div className={`wa-bubble ${className}${flush ? ' is-flush' : ''}`}>
        {children}
        <span className="wa-meta">
          {time}
          {ticks && <Ticks state={ticks} />}
        </span>
        <AnimatePresence>
          {reaction && (
            <motion.span className="wa-reaction" initial={{ scale: 0.2, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 520, damping: 18 }}>
              {reaction}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export function Phone({ scenario: sc, step }) {
  const ticks = step >= S.READ ? 'read' : step >= S.DELIVERED ? 'delivered' : 'sent';
  const msgs = [];

  msgs.push(
    <Bubble key="hello" dir="in" tail time="4:11 PM">
      Send me a task by text, voice note or photo.
    </Bubble>,
  );
  if (step >= S.OUT) {
    msgs.push(
      sc.voice ? (
        <Bubble key="out" dir="out" tail time="4:12 PM" ticks={ticks} className="is-voice" reaction={step >= S.REACT ? sc.react : null}>
          <VoiceBody length={sc.voice.length} playing={step >= S.TO_GEMMA} />
        </Bubble>
      ) : (
        <Bubble key="out" dir="out" tail time="4:12 PM" ticks={ticks} reaction={step >= S.REACT ? sc.react : null}>
          {sc.out}
        </Bubble>
      ),
    );
  }
  if (sc.echo && step >= S.ECHO) {
    msgs.push(<Bubble key="echo" dir="in" tail time="4:12 PM">🎙️ <em>{sc.echo}</em></Bubble>);
  }
  if (step >= S.SPAWN) {
    msgs.push(
      <Bubble key="started" dir="in" tail={!sc.echo} time="4:12 PM">
        🚀 Started <b>{sc.decision.name}</b> on {sc.decision.agent}.<br />I’ll message you when it’s done.
      </Bubble>,
    );
  }
  if (step >= S.REPLY) {
    msgs.push(
      <Bubble key="done" dir="in" time="4:14 PM">
        ✅ <b>{sc.decision.name}</b> finished:<br />{sc.finished}
      </Bubble>,
    );
  }
  if (step >= S.IMAGE) {
    msgs.push(
      <Bubble key="img" dir="in" time="4:14 PM" className="is-image" flush>
        <div className={`wa-image is-${sc.image}`}>
          {sc.image === 'page' ? <MiniPage /> : <img src="/generated/chai-logo.webp" alt="Generated chai glass logo in brown and orange" />}
        </div>
        <span className="wa-caption">{sc.imageCaption}</span>
      </Bubble>,
    );
  }

  const typing = step >= S.THINK && step < S.SPAWN;

  return (
    <div className="phone" aria-hidden="true">
      <div className="phone-btn b1" /><div className="phone-btn b2" /><div className="phone-btn b3" />
      <div className="phone-screen">
        <div className="wa-status">
          <span>4:12</span>
          <span className="wa-island" />
          <span className="wa-status-icons">
            <svg width="17" height="11" viewBox="0 0 17 11"><g fill="#fff"><rect x="0" y="7" width="3" height="4" rx="1" /><rect x="4.5" y="5" width="3" height="6" rx="1" /><rect x="9" y="2.5" width="3" height="8.5" rx="1" /><rect x="13.5" y="0" width="3" height="11" rx="1" /></g></svg>
            <svg width="15" height="11" viewBox="0 0 15 11"><path fill="#fff" d="M7.5 2.3c2 0 3.8.8 5.2 2.1l1.1-1.1A8.9 8.9 0 0 0 7.5.7 8.9 8.9 0 0 0 1.2 3.3l1.1 1.1a7.4 7.4 0 0 1 5.2-2.1Zm0 3.2c1.1 0 2.2.4 3 1.2l1.1-1.1a5.9 5.9 0 0 0-8.2 0l1.1 1.1c.8-.8 1.9-1.2 3-1.2Zm0 3.1-1.6 1.6 1.6 1.6 1.6-1.6-1.6-1.6Z" /></svg>
            <span className="wa-battery"><i /></span>
          </span>
        </div>
        <div className="wa-header">
          <ChevronLeft size={24} className="wa-back" />
          <span className="wa-avatar"><HukamMark size={36} /></span>
          <span className="wa-title">
            <b>Hukam</b>
            <small className={typing ? 'is-typing' : ''}>{typing ? 'typing…' : 'online'}</small>
          </span>
          <span className="wa-actions"><Video size={21} /><PhoneIcon size={19} /></span>
        </div>
        <div className="wa-chat">
          <div className="wa-wall" />
          <div className="wa-msgs">
            <div className="wa-date"><span>Today</span></div>
            <AnimatePresence initial={false} mode="popLayout">{msgs}</AnimatePresence>
          </div>
        </div>
        <div className="wa-composer">
          <Plus size={24} />
          <span className="wa-input">Message</span>
          <Camera size={21} />
          <Mic size={21} />
        </div>
        <div className="phone-home" />
      </div>
    </div>
  );
}
