(() => {
  const demo = document.getElementById("schedule-demo");
  const form = document.getElementById("demo-form");
  const fields = form.elements;
  const draft = document.getElementById("demo-draft");
  const repeat = document.getElementById("demo-repeat");
  const oneTime = document.getElementById("demo-once");
  const video = document.getElementById("demo-video");
  const times = document.getElementById("demo-times");
  const timeTemplate = document.getElementById("demo-time-row");
  const add = document.getElementById("demo-add");
  const start = document.getElementById("demo-submit");
  const stop = document.getElementById("demo-stop");
  const status = document.getElementById("demo-status");
  const next = document.getElementById("demo-next");
  const nextTime = document.getElementById("demo-next-time");
  const summary = document.getElementById("demo-summary");
  const message = document.getElementById("demo-message");
  const displayDate = new Intl.DateTimeFormat("en", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  });
  const minute = 60_000;
  const maxTimes = 30;
  let invalidField;

  function inputDate(date) {
    const local = new Date(date.getTime() - date.getTimezoneOffset() * minute);
    return local.toISOString().slice(0, 16);
  }

  function selectedLabel(select) {
    return select.selectedOptions[0].textContent;
  }

  function fillOptions(select, labels) {
    select.replaceChildren(...labels.map(label => new Option(label)));
  }

  function updateCameraOptions() {
    const rear = fields.lens.value === "rear";
    fillOptions(fields.zoom, rear ? ["1×", "1.5×", "2×", "3×"] : ["1×", "1.5×"]);
    if (fields.kind.value === "video") {
      fillOptions(fields.resolution, ["Auto", "Full HD", "HD", "SD"]);
    } else {
      fillOptions(fields.resolution, rear
        ? ["Auto", "4000 × 3000", "1920 × 1080"]
        : ["Auto", "3264 × 2448", "1920 × 1080"]);
    }
  }

  function updateSections() {
    const repeating = fields.mode.value === "repeat";
    repeat.hidden = repeat.disabled = !repeating;
    oneTime.hidden = oneTime.disabled = repeating;
    video.hidden = video.disabled = fields.kind.value !== "video";
  }

  function clearMessage(text = "") {
    invalidField?.removeAttribute("aria-invalid");
    invalidField?.removeAttribute("aria-describedby");
    invalidField = undefined;
    message.removeAttribute("data-error");
    message.textContent = text;
  }

  function reject(field, text) {
    invalidField = field;
    field.setAttribute("aria-invalid", "true");
    field.setAttribute("aria-describedby", message.id);
    message.dataset.error = "";
    message.textContent = text;
    field.focus();
    return null;
  }

  function refreshTimeRows() {
    const rows = [...times.children];
    rows.forEach((row, index) => {
      const field = row.querySelector("input");
      const label = row.querySelector("label");
      const remove = row.querySelector("button");
      field.id = "demo-capture-time-" + (index + 1);
      label.htmlFor = field.id;
      label.textContent = "Capture " + (index + 1);
      remove.setAttribute("aria-label", "Remove capture " + (index + 1));
      remove.hidden = rows.length === 1;
    });
    add.disabled = rows.length >= maxTimes;
    add.textContent = add.disabled ? "30 times added" : "Add time";
  }

  function addTime(value, focus = false) {
    if (times.children.length >= maxTimes) return;
    const row = timeTemplate.content.firstElementChild.cloneNode(true);
    const input = row.querySelector("input");
    input.value = value;
    times.append(row);
    refreshTimeRows();
    if (focus) input.focus();
  }

  function timeValue(field) {
    const date = new Date(field.value);
    return Number.isFinite(date.getTime()) && inputDate(date) === field.value
      ? date.getTime()
      : NaN;
  }

  function draftSchedule() {
    const duration = fields.kind.value === "video" ? Number(fields.duration.value) : 0;
    const now = Date.now();
    if (fields.mode.value === "once") {
      const slots = [...times.querySelectorAll("input")]
        .map(field => ({ field, time: timeValue(field) }));
      const invalid = slots.find(slot => !(slot.time > now));
      if (invalid) return reject(invalid.field, "Choose a capture time in the future.");
      slots.sort((a, b) => a.time - b.time);
      for (let index = 1; index < slots.length; index += 1) {
        const previous = slots[index - 1];
        const current = slots[index];
        if (current.time === previous.time) return reject(current.field, "Choose a different time for each capture.");
        if (duration && current.time - previous.time <= duration * minute) {
          return reject(current.field, "Leave more time between captures than the video length.");
        }
      }
      return { time: slots[0].time, cadence: "One-time · " + slots.length + (slots.length === 1 ? " capture" : " captures") };
    }

    const first = timeValue(fields.start);
    const last = timeValue(fields.end);
    const interval = fields.interval.valueAsNumber;
    if (!(first > now)) return reject(fields.start, "Choose a start time in the future.");
    if (!(last > first)) return reject(fields.end, "Choose an end time after the start.");
    if (!Number.isInteger(interval) || interval < 1) return reject(fields.interval, "Enter a whole number of minutes, at least 1.");
    if (interval <= duration) return reject(fields.interval, "Set an interval longer than the video length.");
    if (last - first < duration * minute) return reject(fields.end, "Leave enough time to record the first video.");
    return { time: first, cadence: "Repeat · every " + interval + " min", end: last };
  }

  function showSchedule({ time, cadence, end }) {
    const isVideo = fields.kind.value === "video";
    const capture = isVideo
      ? "Video · " + selectedLabel(fields.duration) + " · " + selectedLabel(fields.audio).toLowerCase()
      : "Photo";
    const rows = [
      ["Schedule", cadence],
      ["Capture", capture],
      ["Camera", selectedLabel(fields.lens) + " · " + selectedLabel(fields.zoom)],
      ["Resolution", selectedLabel(fields.resolution)],
      ["Save to", selectedLabel(fields.destination)],
    ];
    if (end) rows.splice(1, 0, ["Ends", displayDate.format(end)]);
    summary.replaceChildren(...rows.map(([name, value]) => {
      const item = document.createElement("div");
      const title = document.createElement("dt");
      const detail = document.createElement("dd");
      title.textContent = name;
      detail.textContent = value;
      item.append(title, detail);
      return item;
    }));
    nextTime.textContent = displayDate.format(time);
    draft.hidden = start.hidden = true;
    status.hidden = stop.hidden = false;
    clearMessage("Schedule preview ready.");
    next.focus();
  }

  function openDraft() {
    status.hidden = stop.hidden = true;
    draft.hidden = start.hidden = false;
  }

  function reset() {
    const first = new Date();
    first.setDate(first.getDate() + 1);
    first.setHours(8, 0, 0, 0);
    const end = new Date(first);
    end.setHours(10, 0, 0, 0);
    form.reset();
    fields.start.value = inputDate(first);
    fields.end.value = inputDate(end);
    times.replaceChildren();
    addTime(inputDate(first));
    updateSections();
    updateCameraOptions();
    openDraft();
    draft.scrollTop = 0;
    clearMessage();
  }

  form.addEventListener("input", () => clearMessage());
  form.addEventListener("change", event => {
    if (event.target.name === "mode" || event.target.name === "kind") updateSections();
    if (event.target.name === "kind" || event.target.name === "lens") updateCameraOptions();
  });

  add.addEventListener("click", () => {
    const previous = [...times.querySelectorAll("input")].map(timeValue).filter(Number.isFinite);
    const latest = Math.max(Date.now(), ...previous);
    clearMessage();
    addTime(inputDate(new Date(latest + 30 * minute)), true);
  });

  times.addEventListener("click", event => {
    const button = event.target.closest("button");
    if (!button || times.children.length === 1) return;
    clearMessage();
    button.closest(".demo-one-time").remove();
    refreshTimeRows();
    add.focus();
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    if (!status.hidden) return;
    clearMessage();
    const schedule = draftSchedule();
    if (schedule) showSchedule(schedule);
  });

  stop.addEventListener("click", () => {
    openDraft();
    clearMessage("Schedule preview stopped.");
    start.focus();
  });

  document.getElementById("demo-reset").addEventListener("click", () => {
    reset();
    clearMessage("Preview settings reset.");
  });

  reset();
  document.getElementById("demo-caption").textContent = "Interactive preview. Settings apply only in this browser.";
  document.getElementById("schedule-demo-fallback").hidden = true;
  demo.hidden = false;
})();
