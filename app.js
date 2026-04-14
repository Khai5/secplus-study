// ── STATE ──────────────────────────────────────────────────────
const state = {
  view: 'home',
  quiz: {
    questions: [], current: 0, answers: [], started: false, finished: false,
    timer: null, seconds: 0,
    domains: ['general','threats','arch','ops','gov'], count: 20,
  },
  fc: {
    cards: [], index: 0, flipped: false,
    domain: 'all', known: new Set(), unknown: new Set(),
  },
  dict: { query: '', domain: 'all' },
  progress: JSON.parse(localStorage.getItem('sp_progress') || '{"sessions":[],"fcStats":{}}'),
};

function saveProgress() {
  localStorage.setItem('sp_progress', JSON.stringify(state.progress));
}

// ── ROUTER ─────────────────────────────────────────────────────
function navigate(view) {
  state.view = view;
  document.querySelectorAll('.nav-btn, .mob-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  document.getElementById('mobile-menu').classList.add('hidden');
  render();
}

document.getElementById('nav').addEventListener('click', e => {
  const btn = e.target.closest('[data-view]');
  if (btn) navigate(btn.dataset.view);
});
document.getElementById('mobile-menu').addEventListener('click', e => {
  const btn = e.target.closest('[data-view]');
  if (btn) navigate(btn.dataset.view);
});
document.getElementById('hamburger').addEventListener('click', () => {
  document.getElementById('mobile-menu').classList.toggle('hidden');
});

// ── UTILS ──────────────────────────────────────────────────────
function esc(s) { return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function highlight(text, q) {
  if (!q) return esc(text);
  const safe = q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  return esc(text).replace(new RegExp(`(${safe})`,'gi'),'<mark>$1</mark>');
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length-1; i > 0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}
function fmt(s) { return `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`; }

// ── RENDER DISPATCHER ──────────────────────────────────────────
function render() {
  const main = document.getElementById('main');
  switch (state.view) {
    case 'home':       main.innerHTML = renderHome(); break;
    case 'quiz':       main.innerHTML = renderQuiz(); bindQuiz(); break;
    case 'flashcards': main.innerHTML = renderFlashcards(); bindFlashcards(); break;
    case 'dictionary': main.innerHTML = renderDictionary(); bindDict(); break;
    case 'progress':   main.innerHTML = renderProgress(); break;
  }
}

// ── HOME ───────────────────────────────────────────────────────
function renderHome() {
  const sessions = state.progress.sessions;
  const lastScore = sessions.length ? sessions[sessions.length-1].pct : null;
  const best = sessions.length ? Math.max(...sessions.map(s=>s.pct)) : null;
  const fcKnown = Object.keys(state.progress.fcStats).filter(k=>state.progress.fcStats[k]==='known').length;

  return `
  <div class="home-hero">
    <div class="hero-tag">CompTIA SY0-701</div>
    <h1 class="hero-title">Security+<br><span>Study Hub</span></h1>
    <p class="hero-sub">Everything you need to pass the Security+ exam — quiz practice, flashcards, and a full glossary in one place.</p>
  </div>

  <div class="stat-row">
    <div class="stat-card"><span class="num">${QUESTIONS.length}</span><span class="lbl">Practice questions</span></div>
    <div class="stat-card"><span class="num">${TERMS.length}</span><span class="lbl">Glossary terms</span></div>
    <div class="stat-card"><span class="num">${sessions.length}</span><span class="lbl">Quizzes taken</span></div>
    <div class="stat-card"><span class="num">${best !== null ? best+'%' : '—'}</span><span class="lbl">Best score</span></div>
  </div>

  <p class="section-title">Study tools</p>
  <div class="feature-grid">
    <div class="feature-card" onclick="navigate('quiz')">
      <div class="feature-icon">✦</div>
      <div class="feature-title">Practice quiz</div>
      <div class="feature-desc">Randomised questions with instant feedback. Choose your domain and question count. Timed like the real exam.</div>
    </div>
    <div class="feature-card" onclick="navigate('flashcards')">
      <div class="feature-icon">◈</div>
      <div class="feature-title">Flashcards</div>
      <div class="feature-desc">Flip through ${TERMS.length} terms. Mark cards as known or still learning to focus your review.</div>
    </div>
    <div class="feature-card" onclick="navigate('dictionary')">
      <div class="feature-icon">▦</div>
      <div class="feature-title">Dictionary</div>
      <div class="feature-desc">Search and filter all ${TERMS.length} terms and abbreviations used in the SY0-701 exam.</div>
    </div>
    <div class="feature-card" onclick="navigate('progress')">
      <div class="feature-icon">◉</div>
      <div class="feature-title">Progress</div>
      <div class="feature-desc">Track your quiz scores over time, see your weak domains, and watch your improvement.</div>
    </div>
  </div>

  <div class="tip-box">
    <p><strong>Exam tip:</strong> The real Security+ (SY0-701) has up to 90 questions in 90 minutes with a passing score of <strong>750/900</strong>. Don't book until you're consistently scoring <strong>80%+</strong> on practice tests.</p>
  </div>`;
}

// ── QUIZ ───────────────────────────────────────────────────────
function renderQuiz() {
  const q = state.quiz;
  if (!q.started) return renderQuizSetup();
  if (q.finished)  return renderQuizResults();
  return renderQuizQuestion();
}

function renderQuizSetup() {
  const sel = state.quiz.domains;
  const initPool = QUESTIONS.filter(q => sel.includes(q.cat));
  const initMax  = Math.max(initPool.length, 5);
  const initVal  = Math.min(state.quiz.count || 20, initMax);
  const domains  = [
    { val:'general', label:'General concepts',        dot:'dot-general' },
    { val:'threats', label:'Threats &amp; attacks',   dot:'dot-threats' },
    { val:'arch',    label:'Architecture',             dot:'dot-arch' },
    { val:'ops',     label:'Operations',               dot:'dot-ops' },
    { val:'gov',     label:'Governance &amp; compliance', dot:'dot-gov' },
  ];
  return `
  <p class="section-title">Practice quiz</p>
  <div class="quiz-setup">
    <div class="setup-grid">
      <div class="setup-card">
        <div class="setup-label">DOMAINS</div>
        <div class="domain-check-group">
          ${domains.map(d => `
          <label class="domain-check-item">
            <input type="checkbox" class="domain-cb" value="${d.val}" ${sel.includes(d.val)?'checked':''} onchange="updateDomainState()">
            <span class="domain-check-dot ${d.dot}"></span>
            <span class="domain-check-label">${d.label}</span>
          </label>`).join('')}
        </div>
        <div class="domain-toggle-row">
          <button class="domain-toggle-btn" onclick="toggleAllDomains()">select all / none</button>
        </div>
      </div>
      <div class="setup-card">
        <div class="setup-label">NUMBER OF QUESTIONS</div>
        <div class="range-row">
          <input type="range" id="q-count" min="5" max="${initMax}" value="${initVal}" step="5"
            oninput="document.getElementById('q-count-display').textContent=this.value">
          <span class="range-val" id="q-count-display">${initVal}</span>
        </div>
      </div>
    </div>
    <div class="btn-row">
      <button class="btn" onclick="startQuiz()">Start quiz →</button>
    </div>
  </div>

  <p class="section-title" style="margin-top:2rem">Recent scores</p>
  ${state.progress.sessions.length === 0
    ? '<div class="empty-state"><div class="empty-icon">◎</div><p>No quizzes taken yet</p></div>'
    : state.progress.sessions.slice(-5).reverse().map(s => `
      <div class="history-item">
        <span class="history-date">${s.date}</span>
        <span class="history-info">${s.count} questions · ${s.domain}</span>
        <span class="history-score" style="color:${s.pct>=75?'var(--green)':'var(--red)'}">${s.pct}%</span>
      </div>`).join('')}`;
}

function updateDomainState() {
  const checks = document.querySelectorAll('.domain-cb:checked');
  const domains = Array.from(checks).map(c => c.value);
  state.quiz.domains = domains;
  const pool = QUESTIONS.filter(q => domains.includes(q.cat));
  const slider = document.getElementById('q-count');
  const disp   = document.getElementById('q-count-display');
  if (slider) {
    const max = Math.max(pool.length, 5);
    slider.max = max;
    const clamped = Math.min(parseInt(slider.value) || 5, max);
    const stepped = Math.max(5, Math.round(clamped / 5) * 5);
    const final = Math.min(stepped, max);
    slider.value = final;
    if (disp) disp.textContent = final;
  }
}

function toggleAllDomains() {
  const checks = document.querySelectorAll('.domain-cb');
  const allChecked = Array.from(checks).every(c => c.checked);
  checks.forEach(c => { c.checked = !allChecked; });
  updateDomainState();
}

function startQuiz() {
  const checks = document.querySelectorAll('.domain-cb:checked');
  const domains = Array.from(checks).map(c => c.value);
  if (domains.length === 0) { alert('Please select at least one domain.'); return; }

  const count = parseInt(document.getElementById('q-count').value);
  const pool  = QUESTIONS.filter(q => domains.includes(q.cat));
  const selected = shuffle(pool).slice(0, Math.min(count, pool.length));

  const allKeys = ['general','threats','arch','ops','gov'];
  const domainLabel = domains.length === allKeys.length
    ? 'All domains'
    : domains.map(d => DOMAIN_META[d]?.label || d).join(', ');

  state.quiz = {
    questions: selected, current: 0, answers: new Array(selected.length).fill(null),
    started: true, finished: false, timer: null,
    seconds: selected.length * 60,
    domains, domainLabel, count: selected.length,
  };

  startTimer();
  render();
}

function startTimer() {
  if (state.quiz.timer) clearInterval(state.quiz.timer);
  state.quiz.timer = setInterval(() => {
    state.quiz.seconds--;
    const el = document.getElementById('quiz-timer');
    if (el) {
      el.textContent = fmt(state.quiz.seconds);
      el.className = 'timer' + (state.quiz.seconds < 300 ? (state.quiz.seconds < 60 ? ' danger' : ' warn') : '');
    }
    if (state.quiz.seconds <= 0) finishQuiz();
  }, 1000);
}

function renderQuizQuestion() {
  const q  = state.quiz;
  const qi = q.questions[q.current];
  const answered = q.answers[q.current] !== null;
  const pct = Math.round(((q.current + (answered?1:0)) / q.questions.length) * 100);
  const meta = DOMAIN_META[qi.cat];

  return `
  <div class="q-progress-bar"><div class="q-progress-fill" style="width:${pct}%"></div></div>
  <div class="q-meta">
    <span class="q-counter">Question ${q.current+1} of ${q.questions.length}</span>
    <span class="q-domain ${meta.qd}">${meta.label}</span>
    <span class="timer" id="quiz-timer">${fmt(q.seconds)}</span>
  </div>
  <div class="q-card">
    <div class="q-text">${esc(qi.q)}</div>
    ${qi.options.map((opt, i) => {
      let cls = 'option';
      if (answered) {
        if (i === qi.answer) cls += ' reveal';
        else if (i === q.answers[q.current]) cls += ' wrong';
      }
      return `<button class="${cls}" onclick="answerQuiz(${i})" ${answered?'disabled':''}><span class="opt-letter">${String.fromCharCode(65+i)}.</span>${esc(opt)}</button>`;
    }).join('')}
    ${answered ? `<div class="explanation"><strong>Explanation:</strong> ${esc(qi.exp)}</div>` : ''}
  </div>
  <div class="btn-row">
    <button class="btn-ghost" onclick="quizNav(-1)" ${q.current===0?'disabled':''}>← Back</button>
    ${q.current < q.questions.length-1
      ? `<button class="btn" onclick="quizNav(1)">Next →</button>`
      : `<button class="btn" onclick="finishQuiz()">Finish →</button>`}
    <span style="margin-left:auto;font-family:var(--mono);font-size:12px;color:var(--text3)">${q.answers.filter(a=>a!==null).length}/${q.questions.length} answered</span>
  </div>`;
}

function answerQuiz(i) {
  if (state.quiz.answers[state.quiz.current] !== null) return;
  state.quiz.answers[state.quiz.current] = i;
  render(); startTimer();
}

function quizNav(dir) {
  state.quiz.current = Math.max(0, Math.min(state.quiz.questions.length-1, state.quiz.current+dir));
  render(); startTimer();
}

function finishQuiz() {
  clearInterval(state.quiz.timer);
  state.quiz.finished = true;

  const q = state.quiz;
  let correct = 0;
  q.questions.forEach((qi,i) => { if (q.answers[i] === qi.answer) correct++; });
  const pct = Math.round((correct / q.questions.length) * 100);

  state.progress.sessions.push({
    date: new Date().toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}),
    count: q.questions.length, domain: q.domainLabel || 'All domains', pct, correct,
  });
  saveProgress();
  render();
}

