/********************
 * 基本 DOM
 ********************/
const screens = {
  title: document.querySelector("#screen-title"),
  load: document.querySelector("#screen-load"),
  game: document.querySelector("#screen-game"),
};

const $bg = document.querySelector("#bg");
const $ch = document.querySelector("#ch");
const $name = document.querySelector("#name");
const $text = document.querySelector("#text");
const $choices = document.querySelector("#choices");
const $next = document.querySelector("#next");

const $slots = document.querySelector("#slots");
const $pageButtons = document.querySelector("#page-buttons");

/********************
 * 參數：600 格存檔
 ********************/
const SLOTS_TOTAL = 600;
const PAGES = 10;
const SLOTS_PER_PAGE = SLOTS_TOTAL / PAGES; // 60
const SLOTS_SHOWN_ON_LOAD_SCREEN = 6; // 你要求「起碼 6 個長方形」

const LS_PREFIX = "webvn_save_v1_"; // localStorage key 前綴

function showScreen(which) {
  for (const k of Object.keys(screens)) screens[k].classList.add("hidden");
  screens[which].classList.remove("hidden");
}

/********************
 * 劇情資料（先用 demo）
 ********************/
const story = {
  start: [
    { name: "旁白", text: "這是首頁/加載/存檔的基礎骨架。" },
    { name: "旁白", text: "下一步你可以把 story 換成你的劇情段落。" },
    {
      name: "旁白",
      text: "要不要進入分歧？",
      choices: [
        { label: "走分歧", jump: "branch" },
        { label: "直達結局A", jump: "endingA" }
      ]
    }
  ],
  branch: [
    { name: "你", text: "我走了分歧路線。" },
    { name: "旁白", text: "這裡之後可以加旗標/好感度/CG。" },
    { jump: "endingB" }
  ],
  endingA: [
    { name: "旁白", text: "結局 A：你從頭開始一路走到這裡。" }
  ],
  endingB: [
    { name: "旁白", text: "結局 B：你完成分歧讀檔骨架。" }
  ]
};

/********************
 * 遊戲狀態
 ********************/
let gameState = {
  label: "start",
  index: 0,
  vars: {} // 之後放旗標、好感度等
};

function setStage({ bg, ch }) {
  if (bg) {
    $bg.src = bg;
    $bg.style.display = "block";
  } else {
    $bg.removeAttribute("src");
    $bg.style.display = "block"; // 先保留空畫面，不隱藏也OK
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

function formatTime(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}/${pad(d.getMonth()+1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function render(node) {
  if ("bg" in node || "ch" in node) setStage({ bg: node.bg ?? null, ch: node.ch ?? null });

  // jump（段落跳轉）
  if (node.jump) {
    gameState.label = node.jump;
    gameState.index = 0;
    return step();
  }

  $name.textContent = node.name ?? "";
  $text.textContent = node.text ?? "";
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

function step() {
  const scene = story[gameState.label];
  if (!scene) {
    $name.textContent = "系統";
    $text.textContent = `找不到段落：${gameState.label}`;
    $next.style.display = "none";
    return;
  }

  if (gameState.index >= scene.length) {
    $name.textContent = "旁白";
    $text.textContent = "（已到段落結尾）";
    $next.style.display = "none";
    return;
  }

  const node = scene[gameState.index];
  gameState.index += 1;
  render(node);
}

/********************
 * 存檔/讀檔（600 格）
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
    state: gameState,
    // 之後可加：bg/ch/截圖/當前台詞等
  };
}

function quickSave() {
  // 找第一個空格；若都滿了就覆蓋 1
  let target = 1;
  for (let i = 1; i <= SLOTS_TOTAL; i++) {
    if (!readSlot(i)) { target = i; break; }
  }
  writeSlot(target, makeSavePayload());
  alert(`已快速存檔到 Slot ${target}`);
}

function loadFromSlot(slotId) {
  const data = readSlot(slotId);
  if (!data || !data.state) {
    alert("這個存檔是空的。");
    return;
  }
  gameState = data.state;
  showScreen("game");
  step(); // 注意：step 會讀 gameState.index，所以載入後會續跑下一句
}

/********************
 * 加載畫面 UI
 ********************/
let currentPage = 1;

function renderPageButtons() {
  $pageButtons.innerHTML = "";
  for (let p = 1; p <= PAGES; p++) {
    const btn = document.createElement("button");
    btn.className = "page-btn" + (p === currentPage ? " active" : "");
    btn.textContent = String(p);
    btn.addEventListener("click", () => {
      currentPage = p;
      renderPageButtons();
      renderSlots();
    });
    $pageButtons.appendChild(btn);
  }
}

function renderSlots() {
  $slots.innerHTML = "";

  const startSlotId = (currentPage - 1) * SLOTS_PER_PAGE + 1;
  const endSlotId = startSlotId + SLOTS_SHOWN_ON_LOAD_SCREEN - 1; // 只顯示 6 個

  for (let slotId = startSlotId; slotId <= endSlotId; slotId++) {
    const data = readSlot(slotId);

    const card = document.createElement("div");
    card.className = "slot";

    const left = document.createElement("div");
    left.className = "left";

    const title = document.createElement("div");
    title.className = "slot-id";
    title.textContent = `Slot ${slotId}`;

    const time = document.createElement("div");
    time.className = data ? "slot-time" : "slot-empty";
    time.textContent = data ? formatTime(data.ts) : "（空）";

    left.appendChild(title);
    left.appendChild(time);

    const right = document.createElement("div");
    right.style.opacity = "0.7";
    right.textContent = "讀取 ▶";

    card.appendChild(left);
    card.appendChild(right);

    card.addEventListener("click", () => loadFromSlot(slotId));
    $slots.appendChild(card);
  }
}

function openLoadScreen(fromGame = false) {
  showScreen("load");
  renderPageButtons();
  renderSlots();
}

/********************
 * 首頁按鈕
 ********************/
document.querySelector("#btn-start").addEventListener("click", () => {
  // 從頭開始：重置狀態
  gameState = { label: "start", index: 0, vars: {} };
  showScreen("game");
  step();
});

document.querySelector("#btn-load").addEventListener("click", () => {
  currentPage = 1;
  openLoadScreen(false);
});

document.querySelector("#btn-exit").addEventListener("click", () => {
  alert("網頁遊戲無法直接關閉瀏覽器分頁。\n你可以用：Ctrl+W（關閉分頁）或 Alt+F4（關閉視窗）。");
});

/********************
 * 加載頁按鈕
 ********************/
document.querySelector("#btn-load-back").addEventListener("click", () => {
  showScreen("title");
});

/********************
 * 遊戲內按鈕
 ********************/
$next.addEventListener("click", step);

document.querySelector("#btn-quick-save").addEventListener("click", quickSave);

document.querySelector("#btn-open-load").addEventListener("click", () => {
  currentPage = 1;
  openLoadScreen(true);
});

document.querySelector("#btn-to-title").addEventListener("click", () => {
  showScreen("title");
});

/********************
 * 初始進入首頁
 ********************/
showScreen("title");
