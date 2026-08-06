/* ============================================================
   Rococo 个人工作台  ·  modules.js
   日常 / 生活 / 灵感星球 各模块渲染
   ============================================================ */

/* ============================================================
   日常
   ============================================================ */
function renderDaily(sub) {
  if (sub === "todo") return renderTodo();
  return renderMood();
}

const MOOD_EMOJIS = ["😊", "😌", "🥰", "😎", "🤔", "😴", "😢", "😡", "🤩", "😇"];

function renderMood() {
  const t = todayStr();
  const cur = state.mood[t] || {};
  const emo = MOOD_EMOJIS.map(
    (e) => `<div class="mood-emoji ${cur.emoji === e ? "sel" : ""}" data-emoji="${e}">${e}</div>`
  ).join("");
  const history = Object.keys(state.mood)
    .sort((a, b) => (a < b ? 1 : -1))
    .slice(0, 12)
    .map((d) => {
      const m = state.mood[d];
      return `<div class="mood-item">
        <div class="me">${m.emoji}</div>
        <div style="flex:1">
          <div class="md">${d}</div>
          <div class="mt">${esc(m.text || "（未写文字）")}</div>
        </div>
        <button class="todo-del" data-action="mood-del" data-date="${d}" title="删除">✕</button>
      </div>`;
    })
    .join("");
  return `
    <div class="section-grid">
      <div class="card">
        <div class="card-title">😊 今日心情</div>
        <div class="card-sub">${t} · 选一个最贴近此刻的表情</div>
        <div class="mood-emojis" id="moodEmojis">${emo}</div>
        <div class="field">
          <label class="label">想说点什么？（可选）</label>
          <textarea class="textarea" id="moodText" placeholder="今天发生了什么，或只是想对自己说句话…">${esc(cur.text || "")}</textarea>
        </div>
        <button class="btn" data-action="mood-save">保存今日心情</button>
      </div>
      <div class="card">
        <div class="card-title">🕒 心情日历</div>
        <div class="card-sub">最近记录 · 悬停查看</div>
        <div class="mood-history">${history || '<div class="empty">还没有心情记录</div>'}</div>
      </div>
    </div>`;
}

function renderTodo() {
  const items = [...state.todos].sort((a, b) => a.order - b.order);
  const done = items.filter((x) => x.done).length;
  const pct = items.length ? (done / items.length) * 100 : 0;
  const list = items.length
    ? items
        .map(
          (x) => `<div class="todo ${x.done ? "done" : ""}" draggable="true" data-id="${x.id}">
        <span class="drag-handle" title="拖拽排序">⠿</span>
        <div class="todo-check ${x.done ? "on" : ""}" data-action="todo-toggle" data-id="${x.id}">${x.done ? "✓" : ""}</div>
        <div class="todo-text">${esc(x.text)}</div>
        <button class="todo-del" data-action="todo-del" data-id="${x.id}" title="删除">✕</button>
      </div>`
        )
        .join("")
    : '<div class="empty">暂无待办，添加一件今天想完成的事吧</div>';
  return `
    <div class="section-grid">
      <div class="card">
        <div class="card-title">✓ 待办事项</div>
        <div class="card-sub">拖拽 ⠿ 可调整顺序 · 点击方框标记完成</div>
        <div class="field">
          <label class="label">添加待办</label>
          <div class="row">
            <input class="input" id="todoInput" placeholder="例如：完成工作台预算模块…" />
            <button class="btn" data-action="todo-add" style="flex:0 0 auto">添加</button>
          </div>
        </div>
        <div class="progress-wrap">
          <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
          <div style="font-size:12px;color:var(--muted);margin-top:6px">已完成 ${done} / ${items.length}</div>
        </div>
      </div>
      <div class="card">
        <div class="card-title">📋 清单</div>
        <div class="card-sub">悬停查看 · 拖拽排序</div>
        <div class="todo-list" id="todoList">${list}</div>
      </div>
    </div>`;
}

/* ============================================================
   生活
   ============================================================ */
function renderLife(sub) {
  return { budget: renderBudget, bill: renderBill, recipe: renderRecipe, health: renderHealth }[sub]();
}

