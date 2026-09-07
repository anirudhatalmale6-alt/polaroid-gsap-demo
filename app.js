/* Polaroid camera animation - GSAP timeline
   No plugins, no dependencies beyond gsap core.
   Everything animated is transform / opacity so it stays on the GPU on mobile. */

(function () {
  'use strict';

  var q = function (s) { return document.querySelector(s); };

  var camera   = q('#camera');
  var burst    = q('#flashBurst');
  var overlay  = q('#flashOverlay');
  var iris     = q('#shutterIris');
  var btnSvg   = q('#shutterBtn');
  var led      = q('#led');
  var ledGlow  = q('#ledGlow');
  var photoA   = q('#photoA');
  var photoB   = q('#photoB');
  var veilA    = photoA.querySelector('.dev-veil');
  var veilB    = photoB.querySelector('.dev-veil');
  var playBtn  = q('#playBtn');
  var sndBox   = q('#sndToggle');

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ------------------------------------------------------------------ *
   * Sound
   * Synthesised here so the demo has no audio asset to download.
   * Drop a real shutter file in with SHUTTER_SRC and it is used instead,
   * still driven off the same timeline label so sync never drifts.
   * ------------------------------------------------------------------ */
  var SHUTTER_SRC = window.SHUTTER_SRC || null;
  var shutterEl = null;
  if (SHUTTER_SRC) {
    shutterEl = new Audio(SHUTTER_SRC);
    shutterEl.preload = 'auto';
  }

  var ctx = null;
  function audio() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function noiseBuffer(c, secs) {
    var len = Math.floor(c.sampleRate * secs);
    var buf = c.createBuffer(1, len, c.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    return buf;
  }

  function playShutter() {
    if (!sndBox.checked) return;
    if (shutterEl) { shutterEl.currentTime = 0; shutterEl.play().catch(function(){}); return; }
    var c = audio(); if (!c) return;
    var t = c.currentTime;

    // mirror slap + blade close: two short filtered noise transients
    [0, 0.055].forEach(function (off, i) {
      var s = c.createBufferSource();
      s.buffer = noiseBuffer(c, 0.09);
      var bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = i ? 2600 : 1700;
      bp.Q.value = 1.1;
      var g = c.createGain();
      g.gain.setValueAtTime(i ? 0.42 : 0.6, t + off);
      g.gain.exponentialRampToValueAtTime(0.0008, t + off + 0.085);
      s.connect(bp); bp.connect(g); g.connect(c.destination);
      s.start(t + off); s.stop(t + off + 0.1);
    });

    // low body thunk
    var o = c.createOscillator();
    var og = c.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(180, t);
    o.frequency.exponentialRampToValueAtTime(70, t + 0.09);
    og.gain.setValueAtTime(0.28, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
    o.connect(og); og.connect(c.destination);
    o.start(t); o.stop(t + 0.13);
  }

  function playWhir(dur) {
    if (!sndBox.checked) return;
    var c = audio(); if (!c) return;
    var t = c.currentTime;

    var o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(84, t);
    o.frequency.linearRampToValueAtTime(96, t + dur);
    var lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    var g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.07);
    g.gain.setValueAtTime(0.09, t + dur - 0.1);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(c.destination);
    o.start(t); o.stop(t + dur + 0.02);

    // paper hiss riding on top of the motor
    var s = c.createBufferSource();
    s.buffer = noiseBuffer(c, dur);
    var hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 3200;
    var sg = c.createGain();
    sg.gain.value = 0.05;
    s.connect(hp); hp.connect(sg); sg.connect(c.destination);
    s.start(t); s.stop(t + dur);
  }

  /* ------------------------------------------------------------------ *
   * Positions (percentages of each element, so they hold at any size)
   * ------------------------------------------------------------------ */
  var OFF      = -122;   // fully swallowed by the camera
  var A_LIP    = 6;      // photo A just clear of the rollers
  var A_REST   = 101.9;   // photo A settled below the camera
  var B_REST   = -5;    // photo B parked with its top edge still in the slot

  function reset() {
    gsap.set(camera, { y: 0, x: 0, rotation: 0, scale: 1 });
    gsap.set([photoA, photoB], { yPercent: OFF, rotation: 0, x: 0 });
    gsap.set([veilA, veilB], { opacity: 1 });
    gsap.set([burst, overlay], { opacity: 0 });
    gsap.set(iris, { attr: { r: 0 } });
    gsap.set(btnSvg, { y: 0, scale: 1, transformOrigin: '130px 192px' });
    gsap.set([led, ledGlow], { opacity: 1 });
  }

  function build() {
    var tl = gsap.timeline({
      paused: true,
      defaults: { ease: 'power2.out' },
      onStart: function () { playBtn.disabled = true; },
      onComplete: function () { playBtn.disabled = false; playBtn.textContent = 'Replay'; }
    });

    /* --- 1. shutter press --------------------------------------------- */
    tl.to(btnSvg, { scale: 0.9, y: 3, duration: 0.07, ease: 'power3.in' }, 0)
      .to(btnSvg, { scale: 1, y: 0, duration: 0.22, ease: 'back.out(2.4)' }, 0.07);

    /* --- 2. flash + shutter, locked to the same instant ---------------- */
    tl.add('snap', 0.09)
      .call(playShutter, null, 'snap')
      .to(iris,    { attr: { r: 64 }, duration: 0.05, ease: 'power4.in' }, 'snap')
      .to(iris,    { attr: { r: 0 },  duration: 0.14, ease: 'power2.out' }, 'snap+=0.07')
      .fromTo(burst,   { opacity: 0, scale: 0.55, transformOrigin: '126px 99px' },
                       { opacity: 1, scale: 1.15, duration: 0.045, ease: 'none' }, 'snap')
      .to(burst,   { opacity: 0, scale: 1.4, duration: 0.30, ease: 'power2.out' }, 'snap+=0.05')
      .fromTo(overlay, { opacity: 0 }, { opacity: 0.92, duration: 0.04, ease: 'none' }, 'snap')
      .to(overlay, { opacity: 0, duration: 0.34, ease: 'power2.out' }, 'snap+=0.05')
      // a second, weaker bounce of light - real flashes never fall off clean
      .to(burst,   { opacity: 0.35, duration: 0.03 }, 'snap+=0.10')
      .to(burst,   { opacity: 0, duration: 0.22 }, 'snap+=0.13')
      .to([led, ledGlow], { opacity: 0.15, duration: 0.05 }, 'snap')
      .to([led, ledGlow], { opacity: 1, duration: 0.5 }, 'snap+=0.45');

    /* --- 3. recoil ----------------------------------------------------- */
    tl.to(camera, { y: -9, rotation: -0.9, scale: 1.012, duration: 0.09, ease: 'power3.out' }, 'snap')
      .to(camera, { y: 4, rotation: 0.5, scale: 0.997, duration: 0.11, ease: 'power1.inOut' }, 'snap+=0.09')
      .to(camera, { y: 0, rotation: 0, scale: 1, duration: 0.85, ease: 'elastic.out(1, 0.34)' }, 'snap+=0.20')
      .to(camera, { x: 3, duration: 0.06, ease: 'power1.inOut', yoyo: true, repeat: 3 }, 'snap+=0.05');

    /* --- 4. first print rolls out -------------------------------------- */
    tl.add('ejectA', 0.62)
      .call(playWhir, [0.95], 'ejectA')
      .to(photoA, { yPercent: A_LIP, rotation: 1.4, duration: 0.95, ease: 'power2.out' }, 'ejectA')
      // tiny stutter as the rollers let go
      .to(photoA, { rotation: 0.4, duration: 0.12, ease: 'power1.inOut' }, 'ejectA+=0.86');

    /* --- 5. it drops into its final resting place ---------------------- */
    tl.add('settleA', 'ejectA+=0.98')
      .to(photoA, { yPercent: A_REST, duration: 0.72, ease: 'power2.inOut' }, 'settleA')
      .to(photoA, { rotation: -3.4, duration: 0.9, ease: 'power2.out' }, 'settleA')
      .to(photoA, { x: '-2.5%', duration: 0.9, ease: 'power2.out' }, 'settleA')
      // paper flexes as it lands
      .to(photoA, { yPercent: A_REST - 1.1, duration: 0.16, ease: 'power2.out' }, 'settleA+=0.72')
      .to(photoA, { yPercent: A_REST, duration: 0.32, ease: 'power1.inOut' }, 'settleA+=0.88')
      .to(veilA,  { opacity: 0, duration: 1.5, ease: 'power1.inOut' }, 'settleA+=0.05');

    /* --- 6. second print half-ejects and stays in the camera ----------- */
    tl.add('ejectB', 'settleA+=0.55')
      .call(playWhir, [0.85], 'ejectB')
      .to(photoB, { yPercent: B_REST, rotation: 1.7, duration: 0.9, ease: 'power2.out' }, 'ejectB')
      .to(photoB, { rotation: 1.1, duration: 0.5, ease: 'power1.out' }, 'ejectB+=0.82')
      .to(veilB,  { opacity: 0, duration: 1.5, ease: 'power1.inOut' }, 'ejectB+=0.35');

    return tl;
  }

  reset();
  var tl = build();
  window.__tl = tl;                       // handy for frame grabs / QA

  function run() {
    reset();
    if (reduced) { tl.progress(1); return; }
    tl.restart();
  }

  playBtn.addEventListener('click', function () { audio(); run(); });
  q('#stage').addEventListener('click', function () { if (!playBtn.disabled) { audio(); run(); } });

  // first pass runs on load; sound joins in from the first tap (browser policy)
  window.addEventListener('load', function () { gsap.delayedCall(0.45, run); });
})();
