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

/********
