/* ============================================================
   EduPlan — app.js
   All functions are top-level so onclick="..." in HTML works.

   Schedule model:
   - Student selects which days they teach (Mon–Fri)
   - For each selected day: start time, end time, lessons per day
   - 1 lesson per day → 40 min (or custom duration)
   - 2 lessons per day → isDouble = true → 80 min
   - Week range (startWeek → endWeek) generates one row per
     day-slot per week, each row has topic + subtopic fields.
============================================================ */

const BASE_URL = 'https://lessonplans-l3b1.onrender.com';

/* ── State ───────────────────────────────────────────────── */
const state = {
  step:       1,
  logoBase64: null,
  lessons:    [],   // populated when Generate is clicked
  daySlots:   [],   // [{day, startTime, endTime, lessonsPerDay}]
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

/* ═══════════════════════════════════════════════════════════
   STEP 3 — Day selector UI
   Renders day checkboxes + time inputs + lessons-per-day picker
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
  var detail = document.getElementById('daydetail-' + day);
  var card   = document.getElementById('daycard-' + day);
  var checked = card.querySelector('.day-check').checked;
  detail.style.display = checked ? 'block' : 'none';
  card.classList.toggle('selected', checked);
}

function updateDayBadge(day) {
  var sel    = document.querySelector('.day-count[data-day="' + day + '"]');
  var badge  = document.getElementById('daybadge-' + day);
  var count  = parseInt(sel.value);
  badge.textContent = count === 2
    ? 'Double lesson — 80 min total'
    : 'Single lesson — 40 min';
}

/* ── Collect selected day slots ──────────────────────────── */
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
   Logic: for each week in range, for each selected day slot,
   create one row (or two rows if double lesson).
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

  var totalRows = 0;
  for (var w = startWeek; w <= endWeek; w++) {
    daySlots.forEach(function (slot) {
      // Each day slot is ONE lesson plan row
      // (double lesson → same row, just isDouble=true, 80 min)
      totalRows++;
    });
  }

  if (totalRows > 40) {
    showToast('⚠️ Too many lesson rows (' + totalRows + '). Reduce week range or days.');
    return;
  }

  state.daySlots = daySlots;

  var container = document.getElementById('topicsContainer');
  container.innerHTML = '';

  /* Table header */
  var header = document.createElement('div');
  header.className = 'topics-header';
  header.innerHTML =
    '<span>Week / Day</span>' +
    '<span>Topic</span>' +
    '<span>Sub-Topic</span>' +
    '<span>Date</span>' +
    '<span></span>';
  container.appendChild(header);

  var lessonCounter = 0;
  for (var week = startWeek; week <= endWeek; week++) {
    daySlots.forEach(function (slot) {
      lessonCounter++;
      var isDouble = slot.lessonsPerDay === 2;
      var label    = 'W' + week + '<br>' + slot.day.substring(0, 3);
      if (isDouble) label += '<br><span class="dbl-tag">DBL</span>';

      var row = document.createElement('div');
      row.className = 'topic-row';
      row.setAttribute('data-week',      week);
      row.setAttribute('data-lesson',    lessonCounter);
      row.setAttribute('data-day',       slot.day);
      row.setAttribute('data-start',     slot.startTime);
      row.setAttribute('data-end',       slot.endTime);
      row.setAttribute('data-double',    isDouble ? 'true' : 'false');

      row.innerHTML =
        '<div class="week-tag">' + label + '</div>' +
        '<input type="text"  class="topic-input"    placeholder="e.g. Faulting">' +
        '<input type="text"  class="subtopic-input" placeholder="e.g. Types of faults">' +
        '<input type="date"  class="lesson-date">' +
        '<button class="rm-btn" title="Remove">✕</button>';

      row.querySelector('.rm-btn').addEventListener('click', function () {
        this.closest('.topic-row').remove();
      });

      container.appendChild(row);
    });
  }

  showToast('✅ ' + lessonCounter + ' lesson rows created');
}

