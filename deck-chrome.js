/* deck-chrome.js · optional add-on for the CDTI deck-stage decks (not an engine).
   Load after deck-stage.js and deck-morph.js. Everything degrades gracefully
   without it: slides still read, print and navigate.

   1. Day bar + progress: with <deck-stage data-part="1|2|3">, appends a
      wordless .daybar to every slide (not .no-bar) and sets --p (0–1), the
      share of this deck already shown, which fills the current segment.
   2. Page numbers: fills any EMPTY .pg with the slide's position among the
      non-skipped slides, and re-numbers when slides are skipped or moved.
      A .pg that already has text is left alone.
   3. Films: figure.film[data-yt] becomes a YouTube player on click (the
      poster <img> stays underneath for print); a .film holding a <video>
      toggles play/pause. P stops the film that is playing on the current
      slide (or starts its first film); Esc, or a click anywhere on the slide
      off the player, stops it too (the player's iframe swallows clicks on
      itself). Leaving the slide stops every film on it and restores the poster.
   4. Animations: iframe[data-anim] gets 'deck:play' when its slide is active
      and 'deck:pause' otherwise (the protocol in inbm/animation/
      scientific-method.html). Each time its slide is entered, the animation
      replays from the start (its #replayBtn, same origin; else a
      'deck:replay' message), so the build happens in front of the room and
      not at page load. Not under reduced motion. Clicking into any slide
      iframe hands keyboard focus back to the deck so the clicker keeps working.
   5. B toggles a blackout (Esc or a click clears it; while it is on, the
      clicker's next/back only lifts it).
   8. Returning to slide 1 (Home) resets every reveal gate in the deck.
   6. [data-enlarge] (an <img>, or a wrapper holding one) opens full screen
      on click; any key or click closes it without moving the deck.
   7. Morph polish (deck-morph.js flights, adjusted from outside; inert under
      reduced motion and print, like deck-morph itself):
      a. a pair whose class changes (the ladder's .now rung becoming a past
         rung) flies as ONE clone already wearing the arrival style; its
         colour, rules and padding now tween from the departure style, so
         the change travels with the glide instead of snapping at t=0.
      b. a text crossfade pair (different words) swaps rather than
         superimposes: the old words are gone by 40% of the flight, the new
         ones arrive from 45%. Image pairs keep the plain crossfade.
      c. between two .s-ladder slides (or two [data-morph-stagger] slides),
         the unpaired content swaps the same way: the leaving slide's
         fades out first, the arriving slide's fades in after it.          */
