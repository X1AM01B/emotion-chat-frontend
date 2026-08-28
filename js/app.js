/* ============================================================
   法智通 · 法律智能助手 —— 应用脚本
   说明：纯前端演示原型，所有数据为演示数据，不构成法律意见。
   真实 LLM / RAG 服务由后端提供，前端预留对应接口位。
   ============================================================ */
'use strict';
const $  = (sel, el = document) => el.querySelector(sel);
const $$ = (sel, el = document) => Array.from(el.querySelectorAll(sel));

/* ---------------- 通用工具 ---------------- */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

/* 内联 SVG 图标（供 JS 动态渲染复用） */
const ICONS = {
  globe: '<svg viewBox="0 0 24 24" class="ic"><circle cx="12" cy="12" r="10"/><path d="M2 12h20"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>',
  tag: '<svg viewBox="0 0 24 24" class="ic"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.83z"/></svg>',
  cal: '<svg viewBox="0 0 24 24" class="ic"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  doc: '<svg viewBox="0 0 24 24" class="ic"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>',
  robot: '<svg viewBox="0 0 24 24" class="ic"><rect x="4" y="8" width="16" height="12" rx="3"/><circle cx="9" cy="14" r="1.2" fill="currentColor" stroke="none"/><circle cx="15" cy="14" r="1.2" fill="currentColor" stroke="none"/><path d="M12 8V4"/><circle cx="12" cy="3" r="1"/></svg>',
  copy: '<svg viewBox="0 0 24 24" class="ic"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  like: '<svg viewBox="0 0 24 24" class="ic"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3z"/><path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>',
};
const icon = (n) => ICONS[n] || '';

/* 社保法 RAG 后端地址（social_insurance/api_server.py，端口 8001）。
   置空则禁用真实 RAG，仅用本地演示模板。 */
const API_BASE = 'https://api.3232132.xyz';

/* ============================================================
   路由：hash (#/home ...)
   ============================================================ */
const PAGES = ['home', 'chat', 'review', 'report', 'dashboard', 'knowledge', 'leads'];
let currentPage = 'home';

function navigate() {
  let h = (location.hash || '#/home').replace('#/', '');
  if (!PAGES.includes(h)) h = 'home';
  currentPage = h;
  $$('.page').forEach(p => p.classList.remove('active'));
  const page = $('#page-' + h);
  if (page) page.classList.add('active');
  $$('.nav-link').forEach(a => a.classList.toggle('active', a.dataset.page === h));
  window.scrollTo(0, 0);
}
window.addEventListener('hashchange', navigate);

/* ============================================================
   智能问答
   ============================================================ */
/* 法条库（演示数据） */
const LAWS = {
  labor30: { title: '《劳动合同法》第三十条', text: '用人单位应当按照劳动合同约定和国家规定，向劳动者及时足额支付劳动报酬。用人单位拖欠或者未足额支付劳动报酬的，劳动者可以依法向当地人民法院申请支付令。' },
  labor46: { title: '《劳动合同法》第四十六条', text: '用人单位未及时足额支付劳动报酬的，劳动者可以解除劳动合同，用人单位应当向劳动者支付经济补偿。' },
  civil509: { title: '《民法典》第五百零九条', text: '当事人应当按照约定全面履行自己的义务。当事人应当遵循诚信原则，根据合同的性质、目的和交易习惯履行通知、协助、保密等义务。' },
  civil577: { title: '《民法典》第五百七十七条', text: '当事人一方不履行合同义务或者履行合同义务不符合约定的，应当承担继续履行、采取补救措施或者赔偿损失等违约责任。' },
  tort1165: { title: '《民法典》第一千一百六十五条', text: '行为人因过错侵害他人民事权益造成损害的，应当承担侵权责任。依照法律规定推定行为人有过错，其不能证明自己没有过错的，应当承担侵权责任。' },
  tort1179: { title: '《民法典》第一千一百七十九条', text: '侵害他人造成人身损害的，应当赔偿医疗费、护理费、交通费、营养费、住院伙食补助费等为治疗和康复支出的合理费用，以及因误工减少的收入。' },
  civ003: { title: '《民法典》第三条', text: '民事主体的人身权利、财产权利以及其他合法权益受法律保护，任何组织或者个人不得侵犯。' },
};

