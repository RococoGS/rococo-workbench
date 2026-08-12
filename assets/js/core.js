/* ============================================================
   Rococo 个人工作台  ·  core.js
   工具函数 / 状态 / 导航 / 总览
   （经典脚本，与 modules.js、events.js 共享全局作用域）
   ============================================================ */
const STORE_KEY = "rococo_workbench_v1";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

/* ---------- 工具函数 ---------- */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const pad = (n) => String(n).padStart(2, "0");
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
);
const num = (n) => Number(n || 0);
const money = (n) => "¥" + Number(n || 0).toLocaleString("zh-CN", { maximumFractionDigits: 2 });
const weekdayName = (i) => ["周一", "周二", "周三", "周四", "周五", "周六", "周日"][i];
const todayWeekday = () => (new Date().getDay() + 6) % 7; // 0=周一
/* 本周一 00:00 ~ 下周一 00:00（左闭右开，ISO 日期串可直接比较） */
const weekRange = () => {
  const now = new Date();
  const dow = now.getDay(); // 0=Sun..6=Sat
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((dow + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  const nextMon = new Date(monday);
  nextMon.setDate(monday.getDate() + 7);
  const fmt = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  return [fmt(monday), fmt(nextMon)];
};

const budgetTotal = (o) => num(o && o.essentials) + num(o && o.rent) + num(o && o.emotion) + num(o && o.other);
const monthLabel = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const weekLabel = () => { const [mon] = weekRange(); return `${mon} 周`; };

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove("show"), 1900);
}

/* ---------- 状态 ---------- */
function defaultState() {
  return {
    profile: { name: "Rococo" },
    mood: {},        // {date:{emoji,text}}
    todos: [],       // {id,text,done,order}
    budget: {
      monthly: { essentials: 0, rent: 0, emotion: 0, other: 0 },
      weekly: { essentials: 0, rent: 0, emotion: 0, other: 0 },
      wallets: { wechat: 0, alipay: 0, card1: 0, card2: 0 },
      deposits: [], // {id,date,wallet,amount,note}
      history: [],  // {id,type:'monthly'|'weekly',label,date,amounts:{essentials,rent,emotion,other},total}
    },
    bills: {
      income: [],  // {id,month,amount,source}
      expense: [], // {id,date,amount,category,note}
      categories: ["餐饮", "交通", "购物", "居住", "娱乐", "医疗", "其他"],
    },
    recipes: {},    // {"0":{breakfast,lunch,dinner}}  按周几(0-6)
    recipesHistory: [], // {id,label,date,data:{"0":{breakfast,lunch,dinner}}}
    health: {
      periods: [],  // {id,start,days}
      weights: [],  // {id,date,value}
      workouts: [], // {id,date,type}
      steps: {},    // {date:number}
    },
    inspiration: [], // {id,date,text}
    media: [],       // {id,date,type,title,rating,note}
    books: [],       // {id,date,title,rating,note}
    games: [],       // {id,name,icon,rating,review,attraction,progress,note}
  };
}

let state = defaultState();  // 启动时只持有空壳，绝不预载明文数据，杜绝解锁前数据泄露

/* ---------- 单密码 · 客户端加密 · 云端同步 ---------- */
let sb = null;
let sessionKey = null;       // AES-GCM CryptoKey（仅存于内存）
let sessionPassword = "";    // 仅存于内存，绝不外发
let lastSyncTime = null;
let cloudBroken = false;
let pushTimer = null;

// 固定盐：保证同一密码在任意设备推导出同一把密钥（跨设备可解密）
const SYNC_SALT = new TextEncoder().encode("RococoWorkbenchSyncSalt_v1_2026");
// 单用户固定行：所有同步数据都读写这一行
const FIXED_USER_ID = "00000000-0000-0000-0000-000000000001";

function initSupabase() {
  try {
    if (typeof supabase !== "undefined" && supabase.createClient) {
      sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      return true;
    }
  } catch (e) {}
  console.warn("Supabase 不可用，进入离线模式");
  return false;
}

