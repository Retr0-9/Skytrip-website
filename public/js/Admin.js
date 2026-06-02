const API_BASE_URL =
  "https://bookingtrip-api-2026-cyh0f4dhfednh3fj.westeurope-01.azurewebsites.net";

const ENDPOINTS = {
  userMe: "/api/UserAccount/me",
  profileMe: "/api/profile/me",

  userAll: "/api/UserAccount",
  userById: (id) => `/api/UserAccount/${id}`,
  userUpdate: (id) => `/api/UserAccount/${id}`,

  employeesAll: "/api/Employee/All",

  flightsAll: "/api/FlightSchedules/All",
  flightCreate: "/api/FlightSchedules",
  flightUpdate: (id) => `/api/FlightSchedules/${id}`,
  flightDelete: (id) => `/api/FlightSchedules/${id}`,
  flightCities: "/api/FlightSchedules/Cities",

  bookingsAll: "/api/BookingTrip",
  bookingDelete: (id) => `/api/BookingTrip/${id}`,
  bookingConfirm: (id) => `/api/BookingTrip/${id}/confirm`,

  countriesAll: "/api/Country/All",
  servicesAll: "/api/Services/All",
};

const state = {
  role: "Admin",
  tab: "flights",
  token: localStorage.getItem("auth_token") || "",
  user: null,
  flights: [],
  bookings: [],
  employees: [],
  users: [],
  countries: [],
  services: [],
  cities: [],
  filter: "all",
  editingItem: null,
};

const views = {
  Admin: {
    title: "Admin Dashboard",
    subtitle:
      "Manage employees, user accounts, bookings, and flight schedules.",
    primaryLabel: "+ Add Flight",
    nav: [
      { key: "flights", label: "Flights", icon: "✈️" },

      { key: "bookings", label: "Bookings", icon: "🧾" },
      { key: "roles", label: "Roles & Access", icon: "🛡️" },
    ],
    endpoints: [
      { title: "Create flight", path: "POST /api/FlightSchedules" },
      {
        title: "Delete flight",
        path: "DELETE /api/FlightSchedules/{id}",
      },
      { title: "Employees", path: "GET /api/Employee/All" },
      { title: "User accounts", path: "GET /api/UserAccount" },
      { title: "Bookings", path: "GET /api/BookingTrip" },
    ],
    actions: [
      {
        key: "createFlight",
        title: "Add new flight",
        text: "Create a new schedule with city, date, time and price.",
      },
      {
        key: "assignRole",
        title: "Assign permissions",
        text: "Promote or edit employee access from user accounts.",
      },
      {
        key: "loadEmployees",
        title: "Refresh employees",
        text: "Pull the latest employees from the API.",
      },
      {
        key: "loadBookings",
        title: "Review bookings",
        text: "See all bookings and their status.",
      },
    ],
  },
};

const ROLE_ID_MAP = {
  1: "Admin",
  2: "Employee",
  3: "Client",
};

const $ = (id) => document.getElementById(id);

function showToast(message, isError = false) {
  const el = $("toast");
  el.textContent = message;
  el.style.background = isError ? "rgba(190,24,93,.95)" : "rgba(15,23,42,.92)";
  el.classList.add("show");
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => el.classList.remove("show"), 2800);
}

function getAuthHeaders() {
  return state.token ? { Authorization: "Bearer " + state.token } : {};
}

function decodeJwt(token) {
  try {
    const payload = token.split(".")[1];
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

function getUserNameFromPayload(payload) {
  if (!payload) return "User";
  const email =
    payload.email || payload.Email || payload.unique_name || payload.sub || "";
  return email ? String(email).split("@")[0] : "User";
}

async function parseResponse(res) {
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (res.status === 204) return null;
  if (ct.includes("application/json")) return await res.json();
  const txt = await res.text().catch(() => "");
  try {
    return txt ? JSON.parse(txt) : txt;
  } catch {
    return txt;
  }
}

async function apiRequest(path, options = {}) {
  const url = API_BASE_URL.replace(/\/+$/, "") + path;
  const res = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...getAuthHeaders(),
      ...(options.headers || {}),
    },
  });

  const data = await parseResponse(res);

  if (!res.ok) {
    const message =
      data?.detail ||
      data?.message ||
      data?.title ||
      (typeof data === "string" ? data : "Request failed");
    throw new Error(`${res.status} - ${message}`);
  }

  return data;
}