/* 社保法领域意图（命中则走社保法 RAG 后端；未命中走下方演示模板） */
const SOCIAL_RE = /社保|社会保险|养老|养老金|退休|医保|医疗|生育|工伤|失业|失业保险|基金|缴费|参保|待遇|经办|报销|个人账户|累计缴费|抚恤|工亡/;
const SOCIAL_TAGS = ['社会保险', '定向 RAG 检索'];
function isSocialQuestion(text) { return SOCIAL_RE.test(text); }

/* 回答模板：按关键词路由（演示多标签意图识别）。
   注意：match 必须是【正则数组】——findTemplate 用 for...of 遍历 t.match。 */
const REPLY_TEMPLATES = [
  {
    match: [SOCIAL_RE],
    tags: ['社会保险', '养老保险', '医疗保险', '参保缴费'],
    summary: '社保法相关咨询将接通社保法 RAG 知识库实时检索（需启动 social_insurance/api_server.py）。当前为演示占位回答。',
    cites: ['civ003'],
    steps: ['启动社保法 RAG 服务后，将返回基于《中华人民共和国社会保险法》条文原文的可溯源回答。'],
  },
  {
    match: [/欠薪|工资|劳动|仲裁|离职|加班|补偿/],
    tags: ['劳动人事', '欠薪', '已离职', '仲裁时效'],
    summary: '用人单位拖欠劳动报酬，劳动者有权要求足额支付并主张经济补偿。建议先协商、再投诉、后仲裁，注意一年仲裁时效。',
    cites: ['labor30', 'labor46'],
    steps: ['保留劳动合同、工资条、考勤记录、离职证明等证据。', '向用人单位所在地劳动监察大队投诉，或拨打 12333。', '协商无果则在离职之日起一年内申请劳动仲裁，可同时主张经济补偿。'],
  },
  {
    match: [/合同|押金|租赁|违约|订金|定金|退款/],
    tags: ['合同纠纷', '押金退还', '租赁', '违约责任'],
    summary: '押金退还纠纷属于合同纠纷，可依据合同约定与《民法典》相关规定主张返还。建议先协商，协商不成可向法院起诉或申请调解。',
    cites: ['civil509', 'civil577'],
    steps: ['保留租赁合同、押金收据、沟通记录等证据。', '与对方书面协商，明确退还期限及逾期责任。', '协商无果可向合同履行地人民法院起诉或申请人民调解。'],
  },
  {
    match: [/事故|侵权|交通|人身损害|赔偿/],
    tags: ['侵权责任', '交通事故', '责任认定', '人身损害'],
    summary: '责任认定后，可依据过错比例主张医疗费、误工费等赔偿；人身损害赔偿的诉讼时效为三年，注意及时主张权利。',
    cites: ['tort1165', 'tort1179'],
    steps: ['保存事故认定书、医疗票据、误工证明、护理记录等证据。', '先与对方及其保险公司协商理赔方案。', '协商不成可向事故发生地人民法院起诉，主张合理赔偿。'],
  },
];
const DEFAULT_TEMPLATE = {
  tags: ['民事', '综合咨询'],
  summary: '您的问题涉及民事权益保护。建议先梳理事实与证据，明确诉求后选择协商、调解或诉讼路径；如需进一步判断，可补充事件经过与相关证据。',
  cites: ['civ003'],
  steps: ['梳理事件时间线，整理并保存相关书面、电子证据。', '明确您的核心诉求与主张金额/事项。', '据此选择协商、调解或诉讼路径，注意法定时效。'],
};

const RECOMMENDED = ['离职后多久可申请劳动仲裁？', '拖欠工资的经济补偿怎么计算？', '没有劳动合同还能维权吗？', '劳动监察投诉需要哪些材料？'];

