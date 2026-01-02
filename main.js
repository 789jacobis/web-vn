/***********************
 * CONFIG
 ***********************/
const NORMAL_SLOTS = 12;
const QUICK_SLOTS = 12;

// 存檔 key 前綴
const KEY_NORMAL = "webvn_save_normal_";
const KEY_QUICK  = "webvn_save_quick_";

// 打字機設定
const TEXT_SPEED = 50; 
let isTyping = false;   
let typingTimer = null; 
let currentFullText = ""; 

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
  index: 0,          
  lastLine: { name:"", text:"" } 
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

// ✅ 整合修正後的 renderNode
function renderNode(node){
  if(node.jump){
    state.label = node.jump;
    state.index = 0;
    return step();
  }
  
  const name = node.name ?? "";
  const text = node.text ?? "";

  $uiName.textContent = name;
  startTyping(text); // 啟動打字機
  state.lastLine = { name, text };

  clearChoices();

  if(node.choices && node.choices.length){
    $btnNext.style.display = "none";
    node.choices.forEach(c=>{
      const btn = document.createElement("button");
      btn.className = "choice";
      btn.textContent = c.label;
      btn.addEventListener("click", ()=>{
        completeTyping(); // 點擊選項前先停止打字
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

// ✅ 修正後的打字機函式
function startTyping(text) {
  if (typingTimer) clearTimeout(typingTimer); 
  isTyping = true;
  currentFullText = text;
  $uiText.textContent = ""; 
  
  let i = 0;
  function type() {
    if (i < text.length) {
      $uiText.textContent += text.charAt(i);
      i++;
      typingTimer = setTimeout(type, TEXT_SPEED);
    } else {
      isTyping = false;
      typingTimer = null;
    }
  }
  type();
}

function completeTyping() {
  if (typingTimer) clearTimeout(typingTimer);
  $uiText.textContent = currentFullText;
  isTyping = false;
  typingTimer = null;
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
    thumb,
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

// ✅ 修正後的縮圖擷取 (解決 hidden 無法擷取的問題)
async function captureStageThumbnail(){
  if(!window.html2canvas || !$stage) return null;
  const wasHidden = screens.game.classList.contains("hidden");
  if (wasHidden) {
    screens.game.classList.remove("hidden");
    void screens.game.offsetWidth; 
  }
  try{
    await new Promise(requestAnimationFrame);
    await new Promise(requestAnimationFrame);
    const canvas = await html2canvas($stage, {
      backgroundColor: null, 
      scale: 1,              
      useCORS: true
    });
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
    if (wasHidden) screens.game.classList.add("hidden");
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
 * LOAD UI
 ***********************/
let loadTab = "normal"; 
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
        loadFrom(loadTab, i);
      }
    }));
  }
}

function loadFrom(mode, slot){
  const data = readSlot(mode, slot);
  if(!data || !data.state) return alert("這個存檔是空的。");
  state.label = data.state.label;
  state.index = data.state.index;
  state.lastLine = data.state.lastLine ?? { name:"", text:"" };
  const scene = story[state.label];
  const shownIndex = Math.max(0, state.index - 1);
  const node = scene?.[shownIndex];
  showScreen("game");
  if(node) renderNode(node);
  else step();
}

/***********************
 * SAVE UI
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
        // ✅ 修正：先擷取 payload 再 confirm
        const payload = await makePayload(); 
        const ok = confirm(`要覆蓋 ${saveTab === "quick" ? "Q.Save" : "Save"} Slot ${String(i).padStart(3,"0")} 嗎？`);
        if (ok) {
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
  thumb.style.backgroundImage = (data && data.thumb) ? `url(${data.thumb})` : "";
  thumb.textContent = data ? (data.thumb ? "" : "Preview") : "Empty";
  const time = document.createElement("div");
  time.className = "time";
  time.textContent = data ? nowString(data.ts) : "—";
  const meta = document.createElement("div");
  meta.className = "meta";
  meta.textContent = data ? `章節：${data.meta?.label ?? "?"} 角色：${data.meta?.speaker ?? "?"}` : (mode === "quick" ? "快速存檔格" : "一般存檔格");
  const snip = document.createElement("div");
  snip.className = "snippet";
  snip.textContent = data ? `「${data.meta?.snippet ?? ""}」` : "（沒有存檔）";
  card.append(no, thumb, time, meta, snip);
  card.addEventListener("click", onClick);
  return card;
}

async function quickSave(){
  const slots = [];
  for(let i=1;i<=QUICK_SLOTS;i++) slots.push({ i, data: readSlot("quick", i) });
  let target = slots.find(s => !s.data)?.i;
  if(!target){
    slots.sort((a,b) => (a.data?.ts ?? 0) - (b.data?.ts ?? 0));
    target = slots[0].i;
  }
  const payload = await makePayload();
  writeSlot("quick", target, payload);
  alert(`已快速存檔到 Q.Save ${String(target).padStart(3,"0")}`);
}

/***********************
 * Wire buttons
 ***********************/
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
document.querySelector("#btn-exit").addEventListener("click", ()=> alert("請手動關閉分頁。"));
document.querySelector("#btn-back-title-1").addEventListener("click", ()=> showScreen("title"));

// ✅ 修改後的下一句按鈕邏輯
document.querySelector("#btn-next").addEventListener("click", () => {
  if (isTyping) completeTyping();
  else step();
});
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
document.querySelector("#btn-close-load").addEventListener("click", ()=> showScreen("title"));
document.querySelector("#btn-close-save").addEventListener("click", ()=> showScreen("game"));

document.querySelectorAll("#screen-load .tab[data-tab]").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    loadTab = btn.getAttribute("data-tab");
    renderLoadSlots();
  });
});
document.querySelectorAll("#screen-save .tab[data-save-tab]").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    saveTab = btn.getAttribute("data-save-tab");
    renderSaveSlots();
  });
});

showScreen("title");
