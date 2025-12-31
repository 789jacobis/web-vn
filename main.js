/***********************
 * CONFIG
 ***********************/
const NORMAL_SLOTS = 12;
const QUICK_SLOTS = 12;

// 存檔 key 前綴：兩套分開
const KEY_NORMAL = "webvn_save_normal_";
const KEY_QUICK  = "webvn_save_quick_";

/***********************
 * SCREENS
 ***********************/
const screens = {
  title:   document.querySelector("#screen-title"),
  load:    document.querySelector("#screen-load"),
  save:    document.querySelector("#screen-save"),
  credits: document.querySelector("#screen-credits"),
  game:    document.querySelector("#screen-game"),
};

function showScreen(name){
  Object.values(screens).forEach(el => el.classList.add("hidden"));
  screens[name].classList.remove("hidden");
}

/***********************
 * STORY (DEMO)
 ***********************/
const story = {
  start: [
    { name:"旁白", text:"這是一個重做後的 UI 範本：首頁、讀取進度（Load / Q.Load）、製作名單。" },
    { name:"旁白", text:"你可以先用『存檔 / 快速存檔』產生存檔，再回『讀取進度』切換 Load / Q.Load 讀回來。" },
    { name:"旁白", text:"要不要進分歧？", choices: [
      { label:"走分歧（示範）", jump:"branch" },
      { label:"不分歧（直走）", jump:"endingA" },
    ]},
  ],
  branch: [
    { name:"你", text:"我走了分歧。" },
    { name:"旁白", text:"現在試試：存檔到 Load 或 Q.Save，然後去讀檔。" },
    { jump:"endingB" }
  ],
  endingA: [
    { name:"旁白", text:"結局 A：你選擇了直走。" }
  ],
  endingB: [
    { name:"旁白", text:"結局 B：你走了分歧。" }
  ]
};

let state = {
  label: "start",
  index: 0,          // 下一次 step 要讀的 index
  lastLine: { name:"", text:"" } // 當下畫面那句（用來做摘要）
};

const $uiName = document.querySelector("#ui-name");
const $uiText = document.querySelector("#ui-text");
const $uiChoices = document.querySelector("#ui-choices");
const $btnNext = document.querySelector("#btn-next");
const $stage = document.querySelector("#screen-game .stage");


function clearChoices(){ $uiChoices.innerHTML = ""; }

function step(){
  const scene = story[state.label];
  if(!scene){
    $uiName.textContent = "系統";
    $uiText.textContent = `找不到段落：${state.label}`;
    $btnNext.style.display = "none";
    clearChoices();
    return;
  }
  if(state.index >= scene.length){
    $uiName.textContent = "旁白";
    $uiText.textContent = "（已到段落結尾）";
    $btnNext.style.display = "none";
    clearChoices();
    return;
  }

  const node = scene[state.index];
  state.index += 1;
  renderNode(node);
}

function renderNode(node){
  if(node.jump){
    state.label = node.jump;
    state.index = 0;
    return step();
  }

  const name = node.name ?? "";
  const text = node.text ?? "";

  $uiName.textContent = name;
  $uiText.textContent = text;

  state.lastLine = { name, text };

  clearChoices();

  if(node.choices && node.choices.length){
    $btnNext.style.display = "none";
    node.choices.forEach(c=>{
      const btn = document.createElement("button");
      btn.className = "choice";
      btn.textContent = c.label;
      btn.addEventListener("click", ()=>{
        state.label = c.jump;
        state.index = 0;
        step();
      });
      $uiChoices.appendChild(btn);
    });
  }else{
    $btnNext.style.display = "inline-block";
  }
}

/***********************
 * SAVE DATA
 ***********************/