let sessions = [
  {
    id: 's1', title: '公司拖欠工资怎么办', time: '今天 10:23', domain: '劳动人事', active: true,
    messages: [
      { role: 'user', text: '公司拖欠我两个月工资，我已经离职，应该怎么做才能拿到钱？', time: '今天 10:23' },
      { role: 'ai', summary: '用人单位拖欠劳动报酬，劳动者有权要求足额支付并主张经济补偿。建议先协商、再投诉、后仲裁，注意一年仲裁时效。', cites: ['labor30', 'labor46'], steps: ['保留劳动合同、工资条、考勤记录、离职证明等证据。', '向用人单位所在地劳动监察大队投诉，或拨打 12333。', '协商无果则在离职之日起一年内申请劳动仲裁，可同时主张经济补偿。'], time: '10:23' },
    ],
  },
  {
    id: 's2', title: '租房押金不退', time: '昨天 16:45', domain: '合同纠纷', active: false,
    messages: [
      { role: 'user', text: '房东以房屋有损坏为由扣留押金不给退，合理吗？', time: '16:43' },
      { role: 'ai', summary: '如房屋损坏并非您造成或已按约定恢复，房东无权扣留押金。可先协商要求退还，协商不成可诉至法院。', cites: ['civil577'], steps: ['提供入住与退租时的房屋照片、押金收据。', '向房东发书面函件要求限期退还。', '仍不退可向法院起诉返还押金及利息。'], time: '16:45' },
    ],
  },
  {
    id: 's3', title: '交通事故责任认定', time: '8-23', domain: '侵权责任', active: false,
    messages: [
      { role: 'user', text: '交通事故认定书判我全责，但对赔偿金额有异议怎么办？', time: '09:20' },
      { role: 'ai', summary: '对责任认定有异议可在法定期限内申请复核；对赔偿金额有异议可主张依实际损失核算。', cites: ['tort1165'], steps: ['三日内向上一级交警部门申请复核。', '核对各项损失的票据与证明。', '协商不成可起诉由法院核定赔偿。'], time: '09:22' },
    ],
  },
  {
    id: 's4', title: '竞业限制补偿标准', time: '8-20', domain: '劳动人事', active: false,
    messages: [
      { role: 'user', text: '离职后被竞业限制条款约束，补偿金标准怎么算？', time: '14:05' },
      { role: 'ai', summary: '竞业限制期限内用人单位应按月支付经济补偿，标准一般不低于劳动合同解除前十二个月平均工资的 30%。', cites: ['labor46'], steps: ['核对竞业限制协议中的补偿条款。', '如未约定或未足额支付，可要求补足。', '用人单位三个月未支付，可请求解除竞业限制。'], time: '14:06' },
    ],
  },
];
let activeSession = sessions[0];

function findTemplate(text) {
  for (const t of REPLY_TEMPLATES) {
    for (const m of t.match) if (m.test(text)) return t;
  }
  return null;
}

/* 引用归一化：字符串作法条 id 查表（演示模板），对象直接用（RAG 返回） */
function normCite(c) { return typeof c === 'string' ? LAWS[c] : c; }

function msgHTML(m) {
  if (m.role === 'user') {
    return `<div class="msg msg-user"><div><div class="bubble">${escapeHTML(m.text)}</div><div class="t">${m.time}</div></div></div>`;
  }
  const citesSrc = (m.cites || []).map(normCite);
  let cites = '';
  if (citesSrc.length) {
    cites = `<div class="sec-label">引用法条</div>` + citesSrc.map(c =>
      `<div class="cite"><div class="law">${escapeHTML(c.title)}</div><p>${escapeHTML(c.text)}</p></div>`).join('');
  }
  let steps = '';
  if (m.steps && m.steps.length) {
    steps = `<div class="sec-label">行动建议</div><ol class="steps">` + m.steps.map(s => `<li>${escapeHTML(s)}</li>`).join('') + `</ol>`;
  }
  const plainText = `${m.summary}\n\n引用法条：\n${citesSrc.map(c => `${c.title}：${c.text}`).join('\n')}\n\n行动建议：\n${(m.steps || []).map((s, i) => `${i + 1}. ${s}`).join('\n')}`;
  return `<div class="msg msg-ai"><div class="avatar-bot">${icon('robot')}</div><div class="bubble">
    <div class="sec-label">摘要</div><p class="summary">${escapeHTML(m.summary)}</p>
    ${cites}${steps}
    <div class="msg-actions">
      <button class="msg-action copy-btn" data-text="${escapeHTML(plainText)}">${icon('copy')}复制</button>
      <button class="msg-action like-btn">${icon('like')}点赞</button>
    </div>
  </div></div>`;
}
function escapeHTML(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }

