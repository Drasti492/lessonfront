/* ============================================================
   EduPlan — app.js  v5 (Final)

   KEY CHANGES:
   - lessonNum resets per week (matches scheme per-week numbers)
   - Topic/sub-topic come from scheme only (no user input fields)
   - Scheme preview button detects lessons before generating
   - Date input per lesson row only
   - Reference book, objectives auto-extracted from scheme
   - Grade instead of Form
   - No lesson type, no general objectives field
   - Rate limit: sequential generation with gaps between lessons
============================================================ */

const BASE_URL = 'https://lessonplans-l3b1.onrender.com';

const state = {
  step:       1,
  logoBase64: null,
  lessons:    [],
  daySlots:   [],
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

/* ── Navigation ──────────────────────────────────────────── */
function goTo(step) {
  document.querySelectorAll('.step-panel').forEach(function (p) {
    p.classList.remove('active');
  });
  document.querySelectorAll('.pill').forEach(function (p) {
    p.classList.remove('active', 'done');
  });
  document.getElementById('step-' + step).classList.add('active');
  document.getElementById('pill-' + step).classList.add('active');
  for (var i = 1; i < step; i++) {
    document.getElementById('pill-' + i).classList.add('done');
  }
  state.step = step;
  if (step === 4) buildSummary();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ── Toast ───────────────────────────────────────────────── */
function showToast(msg, duration) {
  duration = duration || 3000;
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(function () { el.classList.remove('show'); }, duration);
}

/* ── Scheme Preview ──────────────────────────────────────── */
async function previewScheme() {
  var schemeText = document.getElementById('schemeText').value.trim();
  if (!schemeText) {
    showToast('⚠️ Please paste your scheme first.');
    return;
  }

  try {
    var res = await fetch(BASE_URL + '/api/schemes/preview', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ schemeText: schemeText }),
    });

    if (!res.ok) throw new Error('Preview failed');

    var data = await res.json();
    var lessons = data.lessons || [];

    var wrap    = document.getElementById('schemePreviewWrap');
    var preview = document.getElementById('schemePreview');

    if (lessons.length === 0) {
      preview.innerHTML = '<div class="preview-empty">No lessons detected. Check your scheme format — week and lesson numbers must be in the first two columns.</div>';
    } else {
      preview.innerHTML = lessons.map(function (l) {
        return '<div class="preview-card">' +
          '<div class="preview-badge">W' + l.week + ' L' + l.lesson + '</div>' +
          '<div class="preview-topic">' + (l.topic || '—') + '</div>' +
          '<div class="preview-obj">' + ((l.objectives || '').substring(0, 100) + (l.objectives && l.objectives.length > 100 ? '…' : '')) + '</div>' +
          '</div>';
      }).join('');
    }

    wrap.style.display = 'block';
    showToast('✅ Detected ' + lessons.length + ' lessons in scheme');
  } catch (e) {
    showToast('⚠️ Could not preview scheme. Check server connection.');
  }
}

/* ═══════════════════════════════════════════════════════════
   STEP 3 — Day selector
═══════════════════════════════════════════════════════════ */
function renderDaySelector() {
  var container = document.getElementById('daySelectorWrap');
  container.innerHTML = '';

  DAYS.forEach(function (day) {
    var card = document.createElement('div');
    card.className = 'day-card';
    card.id        = 'daycard-' + day;

    card.innerHTML =
      '<label class="day-check-label">' +
        '<input type="checkbox" class="day-check" data-day="' + day + '" onchange="toggleDayCard(\'' + day + '\')">' +
        '<span class="day-name">' + day + '</span>' +
      '</label>' +
      '<div class="day-detail" id="daydetail-' + day + '" style="display:none">' +
        '<div class="day-row">' +
          '<div class="day-field">' +
            '<label>Start Time</label>' +
            '<input type="time" class="day-start" data-day="' + day + '" value="08:00">' +
          '</div>' +
          '<div class="day-field">' +
            '<label>End Time</label>' +
            '<input type="time" class="day-end" data-day="' + day + '" value="08:40">' +
          '</div>' +
          '<div class="day-field">' +
            '<label>Lessons / Day</label>' +
            '<select class="day-count" data-day="' + day + '" onchange="updateDayBadge(\'' + day + '\')">' +
              '<option value="1">1 lesson (40 min)</option>' +
              '<option value="2">2 lessons (double, 80 min)</option>' +
            '</select>' +
          '</div>' +
        '</div>' +
        '<div class="day-badge" id="daybadge-' + day + '">Single lesson — 40 min</div>' +
      '</div>';

    container.appendChild(card);
  });
}

