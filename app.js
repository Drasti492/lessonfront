/* ============================================================
   EduPlan — app.js
   Functions are top-level (not inside DOMContentLoaded) so
   onclick="goTo(2)" in the HTML can find them immediately.
   ============================================================ */

const BASE_URL = 'https://lessonplans-l3b1.onrender.com';

/* ── State ───────────────────────────────────────────────── */
const state = { step: 1, logoBase64: null };

/* ── Navigation ──────────────────────────────────────────── */
function goTo(step) {
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.pill').forEach(p => p.classList.remove('active', 'done'));

  document.getElementById('step-' + step).classList.add('active');
  document.getElementById('pill-' + step).classList.add('active');
  for (let i = 1; i < step; i++) {
    document.getElementById('pill-' + i).classList.add('done');
  }

  state.step = step;
  if (step === 4) buildSummary();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Toast ───────────────────────────────────────────────── */
function showToast(msg, duration) {
  duration = duration || 3000;
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(function () { t.classList.remove('show'); }, duration);
}

/* ── Build lesson rows ───────────────────────────────────── */
function buildTopics() {
  var startWeek = parseInt(document.getElementById('startWeek').value) || 1;
  var endWeek   = parseInt(document.getElementById('endWeek').value)   || 3;
  var perWeek   = parseInt(document.getElementById('lessonsPerWeek').value) || 2;

  if (endWeek < startWeek) {
    showToast('⚠️ End week must be ≥ Start week');
    return;
  }
  if ((endWeek - startWeek + 1) * perWeek > 40) {
    showToast('⚠️ Too many lessons! Reduce your week range.');
    return;
  }

  var container = document.getElementById('topicsContainer');
  container.innerHTML = '';

  var header = document.createElement('div');
  header.className = 'topics-header';
  header.innerHTML = '<span>Week</span><span>Topic</span><span>Sub-Topic</span><span>Date</span><span></span>';
  container.appendChild(header);

  for (var week = startWeek; week <= endWeek; week++) {
    for (var lesson = 1; lesson <= perWeek; lesson++) {
      var row = document.createElement('div');
      row.className = 'topic-row';
      row.setAttribute('data-week', week);
      row.setAttribute('data-lesson', lesson);
      row.innerHTML =
        '<div class="week-tag">W' + week + '<br>L' + lesson + '</div>' +
        '<input type="text"  class="topic-input"    placeholder="e.g. Vulcanicity">' +
        '<input type="text"  class="subtopic-input" placeholder="e.g. Intrusive features">' +
        '<input type="date"  class="lesson-date">' +
        '<button class="rm-btn" title="Remove row">✕</button>';

      row.querySelector('.rm-btn').addEventListener('click', function () {
        this.closest('.topic-row').remove();
      });
      container.appendChild(row);
    }
  }

  showToast('✅ ' + ((endWeek - startWeek + 1) * perWeek) + ' lesson rows generated');
}

/* ── Build summary (step 4 preview) ─────────────────────── */
function buildSummary() {
  var name    = document.getElementById('studentName').value || '—';
  var school  = document.getElementById('schoolName').value  || '—';
  var subject = document.getElementById('subject').value     || '—';
  var form    = document.getElementById('form').value        || '—';
  var rows    = document.querySelectorAll('.topic-row').length;
  var start   = document.getElementById('startTime').value   || '—';
  var end     = document.getElementById('endTime').value     || '—';

  document.getElementById('summaryBox').innerHTML =
    '<div class="sum-item"><span class="sum-label">Student Teacher</span><span class="sum-value">' + name    + '</span></div>' +
    '<div class="sum-item"><span class="sum-label">School</span><span class="sum-value">'           + school  + '</span></div>' +
    '<div class="sum-item"><span class="sum-label">Subject</span><span class="sum-value">'          + subject + '</span></div>' +
    '<div class="sum-item"><span class="sum-label">Form / Class</span><span class="sum-value">'     + form    + '</span></div>' +
    '<div class="sum-item"><span class="sum-label">Total Lessons</span><span class="sum-value">'    + rows    + '</span></div>' +
    '<div class="sum-item"><span class="sum-label">Lesson Time</span><span class="sum-value">'      + start + ' – ' + end + '</span></div>';
}

/* ── Collect all form values ─────────────────────────────── */
function getFormData() {
  return {
    studentName:        document.getElementById('studentName').value,
    admNo:              document.getElementById('admNo').value,
    schoolName:         document.getElementById('schoolName').value,
    subject:            document.getElementById('subject').value,
    form:               document.getElementById('form').value,
    stream:             document.getElementById('stream').value,
    numStudents:        document.getElementById('numStudents').value,
    duration:           document.getElementById('duration').value,
    term:               document.getElementById('term').value,
    year:               document.getElementById('year').value,
    lessonType:         document.getElementById('lessonType').value,
    referenceBook:      document.getElementById('referenceBook').value,
    teacherSignature:   document.getElementById('teacherSignature').value,
    hodSignature:       document.getElementById('hodSignature').value,
    principalSignature: document.getElementById('principalSignature').value,
    generalObjectives:  document.getElementById('generalObjectives').value,
    startTime:          document.getElementById('startTime').value,
    endTime:            document.getElementById('endTime').value,
    lessonDay:          document.getElementById('lessonDay').value,
    schemeText:         document.getElementById('schemeText').value,
    logoBase64:         state.logoBase64,
  };
}

/* ── Generate all lesson plans ───────────────────────────── */
async function generatePlans() {
  var rows = document.querySelectorAll('.topic-row');
  if (rows.length === 0) {
    showToast('⚠️ No lesson rows found. Go back and generate rows first.');
    return;
  }

  var formData     = getFormData();
  var plansGrid    = document.getElementById('plansGrid');
  var genBtn       = document.getElementById('genBtn');
  var progressWrap = document.getElementById('progressWrap');
  var progressFill = document.getElementById('progressFill');
  var progressText = document.getElementById('progressText');

  plansGrid.innerHTML   = '';
  genBtn.disabled       = true;
  genBtn.innerHTML      = '<span class="spinner"></span> Generating...';
  progressWrap.style.display = 'block';
  progressFill.style.width   = '0%';

  /* Collect lesson data from rows */
  var lessons = [];
  rows.forEach(function (row) {
    lessons.push({
      week:      row.getAttribute('data-week'),
      lessonNum: row.getAttribute('data-lesson'),
      topic:     row.querySelector('.topic-input').value,
      subTopic:  row.querySelector('.subtopic-input').value,
      date:      row.querySelector('.lesson-date').value,
    });
  });

  /* Create placeholder cards */
  var cards = lessons.map(function (lesson, i) {
    var card = document.createElement('div');
    card.className = 'plan-card';
    card.id = 'card-' + i;
    card.innerHTML =
      '<div class="plan-card-head">' +
        '<div>' +
          '<div class="plan-badge">Week ' + lesson.week + ' · Lesson ' + lesson.lessonNum + '</div>' +
          '<h3>' + (lesson.topic || 'Untitled Lesson') + '</h3>' +
        '</div>' +
      '</div>' +
      '<div class="plan-card-body">' +
        '<strong>Sub-topic:</strong> ' + (lesson.subTopic || '—') + '<br>' +
        '<strong>Date:</strong> '      + (lesson.date    || '—') + '<br>' +
        '<strong>Time:</strong> '      + formData.startTime + ' – ' + formData.endTime +
      '</div>' +
      '<div class="plan-card-foot">' +
        '<span class="plan-status loading">⏳ Generating with AI...</span>' +
      '</div>';
    plansGrid.appendChild(card);
    return card;
  });

  /* Generate sequentially */
  var done = 0;
  for (var i = 0; i < lessons.length; i++) {
    var lesson = lessons[i];
    var foot   = cards[i].querySelector('.plan-card-foot');

    progressText.textContent = 'Generating ' + (i + 1) + ' of ' + lessons.length + ': ' + (lesson.topic || '...');

    try {
      var payload = Object.assign({}, formData, lesson);

      var res = await fetch(BASE_URL + '/api/lessons/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) {
        var errText = await res.text();
        throw new Error('Server ' + res.status + ': ' + errText);
      }

      var blob = await res.blob();
      var url  = URL.createObjectURL(blob);
      var name = 'W' + lesson.week + 'L' + lesson.lessonNum + '_' +
                 (lesson.topic || 'lesson').replace(/[^a-zA-Z0-9]/g, '_') + '.docx';

      foot.innerHTML =
        '<span class="plan-status done">✅ Ready</span>' +
        '<a href="' + url + '" download="' + name + '" class="btn download">⬇ Download DOCX</a>';

    } catch (err) {
      console.error('Lesson ' + (i + 1) + ' failed:', err);
      foot.innerHTML =
        '<span class="plan-status error">❌ Failed — ' + err.message + '</span>' +
        '<button class="btn download" onclick="retrySingle(' + i + ')">↩ Retry</button>';
    }

    done++;
    progressFill.style.width = ((done / lessons.length) * 100) + '%';
  }

  progressText.textContent = '✅ All ' + lessons.length + ' lessons processed!';
  genBtn.disabled  = false;
  genBtn.innerHTML =
    '<svg width="18" height="18" fill="none" viewBox="0 0 24 24">' +
    '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg> Regenerate All';
  showToast('🎉 ' + done + ' lesson plans generated!', 4000);
}

/* ── Retry a single failed card ──────────────────────────── */
async function retrySingle(index) {
  var card  = document.getElementById('card-' + index);
  var foot  = card.querySelector('.plan-card-foot');
  var badge = card.querySelector('.plan-badge').textContent;
  var match = badge.match(/Week (\d+) · Lesson (\d+)/);
  var week      = match ? match[1] : '1';
  var lessonNum = match ? match[2] : '1';
  var topic     = card.querySelector('h3').textContent;

  foot.innerHTML = '<span class="plan-status loading">⏳ Retrying...</span>';

  try {
    var payload = Object.assign({}, getFormData(), { week: week, lessonNum: lessonNum, topic: topic });
    var res     = await fetch(BASE_URL + '/api/lessons/generate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Server error ' + res.status);

    var blob = await res.blob();
    var url  = URL.createObjectURL(blob);
    var name = 'W' + week + 'L' + lessonNum + '_' + topic.replace(/[^a-zA-Z0-9]/g, '_') + '.docx';

    foot.innerHTML =
      '<span class="plan-status done">✅ Ready</span>' +
      '<a href="' + url + '" download="' + name + '" class="btn download">⬇ Download DOCX</a>';

  } catch (err) {
    foot.innerHTML =
      '<span class="plan-status error">❌ ' + err.message + '</span>' +
      '<button class="btn download" onclick="retrySingle(' + index + ')">↩ Retry</button>';
    showToast('❌ Retry failed. Check backend connection.');
  }
}

/* ── Logo upload ─────────────────────────────────────────── */
function initLogoUpload() {
  document.getElementById('logoInput').addEventListener('change', function () {
    var file = this.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function (e) {
      state.logoBase64 = e.target.result;
      var img = document.getElementById('logoPreview');
      img.src = e.target.result;
      img.style.display = 'block';
      document.getElementById('dropInner').style.display = 'none';
      showToast('✅ Logo uploaded!');
    };
    reader.readAsDataURL(file);
  });
}

/* ── Scheme file upload ──────────────────────────────────── */
function initSchemeUpload() {
  document.getElementById('schemeInput').addEventListener('change', async function () {
    var file = this.files[0];
    if (!file) return;

    var tag = document.getElementById('schemeFileName');
    tag.innerHTML      = '📎 ' + file.name;
    tag.style.display  = 'flex';

    /* Plain text — read directly in browser */
    if (file.name.toLowerCase().endsWith('.txt')) {
      var reader = new FileReader();
      reader.onload = function (e) {
        document.getElementById('schemeText').value = e.target.result;
        showToast('✅ Scheme text loaded!');
      };
      reader.readAsText(file);
      return;
    }

    /* DOCX — send to backend to extract with mammoth */
    if (file.name.toLowerCase().endsWith('.docx') || file.name.toLowerCase().endsWith('.doc')) {
      showToast('⏳ Extracting text from DOCX...');
      try {
        var fd = new FormData();
        fd.append('scheme', file);
        var res = await fetch(BASE_URL + '/api/schemes/upload', { method: 'POST', body: fd });
        if (res.ok) {
          var data = await res.json();
          document.getElementById('schemeText').value = data.text || '';
          showToast('✅ Scheme extracted successfully!');
        } else {
          showToast('⚠️ Could not extract DOCX. Please paste the content manually.');
        }
      } catch (e) {
        showToast('⚠️ Server unreachable. Please paste scheme content manually.');
      }
    }
  });
}

/* ── Boot ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function () {
  initLogoUpload();
  initSchemeUpload();
  buildTopics();   /* pre-populate with default 3 weeks × 2 lessons */
});