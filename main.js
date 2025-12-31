const $bg = document.querySelector("#bg");
const $ch = document.querySelector("#ch");
const $name = document.querySelector("#name");
const $text = document.querySelector("#text");
const $choices = document.querySelector("#choices");
const $next = document.querySelector("#next");

// 你可以先不放圖片：用純色背景 + 隱藏角色也能跑
function setStage({ bg, ch }) {
  if (bg) {
    $bg.src = bg;
    $bg.style.display = "block";
  } else {
    $bg.removeAttribute("src");
    $bg.style.display = "none";
  }

  if (ch) {
    $ch.src = ch;
    $ch.style.display = "block";
  } else {
    $ch.removeAttribute("src");
    $ch.style.display = "none";
  }
}

const story = {
  start: [
    { bg: null, ch: null, name: "旁白", text: "這是一個用 GitHub Pages 發佈的網頁視覺小說原型。" },
    { name: "旁白", text: "你可以先把文字流程做完，再慢慢補背景/立繪。" },
    {
      name: "旁白",
      text: "要不要進入測試分歧？",
      choices: [
        { label: "好啊，來分歧", jump: "branch" },
        { label: "先直走結局", jump: "endingA" }
      ]
    }
  ],
  branch: [
    { name: "你", text: "我選擇了分歧路線。" },
    { name: "旁白", text: "這裡之後可以加旗標、好感度、解鎖 CG。" },
    { name: "旁白", text: "先到結局 B。" },
    { jump: "endingB" }
  ],
  endingA: [
    { name: "旁白", text: "結局 A：你先把最小原型做完了。恭喜！" }
  ],
  endingB: [
    { name: "旁白", text: "結局 B：你完成了分歧，已經是一個可玩的 VN 了。" }
  ]
};

let label = "start";
let i = 0;

function clearChoices() {
  $choices.innerHTML = "";
}

function render(node) {
  // 圖片
  if ("bg" in node || "ch" in node) {
    setStage({ bg: node.bg ?? null, ch: node.ch ?? null });
  }

  // 跳轉
  if (node.jump) {
    label = node.jump;
    i = 0;
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
        label = c.jump;
        i = 0;
        step();
      });
      $choices.appendChild(btn);
    });
  } else {
    $next.style.display = "inline-block";
  }
}

function step() {
  const scene = story[label];
  if (!scene) {
    $name.textContent = "系統";
    $text.textContent = `找不到段落：${label}`;
    $next.style.display = "none";
    return;
  }

  if (i >= scene.length) {
    $name.textContent = "旁白";
    $text.textContent = "（已到段落結尾）";
    $next.style.display = "none";
    return;
  }

  const node = scene[i];
  i += 1;
  render(node);
}

$next.addEventListener("click", step);

// 開始
step();
