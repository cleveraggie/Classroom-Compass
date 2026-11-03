"use strict";

const STORAGE_KEY = "classroom-merit-local-v1";
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const uid = () => (window.crypto && crypto.randomUUID)
  ? crypto.randomUUID()
  : "id-" + Date.now() + "-" + Math.random().toString(36).slice(2);
const esc = (value) => String(value ?? "").replace(/[&<>"]/g, (ch) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
const initials = (name) => String(name || "").trim().split(/\s+/).slice(0, 2)
  .map((part) => part[0] || "").join("").toUpperCase();
const todayISO = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const defaultTypes = () => [
  { id: uid(), name: "Participation", value: 1 },
  { id: uid(), name: "Helping others", value: 2 },
  { id: uid(), name: "Great effort", value: 2 },
  { id: uid(), name: "Responsibility", value: 1 },
  { id: uid(), name: "Point deduction", value: -1 }
];
const emptyState = () => ({ classes: [], students: [], pointTypes: [], attendance: [], entries: [] });

let state = readState();
let classes = state.classes;
let students = [];
let pointTypes = [];
let attendance = [];
let entries = [];
let selectedClassId = classes[0]?.id || "";

function readState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (saved && Array.isArray(saved.classes)) {
      return {
        classes: saved.classes,
        students: saved.students || [],
        pointTypes: saved.pointTypes || [],
        attendance: saved.attendance || [],
        entries: saved.entries || []
      };
    }
  } catch (error) {}
  return emptyState();
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    toast("This browser blocked local saving. Keep this browser profile and avoid clearing site data.");
  }
}

function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  window.setTimeout(() => node.classList.remove("show"), 2800);
}

function currentClass() {
  return classes.find((item) => item.id === selectedClassId) || null;
}

function balanceFor(studentId) {
  return entries.filter((entry) => entry.student_id === studentId)
    .reduce((sum, entry) => sum + entry.delta, 0);
}

function renderClassSelectors() {
  const optionHtml = classes.map((item) =>
    '<option value="' + esc(item.id) + '">' + esc(item.name) + "</option>"
  ).join("");
  const empty = '<option value="">No classes yet</option>';
  $("#classSelect").innerHTML = optionHtml || empty;
  $("#pointsClassSelect").innerHTML = optionHtml || empty;
  if (selectedClassId) {
    $("#classSelect").value = selectedClassId;
    $("#pointsClassSelect").value = selectedClassId;
  }
}

