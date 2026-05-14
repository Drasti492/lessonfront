/* ============================================================
   EduPlan v2 — app.js  (FIXED)
   Fixes:
   - checkaDbStatus typo → checkDbStatus
   - All API calls match backend routes
   - Double lesson = two separate 40-min periods (not one 80-min block)
   - Step 4 required dates validation
============================================================ */

const BASE = 'https://lessonplans-l3b1.onrender.com';

/* ─────────────────────────────────────────────────────────────────
   STATE
───────────────────────────────────────────────────────────────── */
const state = {
  currentStep: 1,
  logoBase64:  null,
  subjectId:   null,
  subjectName: '',
  form:        '',
  stream:      '',
  topics:      [],
  selectedTopic: null,
  subtopics:   [],
  selectedSubtopicIds: [],
  daySlots:    [],
  scheduleRows: [],
  generatedPlans: [],
};

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

/* ─────────────────────────────────────────────────────────────────
   NAVIGATION
───────────────────────────────────────────────────────────────── */
function goTo(step) {
  document.querySelectorAll('.step-panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const panel = document.getElementById('step-' + step);
  const nav   = document.querySelector('.nav-item[data-step="' + step + '"]');
  if (panel) panel.classList.add('active');
  if (nav)   nav.classList.add('active');

  state.currentStep = step;
  document.getElementById('mobStepBadge').textContent = 'Step ' + step + ' of 5';

  for (var i = 1; i <= 5; i++) {
    var ns = document.getElementById('ns-' + i);
    if (ns) ns.className = 'nav-status' + (i < step ? ' done' : '');
  }

  if (step === 5) buildSummary();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  closeSidebar();
}

/* ─────────────────────────────────────────────────────────────────
   TOAST
───────────────────────────────────────────────────────────────── */
function toast(msg, duration) {
  duration = duration || 3200;
  var el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  setTimeout(function () { el.classList.remove('show'); }, duration);
}

/* ─────────────────────────────────────────────────────────────────
   SIDEBAR
───────────────────────────────────────────────────────────────── */
function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
  document.getElementById('sidebarOverlay').classList.toggle('open');
}
function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

/* ─────────────────────────────────────────────────────────────────
   DB STATUS — fixed typo from checkaDbStatus → checkDbStatus
───────────────────────────────────────────────────────────────── */
async function checkDbStatus() {
  var dot   = document.querySelector('.db-dot');
  var label = document.querySelector('.db-label');
  try {
    var res  = await fetch(BASE + '/api/admin/stats');
    if (res.ok) {
      var data = await res.json();
      dot.className     = 'db-dot online';
      label.textContent = data.subjects + ' subjects · ' + data.subtopics + ' subtopics';
    } else {
      throw new Error('not ok');
    }
  } catch (e) {
    dot.className     = 'db-dot offline';
    label.textContent = 'DB offline';
  }
}

/* ─────────────────────────────────────────────────────────────────
   STEP 1
───────────────────────────────────────────────────────────────── */
function step1Next() {
  var name   = document.getElementById('studentName').value.trim();
  var admNo  = document.getElementById('admNo').value.trim();
  var school = document.getElementById('schoolName').value.trim();
  if (!name || !admNo || !school) {
    toast('⚠️ Please fill in your name, admission number, and school name.');
    return;
  }
  goTo(2);
}

/* ─────────────────────────────────────────────────────────────────
   STEP 2 — Subject & Class
───────────────────────────────────────────────────────────────── */
async function loadSubjects() {
  try {
    var res  = await fetch(BASE + '/api/curriculum/subjects');
    var data = await res.json();
    var sel  = document.getElementById('subjectSelect');
    sel.innerHTML = '<option value="">— Select subject —</option>';
    (data.subjects || []).forEach(function (s) {
      var opt        = document.createElement('option');
      opt.value      = s._id;
      opt.textContent = s.name;
      opt.dataset.forms = JSON.stringify(s.forms || []);
      sel.appendChild(opt);
    });
  } catch (e) {
    toast('⚠️ Could not load subjects. Check server connection.');
  }
}

