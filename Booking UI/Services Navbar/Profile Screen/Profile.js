const API_BASE = "https://localhost:7216";
const ENDPOINT_ME = `${API_BASE}/api/profile/me`;

const ENDPOINT_COUNTRIES = `${API_BASE}/api/Country/All`;

const $ = (id) => document.getElementById(id);

function toast(msg, ok = true) {
  const t = $("toast");
  const icon = $("toastIcon");
  const msgEl = $("toastMsg");

  icon.textContent = ok ? "✓" : "✗";
  msgEl.textContent = msg;
  t.className = "toast show " + (ok ? "success" : "error");

  clearTimeout(toast._tm);
  toast._tm = setTimeout(() => (t.className = "toast"), 3500);
}

function safe(v, fallback = "—") {
  if (v === null || v === undefined || v === "") return fallback;
  return v;
}

function getToken() {
  return localStorage.getItem("auth_token") || "";
}

function parseJwt(token) {
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(decodeURIComponent(escape(json)));
  } catch {
    return null;
  }
}

function claim(obj, ...keys) {
  for (const k of keys) {
    if (obj && obj[k] !== undefined && obj[k] !== null) return obj[k];
  }
  return null;
}

function fmtDate(d) {
  if (!d) return "—";
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString();
  } catch {
    return String(d);
  }
}

function toISODateInput(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return "";
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function fetchJson(url, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };
  const token = getToken();
  if (token) headers.Authorization = "Bearer " + token;

  const res = await fetch(url, { ...options, headers });
  const text = await res.text().catch(() => "");

  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!res.ok) {
    const msg =
      (body && (body.detail || body.title || body.message)) ||
      (typeof body === "string" ? body : "") ||
      `HTTP ${res.status}`;
    const err = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return body;
}

async function loadCountries() {
  try {
    const data = await fetchJson(ENDPOINT_COUNTRIES);
    const select = $("countryIdEdit");
    if (!select) return;

    select.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select country";
    select.appendChild(placeholder);

    (data || []).forEach((c) => {
      const id = c.countryId ?? c.countryID ?? c.CountryId ?? c.CountryID;
      const name =
        c.countryName ?? c.CountryName ?? (id ? `Country #${id}` : "");
      if (!id) return;
      const opt = document.createElement("option");
      opt.value = String(id);
      opt.textContent = name;
      select.appendChild(opt);
    });
  } catch (e) {
    console.error("Failed to load countries", e);
    toast("✗ Failed to load countries", false);
  }
}

function setupTabs() {
  const map = {
    home: "home.html",
    book: "BookingPage.html",
    tickets: "Ticket.html",
    profile: "Profile.html",
  };

  document.querySelectorAll(".hTab").forEach((btn) => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");
      const url = map[tab];
      if (url) window.location.href = url;
    });
  });

  $("userPill")?.addEventListener(
    "click",
    () => (window.location.href = "Profile.html"),
  );
}

function logout() {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("role");
  localStorage.removeItem("username");
  localStorage.removeItem("personID");
  localStorage.removeItem("clientID");
  window.location.href = "Login.html";
}

function fillAccountFromJwt(jwt) {
  const email = claim(
    jwt,
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
    "email",
  );

  const role = claim(
    jwt,
    "http://schemas.microsoft.com/ws/2008/06/identity/claims/role",
    "role",
  );

  const userId = claim(
    jwt,
    "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
    "userId",
  );

  const personId = claim(jwt, "personId", "personID");
  const clientId = claim(jwt, "clientId", "clientID");

  $("infoEmail").textContent = safe(email);
  $("displayEmail").textContent = safe(email);
  $("displayRole").textContent = safe(role);
  $("infoUserId").textContent = safe(userId);
  $("infoPersonId").textContent = safe(personId);
}

let LAST_ME = null;

function fillPerson(data) {
  const apiEmail = data.email ?? data.Email;
  if (apiEmail) {
    $("infoEmail").textContent = safe(apiEmail);
    $("displayEmail").textContent = safe(apiEmail);
  }

  const fn = data.firstName ?? data.FirstName ?? "";
  const sn = data.secondName ?? data.SecondName ?? "";
  const tn = data.thirdName ?? data.ThirdName ?? "";
  const ln = data.lastName ?? data.LastName ?? "";

  const full = [fn, sn, tn, ln].filter(Boolean).join(" ").trim() || "User";
  $("displayName").textContent = full;

  const a = (fn || ln || "U")[0].toUpperCase();
  $("mainAvatar").textContent = a;
  $("avatar").textContent = a;

  const username = localStorage.getItem("username") || full || "User";
  $("username").textContent = username;

  const phone = safe(data.phone ?? data.Phone);
  $("infoPhone").textContent = phone;
  $("displayPhone").textContent = phone;

  $("infoGender").textContent = safe(data.gender ?? data.Gender);
  $("infoBirthDate").textContent = fmtDate(data.birthDate ?? data.BirthDate);

  const cName = data.countryName ?? data.CountryName;
  const cId =
    data.countryId ?? data.CountryId ?? data.countryID ?? data.CountryID;

  const countryText = safe(cName || (cId ? `Country #${cId}` : null));
  $("infoCountry").textContent = countryText;
  $("displayCountry").textContent = countryText;

  $("firstName").value = fn || "";
  $("secondName").value = sn || "";
  $("thirdName").value = tn || "";
  $("lastName").value = ln || "";
  $("phoneEdit").value = (data.phone ?? data.Phone ?? "") || "";
  $("genderEdit").value = (data.gender ?? data.Gender ?? "") || "";
  $("birthDateEdit").value = toISODateInput(data.birthDate ?? data.BirthDate);
  $("countryIdEdit").value = cId ? String(cId) : "";

  $("statusBadge").textContent = "✓ Loaded";
  $("alertBox").className = "alertBox success";
  $("alertBox").innerHTML = `
          <span class="alertIcon">✓</span>
          <div><strong>Profile loaded successfully!</strong> Your information is up to date.</div>
        `;

  LAST_ME = data;
}

