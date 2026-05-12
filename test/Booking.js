/*****************************************************************
 * ✅ CONFIG
 *****************************************************************/
const API_BASE_URL = "https://localhost:7216";

const ENDPOINTS = {
  tripTypesAll: "/api/Triptypes/All", // ممكن 401
  cities: "/api/FlightSchedules/Cities",
  passengerClassAll: "/api/PassengerClass/All", // غيّرها لو عندك IPassengerClass
  searchSingle: "/api/FlightSchedules/Search",
  searchMulti: "/api/FlightSchedules/SearchMultiCity",
};

function getAuthHeaders() {
  const token = localStorage.getItem("auth_token"); // ✅ نفس Login
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
 * ✅ Date helpers (full-day range)
 *****************************************************************/
function toApiStartOfDay(dateStr) {
  return dateStr ? `${dateStr}T00:00:00.000Z` : null;
}
function toApiEndOfDay(dateStr) {
  return dateStr ? `${dateStr}T23:59:59.999Z` : null;
}

/*****************************************************************
 * Top tabs indicator
 *****************************************************************/
const topTabs = document.getElementById("topTabs");
const topIndicator = document.getElementById("topIndicator");
const topButtons = [...topTabs.querySelectorAll(".tab")];

function placeTopIndicator(el) {
  const base = topTabs.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  topIndicator.style.width = r.width + "px";
  topIndicator.style.transform = "translateX(" + (r.left - base.left) + "px)";
}
placeTopIndicator(topTabs.querySelector(".tab.active"));

const routes = {
  home: "home.html",
  book: "BookingPage.html",
  tickets: "Ticket.html",
  profile: "Profile.html",
};

topButtons.forEach((btn) => {
  btn.addEventListener("mouseenter", () => placeTopIndicator(btn));
  btn.addEventListener("focus", () => placeTopIndicator(btn));
  btn.addEventListener("click", () => {
    topButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    placeTopIndicator(btn);
    const tab = btn.dataset.tab;
    if (routes[tab]) window.location.href = routes[tab];
  });
});

topTabs.addEventListener("mouseleave", () => {
  const active = topTabs.querySelector(".tab.active");
  if (active) placeTopIndicator(active);
});

window.addEventListener("resize", () => {
  const active = topTabs.querySelector(".tab.active");
  if (active) placeTopIndicator(active);
});

/*****************************************************************
 * Trip type segmented
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

let uiTripType = "oneway"; // oneway | round | multi
let cachedCities = [];
let tripTypesFromApi = [];
let selectedTripTypeId = 0;

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

  if (isMulti) returnDate.required = false;
  else returnDate.required = uiTripType === "round";

  document
    .querySelectorAll(
      "#multiBlock select.mc-from, #multiBlock select.mc-to, #multiBlock input.mc-date",
    )
    .forEach((el) => (el.required = isMulti));
}

function guessTripTypeId(type) {
  if (!Array.isArray(tripTypesFromApi) || tripTypesFromApi.length === 0)
    return 0;

  const byName = (needle) =>
    tripTypesFromApi.find((x) =>
      String(x.tripTypeName || x.TripTypeName || x.name || x.title || "")
        .toLowerCase()
        .includes(needle),
    );

  const getId = (obj) =>
    obj?.tripTypeID ?? obj?.TripTypeID ?? obj?.id ?? obj?.ID ?? 0;

  if (type === "oneway")
    return getId(byName("one") || byName("oneway") || tripTypesFromApi[0]);
  if (type === "round")
    return getId(
      byName("round") ||
        byName("return") ||
        tripTypesFromApi[1] ||
        tripTypesFromApi[0],
    );
  if (type === "multi")
    return getId(
      byName("multi") ||
        byName("city") ||
        tripTypesFromApi[2] ||
        tripTypesFromApi[0],
    );
  return 0;
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

  selectedTripTypeId = guessTripTypeId(type);
  sessionStorage.setItem("tripTypeID", String(selectedTripTypeId || 1));

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
 * ClientID modal
 *****************************************************************/
const modalBackdrop = document.getElementById("modalBackdrop");
const clientPill = document.getElementById("clientPill");
const closeModalBtn = document.getElementById("closeModalBtn");
const saveClientBtn = document.getElementById("saveClientBtn");
const clearClientBtn = document.getElementById("clearClientBtn");
const clientIdInput = document.getElementById("clientIdInput");
const clientLabel = document.getElementById("clientLabel");
const avatar = document.getElementById("avatar");

function getClientID() {
  const v = localStorage.getItem("clientID");
  return v ? Number(v) : null;
}
function setClientID(v) {
  if (v === null || v === "" || Number.isNaN(Number(v)))
    localStorage.removeItem("clientID");
  else localStorage.setItem("clientID", String(Number(v)));
  refreshClientUI();
}
function refreshClientUI() {
  const id = getClientID();
  clientLabel.textContent = "ClientID: " + (id ?? "—");
  avatar.textContent = id ? String(id).slice(0, 1) : "C";
}
refreshClientUI();

function openModal() {
  clientIdInput.value = getClientID() ?? "";
  modalBackdrop.classList.add("show");
  setTimeout(() => clientIdInput.focus(), 50);
}
function closeModal() {
  modalBackdrop.classList.remove("show");
}

clientPill.addEventListener("click", openModal);
closeModalBtn.addEventListener("click", closeModal);
modalBackdrop.addEventListener("click", (e) => {
  if (e.target === modalBackdrop) closeModal();
});
saveClientBtn.addEventListener("click", () => {
  setClientID(clientIdInput.value.trim());
  closeModal();
});
clearClientBtn.addEventListener("click", () => {
  setClientID(null);
  closeModal();
});

/*****************************************************************
 * Passengers Panel
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
  return { departureCity: "", arrivalCity: "", flightDate: "" };
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
              <div class="mc-pill">Leg ${idx + 1}</div>
              <button type="button" class="remove-btn" data-remove="${idx}" ${canRemove ? "" : "disabled"}>Remove</button>
            </div>

            <div class="row2">
              <div>
                <p class="label">From (DepartureCity)</p>
                <div class="field">
                  <div class="icon">🛫</div>
                  <select class="mc-from" data-idx="${idx}"></select>
                </div>
              </div>

              <div>
                <p class="label">To (ArrivalCity)</p>
                <div class="field">
                  <div class="icon">🛬</div>
                  <select class="mc-to" data-idx="${idx}"></select>
                </div>
              </div>
            </div>

            <div style="margin-top:12px">
              <p class="label">Flight Date</p>
              <div class="field">
                <div class="icon">📅</div>
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

    fromSel.required = uiTripType === "multi";
    toSel.required = uiTripType === "multi";
    dateInp.required = uiTripType === "multi";

    fromSel.value = leg.departureCity || "";
    toSel.value = leg.arrivalCity || "";
    dateInp.value = leg.flightDate || "";

    fromSel.addEventListener("change", () => {
      legs[idx].departureCity = fromSel.value;
      if (
        legs[idx].arrivalCity &&
        legs[idx].arrivalCity === legs[idx].departureCity
      ) {
        legs[idx].arrivalCity = "";
        toSel.value = "";
      }
    });

    toSel.addEventListener("change", () => {
      legs[idx].arrivalCity = toSel.value;
      if (
        legs[idx].arrivalCity &&
        legs[idx].arrivalCity === legs[idx].departureCity
      ) {
        alert("ArrivalCity cannot equal DepartureCity");
        legs[idx].arrivalCity = "";
        toSel.value = "";
      }
    });

    dateInp.addEventListener(
      "change",
      () => (legs[idx].flightDate = dateInp.value),
    );
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

function validateMultiPayload(payload) {
  if (!payload.legs || payload.legs.length < 2)
    return "MultiCity requires at least 2 legs.";
  if (payload.legs.length > 4) return "Maximum 4 legs allowed.";
  for (let i = 0; i < payload.legs.length; i++) {
    const leg = payload.legs[i];
    if (!leg.departureCity || !leg.arrivalCity)
      return `Leg ${i + 1}: select Departure/Arrival`;
    if (leg.departureCity === leg.arrivalCity)
      return `Leg ${i + 1}: Departure cannot equal Arrival`;
    if (!leg.flightDate) return `Leg ${i + 1}: choose Flight Date`;
  }
  return null;
}

/*****************************************************************
 * Lookups init
 *****************************************************************/
async function initLookups() {
  miniStatus.textContent = "Connecting...";
  statusText.textContent = "Loading lookups...";

  passengerClassSel.innerHTML =
    '<option value="" disabled selected>Loading...</option>';

  const tasks = await Promise.allSettled([
    apiGet(ENDPOINTS.cities),
    apiGet(ENDPOINTS.tripTypesAll), // ممكن 401
    apiGet(ENDPOINTS.passengerClassAll),
  ]);

  const [citiesRes, tripTypesRes, pclassRes] = tasks;

  // Cities
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

    if (cachedCities.length > 0) {
      fromCountry.value = cachedCities[0];
      toCountry.value =
        cachedCities.length > 1 ? cachedCities[1] : cachedCities[0];
    }
  } else {
    console.warn("Cities failed:", citiesRes.reason);
    statusText.textContent = "Cities failed to load";
  }

  // TripTypes (401 safe)
  if (tripTypesRes.status === "fulfilled") {
    const ttypes = tripTypesRes.value;
    tripTypesFromApi = Array.isArray(ttypes)
      ? ttypes
      : ttypes?.data || ttypes?.results || [];
    selectedTripTypeId = guessTripTypeId(uiTripType);
  } else {
    console.warn("TripTypes failed:", tripTypesRes.reason);
    tripTypesFromApi = [];
    selectedTripTypeId = 0;
  }

  // PassengerClass
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
    passengerClassSel.innerHTML =
      '<option value="" disabled selected>Failed to load classes</option>';
  }

  ensureMinLegs();
  miniStatus.textContent = "Connected";
  statusText.textContent = "Ready";
}