/* ---- 预算管理 ---- */
function renderBudget() {
  const b = state.budget;
  const totalWallet = b.wallets.wechat + b.wallets.alipay + b.wallets.card1 + b.wallets.card2;
  const walletDefs = [
    { key: "wechat", name: "微信", ico: "💚" },
    { key: "alipay", name: "支付宝", ico: "💙" },
    { key: "card1", name: "银行卡一", ico: "💳" },
    { key: "card2", name: "银行卡二", ico: "🏦" },
  ];
  const wallets = walletDefs
    .map(
      (w) => `<div class="wallet">
      <div class="wallet-ico">${w.ico}</div>
      <div class="wallet-name">${w.name}</div>
      <div class="wallet-amt">${money(b.wallets[w.key])}</div>
    </div>`
    )
    .join("");
  const budgetBoxes = ["monthly", "weekly"].map((type) => {
    const b2 = state.budget[type];
    const cats = [
      { key: "essentials", name: "🛒 必需品采购" },
      { key: "rent", name: "🏠 房租物业" },
      { key: "emotion", name: "💗 情绪消费" },
      { key: "other", name: "📦 其他" },
    ];
    const rows = cats.map((c) => `<div class="bcat-row">
        <span class="bcat-name">${c.name}</span>
        <input class="input bcat-input" type="number" min="0" data-budget="${type}" data-bcat="${c.key}" value="${num(b2[c.key])}" placeholder="0" />
      </div>`).join("");
    const total = budgetTotal(b2);
    const label = type === "monthly" ? "📊 月度预算" : "🗓 周预算";
    const archiveLabel = type === "monthly" ? "存入本月历史" : "存入本周历史";
    return `<div class="card budget-box">
        <div class="card-title">${label}</div>
        <div class="card-sub">按类别分配 · 自动汇总合计</div>
        <div class="bcat-list">${rows}</div>
        <div class="budget-total">合计 <b>${money(total)}</b></div>
        <button class="btn soft" data-action="budget-archive" data-budget="${type}">${archiveLabel}</button>
      </div>`;
  }).join("");

  const histRows = (state.budget.history || []).slice().sort((a, c) => (a.date < c.date ? 1 : -1))
    .map((h) => {
      const a = h.amounts;
      return `<div class="entry budget-hist" data-type="${h.type}" data-label="${esc(h.label)}">
        <div class="entry-main">
          <div class="entry-title">${h.type === "monthly" ? "📅 月度" : "🗓 周度"} · ${esc(h.label)}</div>
          <div class="entry-meta">必需品 ${money(a.essentials)} · 房租 ${money(a.rent)} · 情绪 ${money(a.emotion)} · 其他 ${money(a.other)} · <b>合计 ${money(h.total)}</b></div>
        </div>
        <button class="todo-del" data-action="budget-hist-del" data-id="${h.id}">✕</button>
      </div>`;
    })
    .join("");

  const depRows = [...b.deposits].sort((a, b2) => (a.date < b2.date ? 1 : -1)).slice(0, 8)
    .map((d) => {
      const w = walletDefs.find((x) => x.key === d.wallet);
      return `<div class="entry">
        <div class="entry-main">
          <div class="entry-title">${w.ico} ${w.name} · ${money(d.amount)}</div>
          <div class="entry-meta">${d.date} ${esc(d.note || "")}</div>
        </div>
        <button class="todo-del" data-action="dep-del" data-id="${d.id}">✕</button>
      </div>`;
    })
    .join("");

  return `
    <div class="section-grid">
      ${budgetBoxes}
      <div class="card">
        <div class="card-title">👛 存款钱包</div>
        <div class="card-sub">共 ${walletDefs.length} 个账户 · 合计 ${money(totalWallet)}</div>
        <div class="wallet-grid">${wallets}</div>
        <div class="field" style="margin-top:16px">
          <label class="label">记一笔存款</label>
          <div class="row">
            <select class="input" id="depWallet">
              ${walletDefs.map((w) => `<option value="${w.key}">${w.name}</option>`).join("")}
            </select>
            <input class="input" id="depAmt" type="number" min="0" placeholder="金额" />
            <input class="input" id="depNote" placeholder="备注(可选)" />
            <button class="btn" data-action="dep-add" style="flex:0 0 auto">存入</button>
          </div>
        </div>
        <div class="entry-list" style="margin-top:12px">${depRows || '<div class="empty">还没有存款记录</div>'}</div>
      </div>
      <div class="card">
        <div class="card-title">🗂 历史预算</div>
        <div class="card-sub">已归档的月度 / 周预算</div>
        <div class="hist-toolbar">
          <select class="input" data-budget-filter-type>
            <option value="all">全部类型</option>
            <option value="monthly">月度</option>
            <option value="weekly">周度</option>
          </select>
          <input class="input" data-budget-filter-text placeholder="搜索标签，如 2026-08" />
        </div>
        <div class="entry-list" id="budgetHistList">${histRows || '<div class="empty">还没有归档的预算，点上方按钮存入</div>'}</div>
      </div>
    </div>`;
}

