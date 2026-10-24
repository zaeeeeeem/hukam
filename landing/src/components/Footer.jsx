import { DotWordmark } from './DotWordmark.jsx';
import { GITHUB_URL, GithubIcon } from './ui.jsx';
import { Logo } from './Nav.jsx';
import './footer.css';

// The page scrolls up off this footer (it is sticky behind <main>), and the dot wordmark
// assembles as it is revealed. No link columns: the wordmark is the closing statement.
export function Footer() {
  return (
    <footer className="footer" aria-labelledby="footer-title">
      <div className="footer-glow" aria-hidden="true" />
      <div className="container footer-inner">
        <div className="footer-top">
          <Logo />
          <p className="footer-credits">
            <span>Open source · Apache-2.0</span>
            <span className="footer-sep" aria-hidden="true" />
            <span>Built at Hacktoberfest Hack Day Lahore</span>
            <span className="footer-sep" aria-hidden="true" />
            <a href={GITHUB_URL} target="_blank" rel="noreferrer"><GithubIcon size={15} /> zaeeeeeem/hukam</a>
          </p>
        </div>
        <h2 id="footer-title" className="sr-only">Your AI. Anywhere.</h2>
        <DotWordmark className="footer-mark" />
      </div>
    </footer>
  );
}