function onSubjectChange() {
  var sel  = document.getElementById('subjectSelect');
  var fSel = document.getElementById('formSelect');
  var opt  = sel.options[sel.selectedIndex];

  state.subjectId   = sel.value || null;
  state.subjectName = opt ? opt.textContent : '';

  fSel.innerHTML = '<option value="">— Select form —</option>';
  fSel.disabled  = !sel.value;

  if (sel.value) {
    var forms = JSON.parse(opt.dataset.forms || '[]');
    forms.forEach(function (f) {
      var o = document.createElement('option');
      o.value = f; o.textContent = f;
      fSel.appendChild(o);
    });
  }
}

function onFormChange() {
  state.form = document.getElementById('formSelect').value;
}

async function step2Next() {
  if (!state.subjectId) { toast('⚠️ Please select a subject.'); return; }
  if (!state.form)       { toast('⚠️ Please select a form / grade.'); return; }
  state.stream = document.getElementById('stream').value.trim();
  await loadTopics();
  goTo(3);
}

/* ─────────────────────────────────────────────────────────────────
   STEP 3 — Topic & Subtopics
───────────────────────────────────────────────────────────────── */
async function loadTopics() {
  try {
    var url  = BASE + '/api/curriculum/topics?subjectId=' + state.subjectId + '&form=' + encodeURIComponent(state.form);
    var res  = await fetch(url);
    var data = await res.json();
    state.topics = data.topics || [];
    renderTopicDropdown(state.topics);
  } catch (e) {
    toast('⚠️ Could not load topics.');
  }
}

function renderTopicDropdown(topics) {
  var dd = document.getElementById('topicDropdown');
  dd.innerHTML = '';
  if (!topics.length) {
    dd.innerHTML = '<div class="topic-option" style="color:var(--muted);font-style:italic">No topics found for this selection</div>';
    return;
  }
  topics.forEach(function (t) {
    var div        = document.createElement('div');
    div.className  = 'topic-option';
    div.textContent = t.name;
    div.dataset.id  = t._id;
    div.onclick     = function () { selectTopic(t); };
    dd.appendChild(div);
  });
}

function filterTopics() {
  var q        = document.getElementById('topicSearch').value.toLowerCase();
  var filtered = state.topics.filter(function (t) { return t.name.toLowerCase().includes(q); });
  renderTopicDropdown(filtered);
  document.getElementById('topicDropdown').classList.add('open');
}

async function selectTopic(topic) {
  state.selectedTopic         = topic;
  state.selectedSubtopicIds   = [];

  document.getElementById('topicSearch').value = topic.name;
  document.getElementById('topicDropdown').classList.remove('open');

  var badge          = document.getElementById('selectedTopicBadge');
  badge.textContent  = '📖 ' + topic.name;
  badge.style.display = 'inline-flex';

  try {
    var res  = await fetch(BASE + '/api/curriculum/subtopics?topicId=' + topic._id);
    var data = await res.json();
    state.subtopics = data.subtopics || [];
    renderSubtopicList(state.subtopics);
    document.getElementById('subtopicSection').style.display    = 'block';
    document.getElementById('subtopicCountBadge').textContent   = state.subtopics.length + ' lessons';
  } catch (e) {
    toast('⚠️ Could not load subtopics.');
  }
}

function renderSubtopicList(subtopics) {
  var list = document.getElementById('subtopicList');
  list.innerHTML = '';
  subtopics.forEach(function (s) {
    var item         = document.createElement('div');
    item.className   = 'subtopic-item';
    item.dataset.id  = s._id;
    var obj = (s.objectives || '').substring(0, 90) + (s.objectives && s.objectives.length > 90 ? '…' : '');
    item.innerHTML   =
      '<input type="checkbox" id="sub_' + s._id + '" data-id="' + s._id + '" onchange="onSubtopicCheck(this)">' +
      '<div>' +
        '<div class="subtopic-name">' + s.name + '</div>' +
        '<div class="subtopic-meta">' + obj + '</div>' +
      '</div>';
    item.onclick = function (e) {
      if (e.target.type !== 'checkbox') {
        var cb = item.querySelector('input[type=checkbox]');
        cb.checked = !cb.checked;
        onSubtopicCheck(cb);
      }
    };
    list.appendChild(item);
  });
}

