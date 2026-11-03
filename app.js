const config = window.APP_CONFIG || {};
const createClient = window.supabase?.createClient;
const isConfigured = config.SUPABASE_URL && config.SUPABASE_ANON_KEY &&
  !config.SUPABASE_URL.includes("YOUR_") && !config.SUPABASE_ANON_KEY.includes("YOUR_");
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));
const today = new Date();
const todayISO = () => {
  const date = new Date();
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const esc = (value) => String(value ?? "").replace(/[&<>"]/g, (ch) =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch]);
const initials = (name) => String(name || "").trim().split(/\s+/).slice(0, 2)
  .map((part) => part[0] || "").join("").toUpperCase();

let supabase;
let currentUser = null;
let classes = [];
let students = [];
let pointTypes = [];
let attendance = [];
let entries = [];
let selectedClassId = "";
let currentTab = "classes";
let loadingClass = false;

function toast(message) {
  const node = $("#toast");
  node.textContent = message;
  node.classList.add("show");
  window.setTimeout(() => node.classList.remove("show"), 2800);
}

function showAuthMessage(message, isError = false) {
  const node = $("#authMessage");
  node.textContent = message;
  node.classList.toggle("error", isError);
  node.classList.remove("hidden");
}

function showDialogMessage(message, isError = false) {
  const node = $("#dialogMessage");
  node.textContent = message;
  node.classList.toggle("error", isError);
  node.classList.remove("hidden");
}

function errorText(error) {
  return error?.message || "Something went wrong. Please try again.";
}

function showApp() {
  $("#authView").classList.toggle("hidden", !isConfigured || !!currentUser);
  $("#appView").classList.toggle("hidden", !isConfigured || !currentUser);
  $("#setupView").classList.toggle("hidden", isConfigured);
  if (currentUser) $("#userEmail").textContent = currentUser.email || "Teacher account";
}

async function handleAuthSubmit(event) {
  event.preventDefault();
  const email = $("#authEmail").value.trim();
  const password = $("#authPassword").value;
  const button = $("#authSubmit");
  button.disabled = true;
  $("#authMessage").classList.add("hidden");
  try {
    if ($("#authForm").dataset.mode === "signup") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      if (!data.session) showAuthMessage("Account created. Check your email for a confirmation link, then sign in.");
      else showAuthMessage("Account created. You are signed in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    }
  } catch (error) {
    showAuthMessage(errorText(error), true);
  } finally {
    button.disabled = false;
  }
}

function toggleAuthMode() {
  const signup = $("#authForm").dataset.mode !== "signup";
  $("#authForm").dataset.mode = signup ? "signup" : "signin";
  $("#authTitle").textContent = signup ? "Create your account" : "Welcome back";
  $("#authSubtitle").textContent = signup ? "Create a private teacher workspace." : "Sign in to manage your classes and points.";
  $("#authPassword").autocomplete = signup ? "new-password" : "current-password";
  $("#authSubmit").textContent = signup ? "Create account" : "Sign in";
  $("#authSwitchText").textContent = signup ? "Already have an account?" : "New teacher?";
  $("#authSwitch").textContent = signup ? "Sign in" : "Create an account";
  $("#authMessage").classList.add("hidden");
}

function currentClass() {
  return classes.find((item) => item.id === selectedClassId) || null;
}

function balanceFor(studentId) {
  return entries.filter((entry) => entry.student_id === studentId).reduce((sum, entry) => sum + entry.delta, 0);
}

function setTab(tab) {
  currentTab = tab;
  $$(".nav-btn").forEach((button) => button.classList.toggle("active", button.dataset.tab === tab));
  $("#classesPage").classList.toggle("hidden", tab !== "classes");
  $("#pointsPage").classList.toggle("hidden", tab !== "points");
  $("#pageTitle").textContent = tab === "classes" ? "Classes & attendance" : "Point tracking";
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

  const search = $("#rosterSearch").value.trim().toLowerCase();
  const shownStudents = students.filter((student) => student.name.toLowerCase().includes(search));
  $("#classRows").innerHTML = shownStudents.map((student) => {
    const attendanceStatus = attendance.find((item) => item.student_id === student.id)?.status || "";
    return "<tr><td><div class=\"person\"><div class=\"avatar\">" + esc(initials(student.name)) +
      "</div><div class=\"person-name\">" + esc(student.name) + "</div></div></td><td class=\"points\">" +
      balanceFor(student.id) + " pts</td><td><select class=\"status " + esc(attendanceStatus) +
      "\" data-attendance=\"" + esc(student.id) + "\" aria-label=\"Attendance for " + esc(student.name) +
      "\"><option value=\"\">Not marked</option><option value=\"present\"" + (attendanceStatus === "present" ? " selected" : "") +
      ">Present</option><option value=\"late\"" + (attendanceStatus === "late" ? " selected" : "") +
      ">Late</option><option value=\"absent\"" + (attendanceStatus === "absent" ? " selected" : "") +
      ">Absent</option><option value=\"excused\"" + (attendanceStatus === "excused" ? " selected" : "") +
      ">Excused</option></select></td><td><button class=\"btn danger small remove-student\" data-id=\"" +
      esc(student.id) + "\">Remove</button></td></tr>";
  }).join("");
  $("#rosterEmpty").classList.toggle("hidden", !c || students.length > 0);
  $("#searchEmpty").classList.toggle("hidden", !c || students.length === 0 || shownStudents.length > 0);
  const here = students.filter((student) => {
    const value = attendance.find((item) => item.student_id === student.id)?.status;
    return value === "present" || value === "late";
  }).length;
  $("#attendanceSummary").textContent = here + " present · " + students.length + " people · " +
    new Date($("#attendanceDate").value + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  $("#pointsRows").innerHTML = students.map((student) => {
    const latest = entries.filter((item) => item.student_id === student.id)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
    const latestText = latest ? esc(latest.type_name) + " (" + (latest.delta > 0 ? "+" : "") + latest.delta + ")" :
      '<span class="hint">No activity yet</span>';
    return "<tr><td><div class=\"person\"><div class=\"avatar\">" + esc(initials(student.name)) +
      "</div><div class=\"person-name\">" + esc(student.name) + "</div></div></td><td class=\"points\">" +
      balanceFor(student.id) + " pts</td><td>" + latestText + "</td><td><button class=\"btn primary small adjust\" data-id=\"" +
      esc(student.id) + "\">＋ / − Points</button></td></tr>";
  }).join("");
  $("#pointsEmpty").classList.toggle("hidden", !c || students.length > 0);
  const sortedEntries = entries.slice().sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
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

async function loadClasses(preferredId) {
  const { data, error } = await supabase.from("classes").select("id,name,created_at").order("name");
  if (error) throw error;
  classes = data || [];
  selectedClassId = classes.some((item) => item.id === (preferredId || selectedClassId))
    ? (preferredId || selectedClassId) : (classes[0]?.id || "");
  await loadClassData();
}

async function loadClassData() {
  if (!selectedClassId) {
    students = []; pointTypes = []; attendance = []; entries = []; render(); return;
  }
  loadingClass = true;
  const date = $("#attendanceDate").value || todayISO();
  const results = await Promise.all([
    supabase.from("students").select("id,class_id,name,created_at").eq("class_id", selectedClassId).order("name"),
    supabase.from("point_types").select("id,class_id,name,value,created_at").eq("class_id", selectedClassId).order("name"),
    supabase.from("attendance").select("id,class_id,student_id,attendance_date,status").eq("class_id", selectedClassId).eq("attendance_date", date),
    supabase.from("point_entries").select("id,class_id,student_id,student_name,point_type_id,type_name,delta,reason,created_at").eq("class_id", selectedClassId).order("created_at", { ascending: false }).limit(500)
  ]);
  const failed = results.find((result) => result.error);
  if (failed) throw failed.error;
  students = results[0].data || [];
  pointTypes = results[1].data || [];
  attendance = results[2].data || [];
  entries = results[3].data || [];
  loadingClass = false;
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
      showDialogMessage(errorText(error), true);
    } finally {
      $("#dialogSave").disabled = false;
    }
  };
  if (!dialog.open) dialog.showModal();
}

async function createClass() {
  openFormDialog("Add a class", "Create a class and its private roster.", 
    '<div class="field"><label for="className">Class name</label><input id="className" maxlength="80" placeholder="e.g. 3rd Period" required></div>',
    async () => {
      const name = $("#className").value.trim();
      if (!name) { showDialogMessage("Enter a class name.", true); return false; }
      const { data, error } = await supabase.from("classes").insert({ owner_id: currentUser.id, name }).select("id,name").single();
      if (error) throw error;
      const defaults = [
        { class_id: data.id, name: "Participation", value: 1 },
        { class_id: data.id, name: "Helping others", value: 2 },
        { class_id: data.id, name: "Great effort", value: 2 },
        { class_id: data.id, name: "Responsibility", value: 1 },
        { class_id: data.id, name: "Point deduction", value: -1 }
      ];
      const { error: typeError } = await supabase.from("point_types").insert(defaults);
      if (typeError) throw typeError;
      await loadClasses(data.id);
      toast("Class created.");
      return true;
    });
}

async function addStudent() {
  const c = currentClass();
  if (!c) return;
  openFormDialog("Add a person", "Add someone to " + c.name + ".", 
    '<div class="field"><label for="studentName">Person name</label><input id="studentName" maxlength="100" placeholder="First and last name" required></div>',
    async () => {
      const name = $("#studentName").value.trim();
      if (!name) { showDialogMessage("Enter a name.", true); return false; }
      if (students.some((student) => student.name.toLowerCase() === name.toLowerCase())) {
        showDialogMessage("That name is already in this class.", true); return false;
      }
      const { error } = await supabase.from("students").insert({ class_id: c.id, name });
      if (error) throw error;
      await loadClassData();
      toast("Person added to " + c.name + ".");
      return true;
    });
}

async function renameClass() {
  const c = currentClass();
  if (!c) return;
  openFormDialog("Rename class", "Update the name shown for this class.",
    '<div class="field"><label for="className">Class name</label><input id="className" maxlength="80" value="' + esc(c.name) + '" required></div>',
    async () => {
      const name = $("#className").value.trim();
      if (!name) { showDialogMessage("Enter a class name.", true); return false; }
      const { error } = await supabase.from("classes").update({ name }).eq("id", c.id);
      if (error) throw error;
      await loadClasses(c.id);
      toast("Class renamed.");
      return true;
    });
}

async function deleteClass() {
  const c = currentClass();
  if (!c || !window.confirm("Delete " + c.name + " and all of its roster, attendance, point options, and point history?")) return;
  const { error } = await supabase.from("classes").delete().eq("id", c.id);
  if (error) { toast(errorText(error)); return; }
  await loadClasses("");
  toast("Class deleted.");
}

async function removeStudent(studentId) {
  const student = students.find((item) => item.id === studentId);
  if (!student || !window.confirm("Remove " + student.name + " from this roster? Their point history will remain.")) return;
  const { error } = await supabase.from("students").delete().eq("id", studentId);
  if (error) { toast(errorText(error)); return; }
  await loadClassData();
  toast("Person removed from the roster.");
}

async function updateAttendance(studentId, status) {
  const date = $("#attendanceDate").value;
  const c = currentClass();
  if (!c || !date) return;
  const existing = attendance.find((item) => item.student_id === studentId);
  if (!status) {
    if (existing) {
      const { error } = await supabase.from("attendance").delete().eq("id", existing.id);
      if (error) throw error;
    }
  } else {
    const { error } = await supabase.from("attendance").upsert({
      class_id: c.id, student_id: studentId, attendance_date: date, status
    }, { onConflict: "student_id,attendance_date" });
    if (error) throw error;
  }
  await loadClassData();
}

async function markAllPresent() {
  const c = currentClass();
  if (!c || !students.length) return;
  const rows = students.map((student) => ({
    class_id: c.id, student_id: student.id, attendance_date: $("#attendanceDate").value, status: "present"
  }));
  const { error } = await supabase.from("attendance").upsert(rows, { onConflict: "student_id,attendance_date" });
  if (error) { toast(errorText(error)); return; }
  await loadClassData();
  toast("Everyone marked present.");
}

function openAdjustment(studentId, sign) {
  const student = students.find((item) => item.id === studentId);
  if (!student) return;
  if (!pointTypes.length) { toast("Add a point option first."); openManageTypes(); return; }
  const options = pointTypes.map((type) => '<option value="' + esc(type.id) + '">' + esc(type.name) +
    " (" + (type.value > 0 ? "+" : "") + type.value + ")</option>").join("");
  openFormDialog((sign > 0 ? "Add points for " : "Deduct points from ") + student.name,
    "Choose one of your point options and add a note.",
    '<div class="field"><label for="entryType">Point option</label><select id="entryType">' + options +
    '</select></div><div class="field"><label for="entryAmount">Points for this entry</label><input id="entryAmount" type="number" min="1" max="999" step="1" value="1" required></div>' +
    '<div class="field"><label for="entryReason">Reason or note</label><input id="entryReason" maxlength="180" placeholder="e.g. Helped a classmate"></div>',
    async () => {
      const type = pointTypes.find((item) => item.id === $("#entryType").value);
      const amount = Number($("#entryAmount").value);
      if (!type) { showDialogMessage("Choose a point option.", true); return false; }
      if (!Number.isInteger(amount) || amount < 1 || amount > 999) { showDialogMessage("Use a whole number from 1 to 999.", true); return false; }
      const delta = (type.value > 0 ? 1 : -1) * amount;
      const reason = $("#entryReason").value.trim();
      const { error } = await supabase.from("point_entries").insert({
        class_id: selectedClassId,
        student_id: student.id,
        student_name: student.name,
        point_type_id: type.id,
        type_name: type.name,
        delta,
        reason
      });
      if (error) throw error;
      await loadClassData();
      toast(delta > 0 ? "Points added." : "Points deducted.");
      return true;
    });
  const categorySelect = $("#entryType");
  const amountField = $("#entryAmount");
  const matching = pointTypes.find((type) => sign > 0 ? type.value > 0 : type.value < 0);
  if (matching) categorySelect.value = matching.id;
  const updateAmount = () => {
    const type = pointTypes.find((item) => item.id === categorySelect.value);
    amountField.value = type ? Math.abs(type.value) : 1;
  };
  categorySelect.onchange = updateAmount;
  updateAmount();
}

function openManageTypes() {
  const dialog = $("#formDialog");
  $("#dialogTitle").textContent = "Customize point options";
  $("#dialogSubtitle").textContent = "These options belong to this class and teacher account.";
  $("#dialogMessage").classList.add("hidden");
  $("#dialogSave").classList.add("hidden");
  $("#dialogBody").innerHTML = '<div class="category-list" id="categoryList"></div><button class="btn secondary small" id="addCategoryBtn" type="button">＋ Add point option</button><p class="hint">Positive values award points; negative values deduct points. You can change the amount for each entry.</p>';
  renderCategoryList();
  $("#addCategoryBtn").onclick = () => editPointType(null);
  $("#dialogForm").onsubmit = (event) => event.preventDefault();
  if (!dialog.open) dialog.showModal();
}

function renderCategoryList() {
  $("#categoryList").innerHTML = pointTypes.length ? pointTypes.map((type) =>
    '<div class="category-row"><span class="category-name">' + esc(type.name) + '</span><span class="category-value">' +
    (type.value > 0 ? "+" : "") + type.value + " pts</span><button class=\"btn secondary small edit-category\" data-id=\"" +
    esc(type.id) + '">Edit</button><button class="btn danger small delete-category" data-id="' + esc(type.id) + '">Delete</button></div>'
  ).join("") : '<div class="empty">No point options yet. Add one to start.</div>';
  $$(".edit-category").forEach((button) => button.onclick = () => editPointType(button.dataset.id));
  $$(".delete-category").forEach((button) => button.onclick = async () => {
    const type = pointTypes.find((item) => item.id === button.dataset.id);
    if (!type || !window.confirm("Delete the point option “" + type.name + "”? Existing point history will remain.")) return;
    const { error } = await supabase.from("point_types").delete().eq("id", type.id);
    if (error) { showDialogMessage(errorText(error), true); return; }
    pointTypes = pointTypes.filter((item) => item.id !== type.id);
    renderCategoryList();
    toast("Point option deleted.");
  });
}

function editPointType(typeId) {
  const original = pointTypes.find((type) => type.id === typeId);
  const fields =
    '<div class="field"><label for="typeName">Option name</label><input id="typeName" maxlength="60" value="' +
    esc(original?.name || "") + '" placeholder="e.g. Teamwork" required></div>' +
    '<div class="field"><label for="typeValue">Default point value (negative deducts)</label><input id="typeValue" type="number" min="-999" max="999" step="1" value="' +
    (original?.value ?? 1) + '" required></div>';
  $("#dialogTitle").textContent = original ? "Edit point option" : "Add point option";
  $("#dialogSubtitle").textContent = "Set a name and a non-zero whole number.";
  $("#dialogBody").innerHTML = fields;
  $("#dialogMessage").classList.add("hidden");
  $("#dialogSave").classList.remove("hidden");
  $("#dialogForm").onsubmit = async (event) => {
    event.preventDefault();
    const name = $("#typeName").value.trim();
    const value = Number($("#typeValue").value);
    if (!name || !Number.isInteger(value) || value === 0 || Math.abs(value) > 999) {
      showDialogMessage("Enter a name and a non-zero whole number from -999 to 999.", true); return;
    }
    $("#dialogSave").disabled = true;
    try {
      if (original) {
        const { error } = await supabase.from("point_types").update({ name, value }).eq("id", original.id);
        if (error) throw error;
        original.name = name; original.value = value;
      } else {
        const { data, error } = await supabase.from("point_types").insert({
          class_id: selectedClassId, name, value
        }).select("id,class_id,name,value").single();
        if (error) throw error;
        pointTypes.push(data);
      }
      openManageTypes();
      toast("Point option saved.");
    } catch (error) {
      showDialogMessage(errorText(error), true);
    } finally {
      $("#dialogSave").disabled = false;
    }
  };
}

async function onUserChanged(user) {
  currentUser = user;
  showApp();
  classes = []; students = []; pointTypes = []; attendance = []; entries = []; selectedClassId = "";
  if (!user) return;
  try {
    await loadClasses("");
  } catch (error) {
    toast(errorText(error));
  }
}

function bindEvents() {
  $("#authForm").dataset.mode = "signin";
  $("#authForm").addEventListener("submit", handleAuthSubmit);
  $("#authSwitch").addEventListener("click", toggleAuthMode);
  $("#signOutBtn").addEventListener("click", async () => {
    const { error } = await supabase.auth.signOut();
    if (error) toast(errorText(error));
  });
  $$(".nav-btn").forEach((button) => button.addEventListener("click", () => setTab(button.dataset.tab)));
  $("#addClassBtn").addEventListener("click", createClass);
  $("#addStudentBtn").addEventListener("click", addStudent);
  $("#renameClassBtn").addEventListener("click", renameClass);
  $("#deleteClassBtn").addEventListener("click", deleteClass);
  $("#markAllBtn").addEventListener("click", markAllPresent);
  $("#manageTypesBtn").addEventListener("click", openManageTypes);
  $("#classSelect").addEventListener("change", async () => {
    selectedClassId = $("#classSelect").value;
    $("#rosterSearch").value = "";
    try { await loadClassData(); } catch (error) { toast(errorText(error)); }
  });
  $("#pointsClassSelect").addEventListener("change", async () => {
    selectedClassId = $("#pointsClassSelect").value;
    try { await loadClassData(); } catch (error) { toast(errorText(error)); }
  });
  $("#attendanceDate").addEventListener("change", async () => {
    try { await loadClassData(); } catch (error) { toast(errorText(error)); }
  });
  $("#rosterSearch").addEventListener("input", render);
  $("#classRows").addEventListener("change", async (event) => {
    if (!event.target.matches("[data-attendance]")) return;
    event.target.disabled = true;
    try { await updateAttendance(event.target.dataset.attendance, event.target.value); }
    catch (error) { toast(errorText(error)); }
  });
  document.addEventListener("click", (event) => {
    const remove = event.target.closest(".remove-student");
    if (remove) removeStudent(remove.dataset.id);
    const adjust = event.target.closest(".adjust");
    if (adjust) openAdjustment(adjust.dataset.id, 1);
    const deduct = event.target.closest(".deduct");
    if (deduct) openAdjustment(deduct.dataset.id, -1);
  });
  $("#dialogClose").addEventListener("click", () => $("#formDialog").close());
  $("#dialogCancel").addEventListener("click", () => $("#formDialog").close());
  $("#attendanceDate").value = todayISO();
  $("#todayLabel").textContent = today.toLocaleDateString(undefined, {
    weekday: "short", month: "long", day: "numeric", year: "numeric"
  });
}

async function start() {
  if (!isConfigured) { showApp(); return; }
  showApp();
  if (typeof createClient !== "function") {
    showAuthMessage("The Supabase library did not load. Refresh the page or check your network connection.", true);
    return;
  }
  supabase = createClient(config.SUPABASE_URL, config.SUPABASE_ANON_KEY);
  bindEvents();
  supabase.auth.onAuthStateChange((_event, session) => {
    void onUserChanged(session?.user || null);
  });
  const { data, error } = await supabase.auth.getSession();
  if (error) { showAuthMessage(errorText(error), true); return; }
  await onUserChanged(data.session?.user || null);
}

if (isConfigured) {
  // start() binds the data-dependent auth flow after Supabase is initialized.
  start().catch((error) => {
    console.error(error);
    showAuthMessage(errorText(error), true);
  });
} else {
  showApp();
}
