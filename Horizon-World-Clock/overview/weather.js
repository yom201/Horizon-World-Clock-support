"use strict";

(() => {
  const demo = document.querySelector("#weather");
  const control = demo.querySelector(".weather-motion");
  const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
  const cell = 160;
  const columns = 12;
  const frames = 72;
  const frameInterval = 1000 / 12;
  const dials = [...demo.querySelectorAll("[data-weather-sprite]")].map((canvas) => ({
    canvas,
    poster: canvas.previousElementSibling,
    context: canvas.getContext("2d"),
    sprite: null
  })).filter((dial) => dial.context);
  if (!dials.length) return;

  let playing = !motionPreference.matches;
  let onScreen = false;
  let elapsed = 0;
  let start = 0;
  let frameRequest = 0;
  let lastFrame = -1;

  function paint(now) {
    if (!start) start = now - elapsed;
    const frame = Math.floor((now - start) / frameInterval) % frames;
    if (frame !== lastFrame) {
      const x = (frame % columns) * cell;
      const y = Math.floor(frame / columns) * cell;
      for (const {canvas, context, sprite, poster} of dials) {
        if (!sprite?.complete || !sprite.naturalWidth) continue;
        context.clearRect(0, 0, cell, cell);
        context.drawImage(sprite, x, y, cell, cell, 0, 0, cell, cell);
        canvas.hidden = false;
        poster.hidden = true;
      }
      lastFrame = frame;
    }
    frameRequest = requestAnimationFrame(paint);
  }

  function syncPlayback() {
    control.textContent = playing ? control.dataset.pause : control.dataset.play;
    if (!playing || !onScreen || document.hidden) {
      cancelAnimationFrame(frameRequest);
      if (start) elapsed = (performance.now() - start) % (frames * frameInterval);
      frameRequest = 0;
      start = 0;
      return;
    }
    if (frameRequest) return;
    for (const dial of dials) {
      if (dial.sprite) continue;
      const image = new Image();
      image.src = dial.canvas.dataset.weatherSprite;
      dial.sprite = image;
    }
    frameRequest = requestAnimationFrame(paint);
  }

  control.hidden = false;
  control.addEventListener("click", () => {
    playing = !playing;
    syncPlayback();
  });
  motionPreference.addEventListener("change", (event) => {
    playing = !event.matches;
    syncPlayback();
  });
  document.addEventListener("visibilitychange", syncPlayback);
  const observer = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    syncPlayback();
  });
  observer.observe(demo.querySelector(".weather-cards"));
  syncPlayback();
})();