function onSubtopicCheck(cb) {
  var id   = cb.dataset.id;
  var item = cb.closest('.subtopic-item');
  if (cb.checked) {
    item.classList.add('checked');
    if (!state.selectedSubtopicIds.includes(id)) state.selectedSubtopicIds.push(id);
  } else {
    item.classList.remove('checked');
    state.selectedSubtopicIds = state.selectedSubtopicIds.filter(function (x) { return x !== id; });
  }
}

function selectAllSubtopics() {
  document.querySelectorAll('#subtopicList input[type=checkbox]').forEach(function (cb) {
    cb.checked = true; onSubtopicCheck(cb);
  });
}
function clearSubtopics() {
  document.querySelectorAll('#subtopicList input[type=checkbox]').forEach(function (cb) {
    cb.checked = false; onSubtopicCheck(cb);
  });
}

function step3Next() {
  if (!state.selectedTopic)             { toast('⚠️ Please select a topic.'); return; }
  if (!state.selectedSubtopicIds.length){ toast('⚠️ Please select at least one subtopic.'); return; }
  goTo(4);
}

/* ─────────────────────────────────────────────────────────────────
   STEP 4 — Schedule & Dates
   NOTE: Double lesson = TWO separate 40-min periods in the same day,
         NOT one joined 80-min block. Each generates its OWN lesson plan.
───────────────────────────────────────────────────────────────── */
function renderDaySelector() {
  var wrap = document.getElementById('daySelectorWrap');
  wrap.innerHTML = '';
  DAYS.forEach(function (day) {
    var card       = document.createElement('div');
    card.className = 'day-card';
    card.id        = 'daycard-' + day;
    card.innerHTML =
      '<label class="day-check-label">' +
        '<input type="checkbox" class="day-check" data-day="' + day + '" onchange="toggleDayCard(\'' + day + '\')">' +
        '<span>' + day + '</span>' +
      '</label>' +
      '<div class="day-detail" id="daydetail-' + day + '" style="display:none">' +
        '<div class="day-field">' +
          '<label>Start time</label>' +
          '<input type="time" class="day-start" data-day="' + day + '" value="08:00">' +
        '</div>' +
        '<div class="day-field">' +
          '<label>End time</label>' +
          '<input type="time" class="day-end" data-day="' + day + '" value="08:40">' +
        '</div>' +
        '<div class="day-field">' +
          '<label>Lessons this day</label>' +
          '<select class="day-count" data-day="' + day + '" onchange="updateDayBadge(\'' + day + '\')">' +
            '<option value="1">1 lesson (40 min)</option>' +
            '<option value="2">2 lessons (2 × 40 min, separate periods)</option>' +
          '</select>' +
        '</div>' +
        '<span class="day-badge" id="daybadge-' + day + '">1 period — 40 min</span>' +
      '</div>';
    wrap.appendChild(card);
  });
}

function toggleDayCard(day) {
  var checked = document.querySelector('.day-check[data-day="' + day + '"]').checked;
  document.getElementById('daydetail-' + day).style.display = checked ? 'flex' : 'none';
  document.getElementById('daycard-' + day).classList.toggle('selected', checked);
}

function updateDayBadge(day) {
  var v     = parseInt(document.querySelector('.day-count[data-day="' + day + '"]').value);
  var badge = document.getElementById('daybadge-' + day);
  badge.textContent = v === 2 ? '2 separate periods — 40 min each' : '1 period — 40 min';
  badge.className   = 'day-badge' + (v === 2 ? ' double' : '');
}