const apiGet = (path) => apiRequest(path);
const apiPost = (path, body) =>
  apiRequest(path, { method: "POST", body: JSON.stringify(body) });
const apiPut = (path, body) =>
  apiRequest(path, { method: "PUT", body: JSON.stringify(body) });
const apiDelete = (path) => apiRequest(path, { method: "DELETE" });

function normalizeArray(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.items)) return data.items;
  return [];
}

function pick(obj, keys, fallback = "") {
  for (const key of keys) {
    if (obj && obj[key] != null && obj[key] !== "") return obj[key];
  }
  return fallback;
}

function getFlightId(f) {
  return pick(
    f,
    [
      "flightScheduleID",
      "FlightScheduleID",
      "flightScheduleId",
      "FlightScheduleId",
      "id",
      "ID",
    ],
    "",
  );
}

function getBookingId(b) {
  return pick(
    b,
    ["bookID", "BookID", "bookingTripID", "BookingTripID", "id", "ID"],
    "",
  );
}

function getUserId(u) {
  return pick(
    u,
    [
      "userID",
      "UserID",
      "userId",
      "UserId",
      "userAccountID",
      "UserAccountID",
      "userAccountId",
      "UserAccountId",
      "id",
      "ID",
    ],
    "",
  );
}

function getEmployeeId(e) {
  return pick(
    e,
    ["employeeID", "EmployeeID", "employeeId", "EmployeeId", "id", "ID"],
    "",
  );
}

function formatDate(v) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
}

function statusBadge(status) {
  const raw = String(status || "Unknown");
  const s = raw.toLowerCase();
  let cls = "blue";

  if (s.includes("confirm") || s.includes("success") || s.includes("active")) {
    cls = "green";
  } else if (
    s.includes("delay") ||
    s.includes("pending") ||
    s.includes("postpone")
  ) {
    cls = "orange";
  } else if (
    s.includes("cancel") ||
    s.includes("delete") ||
    s.includes("reject")
  ) {
    cls = "red";
  } else if (s.includes("admin")) {
    cls = "purple";
  }

  return `<span class="badge ${cls}">${raw}</span>`;
}

function roleNameFromUser(user) {
  const roleId = Number(
    pick(user, ["roleID", "RoleID", "roleId", "RoleId"], 0),
  );
  return ROLE_ID_MAP[roleId] || "Unknown";
}

function safeJsonString(obj) {
  try {
    return JSON.stringify(obj).toLowerCase();
  } catch {
    return "";
  }
}

async function loadCurrentUser() {
  const decoded = decodeJwt(state.token);
  const basicName = getUserNameFromPayload(decoded);

  try {
    const me = await apiGet(ENDPOINTS.userMe);
    state.user = me || { fullName: basicName };
  } catch {
    try {
      const profile = await apiGet(ENDPOINTS.profileMe);
      state.user = profile || { fullName: basicName };
    } catch {
      state.user = { fullName: basicName };
    }
  }
}

function logout() {
  localStorage.removeItem("auth_token");
  window.location.href = "Login.html";
}

