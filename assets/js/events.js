/* ============================================================
   Rococo 个人工作台  ·  events.js
   事件绑定 / 行为处理 / 拖拽 / 初始化
   ============================================================ */

function bindEvents() {
  // 导航（左侧手风琴）
  $("#nav").addEventListener("click", (e) => {
    const child = e.target.closest("[data-sub]");
    if (child) {
      selectSub(child.dataset.module, child.dataset.sub);
      if (isMobile()) setNav(true);
      return;
    }
    const toggle = e.target.closest("[data-toggle]");
    if (toggle) {
      const m = toggle.dataset.toggle;
      if (openGroups.has(m)) openGroups.delete(m); else openGroups.add(m);
      renderNav();
      return;
    }
    const single = e.target.closest(".nav-item[data-module]");
    if (single) {
      setModule(single.dataset.module);
      if (isMobile()) setNav(true);
    }
  });

  // 单密码解锁（回车亦可提交）
  const au = $("#authUnlock"); if (au) au.addEventListener("click", doUnlock);
  const ap = $("#authPwd"); if (ap) ap.addEventListener("keydown", (e) => { if (e.key === "Enter") doUnlock(); });
  // 同步小星星：点击立即手动同步（桌面 / 手机都生效）；桌面端额外悬浮显状态
  const syncBtn = $("#syncBtn");
  if (syncBtn) {
    syncBtn.addEventListener("click", () => { manualSync(); showSyncTip(true); });
    syncBtn.addEventListener("mouseenter", () => { if (!isMobile()) showSyncTip(false); });
    syncBtn.addEventListener("mouseleave", () => { if (!isMobile()) hideSyncTip(); });
  }

  // 侧边栏收起 / 展开
  $("#collapseBtn").addEventListener("click", toggleNav);
  $("#fabToggle").addEventListener("click", toggleNav);
  $("#backdrop").addEventListener("click", () => setNav(true));

  // 内容区点击（总览模块跳转 + 子标签 + 行为按钮）
  $("#content").addEventListener("click", (e) => {
    const card = e.target.closest(".stat[data-module]");
    if (card) {
      selectSub(card.dataset.module, card.dataset.sub);
      if (isMobile()) setNav(true);
      return;
    }
    const st = e.target.closest(".subtab");
    if (st) {
      curSub[curModule] = st.dataset.sub;
      render();
      return;
    }
    const act = e.target.closest("[data-action]");
    if (act) handleAction(act.dataset.action, act, e);
  });
  // 总览模块卡片支持键盘 Enter 跳转
  $("#content").addEventListener("keydown", (e) => {
    if (e.key !== "Enter") return;
    const card = e.target.closest(".stat[data-module]");
    if (card) { e.preventDefault(); card.click(); }
  });

  // 食谱输入框即时保存 + 历史筛选
  $("#content").addEventListener("input", (e) => {
    if (e.target.closest("[data-budget-filter-text], [data-recipe-filter-text]")) { applyHistFilter(e.target); return; }
    const di = e.target.closest(".day-input");
    if (di) {
      const d = di.dataset.day, meal = di.dataset.meal;
      state.recipes[d] = state.recipes[d] || {};
      state.recipes[d][meal] = di.value;
      save();
    }
  });

  // 预算分类金额（月度/周，4 类自动汇总）
  $("#content").addEventListener("change", (e) => {
    if (e.target.closest("[data-budget-filter-type]")) { applyHistFilter(e.target); return; }
    const bc = e.target.closest("[data-budget]");
    if (bc) {
      const type = bc.dataset.budget;
      const cat = bc.dataset.bcat;
      state.budget[type][cat] = num(bc.value);
      save();
      const box = bc.closest(".budget-box");
      if (box) {
        const b = state.budget[type];
        const total = budgetTotal(b);
        const te = box.querySelector(".budget-total b");
        if (te) te.textContent = money(total);
      }
      toast("预算已更新");
    }
  });

  // 侧边栏数据管理
  $(".sidebar-foot").addEventListener("click", (e) => {
    const b = e.target.closest("[data-action]");
    if (!b) return;
    if (b.dataset.action === "export-data") exportData();
    if (b.dataset.action === "reset-data") resetData();
    if (b.dataset.action === "import-data") importData();
    if (b.dataset.action === "logout") doLogout();
  });

  const importInput = $("#importFile");
  if (importInput) importInput.addEventListener("change", (e) => {
    const f = e.target.files && e.target.files[0];
    if (f) handleImportFile(f);
    e.target.value = "";
  });
}