(() => {
  const stage = document.querySelector('deck-stage');
  if (!stage) return;
  const part = parseInt(stage.getAttribute('data-part'), 10) || 0;
  const slides = () => [...stage.children].filter((s) => s.tagName === 'SECTION');

  /* ── 2 · page numbers (the day bar of item 1 was removed on 23 Sept 2026
     at Andre's request; data-part and .no-bar are now inert) ── */
  const decorate = () => {
    const live = slides().filter((s) => !s.hasAttribute('data-deck-skip'));
    live.forEach((s, i) => {
      const pg = s.querySelector(':scope > .pg');
      if (pg && (!pg.textContent.trim() || pg.hasAttribute('data-auto'))) {
        pg.textContent = String(i + 1); pg.setAttribute('data-auto', '');
      }
    });
  };
  decorate();
  new MutationObserver(decorate).observe(stage, { childList: true });
  new MutationObserver(decorate).observe(stage, { subtree: true, attributes: true, attributeFilter: ['data-deck-skip'] });

  /* ── 3 · films ── */
  const films = (root) => [...(root || document).querySelectorAll('.film')];
  films().forEach((f) => {
    if (!f.hasAttribute('role')) f.setAttribute('role', 'button');      // taps don't advance the deck
    if (!f.hasAttribute('tabindex')) f.setAttribute('tabindex', '0');
    const v = f.querySelector('video');
    if (v) v.addEventListener('ended', () => { f.removeAttribute('data-playing'); try { v.load(); } catch (e) {} });
  });
  const stopFilm = (f) => {
    const v = f.querySelector('video');
    if (v && !v.paused) { v.pause(); try { v.load(); } catch (e) {} }  // load() brings the poster back
    f.querySelectorAll('iframe').forEach((fr) => fr.remove());
    f.removeAttribute('data-playing');
  };
  const toggleFilm = (f) => {
    const v = f.querySelector('video');
    if (v) {
      if (v.paused) { const p = v.play(); if (p && p.catch) p.catch(() => {}); f.setAttribute('data-playing', ''); }
      else { v.pause(); f.removeAttribute('data-playing'); }
      return;
    }
    const id = (f.getAttribute('data-yt') || '').trim();
    if (!id) return;
    if (f.querySelector('iframe')) { stopFilm(f); return; }
    const start = parseInt(f.getAttribute('data-start'), 10);
    if (location.protocol === 'file:') {
      // YouTube refuses embeds that arrive without a Referer ("error 153"), and a
      // page opened from disk sends none. Open the film in a tab instead; serve
      // the folder over http (present.command) for the in-slide player.
      window.open('https://www.youtube.com/watch?v=' + encodeURIComponent(id) + (start > 0 ? '&t=' + start + 's' : ''), '_blank', 'noopener');
      return;
    }
    const fr = document.createElement('iframe');
    fr.src = 'https://www.youtube-nocookie.com/embed/' + encodeURIComponent(id) +
      '?autoplay=1&rel=0&modestbranding=1&playsinline=1' + (start > 0 ? '&start=' + start : '');
    fr.title = f.getAttribute('aria-label') || 'Video';
    fr.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture';
    fr.allowFullscreen = true;
    fr.referrerPolicy = 'strict-origin-when-cross-origin';   // YouTube needs the Referer (error 153 without it)
    f.appendChild(fr); f.setAttribute('data-playing', '');
  };
  const playingFilm = () => {
    const cur = stage.querySelector(':scope > section[data-deck-active]');
    return cur && cur.querySelector('.film[data-playing]');
  };
  document.addEventListener('click', (e) => {
    const f = e.target.closest && e.target.closest('.film');
    if (f && stage.contains(f)) { e.preventDefault(); toggleFilm(f); return; }
    // The player's iframe swallows clicks on itself, so a click anywhere else
    // on the current slide is the pointer way to stop a playing film.
    const on = playingFilm();
    if (on && on.closest('section').contains(e.target)) stopFilm(on);
  });
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('film')) { toggleFilm(e.target); e.preventDefault(); }
  });

  /* ── 4 · animation iframes ── */
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const animOn = new WeakMap();   // iframe → was its slide active at the last sync
  const replay = (fr) => {
    if (reduce.matches) return;
    try {
      const b = fr.contentWindow.document.getElementById('replayBtn');
      if (b) { b.click(); return; }
    } catch (e) {}                  // cross-origin (file://): fall back to the message
    try { fr.contentWindow.postMessage('deck:replay', '*'); } catch (e) {}
  };
  const syncAnims = () => {
    stage.querySelectorAll(':scope > section iframe[data-anim]').forEach((fr) => {
      const on = fr.closest('section').hasAttribute('data-deck-active');
      if (on && animOn.get(fr) === false) replay(fr);   // entered: build it again, from the top
      animOn.set(fr, on);
      try { fr.contentWindow.postMessage(on ? 'deck:play' : 'deck:pause', '*'); } catch (e) {}
    });
  };
  stage.querySelectorAll('iframe[data-anim]').forEach((fr) => fr.addEventListener('load', () => setTimeout(syncAnims, 120)));
  window.addEventListener('load', () => setTimeout(syncAnims, 500));
  window.addEventListener('blur', () => {
    requestAnimationFrame(() => {
      const ae = document.activeElement;
      if (ae && ae.tagName === 'IFRAME' && stage.contains(ae)) { ae.blur(); window.focus(); }
    });
  });

  /* morph clones: deck-morph.js rebuilds an <img> clone without its classes,
     so class-based looks (a filter, object-fit) drop out mid-flight. Copy the
     class list from the matching image (same src), preferring the arriving
     slide. (Multiply cannot blend inside the flight overlay, so logos in a
     morph chain must be transparent PNG/SVG, never white-ground files.) */
  new MutationObserver((muts) => {
    muts.forEach((m) => m.addedNodes.forEach((ov) => {
      if (ov.nodeType !== 1 || !ov.style || ov.style.zIndex !== '2147483600') return;
      const cur = stage.querySelector(':scope > section[data-deck-active]');
      const twins = [...stage.querySelectorAll('img[data-morph]')];
      ov.querySelectorAll(':scope > img').forEach((c) => {
        const same = twins.filter((t) => (t.currentSrc || t.src) === c.src);
        const twin = same.find((t) => cur && cur.contains(t)) || same[0];
        if (twin && twin.className) c.className = twin.className;
      });
    }));
  }).observe(document.body, { childList: true });

  /* ── 7 · morph polish ── runs in slidechange, after deck-morph.js (loaded
     first) has built this flight's overlays, so the animations it adds or
     re-times start on the same frame as the flight. */
  const OVERLAY_Z = '2147483600';
  const STAGGER = '.s-ladder, [data-morph-stagger]';
  const TWEEN = ['color', 'backgroundColor',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
    'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'];
  let polished = [];
  const byKey = (slide, key) => [...slide.querySelectorAll('[data-morph]')].find((el) => el.getAttribute('data-morph') === key);
  const polishFlight = (prev, cur) => {
    polished.forEach((a) => { try { a.cancel(); } catch (err) {} });
    polished = [];
    if (!prev || !cur || prev === cur || reduce.matches) return;
    const overlays = [...document.body.children].filter((o) => o.style && o.style.zIndex === OVERLAY_Z);
    let timing = null;
    overlays.forEach((ov) => {
      const clones = [...ov.children];
      const fl = clones.map((c) => c.getAnimations()[0]);
      if (!fl.length || fl.some((a) => !a || !a.effect)) return;
      const t = fl[0].effect.getTiming();
      timing = timing || t;
      if (clones.some((c) => c.tagName === 'IMG')) return;          // images: plain glide / crossfade
      if (clones.length === 1) {                                     // a · class change on a single clone
        const key = clones[0].getAttribute('data-morph');
        const p = key && byKey(prev, key), n = key && byKey(cur, key);
        if (!p || !n || p.className === n.className) return;
        const ps = getComputedStyle(p), ns = getComputedStyle(n);
        const from = {}, to = {};
        TWEEN.forEach((k) => { if (ps[k] !== ns[k]) { from[k] = ps[k]; to[k] = ns[k]; } });
        if (!Object.keys(from).length) return;
        const a = clones[0].animate([from, to], { duration: t.duration, easing: t.easing, fill: 'both' });
        a.currentTime = fl[0].currentTime || 0;
        polished.push(a);
      } else if (clones.length === 2) {                              // b · text crossfade: swap, don't superimpose
        clones.forEach((c, i) => {
          const kf = fl[i].effect.getKeyframes();
          if (kf.length !== 2 || !kf[0].transform || !kf[1].transform) return;
          fl[i].effect.setKeyframes(i === 0
            ? [{ offset: 0, transform: kf[0].transform, opacity: 1 }, { offset: 0.4, opacity: 0 }, { offset: 1, transform: kf[1].transform, opacity: 0 }]
            : [{ offset: 0, transform: kf[0].transform, opacity: 0 }, { offset: 0.45, opacity: 0 }, { offset: 1, transform: kf[1].transform, opacity: 1 }]);
        });
      }
    });
    // c · the unpaired content of a ladder step: out first, then in. The
    // leaving slide's content holds at 0 until the slide itself has gone
    // (0.55s crossfade), then the animation ends and it is whole again.
    if (!timing || !prev.matches(STAGGER) || !cur.matches(STAGGER)) return;
    const d = Number(timing.duration) || 850;
    const content = (s) => [...s.children].filter((el) => !el.matches('.pg, .daybar'));
    content(prev).forEach((el) => polished.push(el.animate(
      [{ opacity: 1, easing: 'ease-out' }, { opacity: 0, offset: 0.3 }, { opacity: 0 }], { duration: d + 150 })));
    content(cur).forEach((el) => polished.push(el.animate(
      [{ opacity: 0 }, { opacity: 0, offset: 0.4, easing: 'ease-out' }, { opacity: 1, offset: 0.85 }, { opacity: 1 }], { duration: d })));
  };

  stage.addEventListener('slidechange', (e) => {
    if (e.detail && e.detail.previousSlide) films(e.detail.previousSlide).forEach(stopFilm);
    closeLightbox();
    syncAnims();
    polishFlight(e.detail && e.detail.previousSlide, e.detail && e.detail.slide);
  });
  window.addEventListener('beforeprint', () => films().forEach(stopFilm));

  /* ── 5 · blackout ── */
  let bo = document.getElementById('blackout');
  const blackout = () => {
    if (!bo) { bo = document.createElement('div'); bo.id = 'blackout'; document.body.appendChild(bo); bo.addEventListener('click', () => bo.removeAttribute('data-on')); }
    return bo;
  };

  /* ── 6 · lightbox ── */
  let lb = null;
  const closeLightbox = () => { if (lb) { lb.remove(); lb = null; } };
  const openLightbox = (src, alt) => {
    closeLightbox();
    lb = document.createElement('div'); lb.className = 'lightbox';
    const img = document.createElement('img'); img.src = src; img.alt = alt || '';
    lb.appendChild(img); document.body.appendChild(lb);
    requestAnimationFrame(() => lb && lb.setAttribute('data-on', ''));
    lb.addEventListener('click', closeLightbox);
  };
  stage.querySelectorAll('[data-enlarge]').forEach((el) => {
    if (!el.hasAttribute('role')) el.setAttribute('role', 'button');
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
  });
  document.addEventListener('click', (e) => {
    const el = e.target.closest && e.target.closest('[data-enlarge]');
    if (!el || !stage.contains(el)) return;
    const img = el.tagName === 'IMG' ? el : el.querySelector('img');
    const src = el.getAttribute('data-enlarge') || (img && (img.currentSrc || img.src));
    if (src) { e.preventDefault(); openLightbox(src, img && img.alt); }
  });

  /* ── 8 · back at the start, every build resets (SCLX, 31 Oct 2026) ──
     deck-stage keeps reveal state across revisits, so Home after a run-through left every
     gated slide fully built in front of the room. Arriving at slide 1 from anywhere else now
     clears all reveal state (reveal state is only the data-reveal-shown attributes). */
  stage.addEventListener('slidechange', (e) => {
    const d = e.detail || {};
    if (d.index === 0 && d.previousIndex > 0) {
      stage.querySelectorAll('[data-reveal-shown]').forEach((el) => el.removeAttribute('data-reveal-shown'));
    }
  });

  /* keys: capture phase, so an open lightbox swallows the key that closes it */
  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (lb) { closeLightbox(); e.preventDefault(); e.stopImmediatePropagation(); return; }
    /* SCLX (31 Oct 2026): while the screen is black, the clicker's next/back only lifts the
       black (as in PowerPoint) instead of moving the deck unseen behind it. */
    if (bo && bo.hasAttribute('data-on') && /^(ArrowRight|ArrowLeft|ArrowDown|ArrowUp|PageDown|PageUp| |Spacebar|Enter)$/.test(e.key)) {
      bo.removeAttribute('data-on'); e.preventDefault(); e.stopImmediatePropagation(); return;
    }
    if (e.key === 'b' || e.key === 'B') { blackout().toggleAttribute('data-on'); e.preventDefault(); }
    else if (e.key === 'Escape') {
      if (bo) bo.removeAttribute('data-on');
      const on = playingFilm();
      if (on) { stopFilm(on); e.preventDefault(); }
    }
    else if (e.key === 'p' || e.key === 'P') {
      // On a slide with several films (P1 #39, the three Brita ads) P must stop
      // the one that is playing, not start the first one on top of it.
      const cur = stage.querySelector(':scope > section[data-deck-active]');
      const f = cur && (cur.querySelector('.film[data-playing]') || cur.querySelector('.film'));
      if (f) { toggleFilm(f); e.preventDefault(); }
    }
  }, true);
})();