function getSelectedDaySlots() {
  var slots = [];
  document.querySelectorAll('.day-check:checked').forEach(function (chk) {
    var day = chk.dataset.day;
    var count = parseInt(document.querySelector('.day-count[data-day="' + day + '"]').value);
    var startTime = document.querySelector('.day-start[data-day="' + day + '"]').value;
    var endTime   = document.querySelector('.day-end[data-day="'   + day + '"]').value;

    if (count === 2) {
      /* Two separate 40-min periods — each generates its own lesson plan */
      slots.push({ day: day, startTime: startTime, endTime: endTime, isDouble: false, periodLabel: 'Period 1' });
      slots.push({ day: day, startTime: startTime, endTime: endTime, isDouble: false, periodLabel: 'Period 2' });
    } else {
      slots.push({ day: day, startTime: startTime, endTime: endTime, isDouble: false, periodLabel: '' });
    }
  });
  return slots;
}

function buildScheduleRows() {
  var slots = getSelectedDaySlots();
  if (!slots.length) { toast('⚠️ Select at least one teaching day first.'); return; }

  var orderedSubs = state.subtopics.filter(function (s) {
    return state.selectedSubtopicIds.includes(s._id);
  });
  if (!orderedSubs.length) { toast('⚠️ No subtopics selected. Go back to Step 3.'); return; }

  /* Assign subtopics to slots in order */
  state.scheduleRows = orderedSubs.map(function (sub, idx) {
    var slot = slots[idx % slots.length];
    return {
      subtopicId:   sub._id,
      subtopicName: sub.name,
      day:          slot.day,
      startTime:    slot.startTime,
      endTime:      slot.endTime,
      isDouble:     false,     // always single 40-min plan
      duration:     40,
      date:         '',
      lessonLabel:  'L' + (idx + 1),
      periodLabel:  slot.periodLabel || '',
    };
  });

  renderScheduleTable();
  document.getElementById('scheduleTableWrap').style.display = 'block';
  toast('✅ ' + state.scheduleRows.length + ' lesson rows created — add a date to each');
}

function renderScheduleTable() {
  var tbody = document.getElementById('scheduleBody');
  tbody.innerHTML = '';
  state.scheduleRows.forEach(function (row, i) {
    var tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' +
        '<span class="lesson-badge">' + row.lessonLabel + '</span>' +
        (row.periodLabel ? '<span class="dbl-pill">' + row.periodLabel + '</span>' : '') +
      '</td>' +
      '<td style="font-size:0.83rem;font-weight:500">' + row.subtopicName + '</td>' +
      '<td style="font-size:0.8rem"><strong>' + row.day + '</strong><br><span style="color:var(--muted)">' + row.startTime + ' – ' + row.endTime + '</span></td>' +
      '<td><input type="date" class="row-date" data-index="' + i + '" onchange="setRowDate(' + i + ', this.value)" value="' + row.date + '"></td>' +
      '<td style="font-size:0.78rem;color:var(--muted)">40 min</td>' +
      '<td><button class="rm-row-btn" onclick="removeScheduleRow(' + i + ')" title="Remove">✕</button></td>';
    tbody.appendChild(tr);
  });
}

function setRowDate(index, value) {
  if (state.scheduleRows[index]) state.scheduleRows[index].date = value;
}
function removeScheduleRow(index) {
  state.scheduleRows.splice(index, 1);
  renderScheduleTable();
  if (!state.scheduleRows.length) document.getElementById('scheduleTableWrap').style.display = 'none';
}

function step4Next() {
  if (!state.scheduleRows.length) { toast('⚠️ Please build lesson rows first.'); return; }
  var missing = state.scheduleRows.filter(function (r) { return !r.date; }).length;
  if (missing > 0) {
    toast('⚠️ ' + missing + ' lesson' + (missing > 1 ? 's are' : ' is') + ' missing a date.');
    return;
  }
  goTo(5);
}