function renderQuizResults() {
  const q = state.quiz;
  let correct = 0;
  const domainMap = {};
  q.questions.forEach((qi,i) => {
    const isCorrect = q.answers[i] === qi.answer;
    if (isCorrect) correct++;
    if (!domainMap[qi.cat]) domainMap[qi.cat] = {correct:0,total:0};
    domainMap[qi.cat].total++;
    if (isCorrect) domainMap[qi.cat].correct++;
  });
  const pct = Math.round((correct/q.questions.length)*100);
  const pass = pct >= 75;
  const timeTaken = (q.count * 60) - q.seconds;

  return `
  <div class="results-card">
    <div class="results-score" style="color:${pass?'var(--green)':'var(--red)'}">${pct}%</div>
    <div class="results-label">${correct}/${q.questions.length} correct &nbsp;·&nbsp; ${pass ? 'Pass ✓' : 'Keep studying'} &nbsp;·&nbsp; ${fmt(timeTaken)} taken</div>
    <div class="results-grid">
      <div class="res-box"><span class="res-num" style="color:var(--green)">${correct}</span><span class="res-lbl">Correct</span></div>
      <div class="res-box"><span class="res-num" style="color:var(--red)">${q.questions.length-correct}</span><span class="res-lbl">Incorrect</span></div>
      <div class="res-box"><span class="res-num" style="color:var(--amber)">${q.answers.filter(a=>a===null).length}</span><span class="res-lbl">Skipped</span></div>
    </div>
    <div class="domain-breakdown">
      ${Object.entries(domainMap).map(([cat,s])=>{
        const m = DOMAIN_META[cat];
        const dp = Math.round((s.correct/s.total)*100);
        return `<div class="domain-row-r"><span class="domain-name">${m.label}</span><span class="domain-score" style="color:${dp>=75?'var(--green)':dp<50?'var(--red)':'var(--amber)'}">${s.correct}/${s.total} (${dp}%)</span></div>`;
      }).join('')}
    </div>
  </div>
  <div class="btn-row">
    <button class="btn" onclick="state.quiz.started=false;state.quiz.finished=false;render()">New quiz</button>
    <button class="btn-ghost" onclick="reviewQuiz()">Review answers</button>
  </div>`;
}

