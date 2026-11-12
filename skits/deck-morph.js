/**
 * deck-morph.js — PowerPoint-Morph-style shared-element transitions for <deck-stage>.
 *
 * Tag any element on two different slides with the same data-morph="key".
 * When navigating between those slides, the element glides + scales from its
 * old position/size to its new one in a fixed overlay (FLIP technique):
 *   - identical content (same text / same image src) → a single clone morphs.
 *   - different content → the old element morphs out while the new morphs in,
 *     crossfading mid-flight (same behaviour as PowerPoint's morph fallback).
 *
 * While a morph is in flight the real elements are hidden and any entrance
 * animation on the target is suppressed (restored when its slide deactivates),
 * so morphs and entrance reveals never double-animate.
 *
 * Inert under prefers-reduced-motion, and during print (deck-stage freezes
 * all animation there). Rapid navigation finishes in-flight morphs instantly.
 */
(function () {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const stage = document.querySelector('deck-stage');
  if (!stage) return;

  const DUR = 850;
  const EASE = 'cubic-bezier(0.45, 0.05, 0.15, 1)';
  let inFlight = [];   // cleanup fns for running morphs
  let suppressed = []; // elements whose entrance animation we disabled

  const COPY_PROPS = [
    'fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing',
    'color', 'backgroundColor', 'borderRadius', 'textTransform', 'textAlign',
    'whiteSpace', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'borderTopWidth', 'borderTopStyle', 'borderTopColor',
    'borderRightWidth', 'borderRightStyle', 'borderRightColor',
    'borderBottomWidth', 'borderBottomStyle', 'borderBottomColor',
    'borderLeftWidth', 'borderLeftStyle', 'borderLeftColor',
    'display', 'alignItems', 'justifyContent', 'gap', 'boxSizing', 'objectFit',
  ];

  function makeClone(el) {
    const cs = getComputedStyle(el);
    let c;
    if (el.tagName === 'IMG') {
      c = document.createElement('img');
      c.src = el.currentSrc || el.src;
    } else {
      c = el.cloneNode(true);
      c.removeAttribute('id');
    }
    for (const p of COPY_PROPS) { try { c.style[p] = cs[p]; } catch (err) {} }
    // Fix (MSOM deck, Jul 2026): morph() hides the source elements *before*
    // fly() clones them, so cloneNode copies the inline visibility:hidden and
    // the flight renders invisible (morphs degrade to a blink-out/blink-in).
    // Clear it on the clone root; descendants inherit.
    c.style.visibility = 'visible';
    if (cs.display === 'inline') c.style.display = 'inline-block';
    c.style.animation = 'none';
    c.style.transition = 'none';
    c.style.position = 'fixed';
    c.style.left = '0';
    c.style.top = '0';
    c.style.margin = '0';
    c.style.width = el.offsetWidth + 'px';
    c.style.height = el.offsetHeight + 'px';
    c.style.maxWidth = 'none';
    c.style.transformOrigin = '0 0';
    c.style.willChange = 'transform, opacity';
    return c;
  }

  function sameContent(a, b) {
    if (a.tagName !== b.tagName) return false;
    if (a.tagName === 'IMG') return (a.currentSrc || a.src) === (b.currentSrc || b.src);
    return a.textContent.trim() === b.textContent.trim();
  }

  function morph(prevEl, nextEl) {
    const pr = prevEl.getBoundingClientRect();
    const nr = nextEl.getBoundingClientRect();
    if (!pr.width || !nr.width) return;

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2147483600;pointer-events:none;';

    // Suppress the target's entrance animation for this activation.
    nextEl.style.animation = 'none';
    suppressed.push(nextEl);

    const prevVis = prevEl.style.visibility;
    const nextVis = nextEl.style.visibility;
    prevEl.style.visibility = 'hidden';
    nextEl.style.visibility = 'hidden';

    const anims = [];
    const fly = (srcEl, oFrom, oTo) => {
      const w = srcEl.offsetWidth || 1, h = srcEl.offsetHeight || 1;
      const c = makeClone(srcEl);
      overlay.appendChild(c);
      const t0 = `translate(${pr.left}px, ${pr.top}px) scale(${pr.width / w}, ${pr.height / h})`;
      const t1 = `translate(${nr.left}px, ${nr.top}px) scale(${nr.width / w}, ${nr.height / h})`;
      anims.push(c.animate(
        [{ transform: t0, opacity: oFrom }, { transform: t1, opacity: oTo }],
        { duration: DUR, easing: EASE, fill: 'both' }
      ));
    };

    if (sameContent(prevEl, nextEl)) {
      fly(nextEl, 1, 1);
    } else {
      fly(prevEl, 1, 0);
      fly(nextEl, 0, 1);
    }
    document.body.appendChild(overlay);

    let done = false;
    const cleanup = () => {
      if (done) return;
      done = true;
      overlay.remove();
      prevEl.style.visibility = prevVis;
      nextEl.style.visibility = nextVis;
    };
    anims[0].onfinish = cleanup;
    inFlight.push(cleanup);
  }

  stage.addEventListener('slidechange', (e) => {
    // Finish any running morphs instantly (rapid navigation).
    inFlight.forEach((fn) => fn());
    inFlight = [];

    // Re-arm entrance animations on slides we've left.
    const activeSlide = e.detail.slide;
    suppressed = suppressed.filter((el) => {
      if (activeSlide.contains(el)) return true;
      el.style.animation = '';
      return false;
    });

    const prev = e.detail.previousSlide;
    if (!prev || prev === activeSlide) return;

    const prevByKey = new Map();
    prev.querySelectorAll('[data-morph]').forEach((el) => prevByKey.set(el.dataset.morph, el));
    activeSlide.querySelectorAll('[data-morph]').forEach((nextEl) => {
      const prevEl = prevByKey.get(nextEl.dataset.morph);
      if (prevEl) morph(prevEl, nextEl);
    });
  });
})();
