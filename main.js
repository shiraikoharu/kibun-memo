const STORAGE_KEY = "koharu_kibun_memo_records";

const MOODS = [
  { name: "つらい", color: "#f6cfc9" },
  { name: "だるい", color: "#e8e2dd" },
  { name: "苦しい", color: "#f3c6d0" },
  { name: "眠い", color: "#d9e8f7" },
  { name: "気力ない", color: "#e3d7f0" },
  { name: "疲れた", color: "#ead8c6" },
  { name: "ふらつく", color: "#d9e8ec" },
  { name: "不安", color: "#f5e9b8" },
  { name: "イライラ", color: "#f6d4b8" },
  { name: "落ち着いてる", color: "#d8ead6" },
  { name: "消えたい", color: "#dcdaf1" },
  { name: "その他", color: "#ebe1da" }
];

const moodColorMap = Object.fromEntries(MOODS.map((mood) => [mood.name, mood.color]));
const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];

let records = [];
let weekStart = startOfWeek(new Date());

const moodButtons = document.getElementById("moodButtons");
const recordStatus = document.getElementById("recordStatus");
const otherPanel = document.getElementById("otherPanel");
const otherNote = document.getElementById("otherNote");
const saveOtherButton = document.getElementById("saveOtherButton");
const cancelOtherButton = document.getElementById("cancelOtherButton");
const weekLabel = document.getElementById("weekLabel");
const weekTableHead = document.getElementById("weekTableHead");
const weekTableBody = document.getElementById("weekTableBody");
const weeklySummary = document.getElementById("weeklySummary");
const recordList = document.getElementById("recordList");
const prevWeekButton = document.getElementById("prevWeekButton");
const nextWeekButton = document.getElementById("nextWeekButton");
const thisWeekButton = document.getElementById("thisWeekButton");
const clearAllButton = document.getElementById("clearAllButton");
const exportButton = document.getElementById("exportButton");
const importFile = document.getElementById("importFile");
const backupStatus = document.getElementById("backupStatus");

init();

function init() {
  records = loadRecords();
  renderMoodButtons();
  bindEvents();
  render();
  registerServiceWorker();
}

function bindEvents() {
  saveOtherButton.addEventListener("click", saveOtherRecord);
  cancelOtherButton.addEventListener("click", closeOtherPanel);
  prevWeekButton.addEventListener("click", () => moveWeek(-1));
  nextWeekButton.addEventListener("click", () => moveWeek(1));
  thisWeekButton.addEventListener("click", () => {
    weekStart = startOfWeek(new Date());
    render();
  });
  clearAllButton.addEventListener("click", clearAllRecords);
  exportButton.addEventListener("click", exportRecords);
  importFile.addEventListener("change", importRecords);
}

function renderMoodButtons() {
  moodButtons.innerHTML = "";
  MOODS.forEach((mood) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "mood-button";
    button.textContent = mood.name;
    button.style.setProperty("--mood-color", mood.color);
    button.addEventListener("click", () => {
      if (mood.name === "その他") {
        openOtherPanel();
      } else {
        addRecord(mood.name, "", "mood");
      }
    });
    moodButtons.appendChild(button);
  });
}

function loadRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeRecord).filter(Boolean);
  } catch (error) {
    console.warn("Failed to load records", error);
    return [];
  }
}

function normalizeRecord(record) {
  if (!record || typeof record !== "object") return null;
  const createdAt = typeof record.createdAt === "string" ? record.createdAt : "";
  const fallbackDate = createdAt ? new Date(createdAt) : new Date();
  const safeDate = isValidDateString(record.date) ? record.date : formatDate(fallbackDate);
  const safeTime = isValidTimeString(record.time) ? record.time : formatTime(fallbackDate);
  const hour = Number.isInteger(record.hour) && record.hour >= 0 && record.hour <= 23
    ? record.hour
    : Number(safeTime.slice(0, 2));
  const mood = typeof record.mood === "string" && record.mood.trim() ? record.mood.trim() : "その他";
  const note = typeof record.note === "string" ? record.note : "";
  const type = record.type === "other" ? "other" : "mood";

  return {
    id: typeof record.id === "string" && record.id ? record.id : createId(),
    date: safeDate,
    time: safeTime,
    hour: Number.isInteger(hour) ? hour : 0,
    mood,
    note,
    type,
    createdAt: createdAt || createLocalIso(new Date(`${safeDate}T${safeTime}:00`))
  };
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
}