function toggleDayCard(day) {
  var detail  = document.getElementById('daydetail-' + day);
  var card    = document.getElementById('daycard-' + day);
  var checked = card.querySelector('.day-check').checked;
  detail.style.display = checked ? 'block' : 'none';
  card.classList.toggle('selected', checked);
}

function updateDayBadge(day) {
  var sel   = document.querySelector('.day-count[data-day="' + day + '"]');
  var badge = document.getElementById('daybadge-' + day);
  badge.textContent = parseInt(sel.value) === 2
    ? 'Double lesson — 80 min total'
    : 'Single lesson — 40 min';
}

function getSelectedDaySlots() {
  var slots = [];
  document.querySelectorAll('.day-check:checked').forEach(function (chk) {
    var day   = chk.getAttribute('data-day');
    var start = document.querySelector('.day-start[data-day="' + day + '"]').value;
    var end   = document.querySelector('.day-end[data-day="'   + day + '"]').value;
    var count = parseInt(document.querySelector('.day-count[data-day="' + day + '"]').value);
    slots.push({ day: day, startTime: start, endTime: end, lessonsPerDay: count });
  });
  return slots;
}

/* ═══════════════════════════════════════════════════════════
   STEP 3 — Build topic rows
   lessonNum resets per week → matches scheme per-week numbers
   No topic/subtopic inputs — AI reads from scheme
═══════════════════════════════════════════════════════════ */
function buildTopics() {
  var startWeek = parseInt(document.getElementById('startWeek').value) || 1;
  var endWeek   = parseInt(document.getElementById('endWeek').value)   || 3;
  var daySlots  = getSelectedDaySlots();

  if (daySlots.length === 0) {
    showToast('⚠️ Please select at least one teaching day first.');
    return;
  }
  if (endWeek < startWeek) {
    showToast('⚠️ End week must be ≥ Start week.');
    return;
  }

  var totalRows = (endWeek - startWeek + 1) * daySlots.length;
  if (totalRows > 40) {
    showToast('⚠️ Too many rows (' + totalRows + '). Reduce week range or days.');
    return;
  }

  state.daySlots = daySlots;

  var container = document.getElementById('topicsContainer');
  container.innerHTML = '';

  /* Table header — only date column now (no topic/subtopic inputs) */
  var header = document.createElement('div');
  header.className = 'topics-header';
  header.innerHTML =
    '<span>Week / Lesson</span>' +
    '<span>Day &amp; Time</span>' +
    '<span>Lesson Date <small>(required)</small></span>' +
    '<span></span>';
  container.appendChild(header);

  var globalIndex = 0;

  for (var week = startWeek; week <= endWeek; week++) {
    var lessonWithinWeek = 0;

    daySlots.forEach(function (slot) {
      lessonWithinWeek++;
      globalIndex++;

      var isDouble = slot.lessonsPerDay === 2;

      var row = document.createElement('div');
      row.className = 'topic-row';
      row.setAttribute('data-week',   week);
      row.setAttribute('data-lesson', lessonWithinWeek);   // per-week
      row.setAttribute('data-index',  globalIndex);
      row.setAttribute('data-day',    slot.day);
      row.setAttribute('data-start',  slot.startTime);
      row.setAttribute('data-end',    slot.endTime);
      row.setAttribute('data-double', isDouble ? 'true' : 'false');

      row.innerHTML =
        '<div class="week-tag">' +
          '<span class="wk-num">W' + week + ' L' + lessonWithinWeek + '</span>' +
          (isDouble ? '<span class="dbl-tag">DBL</span>' : '') +
        '</div>' +
        '<div class="day-time-cell">' +
          '<span class="dt-day">' + slot.day + '</span>' +
          '<span class="dt-time">' + slot.startTime + ' – ' + slot.endTime + '</span>' +
        '</div>' +
        '<input type="date" class="lesson-date" title="Date of this lesson">' +
        '<button class="rm-btn" title="Remove row">✕</button>';

      row.querySelector('.rm-btn').addEventListener('click', function () {
        this.closest('.topic-row').remove();
      });

      container.appendChild(row);
    });
  }

  showToast('✅ ' + globalIndex + ' lesson rows created — add dates for each');
}

