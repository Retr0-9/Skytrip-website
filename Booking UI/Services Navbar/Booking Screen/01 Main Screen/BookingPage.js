/*****************************************************************
 * CONFIG
 *****************************************************************/
const API_BASE_URL = "https://localhost:7216";

const ENDPOINTS = {
  // lookups
  cities: "/api/FlightSchedules/Cities",
  passengerClassAll: "/api/PassengerClass/All",

  // ✅ Search endpoints (زي اللي بالصورة)
  oneway: "/api/FlightSchedules/oneway",
  roundtrip: "/api/FlightSchedules/roundtrip",
  multicity: "/api/FlightSchedules/multicity",
};

document.getElementById("pclassPath").textContent = ENDPOINTS.passengerClassAll;

function getAuthHeaders() {
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: "Bearer " + token } : {};
}

async function parseResponse(res) {
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (res.status === 204) return null;
  if (ct.includes("application/json")) return await res.json();
  const t = await res.text().catch(() => "");
  try {
    return t ? JSON.parse(t) : t;
  } catch {
    return t;
  }
}

async function apiGet(path) {
  const url = API_BASE_URL.replace(/\/+$/, "") + path;
  const res = await fetch(url, {
    headers: { Accept: "application/json", ...getAuthHeaders() },
  });
  const data = await parseResponse(res);
  if (!res.ok) {
    const msg =
      data?.detail ||
      data?.message ||
      data?.title ||
      (typeof data === "string" ? data : "") ||
      res.statusText;
    throw new Error(`GET ${path} -> ${res.status} | ${msg}`);
  }
  return data;
}

async function apiPost(path, body) {
  const url = API_BASE_URL.replace(/\/+$/, "") + path;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...getAuthHeaders(),
    },
    body: JSON.stringify(body),
  });
  const data = await parseResponse(res);
  if (!res.ok) {
    const msg =
      data?.detail ||
      data?.message ||
      data?.title ||
      (typeof data === "string" ? data : "") ||
      res.statusText;
    throw new Error(`POST ${path} -> ${res.status} | ${msg}`);
  }
  return data;
}

/*****************************************************************
 * Date helper (أفضل بدون Z لتجنب timezone issues)
 *****************************************************************/
function toIsoDate(dateStr) {
  // صيغة آمنة لـ .NET وبدون مشاكل timezone
  return dateStr ? `${dateStr}T00:00:00.000` : null;
}

/*****************************************************************
 * Trip segmented control
 *****************************************************************/
const tripSeg = document.getElementById("tripSeg");
const segInd = document.getElementById("segInd");
const segBtns = [...tripSeg.querySelectorAll("button")];

const singleBlock = document.getElementById("singleBlock");
const multiBlock = document.getElementById("multiBlock");
const returnWrap = document.getElementById("returnWrap");
const returnDate = document.getElementById("returnDate");

const form = document.getElementById("bookingForm");
const searchBtn = document.getElementById("searchBtn");

const miniStatus = document.getElementById("miniStatus");
const statusText = document.getElementById("statusText");

const fromCountry = document.getElementById("fromCountry");
const toCountry = document.getElementById("toCountry");
const passengerClassSel = document.getElementById("passengerClass");

let uiTripType = "oneway";
let cachedCities = [];

function option(el, value, text, opts = {}) {
  const o = document.createElement("option");
  o.value = value;
  o.textContent = text;
  if (opts.disabled) o.disabled = true;
  if (opts.selected) o.selected = true;
  el.appendChild(o);
}

function placeSegIndicator(el) {
  const base = tripSeg.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  segInd.style.transform = "translateX(" + (r.left - base.left) + "px)";
}
placeSegIndicator(tripSeg.querySelector("button.active"));

function setMultiRequired(isMulti) {
  fromCountry.required = !isMulti;
  toCountry.required = !isMulti;
  document.getElementById("departDate").required = !isMulti;
  returnDate.required = false;

  document
    .querySelectorAll(
      "#multiBlock select.mc-from, #multiBlock select.mc-to, #multiBlock input.mc-date",
    )
    .forEach((el) => (el.required = isMulti));
}

function setUiTripType(type) {
  uiTripType = type;

  if (type === "oneway") {
    singleBlock.style.display = "block";
    multiBlock.style.display = "none";
    returnWrap.style.display = "none";
    returnDate.value = "";
  } else if (type === "round") {
    singleBlock.style.display = "block";
    multiBlock.style.display = "none";
    returnWrap.style.display = "block";
  } else {
    singleBlock.style.display = "none";
    multiBlock.style.display = "block";
    returnWrap.style.display = "none";
    returnDate.value = "";
    ensureMinLegs();
  }

  setMultiRequired(type === "multi");
}