/* 旧版本数据兼容迁移 */
function migrate(s) {
  // 预算管理：旧的数字字段 -> 新的 4 分类对象
  if (s.budget && typeof s.budget.monthly === "number") {
    const old = s.budget;
    s.budget = {
      monthly: { essentials: 0, rent: 0, emotion: 0, other: num(old.monthly) },
      weekly: { essentials: 0, rent: 0, emotion: 0, other: num(old.weekly) },
      wallets: old.wallets || { wechat: 0, alipay: 0, card1: 0, card2: 0 },
      deposits: old.deposits || [],
      history: [],
    };
  }
  // 收入：旧的 month 字段 -> date 字段
  if (s.bills && Array.isArray(s.bills.income)) {
    s.bills.income = s.bills.income.map((i) => (i.month && !i.date ? { ...i, date: i.month + "-01" } : i));
  }
  if (!Array.isArray(s.recipesHistory)) s.recipesHistory = [];
  if (!Array.isArray(s.games)) s.games = [];
  return s;
}
/* 本地只存密文：先加密再落盘，密码错误者即使翻本机也看不到明文 */
async function saveLocal() {
  if (!sessionKey) return;
  try {
    const payload = await encryptState(state, sessionKey);
    localStorage.setItem(STORE_KEY, JSON.stringify(payload));
  } catch (e) { toast("保存失败：本地存储不可用"); }
}
function readLocalRaw() {
  try { return localStorage.getItem(STORE_KEY); } catch (e) { return null; }
}
function save() {
  saveLocal();                       // 异步加密落盘
  if (sb && sessionKey) pushCloud(); // 自动同步（防抖）
}

/* ---------- 加密工具（AES-GCM + PBKDF2，密码永不外发） ---------- */
function bufToB64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
function b64ToBuf(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}
async function deriveKey(password) {
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: SYNC_SALT, iterations: 150000, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]
  );
}
async function encryptState(obj, key) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(JSON.stringify(obj));
  const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, plain);
  return { v: 1, iv: bufToB64(iv), cipher: bufToB64(cipher) };
}
async function decryptState(payload, key) {
  const iv = new Uint8Array(b64ToBuf(payload.iv));
  const cipher = b64ToBuf(payload.cipher);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipher);
  return JSON.parse(new TextDecoder().decode(plain));
}

/* ---------- 云端读写 ---------- */
function pushCloud() {
  if (!sb || !sessionKey) return;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => {
    encryptState(state, sessionKey)
      .then((payload) => sb.from("workbench_state")
        .upsert({ user_id: FIXED_USER_ID, data: payload, updated_at: new Date().toISOString() }))
      .then(({ error }) => {
        if (error) { console.warn("云端保存失败", error.message); return; }
        lastSyncTime = new Date();
        updateSyncStatus();
      })
      .catch((e) => console.warn("云端保存失败", e && e.message));
  }, 600);
}
async function pullCloud() {
  if (!sb || !sessionKey) return null;
  const { data, error } = await sb.from("workbench_state").select("data").eq("user_id", FIXED_USER_ID).single();
  if (error) return null; // 无行 / 网络错误
  if (data && data.data) {
    if (data.data.cipher) {
      try { return await decryptState(data.data, sessionKey); }
      catch (e) { return { __error: "decrypt" }; } // 密码不一致：解密失败
    }
    return data.data; // 旧版未加密数据：直接采用，稍后加密覆盖
  }
  return null; // 云端为空
}

