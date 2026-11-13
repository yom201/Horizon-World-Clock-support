"use strict";

const ja = document.documentElement.lang === "ja";
const locale = ja ? "ja-JP" : "en-US";
const minute = 60_000;
const hour = 60 * minute;
const day = 24 * hour;
const rad = Math.PI / 180;
const zenith = -0.8333;
const cityData = {
  la: [34.05222222222222, -118.24277777777777, "America/Los_Angeles"],
  ny: [40.71416666666667, -74.00638888888889, "America/New_York"],
  london: [51.50833333333333, -0.12527777777777777, "Europe/London"],
  tokyo: [35.654444444444444, 139.7447222222222, "Asia/Tokyo"],
};

const cities = Object.fromEntries(Object.entries(cityData).map(([id, [lat, lon, timeZone]]) => [id, {
  lat, lon, timeZone,
  clock: new Intl.DateTimeFormat(locale, { timeZone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
  date: new Intl.DateTimeFormat(locale, { timeZone, month: ja ? "numeric" : "short", day: "numeric" }),
}]));

const utcClock = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
});
const utcStart = (time) => Math.floor(time / day) * day;
const isoDay = (time) => new Date(time).toISOString().slice(0, 10);
const clamp = (number, min, max) => Math.min(max, Math.max(min, number));

function solarAltitude(time, city) {
  // Same Meeus/NOAA solar coordinates and altitude threshold as the app's SolarCalculator.
  const century = (time / day + 2440587.5 - 2451545) / 36525;
  const meanLongitude = (280.46646 + century * (36000.76983 + century * 0.0003032)) * rad;
  const meanAnomaly = (357.52911 + century * (35999.05029 - 0.0001537 * century)) * rad;
  const eccentricity = 0.016708634 - century * (0.000042037 + 0.0000001267 * century);
  const center = Math.sin(meanAnomaly) * (1.914602 - century * (0.004817 + 0.000014 * century))
    + Math.sin(2 * meanAnomaly) * (0.019993 - 0.000101 * century)
    + Math.sin(3 * meanAnomaly) * 0.000289;
  const omega = (125.04 - 1934.136 * century) * rad;
  const apparent = meanLongitude + (center - 0.00569 - 0.00478 * Math.sin(omega)) * rad;
  const meanObliquity = 23 + (26 + (21.448 - century * (46.815 + century * (0.00059 - century * 0.001813))) / 60) / 60;
  const obliquity = (meanObliquity + 0.00256 * Math.cos(omega)) * rad;
  const declination = Math.asin(Math.sin(obliquity) * Math.sin(apparent));
  const y = Math.tan(obliquity / 2) ** 2;
  const equation = 4 / rad * (
    y * Math.sin(2 * meanLongitude) - 2 * eccentricity * Math.sin(meanAnomaly)
    + 4 * eccentricity * y * Math.sin(meanAnomaly) * Math.cos(2 * meanLongitude)
    - 0.5 * y ** 2 * Math.sin(4 * meanLongitude) - 1.25 * eccentricity ** 2 * Math.sin(2 * meanAnomaly)
  );
  const solarMinutes = ((time - utcStart(time)) / minute + equation + 4 * city.lon + 2880) % 1440;
  const hourAngle = (solarMinutes / 4 - 180) * rad;
  const latitude = city.lat * rad;
  return Math.asin(Math.sin(latitude) * Math.sin(declination)
    + Math.cos(latitude) * Math.cos(declination) * Math.cos(hourAngle)) / rad;
}