function nowString(ts){
  const d = new Date(ts);
  const pad = (n)=> String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
function clip(s, n=44){
  const t = String(s ?? "").trim().replace(/\s+/g," ");
  return t.length <= n ? t : t.slice(0,n) + "…";
}
async function makePayload(){
  const thumb = await captureStageThumbnail();

  return {
    ts: Date.now(),
    thumb, // ✅新增：縮圖 base64
    meta: {
      label: state.label,
      speaker: clip(state.lastLine.name, 12),
      snippet: clip(state.lastLine.text, 52),
    },
    state: {
      label: state.label,
      index: state.index,
      lastLine: state.lastLine
    }
  };
}

async function captureStageThumbnail(){
  if(!window.html2canvas || !$stage) return null;

  // 如果 game 畫面被 showScreen 隱藏（display:none），先暫時讓它可被截圖
  const gameEl = screens.game; // #screen-game
  const wasHidden = gameEl.classList.contains("hidden");

  // 暫存原本 style，等下還原
  const prevStyle = {
    position: gameEl.style.position,
    left: gameEl.style.left,
    top: gameEl.style.top,
    opacity: gameEl.style.opacity,
    pointerEvents: gameEl.style.pointerEvents,
    visibility: gameEl.style.visibility
  };

  try{
    if(wasHidden){
      // 讓它可渲染，但放到畫面外 + 透明，避免你看到「閃一下」
      gameEl.classList.remove("hidden");
      gameEl.style.position = "fixed";
      gameEl.style.left = "-10000px";
      gameEl.style.top = "0";
      gameEl.style.opacity = "0";
      gameEl.style.pointerEvents = "none";
      gameEl.style.visibility = "visible";
    }

    // 等 1~2 幀，讓畫面完整 render
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);

    const canvas = await html2canvas($stage, {
      backgroundColor: null,
      scale: 1,
      useCORS: true
    });

    // 縮小，避免 localStorage 太大
    const targetW = 320;
    const ratio = canvas.height / canvas.width;
    const targetH = Math.round(targetW * ratio);

    const out = document.createElement("canvas");
    out.width = targetW;
    out.height = targetH;
    const ctx = out.getContext("2d");
    ctx.drawImage(canvas, 0, 0, targetW, targetH);

    return out.toDataURL("image/jpeg", 0.6);
  }catch(e){
    console.warn("captureStageThumbnail failed:", e);
    return null;
  }finally{
    // 還原畫面狀態
    if(wasHidden) gameEl.classList.add("hidden");
    gameEl.style.position = prevStyle.position;
    gameEl.style.left = prevStyle.left;
    gameEl.style.top = prevStyle.top;
    gameEl.style.opacity = prevStyle.opacity;
    gameEl.style.pointerEvents = prevStyle.pointerEvents;
    gameEl.style.visibility = prevStyle.visibility;
  }
}



function keyFor(mode, slot){
  return (mode === "quick" ? KEY_QUICK : KEY_NORMAL) + slot;
}
function readSlot(mode, slot){
  const raw = localStorage.getItem(keyFor(mode, slot));
  if(!raw) return null;
  try{ return JSON.parse(raw); } catch { return null; }
}
function writeSlot(mode, slot, payload){
  localStorage.setItem(keyFor(mode, slot), JSON.stringify(payload));
}

/***********************
 * LOAD UI (tabs + 12 slots)
 ***********************/
let loadTab = "normal"; // "normal" | "quick"

const $loadLabel = document.querySelector("#load-page-label");
const $loadHint  = document.querySelector("#load-hint");
const $slotGrid  = document.querySelector("#slot-grid");

function applyLoadTabUI(){
  $loadLabel.textContent = (loadTab === "quick") ? "Q.Load" : "Load";
  $loadHint.textContent  = (loadTab === "quick") ? "這裡是快速存檔喔！" : "這裡是一般存檔喔！";

  document.querySelectorAll("#screen-load .tab[data-tab]").forEach(btn=>{
    const t = btn.getAttribute("data-tab");
    btn.classList.toggle("active", t === loadTab);
  });
}