/*****************************************************************
 * Pricing helpers (store for available-flights)
 *****************************************************************/
function totalPaxCount() {
  return (
    (pax.adults || 0) +
    (pax.youth || 0) +
    (pax.children || 0) +
    (pax.infants || 0)
  );
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
 * Search payloads
 *****************************************************************/
function buildMultiPayload() {
  const classText =
    passengerClassSel.options[passengerClassSel.selectedIndex]?.textContent ||
    "";
  const travelClass = classText.split(" (+")[0] || "Economy";

  return {
    tripTypeID: selectedTripTypeId ?? 0,
    passengers: {
      adults: pax.adults,
      youth: pax.youth,
      children: pax.children,
      infants: pax.infants,
    },
    travelClass,
    passengerClassID: Number(passengerClassSel.value) || null,
    legs: legs.map((l) => ({
      departureCity: l.departureCity,
      arrivalCity: l.arrivalCity,
      flightDate: l.flightDate || null, // YYYY-MM-DD
    })),
  };
}

async function doSearch() {
  statusText.textContent = "Searching...";
  searchBtn.disabled = true;

  try {
    let endpoint = ENDPOINTS.searchSingle;
    let payload = null;
    let results = null;

    if (uiTripType === "multi") {
      endpoint = ENDPOINTS.searchMulti;
      payload = buildMultiPayload();
      const err = validateMultiPayload(payload);
      if (err) throw new Error(err);

      console.log("POST", API_BASE_URL + endpoint, payload);
      results = await apiPost(endpoint, payload);
    } else {
      endpoint = ENDPOINTS.searchSingle;

      const departureCity = fromCountry.value;
      const arrivalCity = toCountry.value;
      const departDate = document.getElementById("departDate").value;
      const returnDateVal = document.getElementById("returnDate").value;

      if (!departureCity || !arrivalCity)
        throw new Error("Please select Departure/Arrival city");
      if (departureCity === arrivalCity)
        throw new Error("Departure city cannot equal Arrival city");
      if (!departDate) throw new Error("Please choose Departure date");

      if (uiTripType === "oneway") {
        payload = {
          departureCity,
          arrivalCity,
          flightDateFrom: toApiStartOfDay(departDate),
          flightDateTo: toApiEndOfDay(departDate),
          passengerClassID: Number(passengerClassSel.value) || null,
        };
      } else {
        if (!returnDateVal) throw new Error("Please choose Return date");
        payload = {
          departureCity,
          arrivalCity,
          flightDateFrom: toApiStartOfDay(departDate),
          flightDateTo: toApiEndOfDay(returnDateVal),
          passengerClassID: Number(passengerClassSel.value) || null,
        };
      }

      console.log("POST", API_BASE_URL + endpoint, payload);
      results = await apiPost(endpoint, payload);
    }

    console.log("RESULTS:", results);

    // ✅ Store for available-flights
    sessionStorage.setItem("API_BASE_URL", API_BASE_URL);
    sessionStorage.setItem("tripType", uiTripType);
    sessionStorage.setItem("endpointUsed", endpoint);
    sessionStorage.setItem("searchPayload", JSON.stringify(payload));
    sessionStorage.setItem("searchResults", JSON.stringify(results));

    sessionStorage.setItem("totalPassengers", String(totalPaxCount()));
    sessionStorage.setItem("selectedClassFee", String(getSelectedClassFee()));
    sessionStorage.setItem("selectedClassName", getSelectedClassName());

    statusText.textContent = "Redirecting...";
    // تأكد إنه اختار Class
    if (!passengerClassSel.value) {
      throw new Error("Please select passenger class");
    }

    // خزّن PassengerClassID عشان نستخدمه لاحقًا (InfoTickets)
    sessionStorage.setItem(
      "passengerClassID",
      String(Number(passengerClassSel.value)),
    );

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
setUiTripType("oneway");
initLookups();
const tabs = document.getElementById("tabs");
const indicator = document.getElementById("indicator");
const tabButtons = [...tabs.querySelectorAll(".tab")];

function placeIndicator(el) {
  const tabsRect = tabs.getBoundingClientRect();
  const r = el.getBoundingClientRect();
  const left = r.left - tabsRect.left;
  const width = r.width;

  indicator.style.width = width + "px";
  indicator.style.transform = "translateX(" + left + "px)";
}

// أول ما الصفحة تفتح
const activeTab = tabs.querySelector(".tab.active") || tabButtons[0];
placeIndicator(activeTab);

tabButtons.forEach((btn) => {
  btn.addEventListener("mouseenter", () => placeIndicator(btn));
  btn.addEventListener("focus", () => placeIndicator(btn));

  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;

    // تنقّل بين الصفحات
    switch (tab) {
      case "home":
        window.location.href = "Home.html";
        break;
      case "book":
        window.location.href = "BookingPage.html";
        break;
      case "tickets":
        window.location.href = "Ticket.html";
        break;
      case "profile":
        window.location.href = "Profile.html";
        break;
    }
  });
});

// لما تطلع الماوس يرجع على الـ active
tabs.addEventListener("mouseleave", () => {
  const active = tabs.querySelector(".tab.active");
  if (active) placeIndicator(active);
});

// عند تغيير حجم الشاشة
window.addEventListener("resize", () => {
  const active = tabs.querySelector(".tab.active");
  if (active) placeIndicator(active);
});