function hydrateLayout() {
  const view = views.Admin;
  $("pageTitle").textContent = view.title;
  $("pageSubtitle").textContent = view.subtitle;
  $("quickPrimaryBtn").textContent = view.primaryLabel;
  $("sidebarRole").textContent = "Admin";

  const displayName =
    pick(
      state.user,
      [
        "fullName",
        "FullName",
        "userNameOrEmail",
        "UserNameOrEmail",
        "name",
        "Name",
      ],
      getUserNameFromPayload(decodeJwt(state.token)),
    ) || "User";

  $("sidebarName").textContent = displayName;
  $("sidebarAvatar").textContent =
    String(displayName || "U")
      .trim()
      .charAt(0)
      .toUpperCase() || "U";

  $("sideNav").innerHTML = view.nav
    .map(
      (item) => `
          <button class="navBtn ${item.key === state.tab ? "active" : ""}" data-tab="${item.key}" type="button">
            <span class="left"><span>${item.icon}</span><span>${item.label}</span></span>
            <span>›</span>
          </button>
        `,
    )
    .join("");

  $("endpointCards").innerHTML = view.endpoints
    .map(
      (ep) => `
          <div class="miniCard">
            <h4>${ep.title}</h4>
            <p><code>${ep.path}</code></p>
          </div>
        `,
    )
    .join("");

  $("actionGrid").innerHTML = view.actions
    .map(
      (action) => `
          <button class="actionCard" type="button" data-action="${action.key}">
            <strong>${action.title}</strong>
            <span>${action.text}</span>
          </button>
        `,
    )
    .join("");

  renderStats();
  renderActiveTable();
}

function renderStats() {
  const flights = state.flights.length;
  const bookings = state.bookings.length;
  const employees = state.employees.length;
  const admins = state.users.filter(
    (u) => Number(pick(u, ["roleID", "RoleID", "roleId", "RoleId"], 0)) === 1,
  ).length;

  const cards = [
    {
      label: "Flights",
      value: flights,
      sub: "All schedules from /api/FlightSchedules/All",
    },
    {
      label: "Employees",
      value: employees,
      sub: "Loaded from /api/Employee/All",
    },
    {
      label: "Bookings",
      value: bookings,
      sub: "Loaded from /api/BookingTrip",
    },
    {
      label: "Admins",
      value: admins,
      sub: "Detected from roleID = 1",
    },
  ];

  $("statsGrid").innerHTML = cards
    .map(
      (card) => `
          <div class="statCard">
            <div class="statLabel">${card.label}</div>
            <div class="statValue">${card.value}</div>
            <div class="statSub">${card.sub}</div>
          </div>
        `,
    )
    .join("");
}

function renderActiveTable() {
  if (state.tab === "flights") renderFlightsTable();
  else if (state.tab === "employees" || state.tab === "roles")
    renderEmployeesTable();
  else if (state.tab === "bookings") renderBookingsTable();
  else renderSupportTable();
}

function setTable(headers, rowsHtml, meta = {}) {
  $("tableTitle").textContent = meta.title || "Data";
  $("tableSubtitle").textContent = meta.subtitle || "";
  $("tableHeadRow").innerHTML = headers.map((h) => `<th>${h}</th>`).join("");
  $("tableBody").innerHTML = rowsHtml || "";
  $("emptyState").style.display = rowsHtml ? "none" : "block";
  $("sidePanelTitle").textContent = meta.sideTitle || "Quick actions";
  $("sidePanelSubtitle").textContent = meta.sideSubtitle || "";
  $("tableFilters").innerHTML = (meta.filters || [])
    .map(
      (f) =>
        `<button class="chip ${state.filter === f.key ? "active" : ""}" data-filter="${f.key}" type="button">${f.label}</button>`,
    )
    .join("");
}