function reviewQuiz() {
  const q = state.quiz;
  const main = document.getElementById('main');
  let html = '<p class="section-title">Answer review</p>';
  q.questions.forEach((qi,i)=>{
    const userAns = q.answers[i];
    const correct = userAns === qi.answer;
    html += `
    <div class="q-card" style="margin-bottom:12px;border-left:3px solid ${correct?'var(--green)':'var(--red)'}">
      <div style="font-family:var(--mono);font-size:11px;color:var(--text3);margin-bottom:8px">Q${i+1} · ${DOMAIN_META[qi.cat].label}</div>
      <div class="q-text" style="margin-bottom:10px">${esc(qi.q)}</div>
      ${qi.options.map((opt,oi)=>{
        let bg=''; let col='var(--text2)';
        if(oi===qi.answer){bg='rgba(57,217,138,0.08)';col='var(--green)';}
        else if(oi===userAns){bg='rgba(240,79,95,0.08)';col='var(--red)';}
        return `<div style="padding:8px 12px;border-radius:6px;background:${bg};color:${col};font-size:13px;margin-bottom:6px"><span style="font-family:var(--mono);font-size:11px;opacity:0.6;margin-right:8px">${String.fromCharCode(65+oi)}.</span>${esc(opt)}${oi===qi.answer?' ✓':oi===userAns?' ✗':''}</div>`;
      }).join('')}
      <div class="explanation" style="margin-top:8px"><strong>Explanation:</strong> ${esc(qi.exp)}</div>
    </div>`;
  });
  html += `<div class="btn-row" style="margin-top:1rem"><button class="btn-ghost" onclick="state.quiz.finished=true;render()">← Back to results</button></div>`;
  main.innerHTML = html;
}

