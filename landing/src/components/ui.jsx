import { useId } from 'react';

export const GITHUB_URL = 'https://github.com/zaeeeeeem/hukam';

export function Badge({ children }) {
  return <span className="badge"><span><i aria-hidden="true" />{children}</span></span>;
}

// Label rolls up to a second copy on hover (Graphi's RollText, in CSS).
function Roll({ children }) {
  return <span className="btn-roll"><span>{children}</span><span aria-hidden="true">{children}</span></span>;
}

export function GlowButton({ href, children, icon, small, external }) {
  return (
    <a className={`btn btn-glow${small ? ' btn-sm' : ''}`} href={href} {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}>
      <span className="btn-halo" aria-hidden="true" />
      <span className="btn-spark" aria-hidden="true" />
      {icon}
      <Roll>{children}</Roll>
    </a>
  );
}

export function GhostButton({ href, children, icon }) {
  return <a className="btn btn-ghost" href={href}>{icon}<Roll>{children}</Roll></a>;
}

// The H mark from the handoff favicon, redrawn as a vector so it stays crisp at any size.
export function HukamMark({ size = 28, className = '' }) {
  const id = 'hm' + useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#15132b" />
          <stop offset="1" stopColor="#07070f" />
        </linearGradient>
        <linearGradient id={`${id}h`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8d86ff" />
          <stop offset="1" stopColor="#a66bff" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill={`url(#${id}bg)`} />
      <rect x="0.5" y="0.5" width="31" height="31" rx="7.5" fill="none" stroke="rgba(169,155,255,.28)" />
      <g stroke={`url(#${id}h)`} strokeWidth="4" strokeLinecap="round" fill="none">
        <path d="M12.9 8.2 10.4 23.8M22.1 8.2l-2.5 15.6M11.8 16.4l8.9-.5" />
      </g>
    </svg>
  );
}

export function GithubIcon({ size = 17 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2.17c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.04-.71.08-.7.08-.7 1.15.08 1.76 1.19 1.76 1.19 1.03 1.76 2.69 1.25 3.35.96.1-.75.4-1.25.73-1.54-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.69 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
    </svg>
  );
}