function renderFlightsTable() {
  const q = $("globalSearch").value.trim().toLowerCase();

  let list = state.flights.filter((f) => {
    const hay = safeJsonString(f);
    return !q || hay.includes(q);
  });

  if (state.filter === "today") {
    const today = new Date().toDateString();
    list = list.filter((f) => {
      const v = pick(f, ["flightDate", "FlightDate"], "");
      return v && new Date(v).toDateString() === today;
    });
  }

  const rows = list
    .map((f) => {
      const id = getFlightId(f);
      const from = pick(f, ["departureCity", "DepartureCity"], "—");
      const to = pick(f, ["arrivalCity", "ArrivalCity"], "—");
      const flightDate = pick(f, ["flightDate", "FlightDate"], "");
      const departureTime = pick(f, ["departureTime", "DepartureTime"], "—");
      const arrivalTime = pick(f, ["arrivalTime", "ArrivalTime"], "—");
      const basePrice = pick(f, ["basePrice", "BasePrice"], "—");
      const classFee = pick(f, ["classFee", "ClassFee"], "—");
      const totalPrice = pick(f, ["totalPrice", "TotalPrice"], "—");

      return `
            <tr>
              <td>#${id}</td>
              <td>${from}</td>
              <td>${to}</td>
              <td>${formatDate(flightDate)}</td>
              <td>${departureTime}</td>
              <td>${arrivalTime}</td>
              <td>${basePrice}</td>
              <td>${classFee}</td>
              <td>${totalPrice}</td>
              <td>
                <div class="rowActions">
                  <button class="softBtn" type="button" data-edit-flight="${id}">Edit</button>
                  <button class="dangerBtn" type="button" data-delete-flight="${id}">Delete</button>
                </div>
              </td>
            </tr>
          `;
    })
    .join("");

  setTable(
    [
      "ID",
      "From",
      "To",
      "Date",
      "Departure",
      "Arrival",
      "Base Price",
      "Class Fee",
      "Total Price",
      "Actions",
    ],
    rows,
    {
      title: "Flight schedules",
      subtitle: "Admin can add, edit, and delete flights.",
      sideTitle: "Admin tools",
      sideSubtitle: "Manage schedules and permissions from one place.",
      filters: [
        { key: "all", label: "All flights" },
        { key: "today", label: "Today" },
      ],
    },
  );
}

function renderEmployeesTable() {
  const q = $("globalSearch").value.trim().toLowerCase();
  const source = state.users.length ? state.users : state.employees;

  let list = source.filter((item) => !q || safeJsonString(item).includes(q));

  if (state.filter === "admins") {
    list = list.filter(
      (u) => Number(pick(u, ["roleID", "RoleID", "roleId", "RoleId"], 0)) === 1,
    );
  } else if (state.filter === "employees") {
    list = list.filter(
      (u) => Number(pick(u, ["roleID", "RoleID", "roleId", "RoleId"], 0)) === 2,
    );
  } else if (state.filter === "clients") {
    list = list.filter(
      (u) => Number(pick(u, ["roleID", "RoleID", "roleId", "RoleId"], 0)) === 3,
    );
  }

  const rows = list
    .map((u) => {
      const id = getUserId(u) || getEmployeeId(u);
      const name = pick(
        u,
        [
          "userNameOrEmail",
          "UserNameOrEmail",
          "name",
          "Name",
          "fullName",
          "FullName",
        ],
        "Unknown",
      );
      const email = pick(
        u,
        ["userNameOrEmail", "UserNameOrEmail", "email", "Email"],
        "—",
      );
      const role = getUserId(u) !== "" ? roleNameFromUser(u) : "Employee";
      const status =
        getUserId(u) !== ""
          ? pick(u, ["isActive", "IsActive"], false)
            ? "Active"
            : "Inactive"
          : "Active";

      return `
            <tr>
              <td>#${id}</td>
              <td>${name}</td>
              <td>${email}</td>
              <td>${statusBadge(role)}</td>
              <td>${statusBadge(status)}</td>
              <td>
                <div class="rowActions">
                  ${
                    getUserId(u) !== ""
                      ? `<button class="softBtn" type="button" data-assign-role="${getUserId(u)}">Assign role</button>`
                      : "<span class='badge blue'>View only</span>"
                  }
                </div>
              </td>
            </tr>
          `;
    })
    .join("");

  setTable(
    ["ID", "Name", "Email / Username", "Role", "Status", "Actions"],
    rows,
    {
      title: "Employees & user accounts",
      subtitle: "Admin controls access and permissions.",
      sideTitle: "Permissions",
      sideSubtitle: "Role updates are done through /api/UserAccount/{id}.",
      filters: [
        { key: "all", label: "All users" },
        { key: "admins", label: "Admins" },
        { key: "employees", label: "Employees" },
        { key: "clients", label: "Clients" },
      ],
    },
  );
}

