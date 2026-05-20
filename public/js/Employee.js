
      const API_BASE_URL =
        "https://bookingtrip-api-2026-cyh0f4dhfednh3fj.westeurope-01.azurewebsites.net";

      const ENDPOINTS = {
        userMe: "/api/UserAccount/me",

        flightsAll: "/api/FlightSchedules/All",
        flightById: (id) => `/api/FlightSchedules/${id}`,
        flightUpdate: (id) => `/api/FlightSchedules/${id}`,
        flightCities: "/api/FlightSchedules/Cities",

        bookingsAll: "/api/BookingTrip",
        bookingById: (id) => `/api/BookingTrip/${id}`,
        bookingConfirm: (id) => `/api/BookingTrip/${id}/confirm`,

        servicesAll: "/api/Services/All",
      };

      const state = {
        role: "Employee",
        token: localStorage.getItem("auth_token") || "",
        tab: "flights",
        user: null,
        flights: [],
        bookings: [],
        services: [],
        cities: [],
        filter: "all",
        editingItem: null,
      };

      const view = {
        title: "Employee Dashboard",
        subtitle:
          "Update flights, follow bookings, and help operations run smoothly.",
        primaryLabel: "+ Update Flight",
        nav: [
          { key: "flights", label: "Flights", icon: "??" },
          { key: "bookings", label: "Bookings", icon: "??" },
          { key: "support", label: "Operations", icon: "??" },
        ],
        endpoints: [
          { title: "View flights", path: "GET /api/FlightSchedules/All" },
          { title: "Update flight", path: "PUT /api/FlightSchedules/{id}" },
          { title: "View bookings", path: "GET /api/BookingTrip" },
          {
            title: "Confirm booking",
            path: "POST /api/BookingTrip/{id}/confirm",
          },
          { title: "Services", path: "GET /api/Services/All" },
        ],
        actions: [
          {
            key: "updateFlight",
            title: "Update flight",
            text: "Open the update form and change date, time or price.",
          },
          {
            key: "loadBookings",
            title: "Review bookings",
            text: "Check bookings that may be affected by changes.",
          },
          {
            key: "confirmSample",
            title: "Confirm booking",
            text: "Use the booking confirm endpoint for operational support.",
          },
          {
            key: "loadFlights",
            title: "Refresh flights",
            text: "Load the newest flight list and statuses.",
          },
        ],
      };

      const $ = (id) => document.getElementById(id);

      function showToast(message, isError = false) {
        const el = $("toast");
        el.textContent = message;
        el.style.background = isError
          ? "rgba(190,24,93,.95)"
          : "rgba(15,23,42,.92)";
        el.classList.add("show");
        clearTimeout(showToast._t);
        showToast._t = setTimeout(() => el.classList.remove("show"), 2800);
      }

      function getAuthHeaders() {
        return state.token ? { Authorization: "Bearer " + state.token } : {};
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

      function formatDate(v) {
        if (!v) return "—";
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? String(v) : d.toLocaleString();
      }

      function statusBadge(status) {
        const raw = String(status || "Unknown");
        const s = raw.toLowerCase();
        let cls = "blue";

        if (
          s.includes("confirm") ||
          s.includes("success") ||
          s.includes("active")
        ) {
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
        }

        return `<span class="badge ${cls}">${raw}</span>`;
      }

      function safeJsonString(obj) {
        try {
          return JSON.stringify(obj).toLowerCase();
        } catch {
          return "";
        }
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
          payload.email ||
          payload.Email ||
          payload.unique_name ||
          payload.sub ||
          "";
        return email ? String(email).split("@")[0] : "User";
      }

      async function loadCurrentUser() {
        const decoded = decodeJwt(state.token);
        const basicName = getUserNameFromPayload(decoded);

        try {
          const me = await apiGet(ENDPOINTS.userMe);
          state.user = me || { userNameOrEmail: basicName };
        } catch {
          state.user = { userNameOrEmail: basicName };
        }
      }

      function logout() {
        localStorage.removeItem("auth_token");
        window.location.href = "Login.html";
      }

      function hydrateLayout() {
        $("pageTitle").textContent = view.title;
        $("pageSubtitle").textContent = view.subtitle;
        $("quickPrimaryBtn").textContent = view.primaryLabel;
        $("sidebarRole").textContent = "Employee";

        const displayName =
          pick(
            state.user,
            ["fullName", "FullName", "userNameOrEmail", "UserNameOrEmail"],
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
        const cards = [
          {
            label: "Flights",
            value: state.flights.length,
            sub: "Available to update",
          },
          {
            label: "Bookings",
            value: state.bookings.length,
            sub: "Operational booking list",
          },
          {
            label: "Cities",
            value: state.cities.length,
            sub: "Loaded from cities endpoint",
          },
          {
            label: "Services",
            value: state.services.length,
            sub: "Loaded from services endpoint",
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
        else if (state.tab === "bookings") renderBookingsTable();
        else renderSupportTable();
      }

      function setTable(headers, rowsHtml, meta = {}) {
        $("tableTitle").textContent = meta.title || "Data";
        $("tableSubtitle").textContent = meta.subtitle || "";
        $("tableHeadRow").innerHTML = headers
          .map((h) => `<th>${h}</th>`)
          .join("");
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
            const departureTime = pick(
              f,
              ["departureTime", "DepartureTime"],
              "—",
            );
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
                  <button class="softBtn" type="button" data-edit-flight="${id}">Update</button>
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
            title: "Operational flight schedules",
            subtitle: "Employee can update flight data.",
            sideTitle: "Employee tools",
            sideSubtitle: "Focus on updates and booking operations.",
            filters: [
              { key: "all", label: "All flights" },
              { key: "today", label: "Today" },
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
            const status = String(
              pick(b, ["bookingStatus", "BookingStatus"], ""),
            );
            return confirmed || /confirm/i.test(status);
          });
        }

        const rows = list
          .map((b) => {
            const id = getBookingId(b);
            const client = pick(b, ["clientID", "ClientID"], "—");
            const tripType = pick(b, ["tripTypeID", "TripTypeID"], "—");
            const created = pick(b, ["bookingDate", "BookingDate"], "");
            const bookingRef = pick(
              b,
              ["bookingReference", "BookingReference"],
              "—",
            );
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
            subtitle: "Employee can confirm and follow up on bookings.",
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
          sideSubtitle: "Useful while employees are handling changes.",
          filters: [{ key: "all", label: "All" }],
        });
      }

      async function loadDashboardData() {
        $("apiStatus").textContent = "Loading API data...";

        const tasks = await Promise.allSettled([
          apiGet(ENDPOINTS.flightsAll),
          apiGet(ENDPOINTS.bookingsAll),
          apiGet(ENDPOINTS.servicesAll),
          apiGet(ENDPOINTS.flightCities),
        ]);

        state.flights =
          tasks[0].status === "fulfilled" ? normalizeArray(tasks[0].value) : [];
        state.bookings =
          tasks[1].status === "fulfilled" ? normalizeArray(tasks[1].value) : [];
        state.services =
          tasks[2].status === "fulfilled" ? normalizeArray(tasks[2].value) : [];
        state.cities =
          tasks[3].status === "fulfilled" ? normalizeArray(tasks[3].value) : [];

        $("apiStatus").textContent = "API connected";
        renderStats();
        renderActiveTable();
      }

      const flightFormTemplate = (item = {}) => {
        const cities = state.cities.length
          ? state.cities
          : ["Amman", "Dubai", "Istanbul", "Doha"];

        const options = cities
          .map((c) => `<option value="${c}">${c}</option>`)
          .join("");

        const from = pick(item, ["departureCity", "DepartureCity"], "");
        const to = pick(item, ["arrivalCity", "ArrivalCity"], "");
        const departureTime = pick(
          item,
          ["departureTime", "DepartureTime"],
          "",
        );
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
          <input type="hidden" id="flightId" value="${id}" />

          <div class="row2">
            <div>
              <label class="fieldLabel">From city</label>
              <div class="inputWrap">
                <span>??</span>
                <select id="flightFrom" required>
                  <option value="">Select city</option>
                  ${options}
                </select>
              </div>
            </div>

            <div>
              <label class="fieldLabel">To city</label>
              <div class="inputWrap">
                <span>??</span>
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
                <span>??</span>
                <input id="flightDate" type="date" value="${date}" required />
              </div>
            </div>

            <div>
              <label class="fieldLabel">Departure time</label>
              <div class="inputWrap">
                <span>??</span>
                <input id="flightDepartureTime" type="time" value="${departureTime}" required />
              </div>
            </div>

            <div>
              <label class="fieldLabel">Arrival time</label>
              <div class="inputWrap">
                <span>??</span>
                <input id="flightArrivalTime" type="time" value="${arrivalTime}" required />
              </div>
            </div>
          </div>

          <div>
            <label class="fieldLabel">Base price</label>
            <div class="inputWrap">
              <span>??</span>
              <input id="flightBasePrice" type="number" min="0" step="0.01" value="${basePrice}" placeholder="e.g. 120" required />
            </div>
          </div>

          <div class="formFooter">
            <button class="softBtn" type="button" id="cancelEditorBtn">Cancel</button>
            <button class="primaryBtn" type="submit">Save changes</button>
          </div>
        `;
      };

      function openFlightDrawer(item = null) {
        state.editingItem = item;
        $("drawerTitle").textContent = "Update Flight";
        $("drawerSubtitle").textContent =
          "Update the flight schedule details and save changes.";
        $("editorForm").innerHTML = flightFormTemplate(item || {});
        $("drawerBackdrop").classList.add("show");
        $("editorDrawer").classList.add("show");

        if (item) {
          $("flightFrom").value = pick(
            item,
            ["departureCity", "DepartureCity"],
            "",
          );
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
          const id = $("flightId").value;

          if (!dto.departureCity || !dto.arrivalCity) {
            throw new Error("Please select flight cities.");
          }

          if (dto.departureCity === dto.arrivalCity) {
            throw new Error("From and To cannot be the same.");
          }

          await apiPut(ENDPOINTS.flightUpdate(id), dto);
          showToast("Flight updated successfully");
          closeFlightDrawer();
          await loadDashboardData();
        } catch (err) {
          showToast(err.message || "Failed to save flight", true);
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
        if (actionKey === "updateFlight") {
          const first = state.flights[0];
          if (!first) return showToast("No flights available.", true);
          openFlightDrawer(first);
          return;
        }

        if (actionKey === "loadBookings") {
          state.tab = "bookings";
          hydrateLayout();
          return;
        }

        if (actionKey === "confirmSample") {
          const first = state.bookings[0];
          if (!first) return showToast("No bookings available.", true);
          const id = getBookingId(first);
          if (id) confirmBooking(id);
          return;
        }

        if (actionKey === "loadFlights") {
          loadDashboardData();
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
        const first = state.flights[0];
        if (!first) return showToast("No flights loaded yet.", true);
        openFlightDrawer(first);
      });

      $("globalSearch").addEventListener("input", renderActiveTable);

      $("tableBody").addEventListener("click", (e) => {
        const editFlight = e.target.closest("[data-edit-flight]");
        const confirmBtn = e.target.closest("[data-confirm-booking]");

        if (editFlight) {
          const id = editFlight.dataset.editFlight;
          const item = state.flights.find(
            (f) => String(getFlightId(f)) === String(id),
          );
          openFlightDrawer(item || { flightScheduleID: id });
        }

        if (confirmBtn) {
          confirmBooking(confirmBtn.dataset.confirmBooking);
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
          console.warn(err);
          localStorage.removeItem("auth_token");
          window.location.href = "Login.html";
        }
      }

      hydrateLayout();
      init();
    