function isMobile() { return window.innerWidth <= 980; }

/* 右上角实时时钟：2026年8月4日 星期二 15:00 */
function updateClock() {
  const wd = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  const d = new Date();
  const txt = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日 ${wd[d.getDay()]} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const el = $("#clock");
  if (el) el.textContent = txt;
  const ci = $("#clockIn");
  if (ci) ci.textContent = txt;
}
function toggleNav() { const app = $("#app"); app.classList.toggle("nav-collapsed"); updateNavBtns(); }
function setNav(collapsed) { const app = $("#app"); app.classList.toggle("nav-collapsed", collapsed); updateNavBtns(); }
function heartSvg(filled) {
  return `<svg viewBox="0 0 24 24" width="17" height="17" fill="${filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>`;
}
function updateNavBtns() {
  const collapsed = $("#app").classList.contains("nav-collapsed");
  const filled = !collapsed; // 菜单展开=实心，收起=描边
  const cb = $("#collapseBtn"); if (cb) cb.innerHTML = heartSvg(filled);
  const fb = $("#fabToggle"); if (fb) fb.innerHTML = heartSvg(filled);
}

function handleAction(action, el, e) {
  const t = todayStr();
  switch (action) {
    /* ---- 总览 ---- */
    case "news-refresh":
      $("#newsGrid").innerHTML = inspoHtml();
      toast("已为你换一批灵感 ✨");
      break;

    /* ---- 心情 ---- */
    case "mood-save": {
      const box = $("#moodEmojis");
      const sel = box ? box.querySelector(".sel") : null;
      const emoji = sel ? sel.dataset.emoji : null;
      const text = $("#moodText").value.trim();
      if (!emoji) { toast("先选一个表情哦"); return; }
      state.mood[t] = { emoji, text };
      save(); toast("今日心情已保存 💙");
      render();
      break;
    }
    case "mood-del":
      delete state.mood[el.dataset.date];
      save(); toast("已删除"); render();
      break;

    /* ---- 待办 ---- */
    case "todo-add": {
      const inp = $("#todoInput");
      const v = (inp.value || "").trim();
      if (!v) { toast("写点什么吧"); return; }
      const maxOrder = state.todos.reduce((m, x) => Math.max(m, x.order), 0);
      state.todos.push({ id: uid(), text: v, done: false, order: maxOrder + 1 });
      save(); render();
      break;
    }
    case "todo-toggle": {
      const it = state.todos.find((x) => x.id === el.dataset.id);
      if (it) { it.done = !it.done; save(); render(); }
      break;
    }
    case "todo-del":
      state.todos = state.todos.filter((x) => x.id !== el.dataset.id);
      save(); render();
      break;

    /* ---- 预算 ---- */
    case "dep-add": {
      const wallet = $("#depWallet").value;
      const amt = num($("#depAmt").value);
      if (amt <= 0) { toast("金额要大于 0"); return; }
      state.budget.wallets[wallet] += amt;
      state.budget.deposits.push({ id: uid(), date: t, wallet, amount: amt, note: $("#depNote").value.trim() });
      save(); toast("已存入 👛"); render();
      break;
    }
    case "dep-del": {
      const d = state.budget.deposits.find((x) => x.id === el.dataset.id);
      if (d) {
        state.budget.wallets[d.wallet] = Math.max(0, state.budget.wallets[d.wallet] - d.amount);
        state.budget.deposits = state.budget.deposits.filter((x) => x.id !== d.id);
        save(); render();
      }
      break;
    }

    /* ---- 账单 ---- */
    case "inc-add": {
      const date = $("#incDate").value.trim();
      const amt = num($("#incAmt").value);
      if (!date || amt <= 0) { toast("请填好日期和金额"); return; }
      state.bills.income.push({ id: uid(), date, amount: amt, source: $("#incSrc").value.trim() });
      save(); toast("收入已记录"); render();
      break;
    }
    case "inc-del": state.bills.income = state.bills.income.filter((x) => x.id !== el.dataset.id); save(); render(); break;
    case "exp-add": {
      const date = $("#expDate").value.trim();
      const amt = num($("#expAmt").value);
      if (!date || amt <= 0) { toast("请填好日期和金额"); return; }
      state.bills.expense.push({ id: uid(), date, amount: amt, category: $("#expCat").value, note: $("#expNote").value.trim() });
      save(); toast("支出已记录"); render();
      break;
    }
    case "exp-del": state.bills.expense = state.bills.expense.filter((x) => x.id !== el.dataset.id); save(); render(); break;

    /* ---- 历史账单展开明细 ---- */
    case "bill-hist-toggle": {
      const month = el.dataset.month;
      const detail = el.querySelector(".bill-hist-detail");
      const open = el.classList.toggle("open");
      const chev = el.querySelector(".chev");
      if (chev) chev.style.transform = open ? "rotate(90deg)" : "";
      if (open) {
        const incM = state.bills.income.filter((i) => i.date.slice(0, 7) === month).sort((a, b) => (a.date < b.date ? 1 : -1));
        const expM = state.bills.expense.filter((x) => x.date.slice(0, 7) === month).sort((a, b) => (a.date < b.date ? 1 : -1));
        let html = incM.map((i) => `<div class="bill-line inc"><span class="bl-tag">＋ 收入</span><span class="bl-amt">${money(i.amount)}</span><span class="bl-meta">${i.date} ${esc(i.source || "")}</span></div>`).join("")
          + expM.map((x) => `<div class="bill-line exp">${catColor(x.category, true)}<span class="bl-tag">${esc(x.category)}</span><span class="bl-amt">${money(x.amount)}</span><span class="bl-meta">${x.date} ${esc(x.note || "")}</span></div>`).join("");
        detail.innerHTML = html || '<div class="empty">该月没有逐笔记录</div>';
      } else {
        detail.innerHTML = "";
      }
      break;
    }

    /* ---- 健康 ---- */
    case "step-save": {
      const v = num($("#stepInput").value);
      state.health.steps[t] = v; save(); toast("步数已更新 👟"); render();
      break;
    }
    case "wt-add": {
      const date = $("#wtDate").value.trim();
      const v = num($("#wtVal").value);
      if (!date || v <= 0) { toast("请填好日期和体重"); return; }
      state.health.weights.push({ id: uid(), date, value: v });
      save(); toast("体重已记录 ⚖"); render();
      break;
    }
    case "wt-del": state.health.weights = state.health.weights.filter((x) => x.id !== el.dataset.id); save(); render(); break;
    case "per-add": {
      const start = $("#perStart").value.trim();
      const days = Math.max(1, num($("#perDays").value));
      if (!start) { toast("请选择开始日期"); return; }
      state.health.periods.push({ id: uid(), start, days });
      save(); toast("经期已记录 🩸"); render();
      break;
    }
    case "per-del": state.health.periods = state.health.periods.filter((x) => x.id !== el.dataset.id); save(); render(); break;
    case "wk-add": {
      const type = $("#wkType").value.trim() || "运动";
      const ex = state.health.workouts.find((w) => w.date === t);
      if (ex) ex.type = type; else state.health.workouts.push({ id: uid(), date: t, type });
      save(); toast("打卡成功 🏃"); render();
      break;
    }
    case "wk-del": state.health.workouts = state.health.workouts.filter((x) => x.id !== el.dataset.id); save(); render(); break;

    /* ---- 灵感 ---- */
    case "insp-save": {
      const text = ($("#inspText").value || "").trim();
      if (!text) { toast("先写点灵感吧"); return; }
      const ex = state.inspiration.find((x) => x.date === t);
      if (ex) ex.text = text; else state.inspiration.push({ id: uid(), date: t, text });
      save(); toast("灵感已保存 ✺"); render();
      break;
    }
    case "insp-del": state.inspiration = state.inspiration.filter((x) => x.id !== el.dataset.id); save(); render(); break;

    /* ---- 漫与乐 ---- */
    case "media-add": {
      const title = ($("#mTitle").value || "").trim();
      const rating = num($("#mStars").dataset.rating);
      if (!title) { toast("填一下名称吧"); return; }
      state.media.push({ id: uid(), date: t, type: $("#mType").value, title, rating, note: ($("#mNote").value || "").trim() });
      save(); toast("已记录 🎬"); render();
      break;
    }
    case "media-del": state.media = state.media.filter((x) => x.id !== el.dataset.id); save(); render(); break;

    /* ---- 千书千感 ---- */
    case "book-add": {
      const title = ($("#bTitle").value || "").trim();
      const rating = num($("#bStars").dataset.rating);
      if (!title) { toast("填一下书名吧"); return; }
      state.books.push({ id: uid(), date: t, title, rating, note: ($("#bNote").value || "").trim() });
      save(); toast("已记录 📚"); render();
      break;
    }
    case "book-del": state.books = state.books.filter((x) => x.id !== el.dataset.id); save(); render(); break;

    /* ---- 游戏之旅 ---- */
    case "game-add": {
      const name = ($("#gameName").value || "").trim();
      if (!name) { toast("填一下游戏名吧"); return; }
      const g = {
        id: uid(), name,
        icon: ($("#gameIcon").value || "🎮").trim() || "🎮",
        rating: 0, review: "", attraction: "", progress: "进行中", note: "",
      };
      state.games.push(g);
      curGameId = g.id;
      save(); toast("已添加游戏 🎮"); render();
      break;
    }
    case "game-select": {
      curGameId = el.dataset.id;
      render();
      break;
    }
    case "game-save": {
      const g = state.games.find((x) => x.id === curGameId);
      if (!g) { toast("没有选中的游戏"); return; }
      const sbx = $("#gameStars");
      g.rating = num(sbx ? sbx.dataset.rating : 0);
      g.review = ($("#gameReview").value || "").trim();
      g.attraction = ($("#gameAttraction").value || "").trim();
      g.progress = ($("#gameProgress").value || "进行中");
      g.note = ($("#gameNote").value || "").trim();
      save(); toast("游戏状态已保存 ✔"); render();
      break;
    }
    case "game-del": {
      state.games = state.games.filter((x) => x.id !== el.dataset.id);
      if (curGameId === el.dataset.id) curGameId = state.games[0] ? state.games[0].id : null;
      save(); toast("已删除该游戏"); render();
      break;
    }

    /* ---- 预算历史 / 食谱历史 ---- */
    case "budget-archive": {
      const type = el.dataset.budget;
      const amts = state.budget[type];
      const total = budgetTotal(amts);
      const label = type === "monthly" ? monthLabel() : weekLabel();
      const entry = { id: uid(), type, label, date: todayStr(), amounts: { ...amts }, total };
      const idx = state.budget.history.findIndex((h) => h.type === type && h.label === label);
      if (idx >= 0) state.budget.history[idx] = entry; else state.budget.history.push(entry);
      save(); toast("已存入历史预算 🗂"); render();
      break;
    }
    case "budget-hist-del": state.budget.history = state.budget.history.filter((h) => h.id !== el.dataset.id); save(); render(); break;
    case "recipe-archive": {
      const [mon] = weekRange();
      const label = `${mon} 周`;
      const entry = { id: uid(), label, date: todayStr(), data: JSON.parse(JSON.stringify(state.recipes)) };
      const idx = state.recipesHistory.findIndex((h) => h.label === label);
      if (idx >= 0) state.recipesHistory[idx] = entry; else state.recipesHistory.push(entry);
      save(); toast("已存入本周食谱 🍱"); render();
      break;
    }
    case "recipe-hist-del": state.recipesHistory = state.recipesHistory.filter((h) => h.id !== el.dataset.id); save(); render(); break;
    case "recipe-clear": {
      const has = Object.values(state.recipes).some((r) => r && (r.breakfast || r.lunch || r.dinner));
      if (!has) { toast("本周食谱本来就是空的"); return; }
      if (!confirm("确定一键清空本周已记录的全部食谱内容？（已存入的历史食谱不受影响）")) return;
      state.recipes = {};
      save(); toast("本周食谱已清空 🍃"); render();
      break;
    }
  }
}