segBtns.forEach((btn) => {
  btn.addEventListener("mouseenter", () => placeSegIndicator(btn));
  btn.addEventListener("focus", () => placeSegIndicator(btn));
  btn.addEventListener("click", () => {
    segBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    placeSegIndicator(btn);
    setUiTripType(btn.dataset.ui);
  });
});

tripSeg.addEventListener("mouseleave", () => {
  const active = tripSeg.querySelector("button.active");
  if (active) placeSegIndicator(active);
});
window.addEventListener("resize", () => {
  const active = tripSeg.querySelector("button.active");
  if (active) placeSegIndicator(active);
});

/*****************************************************************
 * Passengers Panel (زي ما هو عندك)
 *****************************************************************/
const passengersTrigger = document.getElementById("passengersTrigger");
const passengersPanel = document.getElementById("passengersPanel");
const passengersText = document.getElementById("passengersText");

const pax = { adults: 1, youth: 0, children: 0, infants: 0 };
const MAX_PAX = 4;

function totalPax() {
  return pax.adults + pax.youth + pax.children + pax.infants;
}
function paxLabel() {
  const t = totalPax();
  return t === 1 ? "1 Passenger" : `${t} Passengers`;
}
function syncPassengersUI() {
  passengersPanel.querySelectorAll(".p-row").forEach((row) => {
    const type = row.getAttribute("data-type");
    row.querySelector("[data-count]").textContent = pax[type] ?? 0;
  });
  passengersText.value = paxLabel();
}
function canInc(type) {
  if (totalPax() >= MAX_PAX) return false;
  if (type === "infants" && pax.infants >= pax.adults) return false;
  return true;
}
function canDec(type) {
  if (type === "adults") return pax.adults > 1;
  return (pax[type] ?? 0) > 0;
}
function inc(type) {
  if (!canInc(type)) return;
  pax[type] += 1;
  syncPassengersUI();
}
function dec(type) {
  if (!canDec(type)) return;
  pax[type] -= 1;
  if (type === "adults" && pax.infants > pax.adults) pax.infants = pax.adults;
  syncPassengersUI();
}

passengersTrigger.addEventListener("click", () => {
  passengersPanel.style.display =
    passengersPanel.style.display === "block" ? "none" : "block";
});
document.addEventListener("click", (e) => {
  const inside =
    passengersPanel.contains(e.target) || passengersTrigger.contains(e.target);
  if (!inside) passengersPanel.style.display = "none";
});
passengersPanel.addEventListener("click", (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const row = e.target.closest(".p-row");
  if (!row) return;
  const type = row.getAttribute("data-type");
  const action = btn.getAttribute("data-action");
  if (action === "inc") inc(type);
  if (action === "dec") dec(type);
});
syncPassengersUI();

/*****************************************************************
 * MultiCity legs
 *****************************************************************/
const legsHost = document.getElementById("legsHost");
const addLegBtn = document.getElementById("addLegBtn");
let legs = [];

function createLegModel() {
  return { from: "", to: "", date: "" };
}

function fillCitySelect(selectEl, placeholder) {
  selectEl.innerHTML = "";
  option(selectEl, "", placeholder, { disabled: true, selected: true });
  cachedCities.forEach((c) => option(selectEl, c, c));
}

function ensureMinLegs() {
  if (legs.length < 2) while (legs.length < 2) legs.push(createLegModel());
  if (legs.length > 4) legs = legs.slice(0, 4);
  renderLegs();
}

function renderLegs() {
  legsHost.innerHTML = "";
  legs.forEach((leg, idx) => {
    const wrap = document.createElement("div");
    wrap.className = "mc-leg";
    const canRemove = legs.length > 2;

    wrap.innerHTML = `
        <div class="mc-leg-top">
          <div class="mc-pill">✈️ Leg ${idx + 1}</div>
          <button type="button" class="remove-btn" data-remove="${idx}" ${canRemove ? "" : "disabled"}>Remove</button>
        </div>

        <div class="row2">
          <div>
            <p class="label">🛫 From</p>
            <div class="field">
              <div class="icon">📍</div>
              <select class="mc-from" data-idx="${idx}"></select>
            </div>
          </div>

          <div>
            <p class="label">🛬 To</p>
            <div class="field">
              <div class="icon">📍</div>
              <select class="mc-to" data-idx="${idx}"></select>
            </div>
          </div>
        </div>

        <div style="margin-top:16px">
          <p class="label">📅 Flight Date</p>
          <div class="field">
            <div class="icon">📆</div>
            <input class="mc-date" data-idx="${idx}" type="date" />
          </div>
        </div>
      `;

    legsHost.appendChild(wrap);

    const fromSel = wrap.querySelector(".mc-from");
    const toSel = wrap.querySelector(".mc-to");
    const dateInp = wrap.querySelector(".mc-date");

    if (cachedCities.length > 0) {
      fillCitySelect(fromSel, "Select departure");
      fillCitySelect(toSel, "Select arrival");
    } else {
      fromSel.innerHTML = `<option value="" disabled selected>Select departure</option>`;
      toSel.innerHTML = `<option value="" disabled selected>Select arrival</option>`;
    }

    fromSel.value = leg.from || "";
    toSel.value = leg.to || "";
    dateInp.value = leg.date || "";

    fromSel.addEventListener("change", () => {
      legs[idx].from = fromSel.value;
      if (legs[idx].to && legs[idx].to === legs[idx].from) {
        legs[idx].to = "";
        toSel.value = "";
      }
    });

    toSel.addEventListener("change", () => {
      legs[idx].to = toSel.value;
      if (legs[idx].to && legs[idx].to === legs[idx].from) {
        alert("To cannot equal From");
        legs[idx].to = "";
        toSel.value = "";
      }
    });

    dateInp.addEventListener("change", () => (legs[idx].date = dateInp.value));
  });

  setMultiRequired(uiTripType === "multi");
}