function renderBookingsTable() {
  const q = $("globalSearch").value.trim().toLowerCase();

  let list = state.bookings.filter(
    (item) => !q || safeJsonString(item).includes(q),
  );

  if (state.filter === "pending") {
    list = list.filter((b) =>
      String(pick(b, ["bookingStatus", "BookingStatus"], ""))
        .toLowerCase()
        .includes("pending"),
    );
  } else if (state.filter === "confirmed") {
    list = list.filter((b) => {
      const confirmed = pick(b, ["isConfirmed", "IsConfirmed"], false);
      const status = String(pick(b, ["bookingStatus", "BookingStatus"], ""));
      return confirmed || /confirm/i.test(status);
    });
  }

  const rows = list
    .map((b) => {
      const id = getBookingId(b);
      const client = pick(b, ["clientID", "ClientID"], "—");
      const tripType = pick(b, ["tripTypeID", "TripTypeID"], "—");
      const created = pick(b, ["bookingDate", "BookingDate"], "");
      const bookingRef = pick(b, ["bookingReference", "BookingReference"], "—");
      const status = pick(
        b,
        ["bookingStatus", "BookingStatus"],
        pick(b, ["isConfirmed", "IsConfirmed"], false)
          ? "Confirmed"
          : "Pending",
      );

      return `
            <tr>
              <td>#${id}</td>
              <td>${client}</td>
              <td>${tripType}</td>
              <td>${formatDate(created)}</td>
              <td>${bookingRef}</td>
              <td>${statusBadge(status)}</td>
              <td>
                <div class="rowActions">
                  <button class="softBtn" type="button" data-confirm-booking="${id}">Confirm</button>
                  <button class="dangerBtn" type="button" data-delete-booking="${id}">Delete</button>
                </div>
              </td>
            </tr>
          `;
    })
    .join("");

  setTable(
    [
      "ID",
      "Client ID",
      "TripType ID",
      "Booking Date",
      "Reference",
      "Status",
      "Actions",
    ],
    rows,
    {
      title: "Bookings",
      subtitle: "Admin can review and remove bookings when needed.",
      sideTitle: "Booking operations",
      sideSubtitle: "Connected to /api/BookingTrip and confirm endpoint.",
      filters: [
        { key: "all", label: "All bookings" },
        { key: "pending", label: "Pending" },
        { key: "confirmed", label: "Confirmed" },
      ],
    },
  );
}

function renderSupportTable() {
  const q = $("globalSearch").value.trim().toLowerCase();
  const rows = state.services
    .filter((s) => !q || safeJsonString(s).includes(q))
    .map(
      (s) => `
          <tr>
            <td>#${pick(s, ["serviceID", "ServiceID"], "—")}</td>
            <td>${pick(s, ["nameService", "NameService"], "Service")}</td>
            <td>${pick(s, ["fees", "Fees"], "—")}</td>
            <td>${statusBadge("Available")}</td>
            <td><div class="rowActions"><button class="softBtn" type="button">View</button></div></td>
          </tr>
        `,
    )
    .join("");

  setTable(["ID", "Service", "Fees", "Status", "Actions"], rows, {
    title: "Operations support",
    subtitle: "Extra supporting data from services endpoint.",
    sideTitle: "Operations shortcuts",
    sideSubtitle: "Useful while admins are handling changes.",
    filters: [{ key: "all", label: "All" }],
  });
}