function render() {
  const c = currentClass();
  $("#classCount").textContent = String(classes.length);
  $("#memberCount").textContent = String(students.length);
  $("#pointsTotal").textContent = String(students.reduce((sum, student) => sum + balanceFor(student.id), 0));
  renderClassSelectors();
  $("#classWorkspace").classList.toggle("hidden", !c);
  $("#noClasses").classList.toggle("hidden", !!c);
  $("#pointsWorkspace").classList.toggle("hidden", !c);
  $("#noPointsClass").classList.toggle("hidden", !!c);
  $("#selectedClassTitle").textContent = c ? c.name + " roster" : "Class roster";
  $("#renameClassBtn").disabled = !c;
  $("#deleteClassBtn").disabled = !c;
  $("#markAllBtn").disabled = !c || students.length === 0;
  $("#addStudentBtn").disabled = !c;

  const date = $("#attendanceDate").value || todayISO();
  const search = $("#rosterSearch").value.trim().toLowerCase();
  const shownStudents = students.filter((student) => student.name.toLowerCase().includes(search));
  $("#classRows").innerHTML = shownStudents.map((student) => {
    const status = attendance.find((item) => item.student_id === student.id)?.status || "";
    return "<tr><td><div class=\"person\"><div class=\"avatar\">" + esc(initials(student.name)) +
      "</div><div class=\"person-name\">" + esc(student.name) + "</div></div></td><td class=\"points\">" +
      balanceFor(student.id) + " pts</td><td><select class=\"status " + esc(status) +
      "\" data-attendance=\"" + esc(student.id) + "\" aria-label=\"Attendance for " + esc(student.name) +
      "\"><option value=\"\">Not marked</option><option value=\"present\"" + (status === "present" ? " selected" : "") +
      ">Present</option><option value=\"late\"" + (status === "late" ? " selected" : "") +
      ">Late</option><option value=\"absent\"" + (status === "absent" ? " selected" : "") +
      ">Absent</option><option value=\"excused\"" + (status === "excused" ? " selected" : "") +
      ">Excused</option></select></td><td><button class=\"btn danger small remove-student\" data-id=\"" +
      esc(student.id) + "\">Remove</button></td></tr>";
  }).join("");
  $("#rosterEmpty").classList.toggle("hidden", !c || students.length > 0);
  $("#searchEmpty").classList.toggle("hidden", !c || students.length === 0 || shownStudents.length > 0);
  const here = students.filter((student) => {
    const status = attendance.find((item) => item.student_id === student.id)?.status;
    return status === "present" || status === "late";
  }).length;
  $("#attendanceSummary").textContent = here + " present · " + students.length + " people · " +
    new Date(date + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  $("#pointsRows").innerHTML = students.map((student) => {
    const latest = entries.filter((item) => item.student_id === student.id)
      .sort((a, b) => b.created_at - a.created_at)[0];
    const latestText = latest ? esc(latest.type_name) + " (" + (latest.delta > 0 ? "+" : "") + latest.delta + ")" :
      '<span class="hint">No activity yet</span>';
    return "<tr><td><div class=\"person\"><div class=\"avatar\">" + esc(initials(student.name)) +
      "</div><div class=\"person-name\">" + esc(student.name) + "</div></div></td><td class=\"points\">" +
      balanceFor(student.id) + " pts</td><td>" + latestText + "</td><td><button class=\"btn primary small adjust\" data-id=\"" +
      esc(student.id) + "\">＋ / − Points</button></td></tr>";
  }).join("");
  $("#pointsEmpty").classList.toggle("hidden", !c || students.length > 0);
  const sortedEntries = entries.slice().sort((a, b) => b.created_at - a.created_at);
  $("#pointHistory").innerHTML = sortedEntries.length ? sortedEntries.map((entry) =>
    '<div class="activity-item"><div class="activity-icon ' + (entry.delta > 0 ? "plus" : "minus") + '">' +
    (entry.delta > 0 ? "＋" : "−") + '</div><div class="activity-main"><b>' + esc(entry.student_name) +
    "</b> · " + esc(entry.type_name) + '<div class="activity-note">' + esc(entry.reason || "") +
    '</div><div class="activity-meta">' + new Date(entry.created_at).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
    }) + '</div></div><div class="delta ' + (entry.delta > 0 ? "pos" : "neg") + '">' +
    (entry.delta > 0 ? "+" : "") + entry.delta + "</div></div>"
  ).join("") : '<div class="empty">No points recorded for this class yet.</div>';
}

function loadClassData() {
  if (!classes.some((item) => item.id === selectedClassId)) selectedClassId = classes[0]?.id || "";
  students = state.students.filter((item) => item.class_id === selectedClassId)
    .slice().sort((a, b) => a.name.localeCompare(b.name));
  pointTypes = state.pointTypes.filter((item) => item.class_id === selectedClassId)
    .slice().sort((a, b) => a.name.localeCompare(b.name));
  attendance = state.attendance.filter((item) =>
    item.class_id === selectedClassId && item.attendance_date === $("#attendanceDate").value
  );
  entries = state.entries.filter((item) => item.class_id === selectedClassId);
  render();
}

function openFormDialog(title, subtitle, fieldsHtml, onSave) {
  const dialog = $("#formDialog");
  $("#dialogTitle").textContent = title;
  $("#dialogSubtitle").textContent = subtitle;
  $("#dialogBody").innerHTML = fieldsHtml;
  $("#dialogMessage").classList.add("hidden");
  $("#dialogSave").classList.remove("hidden");
  $("#dialogForm").onsubmit = async (event) => {
    event.preventDefault();
    $("#dialogSave").disabled = true;
    try {
      const shouldClose = await onSave();
      if (shouldClose) dialog.close();
    } catch (error) {
      showDialogMessage(error.message || "Something went wrong.", true);
    } finally {
      $("#dialogSave").disabled = false;
    }
  };
  dialog.showModal();
}

