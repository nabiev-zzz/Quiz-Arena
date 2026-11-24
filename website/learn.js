(() => {
  "use strict";
  const API = "https://humorous-imagination-production.up.railway.app";
  const $ = (id) => document.getElementById(id);
  const state = { token: localStorage.getItem("qa_access_token") || "", user: null, subjects: [], subject: null, topic: null, questions: [], answers: [], result: null, sessionId: null, index: 0, score: 0, selected: null, count: 10, difficulty: "medium", language: "uz", saved: false, saveError: false };
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
  const show = (el, visible = true) => el.classList.toggle("hidden", !visible);
  const notice = (message, error = false) => { const el=$("globalNotice"); el.textContent=message; el.className="notice"+(error?" error":""); show(el,true); window.scrollTo({top:document.body.scrollHeight,behavior:"smooth"}); };
  async function request(path, options = {}, authenticated = true) {
    const headers = { Accept:"application/json", "Content-Type":"application/json", ...(options.headers || {}) };
    if (authenticated && state.token) headers.Authorization = `Bearer ${state.token}`;
    const response = await fetch(API + path, { ...options, headers });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      if (response.status === 401 && authenticated) logout(false);
      const message = Array.isArray(data.message) ? data.message.join(" · ") : data.message;
      throw new Error(message || "So‘rov bajarilmadi. Qayta urinib ko‘ring.");
    }
    return data;
  }
  function setAuthMode(mode) {
    document.querySelectorAll("[data-auth]").forEach((button) => button.classList.toggle("active", button.dataset.auth === mode));
    show($("loginForm"), mode === "login"); show($("registerForm"), mode === "register");
    $("authError").textContent=""; show($("authError"),false);
  }
  function showAuthError(message) { $("authError").textContent=message; show($("authError"),true); }
  function setBusy(form, busy, label) { const button=form.querySelector("button[type=submit]"); button.disabled=busy; button.dataset.original ||= button.textContent; button.textContent=busy?label:button.dataset.original; }
  async function authenticate(form, mode) {
    const values=Object.fromEntries(new FormData(form).entries());
    setBusy(form,true,mode==="login"?"Tekshirilmoqda...":"Hisob yaratilmoqda...");
    try {
      const result=await request(mode==="login"?"/api/auth/login":"/api/auth/register",{method:"POST",body:JSON.stringify(values)},false);
      if(!result.accessToken) throw new Error("Server autentifikatsiya tokenini qaytarmadi.");
      state.token=result.accessToken; localStorage.setItem("qa_access_token",state.token);
      form.reset(); await loadWorkspace();
    } catch(error) { showAuthError(error.message); }
    finally { setBusy(form,false); }
  }
  function logout(showMessage = true) {
    state.token=""; state.user=null; state.subjects=[]; localStorage.removeItem("qa_access_token");
    show($("authView"),true); show($("appView"),false); show($("logoutBtn"),false); show($("userBadge"),false);
    if(showMessage) notice("Hisobdan chiqdingiz.");
  }
  async function loadWorkspace() {
    try {
      const [user, catalog, stats] = await Promise.all([
        request("/api/auth/me"), request("/api/learning/catalog"), request("/api/learning/stats")
      ]);
      state.user=user; state.subjects=Array.isArray(catalog)?catalog:[];
      $("displayName").textContent=user.displayName || user.username;
      $("userBadge").textContent="@"+user.username;
      show($("userBadge"),true); show($("logoutBtn"),true); show($("authView"),false); show($("appView"),true);
      renderStats(stats); renderSubjects(); renderRecent(stats.recentAttempts || []);
      $("year").textContent=new Date().getFullYear();
    } catch(error) {
      if(state.token) logout(false);
      showAuthError(error.message || "Ma’lumotlarni yuklashda xatolik.");
      show($("authView"),true); show($("appView"),false);
    }
  }
  function renderStats(stats) {
    const items=[
      ["Jami testlar",stats.totalAttempts || 0,"yakunlangan urinishlar"],
      ["Ishlangan savollar",stats.totalQuestions || 0,"barcha fanlar bo‘yicha"],
      ["To‘g‘ri javoblar",stats.correctAnswers || 0,"jami to‘g‘ri javob"],
      ["Aniqlik",Math.round(stats.accuracy || 0)+"%","umumiy natija"]
    ];
    $("statsGrid").innerHTML=items.map(([label,value,sub])=>`<article class="stat-card"><small>${label}</small><strong>${value}</strong><span>${sub}</span></article>`).join("");
  }
  function renderRecent(attempts) {
    $("recentAttempts").innerHTML=attempts.length?attempts.map((item)=>`<article class="recent-item"><div><strong>${escapeHtml(item.subjectName)} · ${escapeHtml(item.topicName)}</strong><small>${new Date(item.completedAt).toLocaleString("uz-UZ")} · ${item.totalQuestions} ta savol</small></div><span class="recent-score">${item.correctAnswers}/${item.totalQuestions} · ${Math.round(item.accuracy)}%</span></article>`).join(""):'<p class="muted">Hozircha test natijalari yo‘q. Birinchi testingizni boshlang.</p>';
  }
  function renderSubjects(filter="") {
    const list=state.subjects.filter((subject)=>subject.name.toLowerCase().includes(filter.toLowerCase()));
    $("subjectsGrid").innerHTML=list.length?list.map((subject)=>`<button class="subject-card" type="button" data-subject="${escapeHtml(subject.id)}" style="--accent:${escapeHtml(subject.color||"#a78bfa")};--tint:${escapeHtml(subject.color||"#a78bfa")}20"><span class="subject-icon">${escapeHtml(subject.icon||"✦")}</span><span><strong>${escapeHtml(subject.name)}</strong><small>${escapeHtml(subject.description||"Mavzularni o‘rganing")}</small></span><span class="count">${subject.topics?.length||0} mavzu →</span></button>`).join(""):'<div class="empty">Fan topilmadi.</div>';
  }
  function openSubject(subjectId) {
    const subject=state.subjects.find((item)=>item.id===subjectId); if(!subject)return;
    state.subject=subject; $("topicsTitle").textContent=subject.name; $("topicsSub").textContent=`${subject.topics.length} ta mavzu · Har biriga alohida test`;
    show($("topicsPanel"),true); $("topicSearch").value=""; renderTopics(); $("topicsPanel").scrollIntoView({behavior:"smooth",block:"start"});
  }
  function renderTopics(filter="") {
    const topics=(state.subject?.topics||[]).filter((topic)=>topic.name.toLowerCase().includes(filter.toLowerCase()));
    $("topicsList").innerHTML=topics.length?topics.map((topic,index)=>`<button class="topic-card" type="button" data-topic="${escapeHtml(topic.id)}"><span class="topic-num">${String(index+1).padStart(2,"0")}</span><span><strong>${escapeHtml(topic.name)}</strong><small>${escapeHtml(topic.description||"Mavzu testi")} · 20 ta savol bazasi</small></span><span class="arrow">→</span></button>`).join(""):'<div class="empty">Mavzu topilmadi.</div>';
  }
  function openTopic(topicId) {
    const topic=state.subject?.topics.find((item)=>item.id===topicId); if(!topic)return;
    state.topic=topic; state.count=Math.min(10,topic.questionCount||20); state.difficulty=topic.difficulty||"medium"; state.language="uz";
    show($("quizPanel"),true); show($("resultPanel"),false);
    const counts=[5,10,15,20].filter((n)=>n<=(topic.questionCount||20));
    $("quizPanel").innerHTML=`<div class="quiz-top"><button class="ghost" id="quizBack" type="button">← Mavzularga qaytish</button><span>${escapeHtml(state.subject.name)}</span></div><h2 class="question-title">${escapeHtml(topic.name)}</h2><p class="muted">Test sozlamalarini tanlang. Birinchi tayyorlashdan keyin savollar bazada saqlanadi.</p><div class="setup-fields"><label class="muted">Savollar soni<select id="questionCount" class="search">${counts.map((n)=>`<option value="${n}" ${n===state.count?"selected":""}>${n} ta</option>`).join("")}</select></label><label class="muted">Qiyinlik<select id="difficulty" class="search">${[["easy","Oson"],["medium","O‘rta"],["hard","Qiyin"],["expert","Ekspert"]].map(([v,l])=>`<option value="${v}" ${v===state.difficulty?"selected":""}>${l}</option>`).join("")}</select></label><label class="muted">Test tili<select id="testLanguage" class="search">${[["uz","O‘zbekcha"],["ru","Русский"],["en","English"]].map(([v,l])=>`<option value="${v}">${l}</option>`).join("")}</select></label></div><button id="startQuiz" class="primary" type="button">Testni boshlash <span>→</span></button><p class="muted">20 tagacha savol · Natijalar profilingizga saqlanadi</p>`;
    $("quizBack").addEventListener("click",()=>{show($("quizPanel"),false);$("topicsPanel").scrollIntoView({behavior:"smooth"});});
    $("startQuiz").addEventListener("click",startQuiz);
    $("quizPanel").scrollIntoView({behavior:"smooth",block:"start"});
  }
  async function startQuiz() {
    state.count=Number($("questionCount").value); state.difficulty=$("difficulty").value; state.language=$("testLanguage").value;
    $("quizPanel").innerHTML='<div class="loading"><div class="spinner"></div>Test savollari yuklanmoqda...</div>';
    try {
      const result=await request("/api/learning/web/questions",{method:"POST",body:JSON.stringify({subjectId:state.subject.id,topicId:state.topic.id,count:state.count,difficulty:state.difficulty,language:state.language})});
      if(!Array.isArray(result.questions)||result.questions.length!==state.count) throw new Error("Savollar soni mos kelmadi. Qayta urinib ko‘ring.");
      state.questions=result.questions; state.sessionId=result.sessionId; state.answers=[]; state.result=null; state.index=0; state.score=0; state.selected=null; state.saved=false; state.saveError=false;
      renderQuestion();
    } catch(error) { $("quizPanel").innerHTML=`<p class="notice error">${escapeHtml(error.message)}</p><button id="retryLoad" class="primary" type="button">Qayta urinish</button>`; $("retryLoad").addEventListener("click",startQuiz); }
  }
  function renderQuestion() {
    const q=state.questions[state.index]; if(!q)return finishQuiz();
    const letters=["A","B","C","D"];
    $("quizPanel").innerHTML=`<div class="quiz-top"><span>${escapeHtml(state.subject.name)} · ${escapeHtml(state.topic.name)}</span><span>${state.index+1} / ${state.questions.length}</span></div><div class="progress"><span style="width:${((state.index+1)/state.questions.length)*100}%"></span></div><h2 class="question-title">${escapeHtml(q.question)}</h2><div class="answer-list">${q.options.map((option,index)=>{let cls="";if(state.selected!==null&&index===state.selected)cls="";return `<button class="answer-option${cls}" data-answer="${index}" type="button" ${state.selected!==null?"disabled":""}><span class="letter">${letters[index]}</span><span>${escapeHtml(option)}</span></button>`;}).join("")}</div>${state.selected===null?"":'<div class="explanation">Javobingiz qabul qilindi. To‘g‘ri javob va tushuntirish test yakunida ko‘rsatiladi.</div>'}<div class="quiz-footer"><span class="muted">To‘g‘ri javoblar: ${state.score}</span>${state.selected===null?'<span class="muted">Javobni tanlang</span>':`<button id="nextQuestion" class="primary" type="button">${state.index===state.questions.length-1?"Natijani ko‘rish":"Keyingi savol"} <span>→</span></button>`}</div>`;
    $("quizPanel").querySelectorAll("[data-answer]").forEach((button)=>button.addEventListener("click",()=>chooseAnswer(Number(button.dataset.answer))));
    $("nextQuestion")?.addEventListener("click",()=>{state.index++;state.selected=null;renderQuestion();});
  }
  function chooseAnswer(index) {
    if(state.selected!==null)return;
    state.selected=index;
    state.answers[state.index]={questionId:state.questions[state.index].id,selectedAnswer:index};
    renderQuestion();
  }
  async function finishQuiz() {
    $("quizPanel").innerHTML='<div class="loading"><div class="spinner"></div>Javoblar serverda tekshirilmoqda va natijangiz saqlanmoqda...</div>';
    try {
      state.result=await request("/api/learning/web/attempts",{method:"POST",body:JSON.stringify({sessionId:state.sessionId,subjectId:state.subject.id,topicId:state.topic.id,language:state.language,difficulty:state.difficulty,answers:state.answers})});
      state.score=state.result.correctAnswers; state.saved=true;
    } catch(error) { state.saveError=true; state.saveMessage=error.message; }
    renderResult();
    try { const stats=await request("/api/learning/stats"); renderStats(stats); renderRecent(stats.recentAttempts||[]); } catch {}
  }
  function renderResult() {
    const result=state.result;
    if(!result) {
      show($("quizPanel"),false); show($("resultPanel"),true);
      $("resultPanel").innerHTML=`<div class="result-icon">⚠️</div><h2>Natijani saqlab bo‘lmadi</h2><p>${escapeHtml(state.saveMessage||"Server bilan aloqa uzildi. Internetni tekshirib qayta urinib ko‘ring.")}</p><div class="result-actions"><button id="retryQuiz" class="primary" type="button">Testni qayta boshlash ↻</button><button id="backToTopics" class="ghost" type="button">Mavzularga qaytish</button></div>`;
    } else {
      const percent=Math.round(result.accuracy);
      const letters=["A","B","C","D"];
      const review=result.review.map((item,index)=>`<article class="review-item"><div class="review-heading"><b>${index+1}. ${escapeHtml(item.question)}</b><span class="${item.isCorrect?"good":"bad"}">${item.isCorrect?"To‘g‘ri":"Noto‘g‘ri"}</span></div><p class="muted">Sizning javobingiz: ${letters[item.selectedAnswer]}. ${escapeHtml(item.options[item.selectedAnswer])}</p><p class="muted">To‘g‘ri javob: ${letters[item.correctAnswer]}. ${escapeHtml(item.options[item.correctAnswer])}</p><div class="explanation">${escapeHtml(item.explanation)}</div></article>`).join("");
      show($("quizPanel"),false); show($("resultPanel"),true);
      $("resultPanel").innerHTML=`<div class="result-icon">${percent>=80?"🏆":percent>=50?"✨":"📘"}</div><h2>Test yakunlandi!</h2><div class="result-score">${result.correctAnswers} / ${result.totalQuestions}</div><p>${percent}% aniqlik · Natija serverda tekshirildi va akkauntingizga saqlandi.</p><div class="review-list"><h3>Javoblar tahlili</h3>${review}</div><div class="result-actions"><button id="retryQuiz" class="primary" type="button">Yana test ishlash ↻</button><button id="backToTopics" class="ghost" type="button">Mavzularga qaytish</button></div>`;
    }
    $("retryQuiz").addEventListener("click",startQuiz);
    $("backToTopics").addEventListener("click",()=>{show($("resultPanel"),false);show($("quizPanel"),false);$("topicsPanel").scrollIntoView({behavior:"smooth"});});
    $("resultPanel").scrollIntoView({behavior:"smooth",block:"start"});
  }
  document.querySelectorAll("[data-auth]").forEach((button)=>button.addEventListener("click",()=>setAuthMode(button.dataset.auth)));
  $("loginForm").addEventListener("submit",(event)=>{event.preventDefault();void authenticate(event.currentTarget,"login");});
  $("registerForm").addEventListener("submit",(event)=>{event.preventDefault();void authenticate(event.currentTarget,"register");});
  $("logoutBtn").addEventListener("click",()=>logout());
  $("subjectSearch").addEventListener("input",(event)=>renderSubjects(event.target.value));
  $("subjectsGrid").addEventListener("click",(event)=>{const card=event.target.closest("[data-subject]");if(card)openSubject(card.dataset.subject);});
  $("topicSearch").addEventListener("input",(event)=>renderTopics(event.target.value));
  $("topicsList").addEventListener("click",(event)=>{const card=event.target.closest("[data-topic]");if(card)openTopic(card.dataset.topic);});
  $("backSubjects").addEventListener("click",()=>show($("topicsPanel"),false));
  $("refreshStats").addEventListener("click",async()=>{try{const stats=await request("/api/learning/stats");renderStats(stats);renderRecent(stats.recentAttempts||[]);notice("Statistika yangilandi.");}catch(error){notice(error.message,true);}});
  $("year").textContent=new Date().getFullYear();
  if(state.token) void loadWorkspace(); else setAuthMode("login");
})();