async function loadDashboardData() {
  $("apiStatus").textContent = "Loading API data...";

  const tasks = await Promise.allSettled([
    apiGet(ENDPOINTS.flightsAll),
    apiGet(ENDPOINTS.bookingsAll),
    apiGet(ENDPOINTS.employeesAll),
    apiGet(ENDPOINTS.userAll),
    apiGet(ENDPOINTS.countriesAll),
    apiGet(ENDPOINTS.servicesAll),
    apiGet(ENDPOINTS.flightCities),
  ]);

  state.flights =
    tasks[0].status === "fulfilled" ? normalizeArray(tasks[0].value) : [];
  state.bookings =
    tasks[1].status === "fulfilled" ? normalizeArray(tasks[1].value) : [];
  state.employees =
    tasks[2].status === "fulfilled" ? normalizeArray(tasks[2].value) : [];
  state.users =
    tasks[3].status === "fulfilled" ? normalizeArray(tasks[3].value) : [];
  state.countries =
    tasks[4].status === "fulfilled" ? normalizeArray(tasks[4].value) : [];
  state.services =
    tasks[5].status === "fulfilled" ? normalizeArray(tasks[5].value) : [];
  state.cities =
    tasks[6].status === "fulfilled" ? normalizeArray(tasks[6].value) : [];

  $("apiStatus").textContent = "API connected";
  renderStats();
  renderActiveTable();
}

const flightFormTemplate = (mode = "create", item = {}) => {
  const submitLabel = mode === "edit" ? "Save changes" : "Create flight";
  const cities = state.cities.length
    ? state.cities
    : ["Amman", "Dubai", "Istanbul", "Doha"];

  const options = cities
    .map((c) => `<option value="${c}">${c}</option>`)
    .join("");

  const from = pick(item, ["departureCity", "DepartureCity"], "");
  const to = pick(item, ["arrivalCity", "ArrivalCity"], "");
  const departureTime = pick(item, ["departureTime", "DepartureTime"], "");
  const arrivalTime = pick(item, ["arrivalTime", "ArrivalTime"], "");
  const basePrice = pick(item, ["basePrice", "BasePrice"], "");

  const date = (() => {
    const v = pick(item, ["flightDate", "FlightDate"], "");
    if (!v) return "";
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return String(v).slice(0, 10);
    const iso = new Date(
      d.getTime() - d.getTimezoneOffset() * 60000,
    ).toISOString();
    return iso.slice(0, 10);
  })();

  const id = getFlightId(item);

  return `
          ${mode === "edit" ? `<input type="hidden" id="flightId" value="${id}" />` : ""}

          <div class="row2">
            <div>
              <label class="fieldLabel">From city</label>
              <div class="inputWrap">
                <span>🛫</span>
                <select id="flightFrom" required>
                  <option value="">Select city</option>
                  ${options}
                </select>
              </div>
            </div>

            <div>
              <label class="fieldLabel">To city</label>
              <div class="inputWrap">
                <span>🛬</span>
                <select id="flightTo" required>
                  <option value="">Select city</option>
                  ${options}
                </select>
              </div>
            </div>
          </div>

          <div class="row3">
            <div>
              <label class="fieldLabel">Flight date</label>
              <div class="inputWrap">
                <span>📅</span>
                <input id="flightDate" type="date" value="${date}" required />
              </div>
            </div>

            <div>
              <label class="fieldLabel">Departure time</label>
              <div class="inputWrap">
                <span>🕘</span>
                <input id="flightDepartureTime" type="time" value="${departureTime}" required />
              </div>
            </div>

            <div>
              <label class="fieldLabel">Arrival time</label>
              <div class="inputWrap">
                <span>🕓</span>
                <input id="flightArrivalTime" type="time" value="${arrivalTime}" required />
              </div>
            </div>
          </div>

          <div>
            <label class="fieldLabel">Base price</label>
            <div class="inputWrap">
              <span>💵</span>
              <input id="flightBasePrice" type="number" min="0" step="0.01" value="${basePrice}" placeholder="e.g. 120" required />
            </div>
          </div>

          <div class="formFooter">
            <button class="softBtn" type="button" id="cancelEditorBtn">Cancel</button>
            <button class="primaryBtn" type="submit">${submitLabel}</button>
          </div>

          <div class="helper">
            This form matches the Swagger DTO for flights:
            <code>departureCity, arrivalCity, departureTime, arrivalTime, flightDate, basePrice</code>
          </div>
        `;
};