/* ─────────────────────────────────────────────────────────────────
   STEP 5 — Summary & Generate
───────────────────────────────────────────────────────────────── */
function buildSummary() {
  var name  = document.getElementById('studentName').value || '—';
  var school = document.getElementById('schoolName').value  || '—';
  var count = state.scheduleRows.length;

  document.getElementById('summaryStrip').innerHTML = [
    { label: 'Student Teacher', value: name },
    { label: 'School',          value: school },
    { label: 'Subject',         value: state.subjectName || '—' },
    { label: 'Form / Grade',    value: state.form        || '—' },
    { label: 'Topic',           value: state.selectedTopic ? state.selectedTopic.name : '—' },
    { label: 'Total Lessons',   value: count + ' plan' + (count !== 1 ? 's' : '') },
  ].map(function (item) {
    return '<div class="sum-item"><div class="sum-label">' + item.label + '</div><div class="sum-value">' + item.value + '</div></div>';
  }).join('');
}

function getFormData() {
  return {
    studentName: document.getElementById('studentName').value,
    admNo:       document.getElementById('admNo').value,
    schoolName:  document.getElementById('schoolName').value,
    department:  document.getElementById('department').value,
    subject:     state.subjectName,
    form:        state.form,
    grade:       state.form,
    stream:      state.stream,
    numStudents: document.getElementById('numStudents').value,
    duration:    document.getElementById('duration').value,
    logoBase64:  state.logoBase64 || null,
  };
}

async function generateAll() {
  if (!state.scheduleRows.length) { toast('⚠️ No lesson rows found.'); return; }

  var genBtn       = document.getElementById('genBtn');
  var progressSec  = document.getElementById('progressSection');
  var progressText = document.getElementById('progressText');
  var progressFill = document.getElementById('progressFill');
  var progressFrac = document.getElementById('progressFraction');
  var plansGrid    = document.getElementById('plansGrid');

  genBtn.disabled             = true;
  genBtn.innerHTML            = '<span class="spinner"></span> Generating…';
  progressSec.style.display   = 'flex';
  progressFill.style.width    = '0%';
  plansGrid.innerHTML         = '';
  state.generatedPlans        = [];

  var formData = getFormData();

  /* Placeholder cards */
  var cards = state.scheduleRows.map(function (row, i) {
    var card       = document.createElement('div');
    card.className = 'plan-card';
    card.id        = 'card-' + i;
    card.innerHTML =
      '<div class="plan-card-head">' +
        '<div class="plan-card-week">' + row.lessonLabel + (row.periodLabel ? ' · ' + row.periodLabel : '') + ' · ' + row.day + ' · ' + row.date + '</div>' +
        '<div class="plan-card-title">⏳ ' + row.subtopicName + '</div>' +
      '</div>' +
      '<div class="plan-card-body"><strong>Time:</strong> ' + row.startTime + ' – ' + row.endTime + '<br><strong>Duration:</strong> 40 min</div>' +
      '<div class="plan-card-foot" id="foot-' + i + '"><span class="status-chip pending">⏳ Awaiting generation…</span></div>';
    plansGrid.appendChild(card);
    return card;
  });

  /* Generate sequentially */
  for (var i = 0; i < state.scheduleRows.length; i++) {
    var row  = state.scheduleRows[i];
    var foot = document.getElementById('foot-' + i);

    progressText.textContent = 'Generating ' + (i + 1) + ' of ' + state.scheduleRows.length + ' — ' + row.subtopicName;
    progressFrac.textContent = i + ' / ' + state.scheduleRows.length;

    var payload = Object.assign({}, formData, {
      subtopicId: row.subtopicId,
      day:        row.day,
      date:       row.date,
      startTime:  row.startTime,
      endTime:    row.endTime,
      isDouble:   false,
      duration:   40,
      lessonNum:  i + 1,
    });

    try {
      var res = await fetch(BASE + '/api/lessons/generate', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });

      if (!res.ok) {
        var errText = await res.text();
        throw new Error('Server ' + res.status + ': ' + errText.substring(0, 150));
      }

      var blob  = await res.blob();
      var url   = URL.createObjectURL(blob);
      var fname = 'L' + (i + 1) + '_' + row.subtopicName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 35) + '.docx';

      cards[i].querySelector('.plan-card-title').textContent = row.subtopicName;
      foot.innerHTML =
        '<span class="status-chip done">✅ Ready</span>' +
        '<a href="' + url + '" download="' + fname + '" class="btn-dl">⬇ Download DOCX</a>';

      state.generatedPlans[i] = { success: true, url: url, fname: fname };

    } catch (err) {
      console.error('Lesson ' + (i + 1) + ' failed:', err);
      foot.innerHTML =
        '<span class="status-chip error">❌ ' + err.message.substring(0, 80) + '</span>' +
        '<button class="btn-retry" onclick="retrySingle(' + i + ')">↩ Retry</button>';
      state.generatedPlans[i] = { success: false, error: err.message };
    }

    var pct = ((i + 1) / state.scheduleRows.length) * 100;
    progressFill.style.width = pct + '%';
    progressFrac.textContent = (i + 1) + ' / ' + state.scheduleRows.length;

    /* Delay between calls to avoid Gemini rate limits */
    if (i < state.scheduleRows.length - 1) {
      await new Promise(function (r) { setTimeout(r, 2000); });
    }
  }

  var doneCount = state.generatedPlans.filter(function (p) { return p && p.success; }).length;
  progressText.textContent = '✅ Done! ' + doneCount + ' of ' + state.scheduleRows.length + ' generated.';
  genBtn.disabled  = false;
  genBtn.innerHTML =
    '<svg width="20" height="20" viewBox="0 0 24 24" fill="none">' +
    '<path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>' +
    ' Regenerate All';
  toast('🎉 ' + doneCount + ' lesson plans ready!', 4000);
}

