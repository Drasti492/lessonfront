/* =============================================
   EduPlan — script.js
   Handles all frontend logic.
   Backend URL: change BASE_URL to match your server.
============================================= */

const BASE_URL = 'http://localhost:3000'; // ← Change to your backend URL when deployed

/* ===================== STATE ===================== */
const state = {
  step: 1,
  logoBase64: null
};

/* ===================== NAVIGATION ===================== */
function goTo(step) {
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.pill').forEach(p => { p.classList.remove('active', 'done'); });

  document.getElementById(`step-${step}`).classList.add('active');
  document.getElementById(`pill-${step}`).classList.add('active');

  // Mark previous pills as done
  for (let i = 1; i < step; i++) {
    document.getElementById(`pill-${i}`).classList.add('done');
  }

  state.step = step;
  if (step === 4) buildSummary();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ===================== TOAST ===================== */
function showToast(msg, duration = 3000) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

/* ===================== LOGO UPLOAD ===================== */
document.getElementById('logoInput').addEventListener('change', function () {
  const file = this.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    state.logoBase64 = e.target.result;
    const img = document.getElementById('logoPreview');
    img.src = e.target.result;
    img.style.display = 'block';
    document.getElementById('dropInner').style.display = 'none';
    showToast('✅ Logo uploaded!');
  };
  reader.readAsDataURL(file);
});

/* ===================== SCHEME UPLOAD ===================== */
const schemeInput = document.getElementById('schemeInput');

schemeInput.addEventListener('change', async function () {
  const file = this.files[0];
  if (!file) return;

  const tag = document.getElementById('schemeFileName');
  tag.innerHTML = `📎 ${file.name}`;
  tag.style.display = 'flex';

  // If it's a .txt file, read it directly
  if (file.name.endsWith('.txt')) {
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById('schemeText').value = e.target.result;
      showToast('✅ Scheme text loaded!');
    };
    reader.readAsText(file);
    return;
  }

  // For .docx, send to backend to extract text
  if (file.name.endsWith('.docx') || file.name.endsWith('.doc')) {
    try {
      showToast('⏳ Extracting text from DOCX...');
      const formData = new FormData();
      formData.append('scheme', file);
      const res = await fetch(`${BASE_URL}/api/schemes/upload`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        document.getElementById('schemeText').value = data.text || '';
        showToast('✅ Scheme extracted successfully!');
      } else {
        showToast('⚠️ Could not extract DOCX text. Paste manually.');
      }
    } catch (err) {
      showToast('⚠️ Server not reachable. Please paste scheme manually.');
    }
  }
});

/* ===================== BUILD LESSON ROWS ===================== */
function buildTopics() {
  const startWeek = parseInt(document.getElementById('startWeek').value) || 1;
  const endWeek   = parseInt(document.getElementById('endWeek').value) || 3;
  const perWeek   = parseInt(document.getElementById('lessonsPerWeek').value) || 2;

  if (endWeek < startWeek) {
    showToast('⚠️ End week must be ≥ Start week');
    return;
  }
  if ((endWeek - startWeek + 1) * perWeek > 40) {
    showToast('⚠️ Too many lessons! Reduce your range.');
    return;
  }

  const container = document.getElementById('topicsContainer');
  container.innerHTML = '';

  // Header
  const header = document.createElement('div');
  header.className = 'topics-header';
  header.innerHTML = `
    <span>Week</span>
    <span>Topic</span>
    <span>Sub-Topic</span>
    <span>Date</span>
    <span></span>
  `;
  container.appendChild(header);

  for (let week = startWeek; week <= endWeek; week++) {
    for (let lesson = 1; lesson <= perWeek; lesson++) {
      const row = document.createElement('div');
      row.className = 'topic-row';
      row.dataset.week = week;
      row.dataset.lesson = lesson;
      row.innerHTML = `
        <div class="week-tag">W${week}<br>L${lesson}</div>
        <input type="text" class="topic-input" placeholder="e.g. Quadratic Equations">
        <input type="text" class="subtopic-input" placeholder="e.g. Factorisation method">
        <input type="date" class="lesson-date">
        <button class="rm-btn" title="Remove row">✕</button>
      `;
      row.querySelector('.rm-btn').addEventListener('click', () => row.remove());
      container.appendChild(row);
    }
  }

  showToast(`✅ ${(endWeek - startWeek + 1) * perWeek} lesson rows generated`);
}

