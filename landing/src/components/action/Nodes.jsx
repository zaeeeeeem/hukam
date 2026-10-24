import { AudioLines, Check, Gem, Layers, Sparkle, SquareTerminal } from 'lucide-react';
import { S } from './script.js';

// Desktop canvas geometry (px in a 1240 x 720 box). Wires are hand-placed between node ports.
export const CANVAS = { w: 1240, h: 720 };
export const WIRES = {
  toGemma: 'M 382 300 C 462 300, 472 196, 560 196',
  toSuperset: 'M 860 196 L 920 196',
  toAgent: 'M 1070 260 L 1070 382',
  back: 'M 920 500 C 760 500, 560 612, 382 612',
};
const WHISPER_AT = { x: 467, y: 248 };

function wireState(step, from, until) {
  if (step >= from && step <= until) return 'is-active';
  if (step > until) return 'is-done';
  return '';
}

function Wire({ d, state, dur }) {
  return (
    <g className={`wire ${state}`} style={{ '--dur': `${dur}ms` }}>
      <path d={d} className="wire-base" />
      <path d={d} className="wire-done" pathLength="1" />
      <path d={d} className="wire-flow" pathLength="1" />
    </g>
  );
}

function NodeHead({ icon, title, state, tag }) {
  return (
    <div className="node-head">
      <span className="node-icon">{icon}</span>
      <b>{title}</b>
      <span className={`node-state ${state}`}>
        {state === 'is-done' ? <Check size={12} strokeWidth={3} /> : <i />}
        {tag}
      </span>
    </div>
  );
}

function GemmaBody({ sc, step }) {
  if (step < S.THINK) return <div className="node-idle">Waiting for a message</div>;
  if (step < S.DECIDE) {
    return (
      <div className="node-think">
        <span style={{ width: '82%' }} /><span style={{ width: '64%' }} /><span style={{ width: '74%' }} />
      </div>
    );
  }
  const d = sc.decision;
  return (
    <dl className="node-kv">
      {[['action', d.action], ['agent', d.agent], ['name', d.name], ['risk', d.risk]].map(([k, v], i) => (
        <div key={k} style={{ '--i': i }}><dt>{k}</dt><dd className={k === 'risk' ? 'is-low' : ''}>{v}</dd></div>
      ))}
    </dl>
  );
}

function SupersetBody({ sc, step }) {
  if (step < S.SPAWN) return <div className="node-idle">Sandboxed worktree</div>;
  return (
    <div className="node-cmd">
      <span>$ superset agents create</span>
      <span>  --agent {sc.decision.agent} --name {sc.decision.name}</span>
    </div>
  );
}