function renderMessages() {
  $('#chatMsgs').innerHTML = activeSession.messages.map(msgHTML).join('');
  scrollChat();
}
function renderHistory() {
  $('#historyList').innerHTML = sessions.map(s => `
    <div class="history-item ${s.id === activeSession.id ? 'active' : ''}" data-id="${s.id}">
      <div class="h-title"><span>${s.title}</span>${s.status ? `<span class="h-status">${s.status}</span>` : ''}</div>
      <div class="h-meta">${s.time} · <b>${s.domain}</b></div>
    </div>`).join('');
}
function sessionTags(session) {
  const userMsg = session.messages.filter(m => m.role === 'user').map(m => m.text).join(' ');
  return userMsg ? (findTemplate(userMsg) || DEFAULT_TEMPLATE).tags : DEFAULT_TEMPLATE.tags;
}
function renderTags(tags) {
  $('#questionTags').innerHTML = tags.map(t => `<span class="chip">${t}</span>`).join('');
}
function renderRecs() {
  $('#recList').innerHTML = RECOMMENDED.map(q => `<button class="rec-item">${q}</button>`).join('');
}
function scrollChat() { const el = $('#chatMsgs'); el.scrollTop = el.scrollHeight; }

function showTyping() {
  $('#chatMsgs').insertAdjacentHTML('beforeend',
    `<div class="msg msg-ai"><div class="avatar-bot">${icon('robot')}</div><div class="bubble typing"><i></i><i></i><i></i></div></div>`);
  scrollChat();
}
function finishAnswer(msg, tags) {
  const t = $('#chatMsgs .typing'); if (t) t.remove();
  activeSession.messages.push(msg);
  renderMessages();
  renderTags(tags);
}

/* 调用社保法 RAG 后端（阻塞式提问 → 返回 {answer, citations[]}） */
async function ragAnswer(question) {
  const res = await fetch(API_BASE + '/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });
  if (!res.ok) throw new Error('服务状态码 ' + res.status);
  const data = await res.json();
  if (!data.ok) throw new Error(data.message || '服务异常');
  return data;
}

function sendMessage(text) {
  if (!text.trim()) return;
  activeSession.messages.push({ role: 'user', text, time: '刚刚' });
  renderMessages();
  showTyping();

  // 社保法问题 → 走真实 RAG 后端；后端不可用时回退到演示模板
  if (API_BASE) {
    ragAnswer(text)
      .then(data => finishAnswer({
        role: 'ai',
        summary: '（社保法 RAG 实时检索）\n' + data.answer,
        cites: (data.citations || []).map(c => ({ title: c.title, text: c.text })),
        steps: [], time: '刚刚',
      }, SOCIAL_TAGS))
      .catch(err => {
        const tmpl = findTemplate(text) || DEFAULT_TEMPLATE;
        finishAnswer({
          role: 'ai',
          summary: `（社保法 RAG 服务未连接：${err.message}）\n${tmpl.summary}`,
          cites: tmpl.cites, steps: tmpl.steps, time: '刚刚',
        }, tmpl.tags);
        toast('社保法 RAG 服务未连接，已回退到演示回答');
      });
    return;
  }

  const tmpl = findTemplate(text) || DEFAULT_TEMPLATE;
  setTimeout(() => finishAnswer({
    role: 'ai', summary: tmpl.summary, cites: tmpl.cites, steps: tmpl.steps, time: '刚刚',
  }, tmpl.tags), 900);
}

function initChat() {
  renderHistory();
  renderMessages();
  renderRecs();
  renderTags(sessionTags(activeSession));

  $('#newChatBtn').addEventListener('click', () => {
    const id = 's' + Date.now();
    const ns = { id, title: '新会话', time: '刚刚', domain: '综合', status: '进行中',
      messages: [{ role: 'ai', summary: '您好，我是法智通法律智能助手。请描述您遇到的法律问题，我将基于定向 RAG 检索给出法规依据与行动建议。', cites: [], steps: [], time: '刚刚' }] };
    sessions.unshift(ns);
    activeSession = ns;
    renderHistory(); renderMessages(); renderTags(DEFAULT_TEMPLATE.tags);
  });

  $('#sendBtn').addEventListener('click', () => { const v = $('#chatInput').value; $('#chatInput').value = ''; if (v) sendMessage(v); });
  $('#chatInput').addEventListener('keydown', e => { if (e.key === 'Enter') { const v = e.target.value; e.target.value = ''; if (v) sendMessage(v); } });

  $('#historyList').addEventListener('click', e => {
    const item = e.target.closest('.history-item'); if (!item) return;
    activeSession = sessions.find(s => s.id === item.dataset.id);
    renderTags(sessionTags(activeSession));
    renderHistory(); renderMessages();
  });

  $('#recList').addEventListener('click', e => {
    const btn = e.target.closest('.rec-item'); if (!btn) return;
    sendMessage(btn.textContent.trim());
  });

  $('#chatMsgs').addEventListener('click', e => {
    const copy = e.target.closest('.copy-btn');
    if (copy) {
      const text = copy.dataset.text;
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => toast('回答已复制')).catch(() => toast('已复制'));
      else toast('已复制');
      return;
    }
    const like = e.target.closest('.like-btn');
    if (like) {
      like.classList.toggle('liked');
      toast(like.classList.contains('liked') ? '已点赞，感谢反馈' : '已取消点赞');
    }
  });
}