/* ===================== BUILD SUMMARY ===================== */
function buildSummary() {
  const name    = document.getElementById('studentName').value || '—';
  const school  = document.getElementById('schoolName').value  || '—';
  const subject = document.getElementById('subject').value      || '—';
  const form    = document.getElementById('form').value         || '—';
  const rows    = document.querySelectorAll('.topic-row').length;
  const start   = document.getElementById('startTime').value    || '—';
  const end     = document.getElementById('endTime').value      || '—';

  document.getElementById('summaryBox').innerHTML = `
    <div class="sum-item"><span class="sum-label">Student Teacher</span><span class="sum-value">${name}</span></div>
    <div class="sum-item"><span class="sum-label">School</span><span class="sum-value">${school}</span></div>
    <div class="sum-item"><span class="sum-label">Subject</span><span class="sum-value">${subject}</span></div>
    <div class="sum-item"><span class="sum-label">Form / Class</span><span class="sum-value">${form}</span></div>
    <div class="sum-item"><span class="sum-label">Total Lessons</span><span class="sum-value">${rows}</span></div>
    <div class="sum-item"><span class="sum-label">Lesson Time</span><span class="sum-value">${start} – ${end}</span></div>
  `;
}

/* ===================== COLLECT FORM DATA ===================== */
function getFormData() {
  return {
    studentName:       document.getElementById('studentName').value,
    admNo:             document.getElementById('admNo').value,
    schoolName:        document.getElementById('schoolName').value,
    subject:           document.getElementById('subject').value,
    form:              document.getElementById('form').value,
    stream:            document.getElementById('stream').value,
    numStudents:       document.getElementById('numStudents').value,
    duration:          document.getElementById('duration').value,
    term:              document.getElementById('term').value,
    year:              document.getElementById('year').value,
    lessonType:        document.getElementById('lessonType').value,
    referenceBook:     document.getElementById('referenceBook').value,
    teacherSignature:  document.getElementById('teacherSignature').value,
    hodSignature:      document.getElementById('hodSignature').value,
    principalSignature:document.getElementById('principalSignature').value,
    generalObjectives: document.getElementById('generalObjectives').value,
    startTime:         document.getElementById('startTime').value,
    endTime:           document.getElementById('endTime').value,
    lessonDay:         document.getElementById('lessonDay').value,
    schemeText:        document.getElementById('schemeText').value,
    logoBase64:        state.logoBase64
  };
}

