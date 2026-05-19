
      /************************************************************
       * ? Doc.html - Robust JS (no style changes)
       * - Reads bookId/ticketId from query OR sessionStorage
       * - Loads countries
       * - Loads booking passengers from multiple possible endpoints
       * - POST passenger as multipart (DocumentFile)
       ************************************************************/

      // ========= CONFIG =========
      const BASE_URL =
        sessionStorage.getItem("API_BASE_URL") ||
        "https://bookingtrip-api-2026-cyh0f4dhfednh3fj.westeurope-01.azurewebsites.net";

      // ???? ???? ?? Prefix ??? ??????
      const PASSENGERS_ENDPOINT_CANDIDATES = [
        (bookId) => `/api/bookings/${bookId}/passengers`,
        (bookId) => `/api/BookingTrip/${bookId}/passengers`,
        (bookId) => `/api/BookingTrip/Passengers/${bookId}`,
        (bookId) => `/api/BookingPassengers/${bookId}`,
      ];

      const endpoints = {
        countries: "/api/Country/All",
      };

      // ========= HELPERS =========
      const $ = (id) => document.getElementById(id);

      function getAuthHeaders() {
        const token = localStorage.getItem("auth_token");
        return token ? { Authorization: "Bearer " + token } : {};
      }

      function getQueryNumber(name) {
        const u = new URL(window.location.href);
        const v = u.searchParams.get(name);
        const n = Number(v);
        return Number.isFinite(n) && n > 0 ? n : null;
      }

      function getBookId() {
        return (
          getQueryNumber("bookId") ||
          Number(sessionStorage.getItem("bookId") || "0") ||
          null
        );
      }

      function getTicketId() {
        return (
          getQueryNumber("ticketId") ||
          Number(sessionStorage.getItem("ticketId") || "0") ||
          null
        );
      }

      function showToast(msg, ok = true) {
        const t = $("toast");
        t.innerHTML = ok
          ? `? <b>Success:</b> ${msg}`
          : `?? <b>Error:</b> ${msg}`;
        t.classList.add("show");
        clearTimeout(showToast._tm);
        showToast._tm = setTimeout(() => t.classList.remove("show"), 3200);
      }

      function isoFromDateOnly(dateStr) {
        if (!dateStr) return "";
        // ???? Z ???? ?? ???? ????? timezone
        return `${dateStr}T00:00:00`;
      }

      function setLoading(btn, loading) {
        btn.disabled = loading;
        btn.style.filter = loading ? "grayscale(.15)" : "";
      }

      function currentDocType() {
        const v = document.querySelector('input[name="docType"]:checked');
        return v ? v.value : "Passport";
      }

      function validateFormHard() {
        const requiredIds = [
          "firstName",
          "lastName",
          "email",
          "phone",
          "birthDate",
          "gender",
          "issueCountryId",
          "expirationDate",
        ];

        for (const id of requiredIds) {
          const el = $(id);
          if (!el || !el.value) {
            el?.focus?.();
            return { ok: false, msg: `Please fill: ${id}` };
          }
        }

        const file = $("docFile")?.files?.[0] || $("docPhoto")?.files?.[0];
        if (!file)
          return { ok: false, msg: "Please select a document (PDF/Photo)." };

        const email = $("email").value.trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          $("email").focus();
          return { ok: false, msg: "Invalid email format." };
        }

        return { ok: true, msg: "OK" };
      }

      function formatDateOnly(iso) {
        if (!iso) return "—";
        if (String(iso).startsWith("0001-01-01")) return "—";
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return "—";
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${y}-${m}-${day}`;
      }

      function escapeHtml(str) {
        return String(str).replace(
          /[&<>"']/g,
          (m) =>
            ({
              "&": "&amp;",
              "<": "&lt;",
              ">": "&gt;",
              '"': "&quot;",
              "'": "&#39;",
            })[m],
        );
      }

      // ========= STATE =========
      let bookId = null;
      let ticketId = null;
      let countries = [];
      let bookingData = null;
      let isSubmitting = false;

      // ========= API =========
      async function parseError(res) {
        const txt = await res.text().catch(() => "");
        try {
          const j = txt ? JSON.parse(txt) : null;
          return (
            j?.detail ||
            j?.message ||
            j?.title ||
            (typeof j === "string" ? j : "") ||
            txt ||
            res.statusText
          );
        } catch {
          return txt || res.statusText;
        }
      }

      async function apiGet(path) {
        const res = await fetch(BASE_URL + path, {
          method: "GET",
          headers: { Accept: "application/json", ...getAuthHeaders() },
        });
        if (!res.ok) throw new Error(await parseError(res));
        const ct = (res.headers.get("content-type") || "").toLowerCase();
        if (ct.includes("application/json")) return await res.json();
        return await res.text();
      }

      async function apiPostMultipart(path, formData) {
        const res = await fetch(BASE_URL + path, {
          method: "POST",
          headers: { ...getAuthHeaders() },
          body: formData,
        });
        if (!res.ok) throw new Error(await parseError(res));
        const ct = (res.headers.get("content-type") || "").toLowerCase();
        if (ct.includes("application/json")) return await res.json();
        return { ok: true };
      }

      async function getBookingPassengersSmart(bookId) {
        let lastErr = null;

        for (const makePath of PASSENGERS_ENDPOINT_CANDIDATES) {
          const path = makePath(bookId);
          try {
            const data = await apiGet(path);
            // ???? ?????? ???? ??? ???? ??????? POST ????
            getBookingPassengersSmart._chosen = path;
            return data;
          } catch (e) {
            lastErr = e;
          }
        }

        throw lastErr || new Error("No passengers endpoint worked.");
      }

      async function postPassengerSmart(bookId, formData) {
        // ?????? ??? ?????? ???? ??? ???? GET
        const chosen = getBookingPassengersSmart._chosen;
        if (chosen) return await apiPostMultipart(chosen, formData);

        // fallback: ???? ?? ????????
        let lastErr = null;
        for (const makePath of PASSENGERS_ENDPOINT_CANDIDATES) {
          const path = makePath(bookId);
          try {
            const data = await apiPostMultipart(path, formData);
            getBookingPassengersSmart._chosen = path;
            return data;
          } catch (e) {
            lastErr = e;
          }
        }
        throw lastErr || new Error("POST passenger failed.");
      }

      // ========= NAV =========
      function goServices() {
        const bid = bookId;
        const tid = ticketId;

        if (bid) sessionStorage.setItem("bookId", String(bid));
        if (tid) sessionStorage.setItem("ticketId", String(tid));

        const url =
          `services.html?bookId=${encodeURIComponent(bid)}` +
          (tid ? `&ticketId=${encodeURIComponent(tid)}` : "");

        window.location.href = url;
      }

      // ========= UI =========
      function renderCountries() {
        const select = $("issueCountryId");
        if (!select) return;

        select.innerHTML = `<option value="" disabled selected>Select Country</option>`;
        for (const c of countries) {
          const opt = document.createElement("option");
          opt.value = String(c.countryID ?? c.CountryID ?? c.id ?? c.ID ?? "");
          opt.textContent =
            c.countryName ?? c.CountryName ?? c.name ?? "Country";
          select.appendChild(opt);
        }
      }

      function setDocStatus(file) {
        const dot = $("docDot");
        const s = $("docStatus");
        if (!dot || !s) return;

        if (file) {
          dot.classList.add("ok");
          dot.classList.remove("bad");
          s.textContent = `Selected: ${file.name} (${Math.ceil(file.size / 1024)} KB)`;
        } else {
          dot.classList.remove("ok");
          dot.classList.remove("bad");
          s.textContent = "No document selected";
        }
      }

      function clearFormButKeepCountry() {
        const keepCountry = $("issueCountryId")?.value || "";

        $("firstName").value = "";
        $("secondName").value = "";
        $("thirdName").value = "";
        $("lastName").value = "";
        $("email").value = "";
        $("phone").value = "";
        $("birthDate").value = "";
        $("gender").value = "";
        $("expirationDate").value = "";

        if (keepCountry) $("issueCountryId").value = keepCountry;

        $("docFile").value = "";
        $("docPhoto").value = "";
        setDocStatus(null);

        const passRadio = document.querySelector(
          'input[name="docType"][value="Passport"]',
        );
        if (passRadio) passRadio.checked = true;
      }

      function normalizeBookingCounters(data) {
        // ????? ???? ??? ???:
        // { bookId, ticketId, expectedPassengers, createdPassengers, passengers: [] }
        const expected = Math.max(
          0,
          Number(data?.expectedPassengers ?? data?.ExpectedPassengers ?? 0),
        );
        const createdRaw = Math.max(
          0,
          Number(data?.createdPassengers ?? data?.CreatedPassengers ?? 0),
        );
        const created =
          expected > 0 ? Math.min(createdRaw, expected) : createdRaw;
        return { expected, created, createdRaw };
      }

      function uniquePassengers(list) {
        const seen = new Set();
        const out = [];
        for (const p of Array.isArray(list) ? list : []) {
          const id =
            p?.passengerId ??
            p?.PassengerId ??
            `${p?.personId}-${p?.firstName}-${p?.lastName}-${p?.birthDate}`;
          if (seen.has(String(id))) continue;
          seen.add(String(id));
          out.push(p);
        }
        return out;
      }

      function renderBooking() {
        if (!bookingData) return;

        const bookVal =
          bookingData.bookId ?? bookingData.BookId ?? bookId ?? "—";

        $("bookBadge").textContent = `Book #${bookVal}`;

        const { expected, created, createdRaw } =
          normalizeBookingCounters(bookingData);
        const done = expected > 0 && created >= expected;

        const currentIndex = done
          ? expected
          : Math.min(created + 1, expected || 1);

        $("progressText").textContent = expected
          ? `${currentIndex} of ${expected} passengers`
          : "Passengers";

        const percent =
          expected > 0 ? Math.min(100, (created / expected) * 100) : 0;
        $("progressFill").style.width = percent + "%";

        $("formTitle").textContent = done
          ? "All passengers completed"
          : `Passenger ${currentIndex} Information`;

        if (done) {
          $("submitText").textContent = "Continue to Services";
          $("submitBtn").disabled = false;
        } else {
          $("submitText").textContent =
            created + 1 === expected ? "Finish" : "Next Passenger";
          $("submitBtn").disabled = false;
        }

        if (!done) clearFormButKeepCountry();
      }

      // ========= LOAD FLOW =========
      async function refreshAll() {
        if (!bookId) {
          showToast(
            "Missing bookId. Open with ?bookId=XX or make sure sessionStorage has bookId",
            false,
          );
          $("progressText").textContent = "Missing bookId";
          $("bookBadge").textContent = "Book #—";
          return;
        }

        try {
          $("progressText").textContent = "Loading…";
          $("bookBadge").textContent = `Book #${bookId}`;

          countries = await apiGet(endpoints.countries);
          if (!Array.isArray(countries)) countries = [];
          renderCountries();

          bookingData = await getBookingPassengersSmart(bookId);

          // default country if empty
          if (!$("issueCountryId").value && countries.length) {
            const firstId =
              countries[0].countryID ?? countries[0].CountryID ?? "";
            if (firstId) $("issueCountryId").value = String(firstId);
          }

          // ???? ????? ticketId ?? API ?????
          const tFromApi =
            Number(bookingData?.ticketId ?? bookingData?.TicketId ?? 0) || 0;
          if (!ticketId && tFromApi) {
            ticketId = tFromApi;
            sessionStorage.setItem("ticketId", String(ticketId));
          }

          renderBooking();
          showToast("Loaded ?", true);
        } catch (err) {
          console.error(err);
          showToast(err.message || "Failed to load data", false);
          $("progressText").textContent = "Load failed";
        }
      }

      // ========= SUBMIT =========
      async function submitPassenger(e) {
        e.preventDefault();

        if (isSubmitting) return;
        if (!bookingData)
          return showToast("Booking data not loaded yet.", false);

        const { expected, created } = normalizeBookingCounters(bookingData);
        const done = expected > 0 && created >= expected;

        if (done) {
          showToast("All passengers are already created.", true);
          goServices();
          return;
        }

        const v = validateFormHard();
        if (!v.ok) return showToast(v.msg, false);

        const btn = $("submitBtn");
        setLoading(btn, true);
        isSubmitting = true;

        try {
          const fd = new FormData();

          // ? names match typical Swagger DTO (case-insensitive ??????)
          fd.append("FirstName", $("firstName").value.trim());
          fd.append("SecondName", $("secondName").value.trim() || "");
          fd.append("ThirdName", $("thirdName").value.trim() || "");
          fd.append("LastName", $("lastName").value.trim());

          fd.append("Email", $("email").value.trim());
          fd.append("Phone", $("phone").value.trim());

          fd.append("BirthDate", isoFromDateOnly($("birthDate").value));
          fd.append("Gender", $("gender").value);

          fd.append(
            "IssueCountryId",
            String(Number($("issueCountryId").value || "0")),
          );
          fd.append("DocumentationType", currentDocType());
          fd.append(
            "ExpirationDate",
            isoFromDateOnly($("expirationDate").value),
          );

          const file = $("docFile").files?.[0] || $("docPhoto").files?.[0];
          fd.append("DocumentFile", file);

          await postPassengerSmart(bookId, fd);

          showToast("Passenger saved successfully.", true);

          bookingData = await getBookingPassengersSmart(bookId);
          renderBooking();

          const { expected: e2, created: c2 } =
            normalizeBookingCounters(bookingData);
          if (e2 > 0 && c2 >= e2) {
            showToast("All passengers completed. Redirecting…", true);
            setTimeout(goServices, 600);
          }
        } catch (err) {
          console.error(err);
          showToast(err.message || "Failed to save passenger", false);
        } finally {
          setLoading(btn, false);
          isSubmitting = false;
        }
      }

      // ========= EVENTS =========
      function wireUploads() {
        const fileInput = $("docFile");
        const photoInput = $("docPhoto");

        $("uploadPdfBtn").addEventListener("click", () => fileInput.click());
        $("uploadPdfBtn").addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") fileInput.click();
        });

        $("takePhotoBtn").addEventListener("click", () => photoInput.click());
        $("takePhotoBtn").addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") photoInput.click();
        });

        fileInput.addEventListener("change", () => {
          const f = fileInput.files?.[0] || null;
          if (f) photoInput.value = "";
          setDocStatus(f);
        });

        photoInput.addEventListener("change", () => {
          const f = photoInput.files?.[0] || null;
          if (f) fileInput.value = "";
          setDocStatus(f);
        });
      }

      // ========= INIT =========
      (function init() {
        bookId = getBookId();
        ticketId = getTicketId();

        if (bookId) sessionStorage.setItem("bookId", String(bookId));
        if (ticketId) sessionStorage.setItem("ticketId", String(ticketId));

        $("passengerForm").addEventListener("submit", submitPassenger);
        $("refreshBtn").addEventListener("click", refreshAll);

        wireUploads();
        refreshAll();
      })();
    