/* ---- 账单管理 ---- */
function catColor(cat, dot) {
  const map = {
    餐饮: "#f0a45b", 交通: "#5b8ff9", 购物: "#ef9bc0", 居住: "#7e8ef0",
    娱乐: "#4cc28b", 医疗: "#ef7a85", 其他: "#93a3bf",
  };
  const c = map[cat] || "#93a3bf";
  return dot ? `<span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${c};margin-right:6px"></span>` : c;
}

function renderBill() {
  const bills = state.bills;
  const t = todayStr();
  const month = t.slice(0, 7);
  const monthInc = bills.income.filter((i) => i.date.slice(0, 7) === month).reduce((a, i) => a + num(i.amount), 0);
  const monthExp = bills.expense.filter((e) => e.date.slice(0, 7) === month).reduce((a, e) => a + num(e.amount), 0);
  const balance = monthInc - monthExp;

  const catSums = bills.categories.map((cat) =>
    bills.expense.filter((e) => e.date.slice(0, 7) === month && e.category === cat).reduce((a, e) => a + num(e.amount), 0)
  );
  const maxCat = Math.max(1, ...catSums);

  const cats = bills.categories.map((cat, i) => {
    const sum = catSums[i];
    const pct = (sum / maxCat) * 100;
    return `<div class="cat">
      <div class="cat-name">${cat}</div>
      <div class="cat-track"><div class="cat-fill" style="width:${pct}%;background:${catColor(cat)}"></div></div>
      <div class="cat-amt">${money(sum)}</div>
    </div>`;
  }).join("");

  const incRows = [...bills.income].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6)
    .map((i) => `<div class="entry">
      <div class="entry-main"><div class="entry-title">＋ ${money(i.amount)}</div><div class="entry-meta">${i.date} · ${esc(i.source || "")}</div></div>
      <button class="todo-del" data-action="inc-del" data-id="${i.id}">✕</button>
    </div>`).join("");
  const expRows = [...bills.expense].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 8)
    .map((e) => `<div class="entry">
      <div class="entry-main"><div class="entry-title">${catColor(e.category, true)} ${esc(e.category)} · ${money(e.amount)}</div><div class="entry-meta">${e.date} ${esc(e.note || "")}</div></div>
      <button class="todo-del" data-action="exp-del" data-id="${e.id}">✕</button>
    </div>`).join("");

  return `
    <div class="section-grid">
      <div class="card" style="grid-column:1/-1">
        <div class="card-title">💰 本月汇总（${month}）</div>
        <div class="card-sub">收入与支出自动按类别汇总</div>
        <div class="sum-cards">
          <div class="sum-card"><div class="sc-label">本月收入</div><div class="sc-val" style="color:var(--good)">${money(monthInc)}</div></div>
          <div class="sum-card"><div class="sc-label">本月支出</div><div class="sc-val" style="color:var(--bad)">${money(monthExp)}</div></div>
          <div class="sum-card"><div class="sc-label">本月结余</div><div class="sc-val" style="color:${balance >= 0 ? "var(--primary-deep)" : "var(--bad)"}">${money(balance)}</div></div>
        </div>
        <div class="cat-bar">${cats}</div>
      </div>

      <div class="card">
        <div class="card-title">＋ 记收入</div>
        <div class="field"><label class="label">日期</label><input class="input" id="incDate" type="date" value="${t}" /></div>
        <div class="field"><label class="label">金额</label><input class="input" id="incAmt" type="number" min="0" placeholder="金额" /></div>
        <div class="field"><label class="label">来源（可选）</label><input class="input" id="incSrc" placeholder="如：工资 / 兼职" /></div>
        <button class="btn" data-action="inc-add">保存收入</button>
        <div class="entry-list" style="margin-top:14px">${incRows || '<div class="empty">暂无收入记录</div>'}</div>
      </div>

      <div class="card">
        <div class="card-title">－ 记支出</div>
        <div class="field"><label class="label">日期</label><input class="input" id="expDate" value="${t}" /></div>
        <div class="field"><label class="label">类别</label><select class="input" id="expCat">${bills.categories.map((c) => `<option>${c}</option>`).join("")}</select></div>
        <div class="field"><label class="label">金额</label><input class="input" id="expAmt" type="number" min="0" placeholder="金额" /></div>
        <div class="field"><label class="label">备注（可选）</label><input class="input" id="expNote" placeholder="如：午餐 / 打车" /></div>
        <button class="btn" data-action="exp-add">保存支出</button>
        <div class="entry-list" style="margin-top:14px">${expRows || '<div class="empty">暂无支出记录</div>'}</div>
      </div>

      <div class="card">
        <div class="card-title">📜 历史月度账单</div>
        <div class="card-sub">点击月份可展开当月逐笔明细</div>
        <div class="entry-list">${(() => {
          const ms = new Set();
          bills.income.forEach((i) => ms.add(i.date.slice(0, 7)));
          bills.expense.forEach((e) => ms.add(e.date.slice(0, 7)));
          return [...ms].filter((m) => m !== month).sort((a, b) => (b < a ? -1 : 1)).map((m) => {
            const inc = bills.income.filter((i) => i.date.slice(0, 7) === m).reduce((a, i) => a + num(i.amount), 0);
            const exp = bills.expense.filter((e) => e.date.slice(0, 7) === m).reduce((a, e) => a + num(e.amount), 0);
            const bal = inc - exp;
            return `<div class="entry bill-hist" data-action="bill-hist-toggle" data-month="${m}">
              <div class="entry-main">
                <div class="entry-title">📅 ${m} <span class="chev">▸</span></div>
                <div class="entry-meta">收入 <b style="color:var(--good)">${money(inc)}</b> · 支出 <b style="color:var(--bad)">${money(exp)}</b> · 结余 <b style="color:${bal >= 0 ? "var(--primary-deep)" : "var(--bad)"}">${money(bal)}</b></div>
              </div>
              <div class="bill-hist-detail"></div>
            </div>`;
          }).join("") || '<div class="empty">还没有历史月份</div>';
        })()}</div>
      </div>
    </div>`;
}