function solarEvents(city, start) {
  const events = [];
  // These four mid-latitude cities have a sunrise and sunset every civil day.
  // Scan adjacent UTC days as well so a local day or night can straddle UTC midnight.
  let left = start - 2 * day;
  let wasAbove = solarAltitude(left, city) >= zenith;
  for (let right = left + hour; right <= start + 3 * day; right += hour) {
    const above = solarAltitude(right, city) >= zenith;
    if (above !== wasAbove) {
      let low = left;
      let high = right;
      while (high - low > 1000) {
        const midpoint = (low + high) / 2;
        if ((solarAltitude(midpoint, city) >= zenith) === wasAbove) low = midpoint;
        else high = midpoint;
      }
      events.push({ time: Math.round((low + high) / 2000) * 1000, sunrise: above });
    }
    left = right;
    wasAbove = above;
  }
  return events;
}

function drawDial(canvas, civilMinutes, daylight, progress) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const size = canvas.width;
  const center = size / 2;
  const radius = center - 3;
  const point = (angle, distance) => [center + Math.cos(angle) * distance, center + Math.sin(angle) * distance];

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, 2 * Math.PI);
  ctx.clip();

  ctx.fillStyle = "#071321";
  ctx.fillRect(0, 0, size, size);
  const sky = ctx.createLinearGradient(0, 0, 0, center);
  sky.addColorStop(0, daylight ? "#1a467d" : "#0a1628");
  sky.addColorStop(.65, daylight ? "#427fbb" : "#162c47");
  sky.addColorStop(1, daylight ? "#e0ba84" : "#456889");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, size, center);

  ctx.strokeStyle = daylight ? "#f9dfa6a6" : "#a0bad48c";
  ctx.lineWidth = size * .009;
  ctx.beginPath();
  ctx.moveTo(0, center);
  ctx.lineTo(size, center);
  ctx.stroke();

  for (let tick = 0; tick < 60; tick++) {
    const angle = tick * Math.PI / 30;
    const major = tick % 5 === 0;
    const outer = point(angle, radius * .97);
    const inner = point(angle, radius * (major ? .87 : .925));
    ctx.strokeStyle = major ? "#edf4fbaf" : "#a3b4c879";
    ctx.lineWidth = major ? size * .011 : size * .005;
    ctx.beginPath();
    ctx.moveTo(...outer);
    ctx.lineTo(...inner);
    ctx.stroke();
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, size, center);
  ctx.clip();
  const solarAngle = Math.PI * (1 + progress);
  const [x, y] = point(solarAngle, radius * .71);
  ctx.fillStyle = "#ffd074";
  ctx.beginPath();
  ctx.arc(x, y, size * .079, 0, 2 * Math.PI);
  ctx.fill();
  if (!daylight) {
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = "#091727";
    ctx.beginPath();
    ctx.arc(x + size * .046, y - size * .038, size * .078, 0, 2 * Math.PI);
    ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  ctx.restore();
  ctx.lineCap = "round";
  for (const [angle, length, width] of [
    [civilMinutes * Math.PI / 360 - Math.PI / 2, .5, .034],
    [civilMinutes * Math.PI / 30 - Math.PI / 2, .71, .022],
  ]) {
    ctx.strokeStyle = "#f8f9ff";
    ctx.lineWidth = size * width;
    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.lineTo(...point(angle, radius * length));
    ctx.stroke();
  }
  ctx.fillStyle = "#fff4de";
  ctx.beginPath();
  ctx.arc(center, center, size * .028, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.strokeStyle = "#95b0d86b";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(center, center, radius, 0, 2 * Math.PI);
  ctx.stroke();
}

function viewOf(row) {
  const city = cities[row.dataset.city];
  const canvas = row.querySelector("canvas");
  const clock = row.querySelector("time");
  const phase = row.querySelector(".clock-phase");
  const rise = row.querySelector(".sunrise");
  const set = row.querySelector(".sunset");
  const track = row.querySelector(".demo-track");
  let start = NaN;
  let events = [];

  function render(time) {
    if (utcStart(time) !== start) {
      start = utcStart(time);
      events = solarEvents(city, start);
      if (track) {
        const daylightBands = [];
        events.forEach((event, index) => {
          const next = events[index + 1];
          if (!event.sunrise || !next || event.time >= start + day || next.time <= start) return;
          const left = Math.max(event.time, start);
          const right = Math.min(next.time, start + day);
          const band = document.createElement("span");
          band.className = "sun-band";
          band.style.left = `${100 * (left - start) / day}%`;
          band.style.width = `${100 * (right - left) / day}%`;
          daylightBands.push(band);
        });
        track.replaceChildren(...daylightBands);
      }
    }

    const nextIndex = events.findIndex((event) => event.time > time);
    const previous = events[nextIndex - 1];
    const next = events[nextIndex];
    const localTime = city.clock.format(time);
    const [h, m] = localTime.split(":").map(Number);
    const localDate = city.date.format(time);
    const daylight = previous.sunrise;
    const progress = clamp((time - previous.time) / (next.time - previous.time), 0, 1);
    clock.dateTime = localTime;
    clock.textContent = track ? `${localTime} · ${localDate}` : localTime;
    drawDial(canvas, h * 60 + m, daylight, progress);

    if (phase) {
      phase.textContent = daylight ? (ja ? "昼" : "Day") : (ja ? "夜" : "Night");
      row.classList.toggle("is-day", daylight);
    }

    if (track) {
      const localEvents = events.filter((event) => city.date.format(event.time) === localDate);
      rise.textContent = city.clock.format(localEvents.find((event) => event.sunrise).time);
      set.textContent = city.clock.format(localEvents.find((event) => !event.sunrise).time);
      track.style.setProperty("--marker", `${100 * (time - start) / day}%`);
    }
  }

  return render;
}

const liveViews = [...document.querySelectorAll("#live-clocks [data-city]")].map(viewOf);
const liveUtc = document.querySelector("#live-utc");
function renderLive() {
  const now = Date.now();
  liveUtc.dateTime = new Date(now).toISOString();
  liveUtc.textContent = `${utcClock.format(now)} UTC`;
  liveViews.forEach((render) => render(now));
}
renderLive();
window.setInterval(() => {
  if (!document.hidden) renderLive();
}, 1000 * 15);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) renderLive();
});