/* ── Summary card (step 4) ───────────────────────────────── */
function buildSummary() {
  var name     = document.getElementById('studentName').value || '—';
  var school   = document.getElementById('schoolName').value  || '—';
  var subject  = document.getElementById('subject').value     || '—';
  var grade    = document.getElementById('grade').value       || '—';
  var term     = document.getElementById('term').value        || '—';
  var rows     = document.querySelectorAll('.topic-row').length;

  var daySlots = getSelectedDaySlots();
  var daysText = daySlots.length > 0
    ? daySlots.map(function (s) {
        return s.day.substring(0, 3) + ' ' + s.startTime + '–' + s.endTime;
      }).join(', ')
    : '—';

  document.getElementById('summaryBox').innerHTML =
    '<div class="sum-item"><span class="sum-label">Student Teacher</span><span class="sum-value">' + name    + '</span></div>' +
    '<div class="sum-item"><span class="sum-label">School</span><span class="sum-value">'          + school  + '</span></div>' +
    '<div class="sum-item"><span class="sum-label">Subject</span><span class="sum-value">'         + subject + '</span></div>' +
    '<div class="sum-item"><span class="sum-label">Grade / Class</span><span class="sum-value">'   + grade   + '</span></div>' +
    '<div class="sum-item"><span class="sum-label">Term</span><span class="sum-value">'            + term    + '</span></div>' +
    '<div class="sum-item"><span class="sum-label">Teaching Days</span><span class="sum-value">'   + daysText + '</span></div>' +
    '<div class="sum-item"><span class="sum-label">Total Lessons</span><span class="sum-value">'   + rows    + '</span></div>';
}

/* ── Form data (no topic/subtopic/lessonType/referenceBook/generalObjectives) ── */
function getFormData() {
  return {
    studentName: document.getElementById('studentName').value,
    admNo:       document.getElementById('admNo').value,
    schoolName:  document.getElementById('schoolName').value,
    subject:     document.getElementById('subject').value,
    grade:       document.getElementById('grade').value,
    stream:      document.getElementById('stream').value,
    numStudents: document.getElementById('numStudents').value,
    duration:    document.getElementById('duration').value,
    term:        document.getElementById('term').value,
    year:        document.getElementById('year').value,
    schemeText:  document.getElementById('schemeText').value,
    logoBase64:  state.logoBase64,
  };
}