function showDialogMessage(message, isError) {
  const node = $("#dialogMessage");
  node.textContent = message;
  node.classList.toggle("error", !!isError);
  node.classList.remove("hidden");
}

function createClass() {
  openFormDialog("Add a class", "Create a class and its private roster.",
    '<div class="field"><label for="className">Class name</label><input id="className" maxlength="80" placeholder="e.g. 3rd Period" required></div>',
    () => {
      const name = $("#className").value.trim();
      if (!name) { showDialogMessage("Enter a class name.", true); return false; }
      if (classes.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
        showDialogMessage("A class with that name already exists.", true); return false;
      }
      const c = { id: uid(), name: name };
      state.classes.push(c);
      state.pointTypes.push(...defaultTypes().map((type) => ({ ...type, class_id: c.id })));
      classes = state.classes;
      selectedClassId = c.id;
      persist(); loadClassData(); toast("Class created.");
      return true;
    });
}

function addStudent() {
  const c = currentClass();
  if (!c) return;
  openFormDialog("Add a person", "Add someone to " + c.name + ".",
    '<div class="field"><label for="studentName">Person name</label><input id="studentName" maxlength="100" placeholder="First and last name" required></div>',
    () => {
      const name = $("#studentName").value.trim();
      if (!name) { showDialogMessage("Enter a name.", true); return false; }
      if (students.some((item) => item.name.toLowerCase() === name.toLowerCase())) {
        showDialogMessage("That name is already in this class.", true); return false;
      }
      state.students.push({ id: uid(), class_id: c.id, name: name });
      persist(); loadClassData(); toast("Person added to " + c.name + ".");
      return true;
    });
}

function renameClass() {
  const c = currentClass();
  if (!c) return;
  openFormDialog("Rename class", "Update the name shown for this class.",
    '<div class="field"><label for="className">Class name</label><input id="className" maxlength="80" value="' + esc(c.name) + '" required></div>',
    () => {
      const name = $("#className").value.trim();
      if (!name) { showDialogMessage("Enter a class name.", true); return false; }
      if (classes.some((item) => item.id !== c.id && item.name.toLowerCase() === name.toLowerCase())) {
        showDialogMessage("A class with that name already exists.", true); return false;
      }
      c.name = name; persist(); loadClassData(); toast("Class renamed."); return true;
    });
}

function deleteClass() {
  const c = currentClass();
  if (!c || !window.confirm("Delete " + c.name + " and all of its roster, attendance, point options, and point history?")) return;
  state.classes = state.classes.filter((item) => item.id !== c.id);
  state.students = state.students.filter((item) => item.class_id !== c.id);
  state.pointTypes = state.pointTypes.filter((item) => item.class_id !== c.id);
  state.attendance = state.attendance.filter((item) => item.class_id !== c.id);
  state.entries = state.entries.filter((item) => item.class_id !== c.id);
  classes = state.classes; selectedClassId = classes[0]?.id || "";
  persist(); loadClassData(); toast("Class deleted.");
}

function removeStudent(studentId) {
  const student = students.find((item) => item.id === studentId);
  if (!student || !window.confirm("Remove " + student.name + " from this roster? Their point history will remain.")) return;
  state.students = state.students.filter((item) => item.id !== studentId);
  state.attendance = state.attendance.filter((item) => item.student_id !== studentId);
  students = state.students.filter((item) => item.class_id === selectedClassId);
  persist(); loadClassData(); toast("Person removed from the roster.");
}

function updateAttendance(studentId, status) {
  const date = $("#attendanceDate").value;
  const existingIndex = state.attendance.findIndex((item) =>
    item.class_id === selectedClassId && item.student_id === studentId && item.attendance_date === date
  );
  if (existingIndex >= 0) state.attendance.splice(existingIndex, 1);
  if (status) state.attendance.push({
    class_id: selectedClassId, student_id: studentId, attendance_date: date, status: status
  });
  persist(); loadClassData();
}