function AgentNode({ sc, step, workMs }) {
  const shown = step >= S.TO_AGENT;
  const working = step >= S.WORK;
  const done = step >= S.DONE;
  const lines = [working, working, done]; // the middle line is delayed in CSS to land mid-run
  return (
    <div className={`node node-agent tone-${sc.agent.tone}${shown ? ' is-shown' : ''}${done ? ' is-finished' : ''}`} style={{ '--work': `${workMs}ms` }}>
      <NodeHead
        icon={sc.agent.tone === 'claude' ? <Sparkle size={15} /> : <SquareTerminal size={15} />}
        title={sc.agent.name}
        state={done ? 'is-done' : working ? 'is-active' : ''}
        tag={done ? 'done' : sc.decision.name}
      />
      <div className={`agent-bar${working ? ' is-working' : ''}${done ? ' is-done' : ''}`}><i /></div>
      <ul className="agent-log">
        {sc.log.map((line, i) => (
          <li key={line} className={lines[i] ? 'is-on' : ''} style={{ '--i': i }}>
            <span>{i === 2 && done ? '✓' : '›'}</span>{line}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Canvas({ sc, step }) {
  const gemmaState = step >= S.DECIDE ? 'is-done' : step >= S.THINK ? 'is-active' : '';
  const supState = step >= S.TO_AGENT ? 'is-done' : step >= S.SPAWN ? 'is-active' : '';
  const d = sc.durations;
  const whisperOn = !!sc.voice && step >= S.TO_GEMMA;

  return (
    <div className="canvas" aria-hidden="true">
      <svg className="wires" viewBox={`0 0 ${CANVAS.w} ${CANVAS.h}`} width={CANVAS.w} height={CANVAS.h}>
        <defs>
          <linearGradient id="wire-grad" x1="0" x2="1">
            <stop offset="0" stopColor="#a99bff" />
            <stop offset="1" stopColor="#ffb36b" />
          </linearGradient>
        </defs>
        <Wire d={WIRES.toGemma} state={wireState(step, S.TO_GEMMA, S.ECHO)} dur={d[S.TO_GEMMA] + d[S.ECHO]} />
        <Wire d={WIRES.toSuperset} state={wireState(step, S.TO_SUPERSET, S.TO_SUPERSET)} dur={d[S.TO_SUPERSET]} />
        <Wire d={WIRES.toAgent} state={wireState(step, S.TO_AGENT, S.TO_AGENT)} dur={d[S.TO_AGENT]} />
        <Wire d={WIRES.back} state={wireState(step, S.RETURN, S.REPLY)} dur={d[S.RETURN]} />
      </svg>

      <div className={`whisper${whisperOn ? ' is-on' : ''}${sc.voice ? '' : ' is-skip'}`} style={{ left: WHISPER_AT.x, top: WHISPER_AT.y }}>
        <AudioLines size={13} /> Whisper · local
      </div>

      <div className={`node node-gemma ${gemmaState}`}>
        <NodeHead icon={<Gem size={15} />} title="Gemma 4" state={gemmaState} tag={step >= S.DECIDE ? 'decided' : step >= S.THINK ? 'reading' : 'open model'} />
        <GemmaBody sc={sc} step={step} />
      </div>

      <div className={`node node-superset ${supState}`}>
        <NodeHead icon={<Layers size={15} />} title="Superset" state={supState} tag={step >= S.TO_AGENT ? 'spawned' : step >= S.SPAWN ? 'starting' : 'agents'} />
        <SupersetBody sc={sc} step={step} />
      </div>

      <div className={`agent-ghost${step >= S.TO_AGENT ? ' is-hidden' : ''}`}>agent</div>
      <AgentNode sc={sc} step={step} workMs={d[S.WORK]} />

      <div className={`flyer is-${sc.image}${step === S.RETURN ? ' is-flying' : ''}`} style={{ offsetPath: `path("${WIRES.back}")`, '--dur': `${d[S.RETURN]}ms` }}>
        {sc.image === 'page' ? <img src="/generated/chai-photo.webp" alt="" /> : <img src="/generated/chai-logo.webp" alt="" />}
      </div>
    </div>
  );
}

// Compact pipeline under the phone on narrow screens.
export function Strip({ sc, step }) {
  const items = [
    ['Gemma 4', <Gem size={14} key="g" />, step >= S.DECIDE ? 'is-done' : step >= S.TO_GEMMA ? 'is-active' : ''],
    ['Superset', <Layers size={14} key="s" />, step >= S.TO_AGENT ? 'is-done' : step >= S.TO_SUPERSET ? 'is-active' : ''],
    [sc.agent.name, sc.agent.tone === 'claude' ? <Sparkle size={14} key="a" /> : <SquareTerminal size={14} key="a" />, step >= S.DONE ? 'is-done' : step >= S.TO_AGENT ? 'is-active' : ''],
  ];
  return (
    <div className="strip" aria-hidden="true">
      {items.map(([label, icon, state], i) => (
        <div className="strip-item" key={i}>
          {i > 0 && <span className={`strip-wire ${state}`}><i /></span>}
          <span className={`strip-node ${state}`}>{icon}{label}</span>
        </div>
      ))}
      <div className={`strip-bar${step >= S.WORK ? ' is-working' : ''}${step >= S.DONE ? ' is-done' : ''}`} style={{ '--work': `${sc.durations[S.WORK]}ms` }}><i /></div>
    </div>
  );
}
