/********************
 * 設定：600 格存檔
 ********************/
const SLOTS_TOTAL = 600;
const PAGES = 10;
const SLOTS_PER_PAGE = SLOTS_TOTAL / PAGES; // 60
const LS_PREFIX = "webvn_save_v2_"; // 版本升級：避免你舊 demo 的存檔結構衝突

/********************
 * 畫面切換
 ********************/
const screens = {
  title: document.querySelector("#screen-title"),
  load: document.querySelector("#screen-load"),
  save: document.querySelector("#screen-save"),
  game: document.querySelector("#screen-game"),
};

function showScreen(which) {
  for (const k of Object.keys(screens)) screens[k].classList.add("hidden");
  screens[which].classList.remove("hidden");
}

/********************
 * 遊戲 DOM
 ********************/
const $bg = document.querySelector("#bg");
const $ch = document.querySelector("#ch");
const $name = document.querySelector("#name");
const $text = document.querySelector("#text");
const $choices = document.querySelector("#choices");
const $next = document.querySelector("#next");

/********************
 * 存檔/讀檔 DOM
 ********************/
const $loadSlots = document.querySelector("#load-slots");
const $saveSlots = document.querySelector("#save-slots");
const $loadPageButtons = document.querySelector("#load-page-buttons");
const $savePageButtons = document.querySelector("#save-page-buttons");

/********************
 * 劇情資料（demo）
 * 你之後把 story 換掉即可
 ********************/
const story = {
  start: [
    { name: "旁白", text: "你現在有：首頁/讀檔/存檔/600格/章節摘要。" },
    { name: "旁白", text: "下一步：把你的劇情貼進 story，或改成外部 JSON。" },
    {
      name: "旁白",
      text: "選一條路？",
      choices: [
        { label: "走分歧", jump: "branch" },
        { label: "直達結局A", jump: "endingA" }
      ]
    }
  ],
  branch: [
    { name: "你", text: "我走了分歧路線。" },
    { name: "旁白", text: "現在按『存檔』去挑一格覆蓋，或按『讀檔』回來。" },
    { jump: "endingB" }
  ],
  endingA: [
    { name: "旁白", text: "結局 A：從頭開始到這裡。" }
  ],
  endingB: [
    { name: "旁白", text: "結局 B：分歧到這裡。" }
  ]
};

/********************
 * 遊戲狀態
 * 注意：index 指「下一次 step 會讀到的句子位置」
 * 我們用 lastLine 來記「目前畫面顯示的句子」
 ********************/
let gameState = {
  label: "start",
  index: 0,
  vars: {},
  lastLine: { name: "", text: "" }, // 用於存檔摘要
};

function setStage({ bg, ch }) {
  if (bg) {
    $bg.src = bg;
    $bg.style.display = "block";
  } else {
    $bg.removeAttribute("src");
    $bg.style.display = "block";
  }

  if (ch) {
    $ch.src = ch;
    $ch.style.display = "block";
  } else {
    $ch.removeAttribute("src");
    $ch.style.display = "none";
  }
}

function clearChoices() {
  $choices.innerHTML = "";
}

function step() {
  const scene = story[gameState.label];
  if (!scene) {
    $name.textContent = "系統";
    $text.textContent = `找不到段落：${gameState.label}`;
    document.querySelector("#next").style.display = "none";
    return;
  }

  // 到段落尾
  if (gameState.index >= scene.length) {
    $name.textContent = "旁白";
    $text.textContent = "（已到段落結尾）";
    document.querySelector("#next").style.display = "none";
    clearChoices();
    return;
  }

  const node = scene[gameState.index];
  gameState.index += 1;

  render(node);
}