function buildUpdatePayload() {
  const payload = {};

  const fn = $("firstName").value.trim();
  const sn = $("secondName").value.trim();
  const tn = $("thirdName").value.trim();
  const ln = $("lastName").value.trim();
  const ph = $("phoneEdit").value.trim();
  const gd = $("genderEdit").value.trim();
  const bd = $("birthDateEdit").value;
  const cid = $("countryIdEdit").value.trim();

  // Use exact property names that backend expects
  payload.FirstName = fn || null;
  payload.SecondName = sn || null;
  payload.ThirdName = tn || null;
  payload.LastName = ln || null;
  payload.Phone = ph || null;
  payload.Gender = gd || null;
  payload.BirthDate = bd ? bd : null;
  payload.CountryID = cid ? Number(cid) : null;

  return payload;
}

async function saveMe() {
  $("btnSave").disabled = true;
  $("btnSave").textContent = "⏳ Saving...";

  $("alertBox").className = "alertBox info";
  $("alertBox").innerHTML = `
    <span class="alertIcon">⏳</span>
    <div>Saving your changes...</div>
  `;

  const payload = buildUpdatePayload();

  try {
    await fetchJson(ENDPOINT_ME, {
      method: "PUT",
      body: JSON.stringify(payload),
    });

    toast("✓ Profile updated successfully!");

    $("alertBox").className = "alertBox success";
    $("alertBox").innerHTML = `
      <span class="alertIcon">✓</span>
      <div><strong>Saved successfully!</strong> Reloading your profile...</div>
    `;

    await loadProfile();

    setTimeout(() => {
      const editCard = $("editCard");
      const grid = document.querySelector(".profileGrid");
      editCard.classList.remove("active");
      grid.classList.remove("editing");
      $("btnEdit").innerHTML = "✏️ Edit Profile";
    }, 1000);
  } catch (e) {
    $("alertBox").className = "alertBox error";
    $("alertBox").innerHTML = `
      <span class="alertIcon">✗</span>
      <div><strong>Save failed:</strong> ${e.message}</div>
    `;
    toast("✗ " + (e.message || "Save failed"), false);
  } finally {
    $("btnSave").disabled = false;
    $("btnSave").textContent = "💾 Save Changes";
  }
}

function resetForm() {
  if (!LAST_ME) return;
  fillPerson(LAST_ME);
  toast("✓ Form reset to last saved data");
}

async function loadProfile() {
  const token = getToken();
  if (!token) {
    $("alertBox").className = "alertBox error";
    $("alertBox").innerHTML = `
      <span class="alertIcon">✗</span>
      <div><strong>Authentication required.</strong> Please login first.</div>
    `;
    toast("⚠️ Please login first", false);
    setTimeout(() => (window.location.href = "Login.html"), 1500);
    return;
  }

  const jwt = parseJwt(token) || {};
  fillAccountFromJwt(jwt);

  $("statusBadge").textContent = "⏳ Loading";
  $("alertBox").className = "alertBox info";
  $("alertBox").innerHTML = `
    <span class="alertIcon">⏳</span>
    <div>Loading your profile information...</div>
  `;

  try {
    const me = await fetchJson(ENDPOINT_ME);
    fillPerson(me);
  } catch (e) {
    $("alertBox").className = "alertBox error";
    $("alertBox").innerHTML = `
      <span class="alertIcon">✗</span>
      <div><strong>Error:</strong> ${e.message}</div>
    `;
    $("statusBadge").textContent = "✗ Error";
    toast("✗ " + e.message, false);
  }
}

setupTabs();

// Toggle edit form
$("btnEdit").addEventListener("click", () => {
  const editCard = $("editCard");
  const grid = document.querySelector(".profileGrid");

  if (editCard.classList.contains("active")) {
    editCard.classList.remove("active");
    grid.classList.remove("editing");
    $("btnEdit").innerHTML = "✏️ Edit Profile";
  } else {
    editCard.classList.add("active");
    grid.classList.add("editing");
    $("btnEdit").innerHTML = "✖️ Close Edit";
    // Scroll to edit form smoothly
    setTimeout(() => {
      editCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 100);
  }
});

$("btnRefresh").addEventListener("click", loadProfile);
$("btnLogout").addEventListener("click", logout);
$("editForm").addEventListener("submit", (e) => {
  e.preventDefault();
  saveMe();
});
$("btnReset").addEventListener("click", resetForm);

loadCountries();
loadProfile();