function addRecord(mood, note, type) {
  const now = new Date();
  const record = {
    id: createId(),
    date: formatDate(now),
    time: formatTime(now),
    hour: now.getHours(),
    mood,
    note,
    type,
    createdAt: createLocalIso(now)
  };
  records = [record, ...records];
  saveRecords();
  showStatus(recordStatus, "記録しました");
  closeOtherPanel();
  render();
}

function openOtherPanel() {
  otherPanel.classList.remove("hidden");
  otherNote.focus();
  showStatus(recordStatus, "");
}

function closeOtherPanel() {
  otherPanel.classList.add("hidden");
  otherNote.value = "";
}

function saveOtherRecord() {
  const note = otherNote.value.trim();
  if (!note) {
    showStatus(recordStatus, "内容を入力してください");
    return;
  }
  addRecord("その他", note, "other");
}

function render() {
  records = records.map(normalizeRecord).filter(Boolean);
  saveRecords();
  renderWeek();
  renderSummary();
  renderRecordList();
}

function renderWeek() {
  const days = getWeekDays(weekStart);
  weekLabel.textContent = `${formatShortDate(days[0])} 〜 ${formatShortDate(days[6])}`;
  const todayKey = formatDate(new Date());

  weekTableHead.innerHTML = "";
  const headRow = document.createElement("tr");
  headRow.appendChild(createHeaderCell("時間"));
  days.forEach((day) => {
    const th = createHeaderCell(`${day.getMonth() + 1}/${day.getDate()} (${weekdayLabels[day.getDay()]})`);
    if (formatDate(day) === todayKey) th.classList.add("today");
    headRow.appendChild(th);
  });
  weekTableHead.appendChild(headRow);

  weekTableBody.innerHTML = "";
  for (let hour = 0; hour < 24; hour += 1) {
    const row = document.createElement("tr");
    const timeCell = document.createElement("td");
    timeCell.textContent = `${hour}時`;
    row.appendChild(timeCell);

    days.forEach((day) => {
      const dateKey = formatDate(day);
      const cell = document.createElement("td");
      if (dateKey === todayKey) cell.classList.add("today");
      const cellRecords = records
        .filter((record) => record.date === dateKey && record.hour === hour)
        .sort(compareRecordsAsc);
      const tagWrap = document.createElement("div");
      tagWrap.className = "cell-tags";
      cellRecords.forEach((record) => tagWrap.appendChild(createRecordTag(record, true)));
      cell.appendChild(tagWrap);
      row.appendChild(cell);
    });

    weekTableBody.appendChild(row);
  }
}

function renderSummary() {
  const days = getWeekDays(weekStart).map(formatDate);
  const counts = new Map();
  records.forEach((record) => {
    if (days.includes(record.date)) {
      counts.set(record.mood, (counts.get(record.mood) || 0) + 1);
    }
  });

  const items = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  weeklySummary.innerHTML = "";
  if (!items.length) {
    weeklySummary.innerHTML = '<p class="empty-text">今週の記録はまだありません。</p>';
    return;
  }

  items.forEach(([mood, count]) => {
    const item = document.createElement("div");
    item.className = "summary-item";
    item.innerHTML = `<span>${escapeHtml(mood)}</span><span>${count}回</span>`;
    weeklySummary.appendChild(item);
  });
}