function render(node) {
  if ("bg" in node || "ch" in node) setStage({ bg: node.bg ?? null, ch: node.ch ?? null });

  // 段落跳轉
  if (node.jump) {
    gameState.label = node.jump;
    gameState.index = 0;
    return step();
  }

  const name = node.name ?? "";
  const text = node.text ?? "";

  $name.textContent = name;
  $text.textContent = text;

  // 更新 lastLine（存檔摘要用）
  gameState.lastLine = { name, text };

  clearChoices();

  if (node.choices && node.choices.length) {
    $next.style.display = "none";
    node.choices.forEach(c => {
      const btn = document.createElement("button");
      btn.className = "choice";
      btn.textContent = c.label;
      btn.addEventListener("click", () => {
        gameState.label = c.jump;
        gameState.index = 0;
        step();
      });
      $choices.appendChild(btn);
    });
  } else {
    $next.style.display = "inline-block";
  }
}

/********************
 * 小工具
 ********************/
function pad2(n){ return String(n).padStart(2, "0"); }
function formatTime(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}/${pad2(d.getMonth()+1)}/${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function clipText(s, n=36){
  const t = String(s ?? "").trim().replace(/\s+/g, " ");
  if (t.length <= n) return t;
  return t.slice(0, n) + "…";
}

/********************
 * 存檔資料結構
 ********************/
function slotKey(slotId) {
  return `${LS_PREFIX}${slotId}`;
}

function readSlot(slotId) {
  const raw = localStorage.getItem(slotKey(slotId));
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

function writeSlot(slotId, payload) {
  localStorage.setItem(slotKey(slotId), JSON.stringify(payload));
}

function makeSavePayload() {
  return {
    ts: Date.now(),
    meta: {
      label: gameState.label,                 // 章節/段落
      snippet: clipText(gameState.lastLine.text, 48), // 台詞摘要
      speaker: clipText(gameState.lastLine.name, 12),
    },
    state: {
      // 保存必要狀態（避免直接引用同一個物件）
      label: gameState.label,
      index: gameState.index,
      vars: gameState.vars,
      lastLine: gameState.lastLine,
    }
  };
}

/********************
 * 快速存檔
 ********************/
function quickSave() {
  // 找第一個空格；若都滿了就覆蓋 Slot 1
  let target = 1;
  for (let i = 1; i <= SLOTS_TOTAL; i++) {
    if (!readSlot(i)) { target = i; break; }
  }
  writeSlot(target, makeSavePayload());
  alert(`已快速存檔到 Slot ${target}`);
}

/********************
 * 讀檔（重要：讀完要顯示「同一句」）
 ********************/
function loadFromSlot(slotId) {
  const data = readSlot(slotId);
  if (!data || !data.state) {
    alert("這個存檔是空的。");
    return;
  }

  // 讀回狀態
  gameState = {
    label: data.state.label,
    index: data.state.index,
    vars: data.state.vars ?? {},
    lastLine: data.state.lastLine ?? { name:"", text:"" }
  };

  // 讀檔後：顯示「當時畫面那一句」
  // 因為 index 代表下一句，所以當時顯示的是 index-1
  const scene = story[gameState.label];
  const shownIndex = Math.max(0, (gameState.index - 1));
  const node = scene?.[shownIndex];

  showScreen("game");

  if (node) {
    render(node);
    // 注意：render 會更新 lastLine，但不會改 index，所以仍可續走下一句
  } else {
    // 如果找不到就直接 step()
    step();
  }
}

/********************
 * 存檔：點格子覆蓋
 ********************/
function saveToSlot(slotId) {
  const ok = confirm(`要覆蓋 Slot ${slotId} 嗎？`);
  if (!ok) return;

  writeSlot(slotId, makeSavePayload());
  // 立即更新畫面
  renderSlots("save");
}

/********************
 * 存檔/讀檔畫面 UI
 ********************/
let loadPage = 1;
let savePage = 1;

function renderPageButtons(kind) {
  const host = kind === "load" ? $loadPageButtons : $savePageButtons;
  const current = kind === "load" ? loadPage : savePage;

  host.innerHTML = "";
  for (let p = 1; p <= PAGES; p++) {
    const btn = document.createElement("button");
    btn.className = "page-btn" + (p === current ? " active" : "");
    btn.textContent = String(p);
    btn.addEventListener("click", () => {
      if (kind === "load") loadPage = p;
      else savePage = p;
      renderPageButtons(kind);
      renderSlots(kind);
    });
    host.appendChild(btn);
  }
}

function slotCard(slotId, data, onClick, kind) {
  const card = document.createElement("div");
  card.className = "slot";

  const top = document.createElement("div");
  top.className = "slot-top";

  const id = document.createElement("div");
  id.className = "slot-id";
  id.textContent = `Slot ${slotId}`;

  const time = document.createElement("div");
  if (data) {
    time.className = "slot-time";
    time.textContent = formatTime(data.ts);
  } else {
    time.className = "slot-empty";
    time.textContent = "（空）";
  }

  top.appendChild(id);
  top.appendChild(time);

  const meta = document.createElement("div");
  meta.className = "slot-meta";
  meta.textContent = data
    ? `章節：${data.meta?.label ?? "?"}　角色：${data.meta?.speaker ?? "?"}`
    : (kind === "save" ? "點此存檔" : "沒有存檔");

  const snip = document.createElement("div");
  snip.className = "slot-snippet";
  snip.textContent = data ? `「${data.meta?.snippet ?? ""}」` : "";

  card.appendChild(top);
  card.appendChild(meta);
  card.appendChild(snip);

  card.addEventListener("click", () => onClick(slotId));
  return card;
}

function renderSlots(kind) {
  const host = kind === "load" ? $loadSlots : $saveSlots;
  const page = kind === "load" ? loadPage : savePage;

  host.innerHTML = "";

  const startSlotId = (page - 1) * SLOTS_PER_PAGE + 1;
  const endSlotId = startSlotId + SLOTS_PER_PAGE - 1;

  for (let slotId = startSlotId; slotId <= endSlotId; slotId++) {
    const data = readSlot(slotId);
    const onClick = (kind === "load") ? loadFromSlot : saveToSlot;
    host.appendChild(slotCard(slotId, data, onClick, kind));
  }
}

function openLoadScreen() {
  showScreen("load");
  renderPageButtons("load");
  renderSlots("load");
}

function openSaveScreen() {
  showScreen("save");
  renderPageButtons("save");
  renderSlots("save");
}

/********************
 * 首頁按鈕
 ********************/
document.querySelector("#btn-start").addEventListener("click", () => {
  // 從頭開始：重置狀態
  gameState = { label: "start", index: 0, vars: {}, lastLine: {name:"", text:""} };
  showScreen("game");
  step();
});

document.querySelector("#btn-load").addEventListener("click", () => {
  loadPage = 1;
  openLoadScreen();
});

document.querySelector("#btn-exit").addEventListener("click", () => {
  alert("網頁遊戲無法直接『離開』程式。\n你可以用：Ctrl+W（關閉分頁）或 Alt+F4（關閉視窗）。");
});

/********************
 * 加載/存檔頁 返回
 ********************/
document.querySelector("#btn-load-back").addEventListener("click", () => showScreen("title"));
document.querySelector("#btn-save-back").addEventListener("click", () => showScreen("game"));

/********************
 * 遊戲內按鈕
 ********************/
$next.addEventListener("click", step);

document.querySelector("#btn-save").addEventListener("click", () => {
  savePage = 1;
  openSaveScreen();
});

document.querySelector("#btn-load-in-game").addEventListener("click", () => {
  loadPage = 1;
  openLoadScreen();
});

document.querySelector("#btn-quick-save").addEventListener("click", quickSave);

document.querySelector("#btn-to-title").addEventListener("click", () => showScreen("title"));

/********************
 * 初始進入首頁
 ********************/
showScreen("title");
