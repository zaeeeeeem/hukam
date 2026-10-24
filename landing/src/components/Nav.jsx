import { useEffect, useState } from 'react';
import { GITHUB_URL, GithubIcon, GlowButton, HukamMark } from './ui.jsx';
import './nav.css';

const LINKS = [
  ['Why Hukam', '#why'],
  ['In action', '#in-action'],
  ['How it works', '#how'],
  ['FAQ', '#faq'],
];

export function Logo() {
  return (
    <a className="logo" href="#top" aria-label="Hukam, back to top">
      <HukamMark size={28} />
      <span>Hukam</span>
    </a>
  );
}

export function Nav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className={`nav${scrolled ? ' is-scrolled' : ''}${open ? ' is-open' : ''}`}>
      <nav className="nav-bar container" aria-label="Main">
        <Logo />
        <ul className="nav-links">
          {LINKS.map(([label, href]) => <li key={href}><a href={href}>{label}</a></li>)}
        </ul>
        <div className="nav-cta">
          <GlowButton href={GITHUB_URL} external small icon={<GithubIcon size={15} />}>Star on GitHub</GlowButton>
        </div>
        <button className="nav-toggle" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} aria-controls="nav-sheet" onClick={() => setOpen(!open)}>
          <span /><span />
        </button>
      </nav>
      <div id="nav-sheet" className="nav-sheet" hidden={!open}>
        <ul>
          {LINKS.map(([label, href]) => <li key={href}><a href={href} onClick={() => setOpen(false)}>{label}</a></li>)}
        </ul>
        <GlowButton href={GITHUB_URL} external icon={<GithubIcon size={16} />}>Star on GitHub</GlowButton>
      </div>
    </header>
  );
}