function openFlightDrawer(mode = "create", item = null) {
  state.editingItem = item;
  $("drawerTitle").textContent =
    mode === "edit" ? "Edit Flight" : "Create Flight";

  $("drawerSubtitle").textContent =
    mode === "edit"
      ? "Update the flight schedule details and save changes."
      : "Create a new flight schedule from the dashboard.";

  $("editorForm").innerHTML = flightFormTemplate(mode, item || {});
  $("drawerBackdrop").classList.add("show");
  $("editorDrawer").classList.add("show");

  if (item) {
    $("flightFrom").value = pick(item, ["departureCity", "DepartureCity"], "");
    $("flightTo").value = pick(item, ["arrivalCity", "ArrivalCity"], "");
  }
}

function closeFlightDrawer() {
  $("drawerBackdrop").classList.remove("show");
  $("editorDrawer").classList.remove("show");
  state.editingItem = null;
}

function buildFlightDto() {
  return {
    departureCity: $("flightFrom").value,
    arrivalCity: $("flightTo").value,
    departureTime: $("flightDepartureTime").value,
    arrivalTime: $("flightArrivalTime").value,
    flightDate: $("flightDate").value
      ? new Date($("flightDate").value).toISOString()
      : null,
    basePrice: Number($("flightBasePrice").value || 0),
  };
}

async function submitFlightForm(e) {
  e.preventDefault();

  try {
    const dto = buildFlightDto();

    if (!dto.departureCity || !dto.arrivalCity) {
      throw new Error("Please select flight cities.");
    }

    if (dto.departureCity === dto.arrivalCity) {
      throw new Error("From and To cannot be the same.");
    }

    const id = $("flightId")?.value || getFlightId(state.editingItem || {});

    if (id) {
      await apiPut(ENDPOINTS.flightUpdate(id), dto);
      showToast("Flight updated successfully");
    } else {
      await apiPost(ENDPOINTS.flightCreate, dto);
      showToast("Flight created successfully");
    }

    closeFlightDrawer();
    await loadDashboardData();
  } catch (err) {
    showToast(err.message || "Failed to save flight", true);
  }
}

function openRoleModal(userId = "") {
  $("roleUserId").value = userId || "";
  $("roleModalBackdrop").classList.add("show");
}

function closeRoleModal() {
  $("roleModalBackdrop").classList.remove("show");
}

async function submitRoleForm(e) {
  e.preventDefault();

  try {
    const id = $("roleUserId").value;
    const roleId = Number($("roleSelect").value);

    if (!id) {
      throw new Error("User ID is required.");
    }

    const existing = await apiGet(ENDPOINTS.userById(id));

    const body = {
      clientID: Number(pick(existing, ["clientID", "ClientID"], 0)),
      userNameOrEmail: pick(
        existing,
        ["userNameOrEmail", "UserNameOrEmail"],
        "",
      ),
      passwordHash: pick(existing, ["passwordHash", "PasswordHash"], ""),
      isActive: Boolean(pick(existing, ["isActive", "IsActive"], true)),
      roleID: roleId,
      lastLoginAt: pick(existing, ["lastLoginAt", "LastLoginAt"], null),
    };

    await apiPut(ENDPOINTS.userUpdate(id), body);
    showToast("Role updated successfully");
    closeRoleModal();
    await loadDashboardData();
  } catch (err) {
    showToast(err.message || "Failed to update role", true);
  }
}

async function deleteFlight(id) {
  if (!confirm(`Delete flight #${id}?`)) return;

  try {
    await apiDelete(ENDPOINTS.flightDelete(id));
    showToast("Flight deleted");
    await loadDashboardData();
  } catch (err) {
    showToast(err.message || "Delete failed", true);
  }
}

