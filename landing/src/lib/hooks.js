import { useEffect, useRef, useState } from 'react';

const reduceQuery = '(prefers-reduced-motion: reduce)';

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== 'undefined' && window.matchMedia(reduceQuery).matches);
  useEffect(() => {
    const mq = window.matchMedia(reduceQuery);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  return reduced;
}

// True while the element is on screen. Used to pause loops that nobody can see.
export function useInView(options = { rootMargin: '0px', threshold: 0.2 }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), options);
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, inView];
}

// One observer for every [data-reveal] element: sets data-in once (an attribute React does not manage, so re-renders keep it), then forgets it.
export function useRevealOnScroll() {
  useEffect(() => {
    document.documentElement.classList.add('js');
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.setAttribute('data-in', '');
          io.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -12% 0px', threshold: 0.01 },
    );
    // Every section renders on mount, so one scan finds them all.
    document.querySelectorAll('[data-reveal]:not([data-in])').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}