function bindQuiz() {}

// ── FLASHCARDS ─────────────────────────────────────────────────
function renderFlashcards() {
  const fc = state.fc;
  const pool = fc.domain === 'all' ? TERMS : TERMS.filter(t => t.cat === fc.domain);

  if (fc.cards.length === 0 || fc._domain !== fc.domain) {
    fc._domain = fc.domain;
    fc.cards = shuffle(pool);
    fc.index = 0; fc.flipped = false;
  }

  if (fc.cards.length === 0) return `<div class="empty-state"><div class="empty-icon">◎</div><p>No terms in this domain</p></div>`;

  const card = fc.cards[fc.index];
  const meta = DOMAIN_META[card.cat];
  const knownCount   = [...fc.known].filter(k=>fc.cards.some(c=>c.t===k)).length;
  const unknownCount = [...fc.unknown].filter(k=>fc.cards.some(c=>c.t===k)).length;
  const pct = Math.round(((fc.index+1)/fc.cards.length)*100);

  return `
  <p class="section-title">Flashcards</p>
  <div class="fc-setup">
    <select id="fc-domain" onchange="fcSetDomain(this.value)">
      <option value="all" ${fc.domain==='all'?'selected':''}>All domains</option>
      <option value="general" ${fc.domain==='general'?'selected':''}>General concepts</option>
      <option value="threats" ${fc.domain==='threats'?'selected':''}>Threats &amp; attacks</option>
      <option value="arch" ${fc.domain==='arch'?'selected':''}>Architecture</option>
      <option value="ops" ${fc.domain==='ops'?'selected':''}>Operations</option>
      <option value="gov" ${fc.domain==='gov'?'selected':''}>Governance &amp; compliance</option>
    </select>
    <button class="btn-ghost" onclick="fcShuffle()">Shuffle</button>
    <button class="btn-ghost" onclick="fcReset()">Reset</button>
  </div>

  <div class="fc-progress-bar"><div class="fc-progress-fill" style="width:${pct}%"></div></div>

  <div class="fc-scene" id="fc-scene" onclick="fcFlip()">
    <div class="fc-card ${fc.flipped?'flipped':''}" id="fc-card">
      <div class="fc-front">
        <div class="fc-hint">CLICK TO REVEAL DEFINITION</div>
        <span class="fc-domain-badge ${meta.badge}">${meta.label}</span>
        <div class="fc-term">${esc(card.t)}</div>
      </div>
      <div class="fc-back">
        <div class="fc-hint">DEFINITION</div>
        <span class="fc-domain-badge ${meta.badge}">${meta.label}</span>
        <div class="fc-def">${esc(card.d)}</div>
      </div>
    </div>
  </div>

  <div class="fc-nav">
    <button class="fc-btn" onclick="fcNav(-1)">←</button>
    <span class="fc-counter">${fc.index+1} / ${fc.cards.length}</span>
    <button class="fc-btn" onclick="fcNav(1)">→</button>
  </div>

  <div class="fc-controls">
    <button class="btn-ghost fc-unknown" onclick="fcMark('unknown')">Still learning</button>
    <button class="btn-ghost fc-known" onclick="fcMark('known')">Got it ✓</button>
  </div>

  <div class="fc-stats">
    <span class="fc-known-count">✓ ${knownCount} known</span>
    <span class="fc-unknown-count">✗ ${unknownCount} still learning</span>
    <span class="fc-left-count">◎ ${fc.cards.length - knownCount - unknownCount} unmarked</span>
  </div>`;
}

