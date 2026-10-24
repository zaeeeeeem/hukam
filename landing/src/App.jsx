import { Nav } from './components/Nav.jsx';
import { Hero } from './components/Hero.jsx';
import { Why } from './components/Why.jsx';
import { InAction } from './components/action/InAction.jsx';
import { Steps } from './components/Steps.jsx';
import { Faq } from './components/Faq.jsx';
import { Footer } from './components/Footer.jsx';
import { useRevealOnScroll } from './lib/hooks.js';

export function App() {
  useRevealOnScroll();
  return (
    <>
      <a className="skip-link" href="#main">Skip to content</a>
      <Nav />
      <main id="main">
        <Hero />
        <Why />
        <InAction />
        <Steps />
        <Faq />
      </main>
      <Footer />
    </>
  );
}