/* ═══════════════════════════════════════════════════════════
   GENERATE ALL LESSON PLANS
═══════════════════════════════════════════════════════════ */
async function generatePlans() {
  var rows = document.querySelectorAll('.topic-row');
  if (rows.length === 0) {
    showToast('⚠️ No lesson rows. Go back and build rows first.');
    return;
  }

  var schemeText = document.getElementById('schemeText').value.trim();
  if (!schemeText) {
    showToast('⚠️ No scheme pasted. Go to Step 2 and paste your scheme.');
    return;
  }

  var formData     = getFormData();
  var plansGrid    = document.getElementById('plansGrid');
  var genBtn       = document.getElementById('genBtn');
  var progressWrap = document.getElementById('progressWrap');
  var progressFill = document.getElementById('progressFill');
  var progressText = document.getElementById('progressText');

  plansGrid.innerHTML        = '';
  genBtn.disabled            = true;
  genBtn.innerHTML           = '<span class="spinner"></span> Generating...';
  progressWrap.style.display = 'block';
  progressFill.style.width   = '0%';

  /* Snapshot row data — no topic/subtopic from UI */
  state.lessons = [];
  rows.forEach(function (row) {
    var isDouble = row.getAttribute('data-double') === 'true';
    state.lessons.push({
      week:      row.getAttribute('data-week'),
      lessonNum: row.getAttribute('data-lesson'),   // per-week number
      cardIndex: row.getAttribute('data-index'),
      day:       row.getAttribute('data-day'),
      startTime: row.getAttribute('data-start'),
      endTime:   row.getAttribute('data-end'),
      isDouble:  isDouble,
      duration:  isDouble ? '80' : (formData.duration || '40'),
      date:      row.querySelector('.lesson-date').value,
    });
  });

  /* Create placeholder cards */
  var cards = state.lessons.map(function (lesson, i) {
    var card = document.createElement('div');
    card.className = 'plan-card';
    card.id        = 'card-' + i;
    var typeLabel  = lesson.isDouble ? '🔁 Double (80 min)' : '📋 Single (40 min)';

    card.innerHTML =
      '<div class="plan-card-head">' +
        '<div>' +
          '<div class="plan-badge">Week ' + lesson.week + ' · Lesson ' + lesson.lessonNum + ' · ' + (lesson.day || '') + '</div>' +
          '<h3>⏳ Awaiting scheme extraction...</h3>' +
        '</div>' +
      '</div>' +
      '<div class="plan-card-body">' +
        '<strong>Date:</strong> '  + (lesson.date      || '—') + '<br>' +
        '<strong>Time:</strong> '  + lesson.startTime  + ' – ' + lesson.endTime + '<br>' +
        '<strong>Type:</strong> '  + typeLabel +
      '</div>' +
      '<div class="plan-card-foot">' +
        '<span class="plan-status loading">⏳ Generating...</span>' +
      '</div>';

    plansGrid.appendChild(card);
    return card;
  });

  /* Generate sequentially with small gap to avoid rate limits */
  var done = 0;
  for (var i = 0; i < state.lessons.length; i++) {
    var lesson = state.lessons[i];
    var card   = cards[i];
    var foot   = card.querySelector('.plan-card-foot');

    progressText.textContent =
      'Generating ' + (i + 1) + ' of ' + state.lessons.length +
      ' — Week ' + lesson.week + ' Lesson ' + lesson.lessonNum;

    try {
      var payload = Object.assign({}, formData, lesson);

      var res = await fetch(BASE_URL + '/api/lessons/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) {
        var errText = await res.text();
        throw new Error('Server ' + res.status + ': ' + errText.substring(0, 200));
      }

      var blob      = await res.blob();
      var url       = URL.createObjectURL(blob);
      var dlName    = 'W' + lesson.week + 'L' + lesson.lessonNum +
                      '_' + (lesson.day || '').substring(0, 3) + '.docx';

      /* Update card title with actual topic from server response header if available */
      var topicHeader = res.headers && res.headers.get('X-Lesson-Topic');
      if (topicHeader) {
        card.querySelector('h3').textContent = decodeURIComponent(topicHeader);
      } else {
        card.querySelector('h3').textContent = 'Week ' + lesson.week + ' · Lesson ' + lesson.lessonNum;
      }

      foot.innerHTML =
        '<span class="plan-status done">✅ Ready</span>' +
        '<a href="' + url + '" download="' + dlName + '" class="btn download">⬇ Download DOCX</a>';

    } catch (err) {
      console.error('Lesson ' + (i + 1) + ' failed:', err);
      foot.innerHTML =
        '<span class="plan-status error">❌ ' + err.message + '</span>' +
        '<button class="btn download" onclick="retrySingle(' + i + ')">↩ Retry</button>';
    }

    done++;
    progressFill.style.width = ((done / state.lessons.length) * 100) + '%';

    /* Small delay between lessons to avoid rate limiting */
    if (i < state.lessons.length - 1) {
      await new Promise(function (r) { setTimeout(r, 2000); });
    }
  }

  progressText.textContent = '✅ All ' + state.lessons.length + ' lessons processed!';
  genBtn.disabled  = false;
  genBtn.innerHTML =
    '<svg width="18" height="18" fill="none" viewBox="0 0 24 24">' +
    '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" stroke-width="2"' +
    ' stroke-linecap="round" stroke-linejoin="round"/></svg> Regenerate All';
  showToast('🎉 ' + done + ' lesson plans done!', 4000);
}