/* ---------- 解锁 / 同步 ---------- */
function setAuthMsg(msg, ok) {
  const el = $("#authMsg");
  if (!el) return;
  el.textContent = msg || "";
  el.className = "auth-msg" + (ok ? " ok" : "");
}
async function doUnlock() {
  const pwd = ($("#authPwd").value || "").trim();
  if (!pwd) { setAuthMsg("请输入同步密码"); return; }
  setAuthMsg("正在验证…");
  let key;
  try { key = await deriveKey(pwd); }
  catch (e) { setAuthMsg("当前浏览器不支持加密，请换用现代浏览器"); return; }

  // 读取本地原始数据：可能是密文 / 旧明文 / 空
  const raw = readLocalRaw();
  let localEnc = null, localPlain = null;
  if (raw) {
    try {
      const p = JSON.parse(raw);
      if (p && p.cipher) localEnc = p;
      else if (p && typeof p === "object") localPlain = p;
    } catch (e) {}
  }

  // 尝试用云端密文验证密码（云端只存密文，密码错误必解密失败）
  let cloudState = null, cloudFail = false, cloudEmpty = false, cloudReachable = false;
  if (sb) {
    try {
      const { data, error } = await sb.from("workbench_state").select("data").eq("user_id", FIXED_USER_ID).single();
      cloudReachable = true;
      if (!error && data && data.data) {
        if (data.data.cipher) {
          try { cloudState = await decryptState(data.data, key); }
          catch (e) { cloudFail = true; }   // 密码错误 → 无法解密
        } else {
          cloudState = data.data;           // 兼容旧版明文
        }
      } else { cloudEmpty = true; }
    } catch (e) { cloudReachable = false; }
  }

  // —— 严格决策：密码不对，绝不解锁、绝不留出任何数据 ——
  if (cloudReachable && cloudFail) { setAuthMsg("密码错误：无法解密云端数据"); return; }
  if (cloudReachable && cloudState) { state = Object.assign(defaultState(), cloudState); commitUnlock(key, pwd, true); return; }
  if (localEnc) {
    try { const obj = await decryptState(localEnc, key); state = Object.assign(defaultState(), obj); commitUnlock(key, pwd, false); }
    catch (e) { setAuthMsg("密码错误：无法解密本机数据"); }
    return;
  }
  if (localPlain) { state = Object.assign(defaultState(), migrate(localPlain)); commitUnlock(key, pwd, false); return; }
  if (cloudReachable && cloudEmpty) { state = defaultState(); commitUnlock(key, pwd, false); return; }
  setAuthMsg("无法连接云端且本机无数据，请联网后再试");
}