/* ---- 一周食谱 ---- */
function renderRecipe() {
  const twd = todayWeekday();
  const cols = [];
  for (let i = 0; i < 7; i++) {
    const r = state.recipes[String(i)] || {};
    cols.push(`<div class="day-col ${i === twd ? "today" : ""}">
      <div class="day-name">${weekdayName(i)}${i === twd ? " · 今" : ""}</div>
      <div class="day-slot">早餐</div><textarea class="day-input" data-day="${i}" data-meal="breakfast" placeholder="—">${esc(r.breakfast || "")}</textarea>
      <div class="day-slot">午餐</div><textarea class="day-input" data-day="${i}" data-meal="lunch" placeholder="—">${esc(r.lunch || "")}</textarea>
      <div class="day-slot">晚餐</div><textarea class="day-input" data-day="${i}" data-meal="dinner" placeholder="—">${esc(r.dinner || "")}</textarea>
    </div>`);
  }
  const histRows = (state.recipesHistory || []).slice().sort((a, c) => (a.date < c.date ? 1 : -1))
    .map((h) => {
      const days = [0, 1, 2, 3, 4, 5, 6].map((i) => {
        const r = h.data[String(i)] || {};
        const cell = (v) => (v ? esc(v).slice(0, 14) : "—");
        return `<div class="rh-day"><b>${weekdayName(i).slice(1)}</b><span>早${cell(r.breakfast)} 午${cell(r.lunch)} 晚${cell(r.dinner)}</span></div>`;
      }).join("");
      return `<div class="entry recipe-hist" data-label="${esc(h.label)}">
        <div class="entry-main">
          <div class="entry-title">🍱 ${esc(h.label)}</div>
          <div class="rh-days">${days}</div>
        </div>
        <button class="todo-del" data-action="recipe-hist-del" data-id="${h.id}">✕</button>
      </div>`;
    })
    .join("");

  return `
    <div class="section-grid">
      <div class="card">
        <div class="card-title">🍱 一周食谱</div>
        <div class="card-sub">按周几安排，每周复用 · 高亮为今天，修改后自动保存</div>
        <div class="week-grid">${cols.join("")}</div>
        <button class="btn soft" data-action="recipe-archive" style="margin-top:16px">存入本周食谱</button>
      </div>
      <div class="card">
        <div class="card-title">📚 历史一周食谱</div>
        <div class="card-sub">已归档的每周饮食安排</div>
        <div class="hist-toolbar">
          <input class="input" data-recipe-filter-text placeholder="搜索周标签，如 2026 周" />
        </div>
        <div class="entry-list" id="recipeHistList">${histRows || '<div class="empty">还没有归档，点上方按钮存入本周</div>'}</div>
      </div>
    </div>`;
}