/* ============================================================
   合同审核
   ============================================================ */
function initReview() {
  const zone = $('#uploadZone');
  const fileInput = $('#fileInput');
  zone.addEventListener('click', () => fileInput.click());
  $('#chooseFileBtn').addEventListener('click', e => { e.stopPropagation(); fileInput.click(); });
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('dragover');
    const f = e.dataTransfer.files[0];
    if (f) handleUpload(f.name.replace(/\.[^.]+$/, ''));
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) handleUpload(fileInput.files[0].name.replace(/\.[^.]+$/, ''));
    fileInput.value = '';
  });

  $$('#reviewHistory .history-item').forEach(item => {
    item.addEventListener('click', () => {
      $$('#reviewHistory .history-item').forEach(i => i.classList.remove('selected'));
      item.classList.add('selected');
      $('#previewName').textContent = item.dataset.title;
      toast('已切换历史审核（演示数据加载示例合同）');
    });
  });
}
function handleUpload(name) {
  $('#previewName').textContent = (name || '技术服务合同') + '_v3.pdf';
  toast(`文件已上传（${name || '示例'}），演示环境已加载示例审核结果`);
}

/* ============================================================
   数据看板
   ============================================================ */
const TREND = {
  '7d': { labels: ['08-19', '08-20', '08-21', '08-22', '08-23', '08-24', '08-25'], values: [86, 102, 95, 118, 110, 122, 128] },
  '30d': { labels: genLabels(30), values: genValues(30) },
  'month': { labels: genLabels(22), values: genValues(22) },
};
function genLabels(n) { const a = []; for (let i = n - 1; i >= 0; i--) a.push('08-' + String(26 - i).padStart(2, '0')); return a; }
function genValues(n) { const a = []; let v = 70; for (let i = 0; i < n; i++) { v += Math.round(Math.sin(i / 2) * 8 + (i % 3) * 3 - 2); v = Math.max(40, v); a.push(v); } return a; }

const BARS = {
  '7d': { labels: ['劳动', '合同', '婚姻', '侵权', '其他'], values: [42, 27, 13, 11, 7] },
  '30d': { labels: ['劳动', '合同', '婚姻', '侵权', '其他'], values: [38, 31, 15, 9, 7] },
  'month': { labels: ['劳动', '合同', '婚姻', '侵权', '其他'], values: [40, 29, 14, 10, 7] },
};