async function deleteBooking(id) {
  if (!confirm(`Delete booking #${id}?`)) return;

  try {
    await apiDelete(ENDPOINTS.bookingDelete(id));
    showToast("Booking deleted");
    await loadDashboardData();
  } catch (err) {
    showToast(err.message || "Delete failed", true);
  }
}

async function confirmBooking(id) {
  try {
    await apiPost(ENDPOINTS.bookingConfirm(id), {});
    showToast(`Booking #${id} confirmed`);
    await loadDashboardData();
  } catch (err) {
    showToast(err.message || "Confirmation failed", true);
  }
}

function handleQuickAction(actionKey) {
  if (actionKey === "createFlight") {
    openFlightDrawer("create");
    return;
  }

  if (actionKey === "assignRole") {
    openRoleModal();
    return;
  }

  if (actionKey === "loadEmployees") {
    loadDashboardData();
    return;
  }

  if (actionKey === "loadBookings") {
    state.tab = "bookings";
    hydrateLayout();
    return;
  }
}

$("logoutBtn").addEventListener("click", logout);

$("sideNav").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-tab]");
  if (!btn) return;
  state.tab = btn.dataset.tab;
  hydrateLayout();
});

$("actionGrid").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-action]");
  if (!btn) return;
  handleQuickAction(btn.dataset.action);
});

$("quickPrimaryBtn").addEventListener("click", () => {
  openFlightDrawer("create");
});

$("globalSearch").addEventListener("input", renderActiveTable);

$("tableBody").addEventListener("click", (e) => {
  const editFlight = e.target.closest("[data-edit-flight]");
  const deleteFlightBtn = e.target.closest("[data-delete-flight]");
  const assignRoleBtn = e.target.closest("[data-assign-role]");
  const confirmBtn = e.target.closest("[data-confirm-booking]");
  const deleteBookingBtn = e.target.closest("[data-delete-booking]");

  if (editFlight) {
    const id = editFlight.dataset.editFlight;
    const item = state.flights.find(
      (f) => String(getFlightId(f)) === String(id),
    );
    openFlightDrawer("edit", item || { flightScheduleID: id });
  }

  if (deleteFlightBtn) {
    deleteFlight(deleteFlightBtn.dataset.deleteFlight);
  }

  if (assignRoleBtn) {
    openRoleModal(assignRoleBtn.dataset.assignRole);
  }

  if (confirmBtn) {
    confirmBooking(confirmBtn.dataset.confirmBooking);
  }

  if (deleteBookingBtn) {
    deleteBooking(deleteBookingBtn.dataset.deleteBooking);
  }
});

$("tableFilters").addEventListener("click", (e) => {
  const chip = e.target.closest("[data-filter]");
  if (!chip) return;
  state.filter = chip.dataset.filter;
  renderActiveTable();
});

$("closeDrawerBtn").addEventListener("click", closeFlightDrawer);
$("drawerBackdrop").addEventListener("click", closeFlightDrawer);

$("editorForm").addEventListener("submit", submitFlightForm);
$("editorForm").addEventListener("click", (e) => {
  if (e.target.id === "cancelEditorBtn") closeFlightDrawer();
});

$("closeRoleModalBtn").addEventListener("click", closeRoleModal);
$("cancelRoleBtn").addEventListener("click", closeRoleModal);
$("roleModalBackdrop").addEventListener("click", (e) => {
  if (e.target === $("roleModalBackdrop")) closeRoleModal();
});
$("roleForm").addEventListener("submit", submitRoleForm);

async function init() {
  if (!state.token) {
    window.location.href = "Login.html";
    return;
  }

  try {
    await loadCurrentUser();
    hydrateLayout();
    await loadDashboardData();
  } catch (err) {
    localStorage.removeItem("auth_token");
    window.location.href = "Login.html";
  }
}

hydrateLayout();
init();