/* ---- 星级评分（动态绑定，避免整页重渲染） ---- */
function bindStarRating(root) {
  $$(".stars[data-rating]", root).forEach((box) => {
    box.addEventListener("click", (e) => {
      const star = e.target.closest(".star");
      if (!star) return;
      const v = num(star.dataset.val);
      box.dataset.rating = v;
      $$(".star", box).forEach((s) => s.classList.toggle("on", num(s.dataset.val) <= v));
    });
  });
}

/* ---- 待办拖拽排序 ---- */
function bindDrag() {
  const list = $("#todoList");
  if (!list) return;
  let dragId = null;
  list.querySelectorAll(".todo").forEach((item) => {
    item.addEventListener("dragstart", () => { dragId = item.dataset.id; item.classList.add("dragging"); });
    item.addEventListener("dragend", () => { item.classList.remove("dragging"); });
    item.addEventListener("dragover", (e) => { e.preventDefault(); item.classList.add("drag-over"); });
    item.addEventListener("dragleave", () => item.classList.remove("drag-over"));
    item.addEventListener("drop", (e) => {
      e.preventDefault();
      item.classList.remove("drag-over");
      const targetId = item.dataset.id;
      if (!dragId || dragId === targetId) return;
      const from = state.todos.find((x) => x.id === dragId);
      if (!from) return;
      const toIdx = state.todos.findIndex((x) => x.id === targetId);
      state.todos = state.todos.filter((x) => x.id !== dragId);
      state.todos.splice(toIdx, 0, from);
      state.todos.forEach((x, i) => (x.order = i));
      save(); render();
    });
  });
}