function fcFlip() {
  state.fc.flipped = !state.fc.flipped;
  const card = document.getElementById('fc-card');
  if (card) card.classList.toggle('flipped', state.fc.flipped);
}

function fcNav(dir) {
  state.fc.index = (state.fc.index + dir + state.fc.cards.length) % state.fc.cards.length;
  state.fc.flipped = false;
  render();
}

function fcMark(status) {
  const term = state.fc.cards[state.fc.index].t;
  if (status === 'known') {
    state.fc.known.add(term);
    state.fc.unknown.delete(term);
    state.progress.fcStats[term] = 'known';
  } else {
    state.fc.unknown.add(term);
    state.fc.known.delete(term);
    state.progress.fcStats[term] = 'unknown';
  }
  saveProgress();
  if (state.fc.index < state.fc.cards.length - 1) fcNav(1);
  else render();
}

function fcShuffle() {
  state.fc.cards = shuffle(state.fc.cards);
  state.fc.index = 0; state.fc.flipped = false;
  render();
}

function fcReset() {
  state.fc.known.clear(); state.fc.unknown.clear();
  state.fc.index = 0; state.fc.flipped = false;
  render();
}

function fcSetDomain(d) {
  state.fc.domain = d;
  state.fc.cards = [];
  state.fc.known.clear(); state.fc.unknown.clear();
  render();
}