function renderLoadSlots(){
  applyLoadTabUI();
  $slotGrid.innerHTML = "";

  const total = (loadTab === "quick") ? QUICK_SLOTS : NORMAL_SLOTS;
  for(let i=1;i<=total;i++){
    const data = readSlot(loadTab, i);
    $slotGrid.appendChild(makeSlotCard({
      mode: loadTab,
      slot: i,
      data,
      clickable: !!data,
      onClick: ()=> {
        if(!data) return alert("這個格子是空的。");
        loadFrom(modeFromTab(loadTab), i);
      }
    }));
  }
}

function modeFromTab(tab){ return tab === "quick" ? "quick" : "normal"; }

function loadFrom(mode, slot){
  const data = readSlot(mode, slot);
  if(!data || !data.state){
    alert("這個存檔是空的。");
    return;
  }

  state.label = data.state.label;
  state.index = data.state.index;
  state.lastLine = data.state.lastLine ?? { name:"", text:"" };

  // 讀檔後顯示「當時那一句」：index-1
  const scene = story[state.label];
  const shownIndex = Math.max(0, state.index - 1);
  const node = scene?.[shownIndex];

  showScreen("game");

  if(node) renderNode(node);
  else step();
}

/***********************
 * SAVE UI (manual overwrite)
 ***********************/
let saveTab = "normal";
const $saveLabel = document.querySelector("#save-page-label");
const $saveHint  = document.querySelector("#save-hint");
const $saveGrid  = document.querySelector("#save-grid");

function applySaveTabUI(){
  $saveLabel.textContent = (saveTab === "quick") ? "Q.Save" : "Save";
  $saveHint.textContent  = (saveTab === "quick") ? "這裡是快速存檔喔！" : "這裡是一般存檔喔！";

  document.querySelectorAll("#screen-save .tab[data-save-tab]").forEach(btn=>{
    const t = btn.getAttribute("data-save-tab");
    btn.classList.toggle("active", t === saveTab);
  });
}

function renderSaveSlots(){
  applySaveTabUI();
  $saveGrid.innerHTML = "";

  const total = (saveTab === "quick") ? QUICK_SLOTS : NORMAL_SLOTS;
  for(let i=1;i<=total;i++){
    const data = readSlot(saveTab, i);
    $saveGrid.appendChild(makeSlotCard({
      mode: saveTab,
      slot: i,
      data,
      clickable: true,
      onClick: async () => {
        // 1. 先在背景抓取目前的遊戲縮圖與資料 (在 confirm 彈出前執行)
        const payload = await makePayload(); 
        // 2. 抓好資料後，再詢問使用者是否要覆蓋
        const ok = confirm(`要覆蓋 ${saveTab === "quick" ? "Q.Save" : "Save"} Slot ${String(i).padStart(3,"0")} 嗎？`);
        if (ok) {
          // 3. 使用者確認後，才正式寫入資料
          writeSlot(saveTab, i, payload);
          renderSaveSlots();
        }
      }
    }));
  }
}

/***********************
 * Slot Card (shared)
 ***********************/