/* ---- 渲染后钩子 ---- */
function afterRender() {
  // 心情表情选择
  const me = $("#moodEmojis");
  if (me) me.addEventListener("click", (e) => {
    const em = e.target.closest(".mood-emoji");
    if (em) { $$(".mood-emoji", me).forEach((x) => x.classList.remove("sel")); em.classList.add("sel"); }
  });
  // 星级
  bindStarRating($("#content"));
  // 拖拽
  bindDrag();
  // 待办回车
  const ti = $("#todoInput");
  if (ti) ti.addEventListener("keydown", (e) => { if (e.key === "Enter") handleAction("todo-add", { dataset: {} }); });
  // 若总览页渲染了页内时钟，立即填充（避免下一秒才有文字）
  if ($("#clockIn")) updateClock();
}

/* ---- 历史记录筛选 / 搜索 ---- */
function applyHistFilter(target) {
  const card = target.closest(".card");
  if (!card) return;
  const list = card.querySelector("#budgetHistList, #recipeHistList");
  if (!list) return;
  const itemSel = list.id === "budgetHistList" ? ".budget-hist" : ".recipe-hist";
  const typeSel = card.querySelector("[data-budget-filter-type]");
  const textInp = card.querySelector("[data-budget-filter-text], [data-recipe-filter-text]");
  const type = typeSel ? typeSel.value : "all";
  const q = (textInp ? textInp.value : "").trim().toLowerCase();
  let shown = 0, total = 0;
  list.querySelectorAll(itemSel).forEach((it) => {
    total++;
    const ok = (type === "all" || it.dataset.type === type) && (q === "" || (it.dataset.label || "").toLowerCase().includes(q));
    it.style.display = ok ? "" : "none";
    if (ok) shown++;
  });
  let empty = card.querySelector(".empty-filter");
  if (total > 0 && shown === 0) {
    if (!empty) { empty = document.createElement("div"); empty.className = "empty empty-filter"; list.appendChild(empty); }
    empty.textContent = "没有匹配的记录";
  } else if (empty) { empty.remove(); }
}