legsHost.addEventListener("click", (e) => {
  const btn = e.target.closest("button[data-remove]");
  if (!btn) return;
  const idx = Number(btn.getAttribute("data-remove"));
  if (Number.isNaN(idx) || legs.length <= 2) return;
  legs.splice(idx, 1);
  renderLegs();
});

addLegBtn.addEventListener("click", () => {
  if (legs.length >= 4) return alert("Maximum 4 legs allowed.");
  legs.push(createLegModel());
  renderLegs();
});

function validateMulti() {
  if (legs.length < 2) return "MultiCity requires at least 2 legs.";
  if (legs.length > 4) return "Maximum 4 legs allowed.";
  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    if (!leg.from || !leg.to) return `Leg ${i + 1}: select From / To`;
    if (leg.from === leg.to) return `Leg ${i + 1}: From cannot equal To`;
    if (!leg.date) return `Leg ${i + 1}: choose date`;
  }
  return null;
}

/*****************************************************************
 * Lookups init (شيلنا tripTypesAll لأنه مش مطلوب)
 *****************************************************************/
async function initLookups() {
  miniStatus.textContent = "Connecting...";
  statusText.textContent = "Loading lookups...";

  passengerClassSel.innerHTML = `<option value="" disabled selected>Loading...</option>`;

  const tasks = await Promise.allSettled([
    apiGet(ENDPOINTS.cities),
    apiGet(ENDPOINTS.passengerClassAll),
  ]);

  const [citiesRes, pclassRes] = tasks;

  if (citiesRes.status === "fulfilled") {
    const cities = citiesRes.value;
    cachedCities = Array.isArray(cities)
      ? cities
      : cities?.data || cities?.results || [];
    cachedCities = cachedCities
      .filter(Boolean)
      .map((x) => String(x).trim())
      .filter(Boolean);

    fromCountry.innerHTML = "";
    toCountry.innerHTML = "";
    option(fromCountry, "", "Departure city", {
      disabled: true,
      selected: true,
    });
    option(toCountry, "", "Arrival city", {
      disabled: true,
      selected: true,
    });
    cachedCities.forEach((c) => {
      option(fromCountry, c, c);
      option(toCountry, c, c);
    });

    if (cachedCities.length > 1) {
      fromCountry.value = cachedCities[0];
      toCountry.value = cachedCities[1];
    }
    ensureMinLegs();
  } else {
    console.warn("Cities failed:", citiesRes.reason);
    statusText.textContent = "Cities failed to load";
  }

  if (pclassRes.status === "fulfilled") {
    const pclasses = pclassRes.value;
    const plist = Array.isArray(pclasses)
      ? pclasses
      : pclasses?.data || pclasses?.results || [];

    passengerClassSel.innerHTML = "";
    option(passengerClassSel, "", "Select class", {
      disabled: true,
      selected: true,
    });

    plist.forEach((pc) => {
      const id = pc.classID ?? pc.ClassID ?? pc.id ?? pc.ID;
      const name = pc.nameClass ?? pc.NameClass ?? pc.name ?? pc.title ?? "";
      const fee = pc.feesClass ?? pc.FeesClass ?? pc.fee ?? 0;
      if (id != null && name)
        option(passengerClassSel, String(id), `${name} (+${fee})`);
    });

    if (passengerClassSel.options.length > 1)
      passengerClassSel.selectedIndex = 1;
  } else {
    console.warn("PassengerClass failed:", pclassRes.reason);
    passengerClassSel.innerHTML = `<option value="" disabled selected>Failed to load classes</option>`;
  }

  miniStatus.textContent = "Connected";
  statusText.textContent = "Ready";
}

/*****************************************************************
 * Pricing helpers
 *****************************************************************/
function totalPaxCount() {
  return totalPax();
}