function makeSlotCard({ mode, slot, data, clickable, onClick }){
  const card = document.createElement("div");
  card.className = "slot" + (data ? "" : " empty");

  const no = document.createElement("div");
  no.className = "slot-no";
  no.textContent = String(slot).padStart(3, "0");

const thumb = document.createElement("div");
thumb.className = "thumb";

// ✅ 每次先清乾淨，避免殘留上一格的圖
thumb.style.backgroundImage = "";
thumb.textContent = "";

// ✅ 有存檔且有縮圖 → 顯示縮圖
if (data && data.thumb) {
  thumb.style.backgroundImage = `url(${data.thumb})`;
}
// ✅ 有存檔但沒有縮圖 → 顯示 Preview
else if (data) {
  thumb.textContent = "Preview";
}
// ✅ 完全沒有存檔 → 顯示 Empty
else {
  thumb.textContent = "Empty";
}


  const time = document.createElement("div");
  time.className = "time";
  time.textContent = data ? nowString(data.ts) : "—";

  const meta = document.createElement("div");
  meta.className = "meta";
  if(data){
    meta.textContent = `章節：${data.meta?.label ?? "?"}　角色：${data.meta?.speaker ?? "?"}`;
  }else{
    meta.textContent = (mode === "quick") ? "快速存檔格" : "一般存檔格";
  }

  const snip = document.createElement("div");
  snip.className = "snippet";
  snip.textContent = data ? `「${data.meta?.snippet ?? ""}」` : "（沒有存檔）";

  card.appendChild(no);
  card.appendChild(thumb);
  card.appendChild(time);
  card.appendChild(meta);
  card.appendChild(snip);

  if(clickable){
    card.addEventListener("click", onClick);
  }else{
    card.addEventListener("click", ()=> alert("這個格子是空的。"));
  }

  return card;
}

/***********************
 * Quick Save button behavior
 * 規則：如果有空格 → 填第一個空格
 * 若全滿 → 覆蓋第 1 格（你也可改成覆蓋最舊）
 ***********************/
async function quickSave(){
  // 先抓出 1~12 的資料
  const slots = [];
  for(let i=1;i<=QUICK_SLOTS;i++){
    const data = readSlot("quick", i);
    slots.push({ i, data });
  }

  // 先找空格
  let target = slots.find(s => !s.data)?.i;

  // 都滿了就覆蓋最舊（ts 最小）
  if(!target){
    slots.sort((a,b) => (a.data?.ts ?? 0) - (b.data?.ts ?? 0));
    target = slots[0].i;
  }

  const payload = await makePayload(); // 可能 thumb 會是 null，但也照樣可存
  writeSlot("quick", target, payload);

  alert(`已快速存檔到 Q.Save ${String(target).padStart(3,"0")}`);
}


/***********************
 * Wire buttons
 ***********************/
// Title
document.querySelector("#btn-start").addEventListener("click", ()=>{
  state = { label:"start", index:0, lastLine:{name:"", text:""} };
  showScreen("game");
  step();
});
document.querySelector("#btn-open-load").addEventListener("click", ()=>{
  loadTab = "normal";
  showScreen("load");
  renderLoadSlots();
});
document.querySelector("#btn-open-credits").addEventListener("click", ()=> showScreen("credits"));
document.querySelector("#btn-exit").addEventListener("click", ()=>{
  alert("網頁版無法直接『離開遊戲』。\n你可以用：Ctrl+W（關閉分頁）或 Alt+F4（關閉視窗）。");
});

// Credits back
document.querySelector("#btn-back-title-1").addEventListener("click", ()=> showScreen("title"));

// Game
document.querySelector("#btn-next").addEventListener("click", step);
document.querySelector("#btn-back-title-2").addEventListener("click", ()=> showScreen("title"));

document.querySelector("#btn-open-load-2").addEventListener("click", ()=>{
  loadTab = "normal";
  showScreen("load");
  renderLoadSlots();
});

document.querySelector("#btn-open-save").addEventListener("click", ()=>{
  saveTab = "normal";
  showScreen("save");
  renderSaveSlots();
});
document.querySelector("#btn-quick-save").addEventListener("click", quickSave);

// Load close
document.querySelector("#btn-close-load").addEventListener("click", ()=> showScreen("title"));
// Save close
document.querySelector("#btn-close-save").addEventListener("click", ()=> showScreen("game"));

// Load tabs
document.querySelectorAll("#screen-load .tab[data-tab]").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    loadTab = btn.getAttribute("data-tab");
    renderLoadSlots();
  });
});

// Save tabs
document.querySelectorAll("#screen-save .tab[data-save-tab]").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    saveTab = btn.getAttribute("data-save-tab");
    renderSaveSlots();
  });
});

/***********************
 * Init
 ***********************/
showScreen("title");