/* ---- 数据导出 / 清空 ---- */
function exportData() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `rococo-workbench-${todayStr()}.json`;
  a.click();
  toast("数据已导出");
}

function resetData() {
  if (!confirm("确定清空本机全部工作台数据？此操作不可恢复。")) return;
  localStorage.removeItem(STORE_KEY);
  state = defaultState();
  save();
  render();
  toast("数据已清空");
}

function importData() {
  const inp = $("#importFile");
  if (inp) inp.click();
}

function handleImportFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("bad");
      const hasData = JSON.stringify(state) !== JSON.stringify(defaultState());
      const msg = hasData
        ? "导入将覆盖当前所有工作台数据，确定继续吗？"
        : "确定导入该数据文件吗？";
      if (!confirm(msg)) return;
      state = Object.assign(defaultState(), parsed);
      save();
      renderNav();
      render();
      toast("数据已成功导入");
    } catch (err) {
      toast("导入失败：文件不是有效的工作台数据");
    }
  };
  reader.onerror = () => toast("读取文件失败");
  reader.readAsText(file);
}

/* ---- 初始化 ---- */
function init() {
  bindEvents();
  renderNav();
  render();
  setNav(isMobile());
  updateClock();
  setInterval(updateClock, 1000);
  let lastMobile = isMobile();
  window.addEventListener("resize", () => {
    const m = isMobile();
    if (m !== lastMobile) { lastMobile = m; setNav(m); }
  });
  initSupabase();   // 设置 sb（若网络可用）；失败则进入离线模式
  startAuth();      // 始终先要求输入同步密码
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