/* 验证通过后才真正解锁并渲染 —— 在此之前工作台不会显示任何数据 */
function commitUnlock(key, pwd, adoptedCloud) {
  sessionKey = key;
  sessionPassword = pwd;
  showAuth(false);
  saveLocal();                 // 立即把状态以密文落盘（覆盖旧明文）
  renderNav(); render();
  updateSyncStatus();
  lastSyncTime = new Date();
  cloudBroken = false;
  if (sb) pushCloud();         // 与云端对齐（自愈被错误密钥覆盖的行）
  toast(adoptedCloud ? "已同步云端数据 ☁" : "已进入工作台");
}
async function manualSync() {
  if (!sb) { toast("当前离线，无法同步"); return; }
  if (!sessionKey) { toast("请先解锁工作台"); return; }
  setSyncStatus("syncing");
  try {
    const payload = await encryptState(state, sessionKey);
    const { error } = await sb.from("workbench_state")
      .upsert({ user_id: FIXED_USER_ID, data: payload, updated_at: new Date().toISOString() });
    if (error) throw error;
    const cloud = await pullCloud();
    if (cloud && !cloud.__error) {
      state = Object.assign(defaultState(), cloud);
      try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
      renderNav(); render();
    }
    lastSyncTime = new Date();
    updateSyncStatus();
    if (typeof isMobile === "function" && isMobile()) showSyncTip(true);
    toast("已同步 ✔");
  } catch (e) {
    setSyncStatus("error");
    if (typeof isMobile === "function" && isMobile()) showSyncTip(true);
    toast("同步失败：" + (e.message || "请检查网络"));
  }
}
function setSyncStatus(s) {
  if (s === "syncing") {
    const b = $("#syncBtn"); if (b) b.classList.add("spin");
    const el = $("#syncTip"); if (el) { el.textContent = "同步中…"; el.className = "sync-tip syncing"; }
  } else if (s === "error") {
    const b = $("#syncBtn"); if (b) b.classList.remove("spin");
    const el = $("#syncTip"); if (el) { el.textContent = "同步失败"; el.className = "sync-tip err"; }
  } else {
    const b = $("#syncBtn"); if (b) b.classList.remove("spin");
    updateSyncStatus();
  }
}
function updateSyncStatus() {
  const el = $("#syncTip"); if (!el) return;
  let text = "点击同步", cls = "";
  if (!sb) { text = "离线"; cls = "offline"; }
  else if (lastSyncTime) { text = "已同步 " + lastSyncTime.toTimeString().slice(0, 5); cls = "ok"; }
  el.textContent = text;
  el.className = "sync-tip " + cls;
}
function showSyncTip(autoHide) {
  const el = $("#syncTip"); if (!el) return;
  updateSyncStatus();
  el.classList.add("show");
  if (autoHide) { clearTimeout(el._h); el._h = setTimeout(() => el.classList.remove("show"), 2600); }
}
function hideSyncTip() {
  const el = $("#syncTip"); if (el) el.classList.remove("show");
}
function doLogout() {
  sessionKey = null; sessionPassword = ""; lastSyncTime = null; cloudBroken = false;
  showAuth(true);
}
function showAuth(show) {
  const ov = $("#authOverlay");
  if (ov) ov.classList.toggle("show", show);
}
function startAuth() { showAuth(true); }

/* ---------- 导航（左侧手风琴） ---------- */
let curModule = "overview";
let openGroups = new Set(["daily"]); // 默认展开「日常」；多个模块可同时展开
let curSub = { overview: "overview", daily: "mood", life: "budget", inspiration: "insp" };
let curGameId = null; // 游戏之旅：当前选中的游戏

const SUB_LABEL = {
  overview: "总览", mood: "今日心情", todo: "待办事项",
  budget: "预算管理", bill: "账单管理", recipe: "一周食谱", health: "健康管理",
  insp: "灵感浮窗", media: "漫与乐", book: "千书千感", game: "游戏之旅",
};
/* 模块 / 功能 下方的一句话解释 */
const SUB_TAGLINE = {
  overview: "我与我的未来，都在这里。",
  mood: "也无风雨也无晴。",
  todo: "这里需要全部做掉。",
  budget: "准备怎么花钱、怎么存钱。",
  bill: "花了多少、结余多少。",
  recipe: "早上吃啥、中午吃啥、晚上吃啥。",
  health: "身体才是革命的本钱。",
  insp: "心有灵犀一点通。",
  media: "精神费洛蒙与伊甸园的蛇。",
  book: "好看、爱看、多看。",
  game: "记录每一个正在通关的世界。",
};
const MODULE_TITLE = { daily: "日常", life: "生活", inspiration: "灵感星球" };
const MODULE_DESC = {
  daily: "记录此刻心情，打理每日待办",
  life: "预算 · 账单 · 食谱 · 健康，把生活打理得井井有条",
  inspiration: "收藏每一个闪现的灵感与心动",
};

/* 左导航结构：大模块 + 子功能 */
const NAV = [
  { module: "overview", icon: "☁", label: "总览", single: true },
  { module: "daily", icon: "🐾", label: "日常", children: [
    { sub: "mood", ico: "😊", label: "今日心情" },
    { sub: "todo", ico: "📝", label: "待办事项" },
  ]},
  { module: "life", icon: "🍥", label: "生活", children: [
    { sub: "budget", ico: "💰", label: "预算管理" },
    { sub: "bill", ico: "🧾", label: "账单管理" },
    { sub: "recipe", ico: "🍱", label: "一周食谱" },
    { sub: "health", ico: "💗", label: "健康管理" },
  ]},
  { module: "inspiration", icon: "✨", label: "灵感星球", children: [
    { sub: "insp", ico: "✺", label: "灵感浮窗" },
    { sub: "media", ico: "🎬", label: "漫与乐" },
    { sub: "book", ico: "📚", label: "千书千感" },
    { sub: "game", ico: "🎮", label: "游戏之旅" },
  ]},
];