function bindFlashcards() {}

// ── DICTIONARY ─────────────────────────────────────────────────
function renderDictionary() {
  const { query, domain } = state.dict;
  const filtered = TERMS.filter(t => {
    const dm = domain === 'all' || t.cat === domain;
    const qm = !query || t.t.toLowerCase().includes(query) || t.d.toLowerCase().includes(query);
    return dm && qm;
  }).sort((a,b) => a.t.localeCompare(b.t,undefined,{sensitivity:'base'}));

  let listHtml = ''; let lastLetter = '';
  filtered.forEach(t => {
    const letter = t.t[0].toUpperCase();
    if (letter !== lastLetter) { listHtml += `<div class="dict-letter">${esc(letter)}</div>`; lastLetter = letter; }
    const m = DOMAIN_META[t.cat];
    listHtml += `
    <div class="dict-row">
      <div class="dict-term-cell">
        <div class="dict-term-name">${highlight(t.t, query)}</div>
        <span class="dict-badge ${m.badge}">${esc(m.label)}</span>
      </div>
      <div class="dict-def">${highlight(t.d, query)}</div>
    </div>`;
  });
  if (!filtered.length) listHtml = '<div class="empty-state"><div class="empty-icon">◎</div><p>No terms match</p></div>';

  const domains = ['all','general','threats','arch','ops','gov'];
  const dLabels = {'all':'All','general':'General','threats':'Threats','arch':'Architecture','ops':'Operations','gov':'Governance'};

  return `
  <p class="section-title">Dictionary</p>
  <div class="dict-controls">
    <input type="text" id="dict-search" value="${esc(query)}" placeholder="Search ${TERMS.length} terms..." oninput="state.dict.query=this.value;render()">
  </div>
  <div class="chip-row">
    ${domains.map(d=>`<button class="chip${domain===d?' active':''}" onclick="state.dict.domain='${d}';render()">${esc(dLabels[d])}</button>`).join('')}
  </div>
  <div class="dict-count">${filtered.length} term${filtered.length!==1?'s':''}</div>
  <div class="dict-list">${listHtml}</div>`;
}

function bindDict() {
  const el = document.getElementById('dict-search');
  if (el) { el.focus(); el.selectionStart = el.selectionEnd = el.value.length; }
}