/* ── Build summary card (step 4) ─────────────────────────── */
function buildSummary() {
  var name    = document.getElementById('studentName').value || '—';
  var school  = document.getElementById('schoolName').value  || '—';
  var subject = document.getElementById('subject').value     || '—';
  var form    = document.getElementById('form').value        || '—';
  var term    = document.getElementById('term').value        || '—';
  var rows    = document.querySelectorAll('.topic-row').length;

  var daySlots = getSelectedDaySlots();
  var daysText = daySlots.length > 0
    ? daySlots.map(function (s) { return s.day.substring(0, 3) + ' ' + s.startTime + '–' + s.endTime; }).join(', ')
    : '—';

  document.getElementById('summaryBox').innerHTML =
    '<div class="sum-item"><span class="sum-label">Student Teacher</span><span class="sum-value">' + name    + '</span></div>' +
    '<div class="sum-item"><span class="sum-label">School</span><span class="sum-value">'           + school  + '</span></div>' +
    '<div class="sum-item"><span class="sum-label">Subject</span><span class="sum-value">'          + subject + '</span></div>' +
    '<div class="sum-item"><span class="sum-label">Form / Class</span><span class="sum-value">'     + form    + '</span></div>' +
    '<div class="sum-item"><span class="sum-label">Term</span><span class="sum-value">'             + term    + '</span></div>' +
    '<div class="sum-item"><span class="sum-label">Teaching Days</span><span class="sum-value">'    + daysText + '</span></div>' +
    '<div class="sum-item"><span class="sum-label">Total Lessons</span><span class="sum-value">'    + rows    + '</span></div>';
}

/* ── Collect static form data ────────────────────────────── */
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
    generalObjectives: document.getElementById('generalObjectives').value,
    schemeText:        document.getElementById('schemeText').value,
    logoBase64:        state.logoBase64,
  };
}