function markAllPresent() {
  const date = $("#attendanceDate").value;
  students.forEach((student) => {
    const index = state.attendance.findIndex((item) =>
      item.class_id === selectedClassId && item.student_id === student.id && item.attendance_date === date
    );
    const row = { class_id: selectedClassId, student_id: student.id, attendance_date: date, status: "present" };
    if (index >= 0) state.attendance[index] = row;
    else state.attendance.push(row);
  });
  persist(); loadClassData(); toast("Everyone marked present.");
}

function openAdjustment(studentId) {
  const student = students.find((item) => item.id === studentId);
  if (!student) return;
  if (!pointTypes.length) { toast("Add a point option first."); openManageTypes(); return; }
  const options = pointTypes.map((type) =>
    '<option value="' + esc(type.id) + '">' + esc(type.name) + " (" + (type.value > 0 ? "+" : "") + type.value + ")</option>"
  ).join("");
  openFormDialog("Adjust points for " + student.name, "Choose one of your point options and add a note.",
    '<div class="field"><label for="entryType">Point option</label><select id="entryType">' + options +
    '</select></div><div class="field"><label for="entryAmount">Points for this entry</label><input id="entryAmount" type="number" min="1" max="999" step="1" value="1" required></div>' +
    '<div class="field"><label for="entryReason">Reason or note</label><input id="entryReason" maxlength="180" placeholder="e.g. Helped a classmate"></div>',
    () => {
      const type = pointTypes.find((item) => item.id === $("#entryType").value);
      const amount = Number($("#entryAmount").value);
      if (!type) { showDialogMessage("Choose a point option.", true); return false; }
      if (!Number.isInteger(amount) || amount < 1 || amount > 999) {
        showDialogMessage("Use a whole number from 1 to 999.", true); return false;
      }
      const delta = (type.value > 0 ? 1 : -1) * amount;
      state.entries.push({
        id: uid(), class_id: selectedClassId, student_id: student.id, student_name: student.name,
        point_type_id: type.id, type_name: type.name, delta: delta,
        reason: $("#entryReason").value.trim(), created_at: Date.now()
      });
      persist(); loadClassData(); toast(delta > 0 ? "Points added." : "Points deducted."); return true;
    });
  const select = $("#entryType"), amount = $("#entryAmount");
  const updateAmount = () => {
    const type = pointTypes.find((item) => item.id === select.value);
    amount.value = type ? Math.abs(type.value) : 1;
  };
  select.onchange = updateAmount; updateAmount();
}

function openManageTypes() {
  $("#dialogTitle").textContent = "Customize point options";
  $("#dialogSubtitle").textContent = "Point options belong to this class and this browser profile.";
  $("#dialogMessage").classList.add("hidden");
  $("#dialogSave").classList.add("hidden");
  $("#dialogBody").innerHTML = '<div class="category-list" id="categoryList"></div><button class="btn secondary small" id="addCategoryBtn" type="button">＋ Add point option</button><p class="hint">Positive values award points; negative values deduct points. You can change the amount for each entry.</p>';
  renderCategoryList();
  $("#addCategoryBtn").onclick = () => editPointType(null);
  $("#dialogForm").onsubmit = (event) => event.preventDefault();
  if (!$("#formDialog").open) $("#formDialog").showModal();
}

function renderCategoryList() {
  $("#categoryList").innerHTML = pointTypes.length ? pointTypes.map((type) =>
    '<div class="category-row"><span class="category-name">' + esc(type.name) + '</span><span class="category-value">' +
    (type.value > 0 ? "+" : "") + type.value + ' pts</span><button class="btn secondary small edit-category" data-id="' +
    esc(type.id) + '">Edit</button><button class="btn danger small delete-category" data-id="' + esc(type.id) + '">Delete</button></div>'
  ).join("") : '<div class="empty">No point options yet. Add one to start.</div>';
  $$(".edit-category").forEach((button) => button.onclick = () => editPointType(button.dataset.id));
  $$(".delete-category").forEach((button) => button.onclick = () => {
    const type = pointTypes.find((item) => item.id === button.dataset.id);
    if (!type || !window.confirm("Delete the point option “" + type.name + "”? Existing point history will remain.")) return;
    state.pointTypes = state.pointTypes.filter((item) => item.id !== type.id);
    pointTypes = pointTypes.filter((item) => item.id !== type.id);
    persist(); renderCategoryList(); toast("Point option deleted.");
  });
}