function lineChartSVG(labels, values) {
  const W = 760, H = 280, PL = 30, PR = 30, PT = 20, PB = 40;
  const min = Math.min(...values) * 0.9, max = Math.max(...values) * 1.06;
  const xs = i => PL + (W - PL - PR) * i / (labels.length - 1);
  const ys = v => PT + (H - PT - PB) * (1 - (v - min) / (max - min));
  const pts = values.map((v, i) => [xs(i), ys(v)]);
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
  const area = line + ` L ${xs(labels.length - 1).toFixed(1)} ${H - PB} L ${PL} ${H - PB} Z`;
  const last = pts[pts.length - 1];
  let grid = '';
  for (let g = 1; g <= 3; g++) { const gy = PT + (H - PT - PB) * g / 4; grid += `<line x1="${PL}" y1="${gy}" x2="${W - PR}" y2="${gy}" stroke="#eef1f6"/>`; }
  let dots = '';
  pts.forEach((p, i) => { dots += `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="#fff" stroke="#2563eb" stroke-width="2"/>`; });
  const step = labels.length > 10 ? Math.ceil(labels.length / 7) : 1;
  let xlabels = '';
  labels.forEach((lb, i) => { if (i % step === 0 || i === labels.length - 1) xlabels += `<text x="${xs(i)}" y="${H - 12}" text-anchor="middle" font-size="12" fill="#8a94a6">${lb}</text>`; });
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2563eb" stop-opacity=".18"/><stop offset="1" stop-color="#2563eb" stop-opacity="0"/></linearGradient></defs>
    ${grid}
    <path d="${area}" fill="url(#areaFill)"/>
    <path d="${line}" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round"/>
    ${dots}
    <circle cx="${last[0]}" cy="${last[1]}" r="5" fill="#2563eb" stroke="#fff" stroke-width="2"/>
    ${xlabels}
  </svg>`;
}
const BAR_COLORS = ['#2563eb', '#60a5fa', '#93c5fd', '#1d4ed8', '#bfdbfe'];

function renderBars(data) {
  const max = Math.max(...data.values);
  $('#barChart').innerHTML = data.labels.map((lb, i) => {
    const h = Math.round(data.values[i] / max * 180);
    return `<div class="bar"><span class="bar-val">${data.values[i]}%</span><div class="bar-col" style="height:${h}px;background:${BAR_COLORS[i]}"></div><span class="bar-label">${lb}</span></div>`;
  }).join('');
}
function renderLine() { $('#lineChart').innerHTML = lineChartSVG(TREND[currentRange].labels, TREND[currentRange].values); }

const DASH_ROWS = [
  { src: '微信公众号', domain: '劳动纠纷', level: '高', value: '¥8,000', status: '待跟进', cls: 'follow' },
  { src: '抖音私信', domain: '合同审查', level: '中', value: '¥5,500', status: '已分配', cls: 'assigned' },
  { src: '企业官网', domain: '股权架构', level: '高', value: '¥25,000', status: '待跟进', cls: 'follow' },
  { src: '老客户转介', domain: '婚姻家事', level: '低', value: '¥3,200', status: '已归档', cls: 'archived' },
  { src: '百度推广', domain: '知识产权', level: '中', value: '¥12,000', status: '待跟进', cls: 'follow' },
];
function renderDashTable() {
  $('#dashTable').innerHTML = DASH_ROWS.map(r => `
    <tr><td>${r.src}</td><td>${r.domain}</td><td><span class="level-badge ${r.level === '高' ? 'high' : r.level === '中' ? 'mid' : 'low'}">${r.level}</span></td><td>${r.value}</td><td><span class="status-badge ${r.cls}">${r.status}</span></td><td><span class="link view-clue">查看</span></td></tr>`).join('');
  $$('#dashTable .view-clue').forEach(el => el.addEventListener('click', () => { location.hash = '#/leads'; toast('已跳转至案源线索跟进'); }));
}

let currentRange = '7d';
function initDashboard() {
  renderLine(); renderBars(BARS['7d']); renderDashTable();
  $('#dashFilter').addEventListener('click', e => {
    const btn = e.target.closest('.seg'); if (!btn) return;
    $$('#dashFilter .seg').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentRange = btn.dataset.range;
    renderLine(); renderBars(BARS[currentRange]);
    $('#barChart').closest('.chart-card').querySelector('.block-title').textContent = '咨询领域分布';
  });
}

/* ============================================================
   知识库管理
   ============================================================ */
const KB_ITEMS = [
  { name: '《劳动合同法》第38条', domain: '劳动人事', version: 'v2024.1', date: '2025-08-20', status: '已生效', cls: 'effective' },
  { name: '加班费计算判例集', domain: '劳动人事', version: 'v2025.3', date: '2025-08-22', status: '待校验', cls: 'pending' },
  { name: '《民法典》合同编第509条', domain: '合同纠纷', version: 'v2024.2', date: '2025-07-15', status: '已生效', cls: 'effective' },
  { name: '商标侵权认定指引', domain: '知识产权', version: 'v2025.1', date: '2025-08-18', status: '更新中', cls: 'updating' },
  { name: '刑事量刑指导意见', domain: '刑事辩护', version: 'v2023.4', date: '2024-12-10', status: '已过期', cls: 'expired' },
  { name: '公司治理章程模板库', domain: '公司商事', version: 'v2025.2', date: '2025-08-24', status: '已生效', cls: 'effective' },
];
let kbDomain = '', kbQuery = '';
function renderKbTable() {
  const rows = KB_ITEMS.filter(it =>
    (!kbDomain || it.domain === kbDomain) &&
    (!kbQuery || (it.name + it.domain + it.version).toLowerCase().includes(kbQuery.toLowerCase())));
  $('#kbTable').innerHTML = rows.length ? rows.map(it => `
    <tr><td>${it.name}</td><td>${it.domain}</td><td>${it.version}</td><td>${it.date}</td><td><span class="kb-badge ${it.cls}">${it.status}</span></td></tr>`).join('')
    : `<tr><td colspan="5" style="text-align:center;color:#8a94a6;">无匹配记录</td></tr>`;
  $('#kbTotal').textContent = `共 ${rows.length} 条记录`;
}
function initKnowledge() {
  renderKbTable();
  const tree = $('#kbTree');
  tree.addEventListener('click', e => {
    const parent = e.target.closest('.tree-parent');
    const child = e.target.closest('.tree-child');
    const node = e.target.closest('.tree-node');
    if (parent) {
      node.classList.toggle('open');
      return;
    }
    if (child) {
      $$('.tree-child').forEach(c => c.classList.remove('active'));
      $$('.tree-node').forEach(n => n.classList.remove('active'));
      child.classList.add('active');
      child.closest('.tree-node').classList.add('active');
      kbDomain = child.dataset.domain;
      renderKbTable();
    }
  });
  $('#kbSearch').addEventListener('input', e => { kbQuery = e.target.value.trim(); renderKbTable(); });
  $('#importBtn').addEventListener('click', () => toast('演示环境：请选择法条/判例文件（正式版支持版本化导入）'));
}

/* ============================================================
   案源线索
   ============================================================ */
let leads = [
  { id: 1, title: '劳动合同解除赔偿咨询', value: '高', source: '抖音私信', domain: '劳动纠纷', date: '2026-08-24', status: '待跟进', contact: '张先生 138****5678', desc: '用户已离职，公司拒绝支付 N+1 赔偿金，询问劳动仲裁所需的材料与时效，法律诉求明确、交易金额中等，建议优先跟进。' },
  { id: 2, title: '公司股权架构设计', value: '中', source: '公众号留言', domain: '公司法', date: '2026-08-23', status: '待跟进', contact: '李女士 186****1234', desc: '初创科技公司咨询创始人股权分配与期权池设计，属于潜在常法服务对象，需进一步沟通了解具体诉求。' },
  { id: 3, title: '交通事故责任认定复核', value: '高', source: '官网表单', domain: '交通事故', date: '2026-08-22', status: '待跟进', contact: '王先生 139****9012', desc: '对交警责任认定结果有异议，涉及较大理赔金额，用户已表达强烈维权意愿，属高价值线索。' },
  { id: 4, title: '房屋租赁合同纠纷', value: '高', source: '抖音私信', domain: '合同纠纷', date: '2026-08-21', status: '已邀约', contact: '陈女士 137****4455', desc: '房东扣押押金且涉及装修损失争议，证据充分、标的适中，已邀约到所面谈。' },
  { id: 5, title: '工伤认定与赔偿', value: '中', source: '400 电话', domain: '劳动纠纷', date: '2026-08-20', status: '已邀约', contact: '刘先生 158****7788', desc: '工作期间受伤，用人单位拖延申报工伤，用户希望通过法律途径获得全额赔偿。' },
  { id: 6, title: '知识产权侵权维权', value: '高', source: '企业微信', domain: '知识产权', date: '2026-08-18', status: '已转化', contact: '赵总 135****3322', desc: '合作企业产品被恶意仿冒，已达成委托代理，形成正式合作。' },
  { id: 7, title: '婚姻财产分割协议', value: '中', source: '官网表单', domain: '婚姻家事', date: '2026-08-15', status: '已转化', contact: '周女士 136****8899', desc: '咨询离婚财产分割与子女抚养事宜，已完成咨询并促成方案签订。' },
];
let leadFilter = '';

const valueBadge = v => v === '高' ? '<span class="value-badge high">高价值</span>' : '<span class="value-badge mid">中价值</span>';

function renderLeadCard(l) {
  const nextBtn = l.status === '待跟进' ? { label: '跟进', to: '已邀约' } : l.status === '已邀约' ? { label: '转化', to: '已转化' } : null;
  const actions = nextBtn
    ? `<div class="lead-actions"><button class="btn btn-primary sm" data-move="${l.id}" data-to="${nextBtn.to}">${nextBtn.label}</button><button class="btn btn-ghost sm" data-detail="${l.id}">详情</button></div>`
    : `<div class="lead-actions"><button class="btn btn-ghost sm" data-detail="${l.id}" style="flex:1">详情</button></div>`;
  return `<div class="lead-card">
    <div class="lead-card-top"><div class="lead-title">${l.title}</div>${valueBadge(l.value)}</div>
    <div class="lead-meta">
      <span>${icon('globe')}${l.source}</span>
      <span>${icon('tag')}${l.domain}</span>
      <span>${icon('cal')}${l.date}</span>
    </div>${actions}
  </div>`;
}
function renderLeads() {
  ['待跟进', '已邀约', '已转化'].forEach(st => {
    const col = $('#col-' + st);
    const list = leads.filter(l => l.status === st);
    col.querySelector('.col-count').textContent = list.length;
    col.querySelector('[data-status]').innerHTML = list.map(renderLeadCard).join('') || '<div style="color:#8a94a6;text-align:center;padding:20px 0;font-size:13px;">暂无线索</div>';
  });
}
function leadDetailHTML(l) {
  return `<div class="lead-detail">
    <div class="lead-title">${l.title}</div>
    <div style="display:flex;gap:8px;margin-bottom:16px;">${valueBadge(l.value)}<span class="status-badge ${l.status === '待跟进' ? 'follow' : l.status === '已邀约' ? 'assigned' : 'archived'}">${l.status}</span></div>
    <div class="lead-detail-rows">
      <div><b>来源</b><span>${l.source}</span></div>
      <div><b>领域</b><span>${l.domain}</span></div>
      <div><b>日期</b><span>${l.date}</span></div>
      <div><b>联系方式</b><span>${l.contact}</span></div>
    </div>
    <div class="lead-detail-desc">${l.desc}</div>
  </div>`;
}
function initLeads() {
  renderLeads();
  $('#leadDetail').innerHTML = `<div class="lead-detail-empty">${icon('cal', 'big')}<p>点击左侧卡片查看线索详情</p></div>`;
  $('#leadDetail').classList.add('lead-detail-empty');

  const grid = $('.leads-grid');
  grid.addEventListener('click', e => {
    const detail = e.target.closest('[data-detail]');
    if (detail) {
      const l = leads.find(x => x.id === Number(detail.dataset.detail));
      $('#leadDetail').classList.remove('lead-detail-empty');
      $('#leadDetail').innerHTML = leadDetailHTML(l);
      toast('已加载线索详情');
      return;
    }
    const move = e.target.closest('[data-move]');
    if (move) {
      const l = leads.find(x => x.id === Number(move.dataset.move));
      l.status = move.dataset.to;
      renderLeads();
      toast(`线索「${l.title}」已流转至「${l.status}」`);
    }
  });

  $('#leadTabs').addEventListener('click', e => {
    const btn = e.target.closest('.lead-tab'); if (!btn) return;
    const isActive = btn.classList.contains('active');
    $$('#leadTabs .lead-tab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    leadFilter = isActive ? '' : btn.dataset.status;
    if (leadFilter) {
      ['待跟进', '已邀约', '已转化'].forEach(st => {
        $('#col-' + st).classList.toggle('dim', st !== leadFilter);
      });
    } else {
      ['待跟进', '已邀约', '已转化'].forEach(st => $('#col-' + st).classList.remove('dim'));
    }
  });
}

/* ============================================================
   顶栏 / 页脚 / 导出
   ============================================================ */
function initGlobal() {
  $('#bellBtn').addEventListener('click', () => toast('暂无新通知'));
  $('#avatarBtn').addEventListener('click', () => toast('演示环境 · 登录/鉴权暂未接入'));
  $('#exportBtn').addEventListener('click', () => toast('演示环境：报告已生成导出任务（正式版支持 PDF 下载）'));
}

/* ============================================================
   启动
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initChat();
  initReview();
  initDashboard();
  initKnowledge();
  initLeads();
  initGlobal();
  navigate();
});