/* ── Retry single ────────────────────────────────────────── */
async function retrySingle(index) {
  var lesson = state.lessons[index];
  if (!lesson) {
    showToast('⚠️ Cannot retry — data lost. Please regenerate all.');
    return;
  }

  var foot = document.getElementById('card-' + index).querySelector('.plan-card-foot');
  foot.innerHTML = '<span class="plan-status loading">⏳ Retrying...</span>';

  try {
    var payload = Object.assign({}, getFormData(), lesson);
    var res = await fetch(BASE_URL + '/api/lessons/generate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Server error ' + res.status);

    var blob = await res.blob();
    var url  = URL.createObjectURL(blob);
    var dlName = 'W' + lesson.week + 'L' + lesson.lessonNum +
                 '_' + (lesson.day || '').substring(0, 3) + '.docx';

    foot.innerHTML =
      '<span class="plan-status done">✅ Ready</span>' +
      '<a href="' + url + '" download="' + dlName + '" class="btn download">⬇ Download DOCX</a>';

  } catch (err) {
    foot.innerHTML =
      '<span class="plan-status error">❌ ' + err.message + '</span>' +
      '<button class="btn download" onclick="retrySingle(' + index + ')">↩ Retry</button>';
    showToast('❌ Retry failed.');
  }
}

/* ── Logo upload ─────────────────────────────────────────── */
function initLogoUpload() {
  document.getElementById('logoInput').addEventListener('change', function () {
    var file = this.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('⚠️ Please upload an image file.');
      return;
    }
    var reader = new FileReader();
    reader.onload = function (e) {
      state.logoBase64 = e.target.result;
      var img = document.getElementById('logoPreview');
      img.src           = e.target.result;
      img.style.display = 'block';
      document.getElementById('dropInner').style.display = 'none';
      showToast('✅ Logo uploaded!');
    };
    reader.readAsDataURL(file);
  });
}

/* ── Scheme upload ───────────────────────────────────────── */
function initSchemeUpload() {
  document.getElementById('schemeInput').addEventListener('change', async function () {
    var file = this.files[0];
    if (!file) return;

    var tag       = document.getElementById('schemeFileName');
    tag.innerHTML     = '📎 ' + file.name;
    tag.style.display = 'flex';

    if (file.name.toLowerCase().endsWith('.txt')) {
      var reader = new FileReader();
      reader.onload = function (e) {
        document.getElementById('schemeText').value = e.target.result;
        showToast(' Scheme loaded!');
      };
      reader.readAsText(file);
      return;
    }

    if (file.name.toLowerCase().endsWith('.docx') || file.name.toLowerCase().endsWith('.doc')) {
      showToast('⏳ Extracting text from DOCX...');
      try {
        var fd = new FormData();
        fd.append('scheme', file);
        var res = await fetch(BASE_URL + '/api/schemes/upload', { method: 'POST', body: fd });
        if (res.ok) {
          var data = await res.json();
          document.getElementById('schemeText').value = data.text || '';
          showToast(' Scheme extracted!');
        } else {
          showToast('⚠️ Could not extract DOCX. Paste manually.');
        }
      } catch (e) {
        showToast('⚠️ Server unreachable. Paste scheme manually.');
      }
      return;
    }

    showToast('⚠️ Unsupported file. Use DOCX or TXT.');
  });
}

/* ── Boot ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function () {
  initLogoUpload();
  initSchemeUpload();
  renderDaySelector();
});