function renderNav() {
  const nav = $("#nav");
  if (!nav) return;
  nav.innerHTML = NAV.map((g) => {
    if (g.single) {
      return `<button class="nav-item ${curModule === g.module ? "is-active" : ""}" data-module="${g.module}">
        <span class="nav-ico">${g.icon}</span><span class="nav-txt">${g.label}</span></button>`;
    }
    const isOpen = openGroups.has(g.module);
    const kids = isOpen
      ? `<div class="nav-children">${g.children
          .map(
            (c) => `<button class="nav-child ${curModule === g.module && curSub[g.module] === c.sub ? "is-active" : ""}" data-module="${g.module}" data-sub="${c.sub}">
              <span class="nav-c-ico">${c.ico}</span><span>${c.label}</span></button>`
          )
          .join("")}</div>`
      : "";
    return `<div class="nav-group ${isOpen ? "open" : ""}">
      <button class="nav-item" data-toggle="${g.module}">
        <span class="nav-ico">${g.icon}</span><span class="nav-txt">${g.label}</span>
        <span class="nav-caret">${isOpen ? "▾" : "▸"}</span>
      </button>${kids}
    </div>`;
  }).join("");
}

function setModule(m) {
  curModule = m;
  renderNav();
  render();
}

function selectSub(module, sub) {
  curModule = module;
  curSub[module] = sub;
  openGroups.add(module);
  renderNav();
  render();
}

function moduleBody() {
  if (curModule === "overview") return renderOverview();
  if (curModule === "daily") return renderDaily(curSub.daily);
  if (curModule === "life") return renderLife(curSub.life);
  if (curModule === "inspiration") return renderInspiration(curSub.inspiration);
  return "";
}

function render() {
  const c = $("#content");
  let head = "", body = "";
  if (curModule === "overview") {
    head = `<div class="page-head"><div class="page-title">总览</div><div class="page-desc">${SUB_TAGLINE.overview}</div></div>`;
    body = renderOverview();
  } else {
    const sub = curSub[curModule];
    head = `<div class="page-head"><div class="page-title">${SUB_LABEL[sub] || MODULE_TITLE[curModule]}</div><div class="page-desc">${SUB_TAGLINE[sub] || ""}</div></div>`;
    body = moduleBody();
  }
  c.innerHTML = head + body;
  afterRender();
}

/* ============================================================
   总览
   ============================================================ */
function greeting() {
  const h = new Date().getHours();
  if (h < 5) return ["夜深了", "早点休息，明天又是新的一天"];
  if (h < 11) return ["早上好", "新的一天，从好心情开始 ☀"];
  if (h < 14) return ["中午好", "记得好好吃饭，给自己一点喘息"];
  if (h < 18) return ["下午好", "今天，又是美好的一天。"];
  if (h < 22) return ["晚上好", "放慢节奏，享受属于你的时光 ✦"];
  return ["夜深了", "今天的疲惫，交给一个好梦"];
}