/* ===================== GENERATE ALL PLANS ===================== */
async function generatePlans() {
  const rows = document.querySelectorAll('.topic-row');
  if (rows.length === 0) {
    showToast('⚠️ No lesson rows found. Go back and generate rows first.');
    return;
  }

  const formData = getFormData();
  const plansGrid = document.getElementById('plansGrid');
  const genBtn = document.getElementById('genBtn');
  const progressWrap = document.getElementById('progressWrap');
  const progressFill = document.getElementById('progressFill');
  const progressText = document.getElementById('progressText');

  plansGrid.innerHTML = '';
  genBtn.disabled = true;
  genBtn.innerHTML = '<span class="spinner"></span> Generating...';
  progressWrap.style.display = 'block';

  const lessons = [];
  rows.forEach((row) => {
    lessons.push({
      week:     row.dataset.week,
      lessonNum:row.dataset.lesson,
      topic:    row.querySelector('.topic-input').value,
      subTopic: row.querySelector('.subtopic-input').value,
      date:     row.querySelector('.lesson-date').value,
    });
  });

  let done = 0;

  // Create all cards first (placeholders)
  const cards = lessons.map((lesson, i) => {
    const card = document.createElement('div');
    card.className = 'plan-card';
    card.id = `card-${i}`;
    card.innerHTML = `
      <div class="plan-card-head">
        <div>
          <div class="plan-badge">Week ${lesson.week} · Lesson ${lesson.lessonNum}</div>
          <h3>${lesson.topic || 'Untitled Lesson'}</h3>
        </div>
      </div>
      <div class="plan-card-body">
        <strong>Sub-topic:</strong> ${lesson.subTopic || '—'}<br>
        <strong>Date:</strong> ${lesson.date || '—'}<br>
        <strong>Time:</strong> ${formData.startTime} – ${formData.endTime}
      </div>
      <div class="plan-card-foot">
        <span class="plan-status loading">⏳ Generating with Gemini...</span>
      </div>
    `;
    plansGrid.appendChild(card);
    return card;
  });

  // Process sequentially to avoid overloading the API
  for (let i = 0; i < lessons.length; i++) {
    const lesson = lessons[i];
    const card = cards[i];
    const foot = card.querySelector('.plan-card-foot');

    progressText.textContent = `Generating lesson ${i + 1} of ${lessons.length}: ${lesson.topic || '...'}`;

    try {
      const payload = {
        ...formData,
        week:      lesson.week,
        lessonNum: lesson.lessonNum,
        topic:     lesson.topic,
        subTopic:  lesson.subTopic,
        date:      lesson.date,
      };

      const res = await fetch(`${BASE_URL}/api/lessons/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      // Get the DOCX blob
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      // Update card footer
      foot.innerHTML = `
        <span class="plan-status done">✅ Ready</span>
        <a href="${url}" download="W${lesson.week}L${lesson.lessonNum}_${(lesson.topic || 'lesson').replace(/\s+/g, '_')}.docx" class="btn download">
          ⬇ Download DOCX
        </a>
      `;
    } catch (err) {
      console.error(`Lesson ${i + 1} failed:`, err);
      foot.innerHTML = `
        <span class="plan-status error">❌ Failed</span>
        <button class="btn download" onclick="retrySingle(${i}, ${JSON.stringify(lesson).replace(/"/g, '&quot;')})">
          ↩ Retry
        </button>
      `;
    }

    done++;
    progressFill.style.width = `${(done / lessons.length) * 100}%`;
  }

  progressText.textContent = `✅ All ${lessons.length} lessons processed!`;
  genBtn.disabled = false;
  genBtn.innerHTML = `
    <svg width="18" height="18" fill="none" viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
    Regenerate All
  `;
  showToast(`🎉 ${done} lesson plans generated!`, 4000);
}

/* ===================== RETRY SINGLE LESSON ===================== */
async function retrySingle(index, lesson) {
  const card = document.getElementById(`card-${index}`);
  const foot = card.querySelector('.plan-card-foot');
  foot.innerHTML = `<span class="plan-status loading">⏳ Retrying...</span>`;

  try {
    const formData = getFormData();
    const payload = { ...formData, ...lesson };
    const res = await fetch(`${BASE_URL}/api/lessons/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error('Server error');

    const blob = await res.blob();
    const url = URL.createObjectURL(blob);

    foot.innerHTML = `
      <span class="plan-status done">✅ Ready</span>
      <a href="${url}" download="W${lesson.week}L${lesson.lessonNum}_${(lesson.topic || 'lesson').replace(/\s+/g, '_')}.docx" class="btn download">
        ⬇ Download DOCX
      </a>
    `;
  } catch {
    foot.innerHTML = `
      <span class="plan-status error">❌ Failed again</span>
      <button class="btn download" onclick="retrySingle(${index}, ${JSON.stringify(lesson).replace(/"/g, '&quot;')})">
        ↩ Retry
      </button>
    `;
    showToast('❌ Retry failed. Check your backend connection.');
  }
}

/* ===================== INIT ===================== */
buildTopics();