// ── PROGRESS ───────────────────────────────────────────────────
function renderProgress() {
  const sessions = state.progress.sessions;
  const fcStats  = state.progress.fcStats;

  const totalQuestions = sessions.reduce((s,r) => s + r.count, 0);
  const avgScore = sessions.length ? Math.round(sessions.reduce((s,r) => s+r.pct, 0) / sessions.length) : 0;
  const bestScore = sessions.length ? Math.max(...sessions.map(s=>s.pct)) : 0;
  const fcKnown  = Object.values(fcStats).filter(v=>v==='known').length;

  // Domain accuracy from sessions (approximate from stored data)
  const domainAccuracy = {};
  sessions.forEach(s => {
    if (s.domain !== 'All domains') {
      const key = Object.keys(DOMAIN_META).find(k => DOMAIN_META[k].label === s.domain);
      if (key) {
        if (!domainAccuracy[key]) domainAccuracy[key] = {correct:0,total:0};
        domainAccuracy[key].correct += Math.round(s.pct/100 * s.count);
        domainAccuracy[key].total   += s.count;
      }
    }
  });

  return `
  <p class="section-title">Your progress</p>
  <div class="progress-grid">
    <div class="prog-card">
      <div class="prog-title">AVERAGE SCORE</div>
      <div class="prog-val" style="color:${avgScore>=75?'var(--green)':avgScore>=60?'var(--amber)':'var(--red)'}">${sessions.length?avgScore+'%':'—'}</div>
      <div class="prog-sub">across ${sessions.length} quiz${sessions.length!==1?'zes':''}</div>
      ${sessions.length ? `<div class="prog-bar-wrap"><div class="prog-bar-fill" style="width:${avgScore}%;background:${avgScore>=75?'var(--green)':avgScore>=60?'var(--amber)':'var(--red)'}"></div></div>` : ''}
    </div>
    <div class="prog-card">
      <div class="prog-title">BEST SCORE</div>
      <div class="prog-val">${sessions.length?bestScore+'%':'—'}</div>
      <div class="prog-sub">${bestScore>=75?'Passing score ✓':'Target: 75%+'}</div>
    </div>
    <div class="prog-card">
      <div class="prog-title">QUESTIONS ANSWERED</div>
      <div class="prog-val">${totalQuestions}</div>
      <div class="prog-sub">across all sessions</div>
    </div>
    <div class="prog-card">
      <div class="prog-title">FLASHCARDS KNOWN</div>
      <div class="prog-val">${fcKnown}</div>
      <div class="prog-sub">of ${TERMS.length} total terms</div>
      ${fcKnown ? `<div class="prog-bar-wrap"><div class="prog-bar-fill" style="width:${Math.round(fcKnown/TERMS.length*100)}%"></div></div>` : ''}
    </div>
  </div>

  ${Object.keys(domainAccuracy).length > 0 ? `
  <p class="section-title">Domain accuracy</p>
  ${Object.entries(domainAccuracy).map(([cat,s]) => {
    const pct = Math.round(s.correct/s.total*100);
    return `<div class="domain-prog-row">
      <div class="domain-prog-name">${DOMAIN_META[cat].label}</div>
      <div class="domain-prog-bar-wrap"><div class="domain-prog-bar-fill" style="width:${pct}%;background:${pct>=75?'var(--green)':pct>=60?'var(--amber)':'var(--red)'}"></div></div>
      <div class="domain-prog-pct">${pct}%</div>
    </div>`;
  }).join('')}` : ''}

  <p class="section-title" style="margin-top:2rem">Quiz history</p>
  ${sessions.length === 0
    ? `<div class="empty-state"><div class="empty-icon">◎</div><p>Take a quiz to see your history here</p></div>`
    : sessions.slice().reverse().map(s => `
      <div class="history-item">
        <span class="history-date">${s.date}</span>
        <span class="history-info">${s.count} q · ${s.domain}</span>
        <span class="history-score" style="color:${s.pct>=75?'var(--green)':'var(--red)'}">${s.pct}%</span>
      </div>`).join('')}

  ${sessions.length > 0 ? `<div class="btn-row" style="margin-top:1.5rem"><button class="btn-ghost" onclick="clearProgress()">Clear all progress</button></div>` : ''}`;
}

function clearProgress() {
  if (!confirm('Clear all progress data? This cannot be undone.')) return;
  state.progress = { sessions: [], fcStats: {} };
  state.fc.known.clear(); state.fc.unknown.clear();
  saveProgress();
  render();
}

// ── INIT ───────────────────────────────────────────────────────
render();