/* 灵感抓取池：推理小说推荐语 / 动漫人物经典台词 / 古诗词 */
const INSPO_POOL = [
  /* ---- 推理小说推荐语 ---- */
  { cat: "mystery", tag: "推理", c: "#7e8ef0", h: "《无人生还》· 阿加莎·克里斯蒂", d: "暴风雨孤岛，一首童谣收割十条人命——暴风雪山庄模式的巅峰。" },
  { cat: "mystery", tag: "推理", c: "#7e8ef0", h: "《东方快车谋杀案》· 阿加莎·克里斯蒂", d: "十二个人的审判，一个人的正义，结局在最后一页击中你。" },
  { cat: "mystery", tag: "推理", c: "#7e8ef0", h: "《白夜行》· 东野圭吾", d: "我的天空里没有太阳，总是黑夜。读完久久无法平静。" },
  { cat: "mystery", tag: "推理", c: "#7e8ef0", h: "《嫌疑人X的献身》· 东野圭吾", d: "最精密的诡计，包裹着最笨拙的爱。" },
  { cat: "mystery", tag: "推理", c: "#7e8ef0", h: "《占星术杀人魔法》· 岛田庄司", d: "华丽到近乎不可能的本格谜题，新本格的开山之作。" },
  { cat: "mystery", tag: "推理", c: "#7e8ef0", h: "《恶意》· 东野圭吾", d: "动机比凶案更令人不寒而栗，人心是最深的迷宫。" },
  { cat: "mystery", tag: "推理", c: "#7e8ef0", h: "《钟表馆事件》· 绫辻行人", d: "在滴答作响的馆中，时间才是真正的凶手。" },
  { cat: "mystery", tag: "推理", c: "#7e8ef0", h: "《罗杰疑案》· 阿加莎·克里斯蒂", d: "叙述性诡计的鼻祖，读到最后头皮发麻。" },
  /* ---- 动漫人物经典台词 ---- */
  { cat: "quote", tag: "台词", c: "#ef9bc0", h: "五条悟 ·《咒术回战》", d: "没关系，我是最强的。" },
  { cat: "quote", tag: "台词", c: "#ef9bc0", h: "江户川柯南 ·《名侦探柯南》", d: "真相只有一个！" },
  { cat: "quote", tag: "台词", c: "#ef9bc0", h: "路飞 ·《海贼王》", d: "我是要成为海贼王的男人！" },
  { cat: "quote", tag: "台词", c: "#ef9bc0", h: "坂田银时 ·《银魂》", d: "与其想着怎么漂亮地死去，不如挣扎着活到最后一刻。" },
  { cat: "quote", tag: "台词", c: "#ef9bc0", h: "宫水三叶 ·《你的名字。》", d: "只要记住你的名字，不管你在世界哪个角落，我都一定会去见你。" },
  { cat: "quote", tag: "台词", c: "#ef9bc0", h: "夏目贵志 ·《夏目友人帐》", d: "温柔，本身就是一种力量。" },
  { cat: "quote", tag: "台词", c: "#ef9bc0", h: "利威尔 ·《进击的巨人》", d: "做出不会让自己后悔的选择就好。" },
  { cat: "quote", tag: "台词", c: "#ef9bc0", h: "荻野千寻 ·《千与千寻》", d: "名字一旦被夺走，就找不到回家的路了。" },
  /* ---- 古诗词 ---- */
  { cat: "poem", tag: "诗词", c: "#4cc28b", h: "且将新火试新茶，诗酒趁年华。", d: "苏轼《望江南·超然台作》" },
  { cat: "poem", tag: "诗词", c: "#4cc28b", h: "人间有味是清欢。", d: "苏轼《浣溪沙·细雨斜风作晓寒》" },
  { cat: "poem", tag: "诗词", c: "#4cc28b", h: "行到水穷处，坐看云起时。", d: "王维《终南别业》" },
  { cat: "poem", tag: "诗词", c: "#4cc28b", h: "醉后不知天在水，满船清梦压星河。", d: "唐温如《题龙阳县青草湖》" },
  { cat: "poem", tag: "诗词", c: "#4cc28b", h: "我见青山多妩媚，料青山见我应如是。", d: "辛弃疾《贺新郎·甚矣吾衰矣》" },
  { cat: "poem", tag: "诗词", c: "#4cc28b", h: "疏影横斜水清浅，暗香浮动月黄昏。", d: "林逋《山园小梅》" },
  { cat: "poem", tag: "诗词", c: "#4cc28b", h: "春水碧于天，画船听雨眠。", d: "韦庄《菩萨蛮·人人尽说江南好》" },
  { cat: "poem", tag: "诗词", c: "#4cc28b", h: "人生自是有情痴，此恨不关风与月。", d: "欧阳修《玉楼春·尊前拟把归期说》" },
];
/* 每批 4 条：三类各随机取一条 + 剩余里再随机一条，最后洗牌 */
function inspoHtml() {
  const cats = ["mystery", "quote", "poem"];
  const picked = cats.map((c) => {
    const arr = INSPO_POOL.filter((x) => x.cat === c);
    return arr[Math.floor(Math.random() * arr.length)];
  });
  const rest = INSPO_POOL.filter((x) => !picked.includes(x));
  picked.push(rest[Math.floor(Math.random() * rest.length)]);
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [picked[i], picked[j]] = [picked[j], picked[i]];
  }
  return picked.map((n) => `<div class="news">
      <span class="news-tag" style="background:${n.c}">${n.tag}</span>
      <div class="news-body"><div class="news-h">${esc(n.h)}</div><div class="news-d">${esc(n.d)}</div></div>
    </div>`).join("");
}