/* ---- 健康管理 ---- */
function renderHealth() {
  const h = state.health;
  const t = todayStr();
  const steps = num(h.steps[t]);
  const cal = (steps * 0.04).toFixed(0);
  const STEP_GOAL = 8000;
  const ringPct = Math.min(100, (steps / STEP_GOAL) * 100);
  const R = 52, C = 2 * Math.PI * R;

  const ws = [...h.weights].sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-14);
  let spark = "";
  if (ws.length >= 2) {
    const vals = ws.map((w) => num(w.value));
    const min = Math.min(...vals), max = Math.max(...vals);
    const W = 400, H = 60, p = 6;
    const pts = ws.map((w, i) => {
      const x = p + (i / (ws.length - 1)) * (W - p * 2);
      const y = H - p - ((num(w.value) - min) / (max - min || 1)) * (H - p * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    spark = `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <polyline points="${pts.join(" ")}" fill="none" stroke="#5b8ff9" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
  }
  const lastWeight = [...h.weights].sort((a, b) => (a.date < b.date ? 1 : -1))[0];

  const periods = [...h.periods].sort((a, b) => (a.start < b.start ? 1 : -1));
  const lastP = periods[0];
  let periodInfo = "尚未记录";
  if (lastP) {
    periodInfo = `上次 ${lastP.start} · 持续 ${lastP.days} 天`;
    if (periods.length >= 2) {
      const prev = periods[1];
      const cyc = Math.round((new Date(lastP.start) - new Date(prev.start)) / 86400000);
      periodInfo += ` · 周期约 ${cyc} 天`;
    }
  }

  const wk = (() => {
    const start = new Date(); start.setDate(start.getDate() - start.getDay() + 1);
    let c = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const ds = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      if (h.workouts.some((w) => w.date === ds)) c++;
    }
    return c;
  })();
  const todayWorkout = h.workouts.find((w) => w.date === t);

  const periodRows = periods.slice(0, 6)
    .map((p) => `<div class="entry"><div class="entry-main"><div class="entry-title">🩸 经期记录</div><div class="entry-meta">${p.start} · 持续 ${p.days} 天</div></div><button class="todo-del" data-action="per-del" data-id="${p.id}">✕</button></div>`)
    .join("");
  const weightRows = [...h.weights].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6)
    .map((w) => `<div class="entry"><div class="entry-main"><div class="entry-title">⚖ ${num(w.value)} kg</div><div class="entry-meta">${w.date}</div></div><button class="todo-del" data-action="wt-del" data-id="${w.id}">✕</button></div>`)
    .join("");
  const workoutRows = [...h.workouts].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 6)
    .map((w) => `<div class="entry"><div class="entry-main"><div class="entry-title">🏃 ${esc(w.type || "运动")}</div><div class="entry-meta">${w.date}</div></div><button class="todo-del" data-action="wk-del" data-id="${w.id}">✕</button></div>`)
    .join("");

  return `
    <div class="section-grid">
      <div class="card">
        <div class="card-title">👟 今日步数</div>
        <div class="card-sub">自动估算卡路里消耗（约 0.04 千卡/步）</div>
        <div class="ring-wrap">
          <div class="ring">
            <svg width="120" height="120">
              <circle cx="60" cy="60" r="${R}" fill="none" stroke="#eaf1fe" stroke-width="12"/>
              <circle cx="60" cy="60" r="${R}" fill="none" stroke="#5b8ff9" stroke-width="12" stroke-linecap="round"
                stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - ringPct / 100)}"/>
            </svg>
            <div class="ring-center"><div class="rc-num">${steps ? steps.toLocaleString() : 0}</div><div class="rc-lab">/ ${STEP_GOAL} 步</div></div>
          </div>
          <div style="flex:1">
            <div class="field" style="margin:0">
              <label class="label">记录今日步数</label>
              <div class="row">
                <input class="input" id="stepInput" type="number" min="0" value="${steps}" placeholder="0" />
                <button class="btn" data-action="step-save" style="flex:0 0 auto">更新</button>
              </div>
            </div>
            <div style="margin-top:10px;font-size:13px;color:var(--text-2)">约消耗 <b style="color:var(--primary-deep)">${cal}</b> 千卡</div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">⚖ 体重记录</div>
        <div class="card-sub">${lastWeight ? "最新 " + num(lastWeight.value) + " kg（" + lastWeight.date + "）" : "还没有记录"}</div>
        ${spark || '<div class="empty">记录 2 次以上可看趋势</div>'}
        <div class="field" style="margin-top:12px">
          <div class="row">
            <input class="input" id="wtDate" value="${t}" />
            <input class="input" id="wtVal" type="number" step="0.1" min="0" placeholder="kg" />
            <button class="btn" data-action="wt-add" style="flex:0 0 auto">记录</button>
          </div>
        </div>
        <div class="entry-list">${weightRows || '<div class="empty">暂无记录</div>'}</div>
      </div>

      <div class="card">
        <div class="card-title">🩸 经期记录</div>
        <div class="card-sub">${periodInfo}</div>
        <div class="field"><label class="label">开始日期</label><input class="input" id="perStart" value="${t}" /></div>
        <div class="field"><label class="label">持续天数</label><input class="input" id="perDays" type="number" min="1" value="5" /></div>
        <button class="btn soft" data-action="per-add">记录经期</button>
        <div class="entry-list" style="margin-top:12px">${periodRows || '<div class="empty">暂无记录</div>'}</div>
      </div>

      <div class="card">
        <div class="card-title">🏃 运动打卡</div>
        <div class="card-sub">本周已打卡 ${wk} 天</div>
        <div class="field">
          <div class="row">
            <input class="input" id="wkType" placeholder="运动类型，如：跑步/瑜伽" value="${todayWorkout ? esc(todayWorkout.type) : ""}" />
            <button class="btn ${todayWorkout ? "soft" : ""}" data-action="wk-add">${todayWorkout ? "更新今日打卡" : "今日打卡"}</button>
          </div>
        </div>
        <div class="entry-list">${workoutRows || '<div class="empty">暂无打卡</div>'}</div>
      </div>
    </div>`;
}

/* ============================================================
   灵感星球
   ============================================================ */
function renderInspiration(sub) {
  if (sub === "game") return renderGame();
  if (sub === "media") return renderMedia();
  if (sub === "book") return renderBook();
  return renderInsp();
}

/* ---- 游戏之旅 ---- */
function renderGame() {
  const games = state.games;
  // 默认展示首款添加的游戏；若当前选中无效则回退到第一款
  if (!curGameId || !games.find((x) => x.id === curGameId)) curGameId = games[0] ? games[0].id : null;
  const g = games.find((x) => x.id === curGameId) || null;

  const icons = games.length
    ? games.map((x) => `<button class="game-chip ${x.id === curGameId ? "active" : ""}" data-action="game-select" data-id="${x.id}">
        <span class="game-chip-ico">${esc(x.icon || "🎮")}</span>
        <span class="game-chip-name">${esc(x.name || "未命名")}</span>
      </button>`).join("")
    : '<div class="empty">还没有添加游戏，在下方加一款吧</div>';

  return `
    <div class="section-grid">
      <div class="card game-card" style="grid-column:1/-1">
        <div class="card-title">🎮 游戏之旅</div>
        <div class="card-sub">${SUB_TAGLINE.game}　·　点上方图标切换游戏，各自独立记录</div>
        <div class="game-icons">${icons}</div>
        <div class="game-divider"></div>
        ${g ? gameDetailHtml(g) : '<div class="empty">添加一款游戏后，这里展示它的状态</div>'}
        <div class="game-divider"></div>
        <div class="field">
          <label class="label">添加一款新游戏</label>
          <div class="row">
            <input class="input" id="gameIcon" placeholder="🎮" style="width:54px;flex:0 0 54px;text-align:center" />
            <input class="input" id="gameName" placeholder="游戏名" />
            <button class="btn" data-action="game-add" style="flex:0 0 auto">添加</button>
          </div>
        </div>
      </div>
    </div>`;
}

function gameDetailHtml(g) {
  const PROGS = ["进行中", "已通关", "弃坑", "暂停"];
  return `
    <div class="game-status">
      <div class="game-status-rating">
        <span class="label" style="margin:0">我的评分</span>
        <div class="stars" id="gameStars" data-rating="${num(g.rating)}">${starInput(num(g.rating))}</div>
      </div>
      <div class="field">
        <label class="label">一句话锐评</label>
        <textarea class="textarea" id="gameReview" placeholder="用一句话把最想说的吐槽 / 安利写出来…">${esc(g.review || "")}</textarea>
      </div>
      <div class="field">
        <label class="label">吸引点</label>
        <textarea class="textarea" id="gameAttraction" placeholder="是什么让你停不下来？剧情 / 玩法 / 画风 / 朋友…">${esc(g.attraction || "")}</textarea>
      </div>
      <div class="field">
        <label class="label">当前进度状态</label>
        <select class="input" id="gameProgress">${PROGS.map((p) => `<option ${g.progress === p ? "selected" : ""}>${p}</option>`).join("")}</select>
      </div>
      <div class="field">
        <label class="label">其他备注（可选）</label>
        <textarea class="textarea" id="gameNote" placeholder="想记点什么都可以…">${esc(g.note || "")}</textarea>
      </div>
      <div class="row" style="margin-top:6px">
        <button class="btn" data-action="game-save">保存状态</button>
        <button class="btn soft danger" data-action="game-del" data-id="${g.id}">删除该游戏</button>
      </div>
    </div>`;
}

function stars(r) {
  r = num(r);
  let s = "";
  for (let i = 1; i <= 5; i++) s += `<span class="star ${i <= r ? "on" : ""}">★</span>`;
  return `<span class="stars">${s}</span>`;
}
function starInput(r) {
  let s = "";
  for (let i = 1; i <= 5; i++) s += `<span class="star ${i <= r ? "on" : ""}" data-val="${i}">★</span>`;
  return s;
}

function renderInsp() {
  const t = todayStr();
  const todayNote = (state.inspiration.find((x) => x.date === t) || {}).text || "";
  const history = [...state.inspiration].sort((a, b) => (a.date < b.date ? 1 : -1))
    .map(
      (x) => `<div class="note">
      <button class="note-del" data-action="insp-del" data-id="${x.id}">✕</button>
      <div class="note-date">${x.date}</div>
      <div class="note-text">${esc(x.text)}</div>
    </div>`
    )
    .join("");
  return `
    <div class="section-grid">
      <div class="card">
        <div class="card-title">✺ 今日闪现灵感</div>
        <div class="card-sub">${t} · 把稍纵即逝的念头留住</div>
        <div class="field">
          <textarea class="textarea" id="inspText" placeholder="一个突然冒出来的想法、一句话、一个点子…">${esc(todayNote)}</textarea>
        </div>
        <button class="btn" data-action="insp-save">一键保存灵感</button>
      </div>
      <div class="card">
        <div class="card-title">🗒 灵感历史</div>
        <div class="card-sub">共 ${state.inspiration.length} 条 · 悬停查看</div>
        <div class="note-stack">${history || '<div class="empty">还没有灵感，去写第一条吧</div>'}</div>
      </div>
    </div>`;
}

function renderMedia() {
  const types = [
    { key: "drama", label: "剧" },
    { key: "anime", label: "动漫" },
    { key: "music", label: "音乐" },
  ];
  const opts = types.map((t) => `<option value="${t.key}">${t.label}</option>`).join("");
  const list = [...state.media].sort((a, b) => (a.date < b.date ? 1 : -1))
    .map((m) => {
      const label = { drama: "🎬 剧", anime: "🌸 动漫", music: "🎵 音乐" }[m.type];
      return `<div class="entry">
        <div class="entry-main">
          <div class="entry-title">${label} · ${esc(m.title)} ${stars(m.rating)}</div>
          <div class="entry-meta">${m.date}</div>
          ${m.note ? `<div class="entry-note">${esc(m.note)}</div>` : ""}
        </div>
        <button class="todo-del" data-action="media-del" data-id="${m.id}">✕</button>
      </div>`;
    })
    .join("");
  return `
    <div class="section-grid">
      <div class="card">
        <div class="card-title">🎬 漫与乐</div>
        <div class="card-sub">记录正在追的剧 / 动漫，正在听的音乐，并打分</div>
        <div class="field"><label class="label">类型</label><select class="input" id="mType">${opts}</select></div>
        <div class="field"><label class="label">名称</label><input class="input" id="mTitle" placeholder="作品名" /></div>
        <div class="field"><label class="label">我的评分</label><div class="stars" id="mStars" data-rating="0">${starInput(0)}</div></div>
        <div class="field"><label class="label">短评（可选）</label><input class="input" id="mNote" placeholder="一句话感受" /></div>
        <button class="btn" data-action="media-add">保存记录</button>
      </div>
      <div class="card">
        <div class="card-title">📜 历史记录</div>
        <div class="card-sub">共 ${state.media.length} 条</div>
        <div class="entry-list">${list || '<div class="empty">还没有记录</div>'}</div>
      </div>
    </div>`;
}

function renderBook() {
  const list = [...state.books].sort((a, b) => (a.date < b.date ? 1 : -1))
    .map(
      (b) => `<div class="entry">
        <div class="entry-main">
          <div class="entry-title">📖 ${esc(b.title)} ${stars(b.rating)}</div>
          <div class="entry-meta">${b.date}</div>
          ${b.note ? `<div class="entry-note">${esc(b.note)}</div>` : ""}
        </div>
        <button class="todo-del" data-action="book-del" data-id="${b.id}">✕</button>
      </div>`
    )
    .join("");
  return `
    <div class="section-grid">
      <div class="card">
        <div class="card-title">📚 千书千感</div>
        <div class="card-sub">记录读过的书，写下你的感受与评分</div>
        <div class="field"><label class="label">书名</label><input class="input" id="bTitle" placeholder="书名" /></div>
        <div class="field"><label class="label">我的评分</label><div class="stars" id="bStars" data-rating="0">${starInput(0)}</div></div>
        <div class="field"><label class="label">读后感（可选）</label><textarea class="textarea" id="bNote" placeholder="一句话感想…"></textarea></div>
        <button class="btn" data-action="book-add">保存记录</button>
      </div>
      <div class="card">
        <div class="card-title">📜 已读清单</div>
        <div class="card-sub">共 ${state.books.length} 本</div>
        <div class="entry-list">${list || '<div class="empty">还没有记录</div>'}</div>
      </div>
    </div>`;
}