/* ═══════════════════════════════════════════════════════════
   GENERATE ALL LESSON PLANS
═══════════════════════════════════════════════════════════ */
async function generatePlans() {
  var rows = document.querySelectorAll('.topic-row');
  if (rows.length === 0) {
    showToast('⚠️ No lesson rows found. Go back and build rows first.');
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

  /* ── Snapshot all row data into state.lessons ── */
  state.lessons = [];
  rows.forEach(function (row) {
    var isDouble = row.getAttribute('data-double') === 'true';
    state.lessons.push({
      week:      row.getAttribute('data-week'),
      lessonNum: row.getAttribute('data-lesson'),
      day:       row.getAttribute('data-day'),
      startTime: row.getAttribute('data-start'),
      endTime:   row.getAttribute('data-end'),
      isDouble:  isDouble,
      duration:  isDouble ? '80' : (formData.duration || '40'),
      topic:     row.querySelector('.topic-input').value,
      subTopic:  row.querySelector('.subtopic-input').value,
      date:      row.querySelector('.lesson-date').value,
    });
  });

  /* ── Create placeholder cards ── */
  var cards = state.lessons.map(function (lesson, i) {
    var card = document.createElement('div');
    card.className = 'plan-card';
    card.id        = 'card-' + i;

    var typeLabel = lesson.isDouble ? '🔁 Double (80 min)' : '📋 Single (40 min)';

    card.innerHTML =
      '<div class="plan-card-head">' +
        '<div>' +
          '<div class="plan-badge">Week ' + lesson.week + ' · ' + (lesson.day || 'Lesson') + '</div>' +
          '<h3>' + (lesson.topic || 'Untitled Lesson') + '</h3>' +
        '</div>' +
      '</div>' +
      '<div class="plan-card-body">' +
        '<strong>Sub-topic:</strong> ' + (lesson.subTopic || '—') + '<br>' +
        '<strong>Date:</strong> '      + (lesson.date     || '—') + '<br>' +
        '<strong>Time:</strong> '      + lesson.startTime + ' – ' + lesson.endTime + '<br>' +
        '<strong>Type:</strong> '      + typeLabel +
      '</div>' +
      '<div class="plan-card-foot">' +
        '<span class="plan-status loading">⏳ Generating with Gemini...</span>' +
      '</div>';

    plansGrid.appendChild(card);
    return card;
  });

  /* ── Generate sequentially ── */
  var done = 0;
  for (var i = 0; i < state.lessons.length; i++) {
    var lesson = state.lessons[i];
    var foot   = cards[i].querySelector('.plan-card-foot');

    progressText.textContent =
      'Generating ' + (i + 1) + ' of ' + state.lessons.length +
      ': ' + (lesson.topic || '...');

    try {
      var payload = Object.assign({}, formData, lesson);

      var res = await fetch(BASE_URL + '/api/lessons/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) {
        var errText = await res.text();
        throw new Error('Server ' + res.status + ': ' + errText.substring(0, 120));
      }

      var blob   = await res.blob();
      var url    = URL.createObjectURL(blob);
      var dlName = 'W' + lesson.week + '_' + (lesson.day || 'L' + lesson.lessonNum) + '_' +
                   (lesson.topic || 'lesson').replace(/[^a-zA-Z0-9]/g, '_') + '.docx';

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
  }

  progressText.textContent = '✅ All ' + state.lessons.length + ' lessons processed!';
  genBtn.disabled  = false;
  genBtn.innerHTML =
    '<svg width="18" height="18" fill="none" viewBox="0 0 24 24">' +
    '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg> Regenerate All';
  showToast('🎉 ' + done + ' lesson plans done!', 4000);
}

/* ── Retry a single failed card (uses state.lessons) ─────── */
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

    var blob   = await res.blob();
    var url    = URL.createObjectURL(blob);
    var dlName = 'W' + lesson.week + '_' + (lesson.day || 'L' + lesson.lessonNum) + '_' +
                 (lesson.topic || 'lesson').replace(/[^a-zA-Z0-9]/g, '_') + '.docx';

    foot.innerHTML =
      '<span class="plan-status done">✅ Ready</span>' +
      '<a href="' + url + '" download="' + dlName + '" class="btn download">⬇ Download DOCX</a>';

  } catch (err) {
    foot.innerHTML =
      '<span class="plan-status error">❌ ' + err.message + '</span>' +
      '<button class="btn download" onclick="retrySingle(' + index + ')">↩ Retry</button>';
    showToast('❌ Retry failed. Check backend.');
  }
}

/* ── Logo upload ─────────────────────────────────────────── */
function initLogoUpload() {
  document.getElementById('logoInput').addEventListener('change', function () {
    var file = this.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showToast('⚠️ Please upload an image file (PNG or JPG).');
      return;
    }
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

/* ── Scheme upload ───────────────────────────────────────── */
function initSchemeUpload() {
  document.getElementById('schemeInput').addEventListener('change', async function () {
    var file = this.files[0];
    if (!file) return;

    var tag = document.getElementById('schemeFileName');
    tag.innerHTML     = '📎 ' + file.name;
    tag.style.display = 'flex';

    if (file.name.toLowerCase().endsWith('.txt')) {
      var reader = new FileReader();
      reader.onload = function (e) {
        document.getElementById('schemeText').value = e.target.result;
        showToast('✅ Scheme text loaded!');
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
          showToast('✅ Scheme extracted successfully!');
        } else {
          showToast('⚠️ Could not extract DOCX. Paste content manually.');
        }
      } catch (e) {
        showToast('⚠️ Server unreachable. Paste scheme content manually.');
      }
      return;
    }

    showToast('⚠️ Unsupported file type. Use DOCX or TXT.');
  });
}

/* ── Boot ────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function () {
  initLogoUpload();
  initSchemeUpload();
  renderDaySelector();   // Build day-picker cards in step 3
});