/* 在追影音：状态值展示「最近剧/动漫 + 最近音乐」 */
function mediaValHtml(d, m) {
  const dn = d ? esc(d.title) : "—";
  const mn = m ? esc(m.title) : "—";
  return `<span class="mv-line mv-drama">▸ ${dn}</span><span class="mv-line mv-music">♪ ${mn}</span>`;
}
function mediaTip(d, m) {
  const parts = [];
  if (d) parts.push(`最近剧/动漫：《${esc(d.title)}》`);
  if (m) parts.push(`最近音乐：《${esc(m.title)}》`);
  return parts.length ? parts.join("　") : "去「灵感星球·漫与乐」记录剧 / 动漫 / 音乐吧";
}

function renderOverview() {
  const [gt, gs] = greeting();
  const t = todayStr();

  const mood = state.mood[t];
  const todos = state.todos;
  const todoDone = todos.filter((x) => x.done).length;
  const month = t.slice(0, 7);
  // 本周支出（本周一 ~ 下周一，左闭右开，ISO 日期串可直接比较）
  const [wkStart, wkEnd] = weekRange();
  const weekExp = state.bills.expense
    .filter((e) => e.date >= wkStart && e.date < wkEnd)
    .reduce((a, e) => a + num(e.amount), 0);
  const weights = [...state.health.weights].sort((a, b) => (a.date < b.date ? 1 : -1));
  const lastWeight = weights[0];
  const steps = num(state.health.steps[t]);
  const cal = (steps * 0.04).toFixed(0);
  const inspToday = state.inspiration.filter((x) => x.date === t).length;
  // 最近记录的剧/动漫 与 音乐
  const mediaSorted = [...state.media].sort((a, b) => (a.date < b.date ? 1 : -1));
  const lastDrama = mediaSorted.find((m) => m.type === "drama" || m.type === "anime");
  const lastMusic = mediaSorted.find((m) => m.type === "music");
  const booksSorted = [...state.books].sort((a, b) => (a.date < b.date ? 1 : -1));
  const lastBook = booksSorted[0];
  const weekBudget = budgetTotal(state.budget.weekly);
  const weekBudgetPct = weekBudget > 0 ? Math.min(100, (weekExp / weekBudget) * 100) : 0;

  const stats = [
    { ico: "☀", label: "今日心情", val: mood ? mood.emoji : "—", tip: mood ? `今日心情：${esc(mood.text || "（未写文字）")}` : "今天还没记录心情，去「日常·今日心情」记一下吧" },
    { ico: "✓", label: "待办进度", val: `${todoDone}<small>/${todos.length}</small>`, tip: todos.length ? `已完成 ${todoDone} 项，剩余 ${todos.length - todoDone} 项` : "暂无待办，轻装上阵" },
    { ico: "¥", label: "本周支出", val: money(Math.round(weekExp)), tip: weekBudget > 0 ? `周预算 ${money(weekBudget)}，已用 ${weekBudgetPct.toFixed(0)}%` : "尚未设置周预算" },
    { ico: "⚖", label: "最新体重", val: lastWeight ? lastWeight.value + "<small>kg</small>" : "—", tip: lastWeight ? `记录于 ${lastWeight.date}` : "去「生活·健康管理」记录体重" },
    { ico: "👟", label: "今日步数", val: steps ? steps.toLocaleString() : "—", tip: steps ? `约消耗 ${cal} 千卡` : "去健康模块记录今日步数" },
    { ico: "✺", label: "今日灵感", val: inspToday ? inspToday + "<small>条</small>" : "未记", tip: inspToday ? "今天已有灵感入账 🎉" : "灵感稍纵即逝，去记一条吧" },
    { ico: "🎬", label: "在追影音", val: mediaValHtml(lastDrama, lastMusic), tip: mediaTip(lastDrama, lastMusic) },
    { ico: "📚", label: "已读好书", val: lastBook ? esc(lastBook.title) : "—", tip: lastBook ? `最近在读：《${esc(lastBook.title)}》` : "千书千感 · 还没记录书" },
  ];
  const statHtml = stats
    .map(
      (s) => `<div class="stat">
        <div class="stat-ico">${s.ico}</div>
        <div class="stat-label">${s.label}</div>
        <div class="stat-value">${s.val}</div>
        <div class="stat-tip">${s.tip}</div>
      </div>`
    )
    .join("");

  return `
    <div class="clock-inpage" id="clockIn"></div>
    <div class="greet-box">
      <div class="deco-cloud" aria-hidden="true">☁</div>
      <span class="deco-star s1" aria-hidden="true">✦</span>
      <span class="deco-star s2" aria-hidden="true">✧</span>
      <span class="deco-star s3" aria-hidden="true">✦</span>
      <div class="deco-puppy" aria-hidden="true">
        <svg viewBox="0 0 120 120" width="100%" height="100%">
          <path d="M40 32 Q14 0 30 42 Q35 64 50 52 Z" fill="#fff" stroke="#cfeaff" stroke-width="3" stroke-linejoin="round"/>
          <path d="M80 32 Q106 0 90 42 Q85 64 70 52 Z" fill="#fff" stroke="#cfeaff" stroke-width="3" stroke-linejoin="round"/>
          <circle cx="60" cy="60" r="32" fill="#fff" stroke="#cfeaff" stroke-width="3"/>
          <path d="M38 86 Q60 100 82 86 L82 96 Q60 106 38 96 Z" fill="#5cb6ff"/>
          <circle cx="50" cy="58" r="3.6" fill="#3a4a66"/>
          <circle cx="70" cy="58" r="3.6" fill="#3a4a66"/>
          <circle cx="43" cy="68" r="4.5" fill="#ffd0da" opacity="0.85"/>
          <circle cx="77" cy="68" r="4.5" fill="#ffd0da" opacity="0.85"/>
          <path d="M53 68 Q60 75 67 68" stroke="#3a4a66" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        </svg>
      </div>
      <div class="greet-hi">${gt}，${esc(state.profile.name)}！</div>
      <div class="greet-sub">${gs}</div>
      <div class="stat-row">${statHtml}</div>
    </div>

    <div class="card" style="margin-top:22px">
      <div class="card-title">✨ 灵感抓取 <button class="btn ghost sm" data-action="news-refresh" style="margin-left:auto">换一批</button></div>
      <div class="card-sub">推理小说 · 动漫台词 · 古诗词，随手抓一把灵感</div>
      <div class="news-grid" id="newsGrid">${inspoHtml()}</div>
    </div>`;
}