const demoViews = [...document.querySelectorAll(".demo-row")].map(viewOf);
const output = document.querySelector("#utc-time");
const date = document.querySelector("#demo-date");
const slider = document.querySelector("#scrub");
const play = document.querySelector("#play");
const motion = matchMedia("(prefers-reduced-motion: reduce)");
let animation = null;
const demoStart = Date.now();
date.value = isoDay(demoStart);
slider.value = Math.floor((demoStart - utcStart(demoStart)) / minute);
date.disabled = false;
slider.disabled = false;
play.disabled = false;

function renderDemo() {
  play.disabled = !date.value || !date.validity.valid;
  slider.disabled = play.disabled;
  if (play.disabled) return;
  const time = Date.parse(`${date.value}T00:00:00Z`) + Number(slider.value) * minute;
  const utc = utcClock.format(time);
  output.value = utc;
  slider.setAttribute("aria-valuetext", `${utc} UTC`);
  demoViews.forEach((render) => render(time));
}

function pause() {
  if (animation !== null) window.clearInterval(animation);
  animation = null;
  play.querySelector("span").textContent = "▶";
  play.setAttribute("aria-label", ja ? "再生" : "Play");
}

play.addEventListener("click", () => {
  if (animation !== null) {
    pause();
    return;
  }
  if (!date.value || !date.validity.valid) return;
  play.querySelector("span").textContent = "Ⅱ";
  play.setAttribute("aria-label", ja ? "一時停止" : "Pause");
  animation = window.setInterval(() => {
    slider.value = (Number(slider.value) + (motion.matches ? 36 : 12)) % 1440;
    renderDemo();
  }, motion.matches ? 300 : 100);
});
slider.addEventListener("input", () => {
  pause();
  renderDemo();
});
date.addEventListener("change", () => {
  pause();
  renderDemo();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) pause();
});
pause();
renderDemo();