function editPointType(typeId) {
  const original = pointTypes.find((type) => type.id === typeId);
  $("#dialogTitle").textContent = original ? "Edit point option" : "Add point option";
  $("#dialogSubtitle").textContent = "Set a name and a non-zero whole number.";
  $("#dialogBody").innerHTML =
    '<div class="field"><label for="typeName">Option name</label><input id="typeName" maxlength="60" value="' +
    esc(original?.name || "") + '" placeholder="e.g. Teamwork" required></div>' +
    '<div class="field"><label for="typeValue">Default point value (negative deducts)</label><input id="typeValue" type="number" min="-999" max="999" step="1" value="' +
    (original?.value ?? 1) + '" required></div>';
  $("#dialogMessage").classList.add("hidden");
  $("#dialogSave").classList.remove("hidden");
  $("#dialogForm").onsubmit = (event) => {
    event.preventDefault();
    const name = $("#typeName").value.trim(), value = Number($("#typeValue").value);
    if (!name || !Number.isInteger(value) || value === 0 || Math.abs(value) > 999) {
      showDialogMessage("Enter a name and a non-zero whole number from -999 to 999.", true); return;
    }
    if (original) { original.name = name; original.value = value; }
    else {
      const type = { id: uid(), class_id: selectedClassId, name: name, value: value };
      state.pointTypes.push(type); pointTypes.push(type);
    }
    persist(); openManageTypes(); toast("Point option saved.");
  };
}

function setTab(tab) {
  $$(".nav-btn").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  $("#classesPage").classList.toggle("hidden", tab !== "classes");
  $("#pointsPage").classList.toggle("hidden", tab !== "points");
  $("#pageTitle").textContent = tab === "classes" ? "Classes & attendance" : "Point tracking";
}

function bindEvents() {
  $$(".nav-btn").forEach((button) => button.addEventListener("click", () => setTab(button.dataset.tab)));
  $("#addClassBtn").addEventListener("click", createClass);
  $("#addStudentBtn").addEventListener("click", addStudent);
  $("#renameClassBtn").addEventListener("click", renameClass);
  $("#deleteClassBtn").addEventListener("click", deleteClass);
  $("#markAllBtn").addEventListener("click", markAllPresent);
  $("#manageTypesBtn").addEventListener("click", openManageTypes);
  $("#classSelect").addEventListener("change", () => {
    selectedClassId = $("#classSelect").value; $("#rosterSearch").value = ""; loadClassData();
  });
  $("#pointsClassSelect").addEventListener("change", () => {
    selectedClassId = $("#pointsClassSelect").value; loadClassData();
  });
  $("#attendanceDate").addEventListener("change", loadClassData);
  $("#rosterSearch").addEventListener("input", render);
  $("#classRows").addEventListener("change", (event) => {
    if (event.target.matches("[data-attendance]")) updateAttendance(event.target.dataset.attendance, event.target.value);
  });
  document.addEventListener("click", (event) => {
    const remove = event.target.closest(".remove-student");
    if (remove) removeStudent(remove.dataset.id);
    const adjust = event.target.closest(".adjust");
    if (adjust) openAdjustment(adjust.dataset.id);
  });
  $("#dialogClose").addEventListener("click", () => $("#formDialog").close());
  $("#dialogCancel").addEventListener("click", () => $("#formDialog").close());
  $("#attendanceDate").value = todayISO();
  $("#todayLabel").textContent = new Date().toLocaleDateString(undefined, {
    weekday: "short", month: "long", day: "numeric", year: "numeric"
  });
}

bindEvents();
loadClassData();