function renderRecordList() {
  recordList.innerHTML = "";
  if (!records.length) {
    recordList.innerHTML = '<p class="empty-text">記録はまだありません。</p>';
    return;
  }

  const sorted = [...records].sort(compareRecordsDesc);
  sorted.forEach((record) => {
    const item = document.createElement("article");
    item.className = "record-item";

    const main = document.createElement("div");
    main.className = "record-main";
    const line = document.createElement("div");
    line.className = "record-line";
    line.append(`${formatListDate(record.date)} ${record.time}`);
    line.appendChild(createRecordTag(record, false));
    main.appendChild(line);
    if (record.type === "other" && record.note) {
      const note = document.createElement("p");
      note.className = "record-note";
      note.textContent = record.note;
      main.appendChild(note);
    }

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.textContent = "削除";
    deleteButton.addEventListener("click", () => deleteRecord(record.id));

    item.append(main, deleteButton);
    recordList.appendChild(item);
  });
}

function createRecordTag(record, compact) {
  const tag = document.createElement("span");
  tag.className = "tag";
  tag.style.setProperty("--mood-color", moodColorMap[record.mood] || moodColorMap["その他"]);
  tag.textContent = record.type === "other" && compact
    ? `その他：${shorten(record.note, 10)}`
    : record.mood;
  return tag;
}

function deleteRecord(id) {
  if (!confirm("この記録を削除しますか？")) return;
  records = records.filter((record) => record.id !== id);
  saveRecords();
  render();
}

function clearAllRecords() {
  if (!records.length) {
    showStatus(recordStatus, "削除する記録はありません");
    return;
  }
  if (!confirm("すべての記録を削除しますか？")) return;
  records = [];
  saveRecords();
  render();
}

function exportRecords() {
  const data = JSON.stringify(records.map(normalizeRecord).filter(Boolean), null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `kibun-memo-backup-${formatDate(new Date())}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showStatus(backupStatus, "保存用ファイルを作りました");
}

function importRecords(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || ""));
      if (!Array.isArray(parsed)) throw new Error("invalid");
      const imported = parsed.map(normalizeRecord).filter(Boolean);
      if (!confirm("今ある記録を上書きして復元しますか？")) return;
      records = imported;
      saveRecords();
      render();
      showStatus(backupStatus, "復元しました");
    } catch (error) {
      showStatus(backupStatus, "ファイルを読み込めませんでした");
    } finally {
      importFile.value = "";
    }
  };
  reader.onerror = () => {
    showStatus(backupStatus, "ファイルを読み込めませんでした");
    importFile.value = "";
  };
  reader.readAsText(file);
}

function moveWeek(offset) {
  weekStart = addDays(weekStart, offset * 7);
  render();
}

function getWeekDays(start) {
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

function startOfWeek(date) {
  const base = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = base.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addDays(base, mondayOffset);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatTime(date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function createLocalIso(date) {
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const abs = Math.abs(offsetMinutes);
  const offset = `${sign}${String(Math.floor(abs / 60)).padStart(2, "0")}:${String(abs % 60).padStart(2, "0")}`;
  return `${formatDate(date)}T${formatTime(date)}:${String(date.getSeconds()).padStart(2, "0")}.${String(date.getMilliseconds()).padStart(3, "0")}${offset}`;
}

function formatShortDate(date) {
  return `${date.getMonth() + 1}/${date.getDate()} (${weekdayLabels[date.getDay()]})`;
}

function formatListDate(dateText) {
  const parts = dateText.split("-");
  if (parts.length !== 3) return dateText;
  return `${Number(parts[1])}/${Number(parts[2])}`;
}

function createHeaderCell(text) {
  const th = document.createElement("th");
  th.textContent = text;
  return th;
}

function compareRecordsDesc(a, b) {
  return `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`);
}

function compareRecordsAsc(a, b) {
  return `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`);
}

function createId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function shorten(text, maxLength) {
  const value = text || "";
  return value.length > maxLength ? `${value.slice(0, maxLength)}…` : value;
}

function isValidDateString(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isValidTimeString(value) {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value);
}

function showStatus(element, message) {
  element.textContent = message;
  if (message) {
    window.clearTimeout(element._timer);
    element._timer = window.setTimeout(() => {
      element.textContent = "";
    }, 2200);
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[char]);
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js?v=3").then((registration) => {
      registration.update();
    }).catch((error) => {
      console.warn("Service worker registration failed", error);
    });
  });
}