/* ── Retry single ── */
async function retrySingle(index) {
  var row  = state.scheduleRows[index];
  var foot = document.getElementById('foot-' + index);
  if (!row) { toast('⚠️ Row data lost — please regenerate all.'); return; }

  foot.innerHTML = '<span class="status-chip pending">⏳ Retrying…</span>';

  try {
    var payload = Object.assign({}, getFormData(), {
      subtopicId: row.subtopicId,
      day:        row.day,
      date:       row.date,
      startTime:  row.startTime,
      endTime:    row.endTime,
      isDouble:   false,
      duration:   40,
      lessonNum:  index + 1,
    });
    var res = await fetch(BASE + '/api/lessons/generate', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Server error ' + res.status);

    var blob  = await res.blob();
    var url   = URL.createObjectURL(blob);
    var fname = 'L' + (index + 1) + '_' + row.subtopicName.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 35) + '.docx';

    foot.innerHTML =
      '<span class="status-chip done">✅ Ready</span>' +
      '<a href="' + url + '" download="' + fname + '" class="btn-dl">⬇ Download DOCX</a>';
    state.generatedPlans[index] = { success: true, url: url, fname: fname };
    toast('✅ Retry successful!');
  } catch (err) {
    foot.innerHTML =
      '<span class="status-chip error">❌ ' + err.message.substring(0, 80) + '</span>' +
      '<button class="btn-retry" onclick="retrySingle(' + index + ')">↩ Retry</button>';
    toast('❌ Retry failed — ' + err.message);
  }
}

/* ── Logo upload ── */
function initLogoUpload() {
  document.getElementById('logoInput').addEventListener('change', function () {
    var file = this.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('⚠️ Please upload an image file.'); return; }
    var reader = new FileReader();
    reader.onload = function (e) {
      state.logoBase64 = e.target.result;
      var img = document.getElementById('logoPreview');
      img.src = e.target.result;
      img.style.display = 'block';
      document.getElementById('logoDropInner').style.display = 'none';
      toast('✅ Logo uploaded!');
    };
    reader.readAsDataURL(file);
  });
}

/* ── Topic search — close on outside click ── */
document.addEventListener('click', function (e) {
  var dd = document.getElementById('topicDropdown');
  if (dd && !dd.contains(e.target) && e.target.id !== 'topicSearch') {
    dd.classList.remove('open');
  }
});

/* ── Boot ── */
document.addEventListener('DOMContentLoaded', function () {
  initLogoUpload();
  renderDaySelector();
  loadSubjects();
  checkDbStatus();  // ← fixed typo
});