function getSelectedClassFee() {
  const opt = passengerClassSel.options[passengerClassSel.selectedIndex];
  const txt = (opt?.textContent || "").trim();
  const m = txt.match(/\(\+([0-9]+(?:\.[0-9]+)?)\)/);
  return m ? Number(m[1]) : 0;
}
function getSelectedClassName() {
  const opt = passengerClassSel.options[passengerClassSel.selectedIndex];
  const txt = (opt?.textContent || "").trim();
  return txt ? txt.split(" (+")[0].trim() : "";
}

/*****************************************************************
 * ✅ Search (مربوط مباشرة ب endpoints الصورة)
 *****************************************************************/
async function doSearch() {
  statusText.textContent = "Searching...";
  searchBtn.disabled = true;

  try {
    if (!passengerClassSel.value)
      throw new Error("Please select passenger class");

    let endpoint = "";
    let payload = null;
    let results = null;

    if (uiTripType === "oneway") {
      endpoint = ENDPOINTS.oneway;

      const from = fromCountry.value;
      const to = toCountry.value;
      const d = document.getElementById("departDate").value;

      if (!from || !to) throw new Error("Please select From / To");
      if (from === to) throw new Error("From cannot equal To");
      if (!d) throw new Error("Please choose Departure date");

      payload = { from, to, date: toIsoDate(d) };
      results = await apiPost(endpoint, payload);

      sessionStorage.setItem("tripType", "OneWay");
    }

    if (uiTripType === "round") {
      endpoint = ENDPOINTS.roundtrip;

      const from = fromCountry.value;
      const to = toCountry.value;
      const depart = document.getElementById("departDate").value;
      const ret = document.getElementById("returnDate").value;

      if (!from || !to) throw new Error("Please select From / To");
      if (from === to) throw new Error("From cannot equal To");
      if (!depart) throw new Error("Please choose Departure date");
      if (!ret) throw new Error("Please choose Return date");

      const d1 = toIsoDate(depart);
      const d2 = toIsoDate(ret);

      payload = {
        from,
        to,

        // احتمالات شائعة لأسماء DTO
        departDate: d1,
        DepartDate: d1,
        departureDate: d1,
        DepartureDate: d1,

        returnDate: d2,
        ReturnDate: d2,
      };

      results = await apiPost(endpoint, payload);

      sessionStorage.setItem("tripType", "RoundTrip");
    }

    if (uiTripType === "multi") {
      endpoint = ENDPOINTS.multicity;

      const err = validateMulti();
      if (err) throw new Error(err);

      payload = {
        legs: legs.map((l) => ({
          from: l.from,
          to: l.to,
          date: toIsoDate(l.date),
        })),
        maxOptionsPerLeg: 5,
        maxItineraries: 50,
      };
      results = await apiPost(endpoint, payload);

      sessionStorage.setItem("tripType", "MultiCity");
    }

    // Store for available-flights
    sessionStorage.setItem("API_BASE_URL", API_BASE_URL);
    sessionStorage.setItem("endpointUsed", endpoint);
    sessionStorage.setItem("searchPayload", JSON.stringify(payload));
    sessionStorage.setItem("searchResults", JSON.stringify(results));

    sessionStorage.setItem("totalPassengers", String(totalPaxCount()));
    sessionStorage.setItem("selectedClassFee", String(getSelectedClassFee()));
    sessionStorage.setItem("selectedClassName", getSelectedClassName());
    sessionStorage.setItem(
      "passengerClassID",
      String(Number(passengerClassSel.value)),
    );

    statusText.textContent = "Redirecting...";
    window.location.assign("available-flights.html");
  } catch (err) {
    console.warn("Search error:", err);
    statusText.textContent = "Error: " + (err?.message || "Unknown error");
    alert(err?.message || "Unknown error");
  } finally {
    searchBtn.disabled = false;
  }
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  doSearch();
});

/*****************************************************************
 * Init
 *****************************************************************/
function loadUserProfile() {
  const token = getAuthHeaders().Authorization?.replace("Bearer ", "");
  if (!token) return;
  try {
    const payload = token.split(".")[1];
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const decoded = JSON.parse(decodeURIComponent(escape(json)));

    const firstName = decoded.firstName || decoded.FirstName || "";
    const lastName = decoded.lastName || decoded.LastName || "";
    const email =
      decoded.email ||
      decoded[
        "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress"
      ] ||
      "";

    let fullName = "";
    if (firstName && lastName)
      fullName = `${firstName} ${lastName}`.toUpperCase();
    else if (firstName) fullName = firstName.toUpperCase();
    else if (email) fullName = email.split("@")[0].toUpperCase();
    else fullName = "User";

    document.getElementById("username").textContent = fullName;
    document.getElementById("avatar").textContent = fullName[0];
  } catch {}
}

loadUserProfile();
setUiTripType("oneway");
initLookups();
