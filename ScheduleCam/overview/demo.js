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
  const japanese = document.documentElement.lang === "ja";
  const text = (english, japaneseText) => japanese ? japaneseText : english;
  const displayDate = new Intl.DateTimeFormat(text("en", "ja"), {
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
      fillOptions(fields.resolution, [text("Auto", "自動"), "Full HD", "HD", "SD"]);
    } else {
      fillOptions(fields.resolution, rear
        ? [text("Auto", "自動"), "4000 × 3000", "1920 × 1080"]
        : [text("Auto", "自動"), "3264 × 2448", "1920 × 1080"]);
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
      label.textContent = text(`Capture ${index + 1}`, `撮影 ${index + 1}`);
      remove.setAttribute("aria-label", text(`Remove capture ${index + 1}`, `撮影 ${index + 1}を削除`));
      remove.hidden = rows.length === 1;
    });
    add.disabled = rows.length >= maxTimes;
    add.textContent = add.disabled ? text("30 times added", "30件追加済み") : text("Add time", "日時を追加");
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
      if (invalid) return reject(invalid.field, text("Choose a capture time in the future.", "未来の撮影日時を指定してください。"));
      slots.sort((a, b) => a.time - b.time);
      for (let index = 1; index < slots.length; index += 1) {
        const previous = slots[index - 1];
        const current = slots[index];
        if (current.time === previous.time) return reject(current.field, text("Choose a different time for each capture.", "撮影日時が重複しています。"));
        if (duration && current.time - previous.time <= duration * minute) {
          return reject(current.field, text("Leave more time between captures than the video length.", "動画の長さより長い間隔を空けてください。"));
        }
      }
      return { time: slots[0].time, cadence: text(`One-time · ${slots.length}${slots.length === 1 ? " capture" : " captures"}`, `単発・${slots.length}件`) };
    }

    const first = timeValue(fields.start);
    const last = timeValue(fields.end);
    const interval = fields.interval.valueAsNumber;
    if (!(first > now)) return reject(fields.start, text("Choose a start time in the future.", "未来の開始日時を指定してください。"));
    if (!(last > first)) return reject(fields.end, text("Choose an end time after the start.", "終了日時は開始日時より後にしてください。"));
    if (!Number.isInteger(interval) || interval < 1) return reject(fields.interval, text("Enter a whole number of minutes, at least 1.", "間隔は1分以上の整数で入力してください。"));
    if (interval <= duration) return reject(fields.interval, text("Set an interval longer than the video length.", "動画の長さより長い間隔を設定してください。"));
    if (last - first < duration * minute) return reject(fields.end, text("Leave enough time to record the first video.", "最初の動画を撮り終えられる終了日時を指定してください。"));
    return { time: first, cadence: text(`Repeat · every ${interval} min`, `繰り返し・${interval}分間隔`), end: last };
  }

  function showSchedule({ time, cadence, end }) {
    const isVideo = fields.kind.value === "video";
    const capture = isVideo
      ? text(
        `Video · ${selectedLabel(fields.duration)} · ${selectedLabel(fields.audio).toLowerCase()}`,
        `動画・${selectedLabel(fields.duration)}・音声${selectedLabel(fields.audio)}`
      )
      : text("Photo", "写真");
    const rows = [
      [text("Schedule", "予約方法"), cadence],
      [text("Capture", "撮影の種類"), capture],
      [text("Camera", "カメラ"), selectedLabel(fields.lens) + " · " + selectedLabel(fields.zoom)],
      [text("Resolution", "解像度"), selectedLabel(fields.resolution)],
      [text("Save to", "保存先"), selectedLabel(fields.destination)],
    ];
    if (end) rows.splice(1, 0, [text("Ends", "終了日時"), displayDate.format(end)]);
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
    clearMessage(text("Schedule preview ready.", "予約のプレビューを表示しました。"));
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
    clearMessage(text("Schedule preview stopped.", "予約のプレビューを停止しました。"));
    start.focus();
  });

  document.getElementById("demo-reset").addEventListener("click", () => {
    reset();
    clearMessage(text("Preview settings reset.", "設定を初期化しました。"));
  });

  reset();
  document.getElementById("demo-caption").textContent = text("Interactive preview. Settings apply only in this browser.", "ブラウザで試せる操作デモです。実際の撮影は行いません。");
  document.getElementById("schedule-demo-fallback").hidden = true;
  demo.hidden = false;
})();
