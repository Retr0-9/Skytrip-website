
      // =========================
      // API CONFIG
      // =========================
      const API_BASE =
        "https://bookingtrip-api-2026-cyh0f4dhfednh3fj.westeurope-01.azurewebsites.net";
      const ENDPOINT_ME = `${API_BASE}/api/profile/me`;
      const ENDPOINT_COUNTRIES = `${API_BASE}/api/Country/All`;
      const ENDPOINT_PROFILE_IMAGE = `${API_BASE}/api/profile/me/image`;

      const $ = (id) => document.getElementById(id);

      function safe(v, fallback = "—") {
        if (v === null || v === undefined || v === "") return fallback;
        return v;
      }

      function getToken() {
        return localStorage.getItem("token") || "";
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
          if (obj && obj[k] !== undefined && obj[k] !== null && obj[k] !== "")
            return obj[k];
        }
        return null;
      }

      async function fetchJson(url, options = {}) {
        const headers = {
          ...(options.headers || {}),
          Accept: "application/json",
        };

        const token = getToken();
        if (token) headers.Authorization = "Bearer " + token;

        const hasBody = options.body !== undefined && options.body !== null;
        const isFormData = hasBody && options.body instanceof FormData;
        if (hasBody && !isFormData && !headers["Content-Type"]) {
          headers["Content-Type"] = "application/json";
        }

        const res = await fetch(url, {
          ...options,
          headers,
          cache: "no-store",
        });

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

      function showToast(type, msg) {
        const t = $("toast");
        const icon = $("toastIcon");
        const text = $("toastMsg");
        if (!t || !icon || !text) return;

        t.className = "toast show " + (type === "error" ? "error" : "success");
        icon.textContent = type === "error" ? "✖" : "✓";
        text.textContent = msg || (type === "error" ? "Error" : "Success");

        setTimeout(() => {
          t.className = "toast";
        }, 2400);
      }

      function logout() {
        localStorage.removeItem("token");
        localStorage.removeItem("userId");
        localStorage.removeItem("clientId");
        localStorage.removeItem("email");
        window.location.href = "Login.html";
      }

      // =========================
      // AVATAR UI
      // =========================
      function setAvatarUI(imageUrlOrBlobUrl, letter) {
        const mainImg = $("mainAvatarImg");
        const mainLetter = $("mainAvatarLetter");

        const headImg = $("headerAvatarImg");
        const headLetter = $("headerAvatarLetter");

        const L = (letter || "U").toUpperCase();

        if (mainLetter) mainLetter.textContent = L;
        if (headLetter) headLetter.textContent = L;

        if (imageUrlOrBlobUrl) {
          const finalUrl =
            typeof imageUrlOrBlobUrl === "string" &&
            imageUrlOrBlobUrl.startsWith("http")
              ? imageUrlOrBlobUrl
              : typeof imageUrlOrBlobUrl === "string" &&
                  imageUrlOrBlobUrl.startsWith("/")
                ? `${API_BASE}${imageUrlOrBlobUrl}`
                : imageUrlOrBlobUrl; // blob:

          if (mainImg) {
            mainImg.src = finalUrl;
            mainImg.style.display = "block";
          }
          if (mainLetter) mainLetter.style.display = "none";

          if (headImg) {
            headImg.src = finalUrl;
            headImg.style.display = "block";
          }
          if (headLetter) headLetter.style.display = "none";
        } else {
          if (mainImg) mainImg.style.display = "none";
          if (mainLetter) mainLetter.style.display = "block";

          if (headImg) headImg.style.display = "none";
          if (headLetter) headLetter.style.display = "block";
        }
      }

      async function uploadProfileImage(file) {
        const fd = new FormData();
        fd.append("image", file);

        const token = getToken();

        const res = await fetch(ENDPOINT_PROFILE_IMAGE, {
          method: "POST",
          headers: token ? { Authorization: "Bearer " + token } : {},
          body: fd,
        });

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
          throw new Error(msg);
        }

        return body; // { imageUrl: "..." }
      }

      // =========================
      // JWT FILL (UserId/Email/Role)
      // =========================
      function fillFromJwt() {
        const token = getToken();
        const jwt = parseJwt(token) || {};

        const userId =
          claim(
            jwt,
            "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
            "userId",
            "sub",
          ) || localStorage.getItem("userId");

        const email =
          claim(
            jwt,
            "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
            "email",
          ) || localStorage.getItem("email");

        const role = claim(
          jwt,
          "http://schemas.microsoft.com/ws/2008/06/identity/claims/role",
          "role",
        );

        if ($("infoUserId")) $("infoUserId").textContent = safe(userId);
        if ($("infoEmail")) $("infoEmail").textContent = safe(email);
        if ($("displayEmail")) $("displayEmail").textContent = safe(email);
        if ($("displayRole")) $("displayRole").textContent = safe(role);
      }

      let LAST_ME = null;

      // =========================
      // FILL PERSON FROM /me
      // =========================
      function fillPerson(data) {
        const apiEmail =
          data.email ?? data.Email ?? localStorage.getItem("email");
        if (apiEmail) {
          $("infoEmail").textContent = safe(apiEmail);
          $("displayEmail").textContent = safe(apiEmail);
        }

        const fn = data.firstName ?? data.FirstName ?? "";
        const sn = data.secondName ?? data.SecondName ?? "";
        const tn = data.thirdName ?? data.ThirdName ?? "";
        const ln = data.lastName ?? data.LastName ?? "";

        const full =
          [fn, sn, tn, ln].filter(Boolean).join(" ").trim() || "User";
        $("displayName").textContent = full;

        const a = (fn || ln || "U")[0].toUpperCase();
        $("username").textContent = full;

        const phone = safe(data.phone ?? data.Phone);
        $("infoPhone").textContent = phone;
        $("displayPhone").textContent = phone;

        $("infoGender").textContent = safe(data.gender ?? data.Gender);
        $("infoBirthDate").textContent = fmtDate(
          data.birthDate ?? data.BirthDate,
        );

        const cName = data.countryName ?? data.CountryName;
        const cId =
          data.countryId ?? data.CountryId ?? data.countryID ?? data.CountryID;
        const countryText = safe(cName || (cId ? `Country #${cId}` : null));
        $("infoCountry").textContent = countryText;
        $("displayCountry").textContent = countryText;

        const personId =
          data.personId ??
          data.PersonId ??
          data.personID ??
          data.PersonID ??
          null;

        $("infoPersonId").textContent = safe(personId);

        // Fill edit form
        $("firstName").value = fn || "";
        $("secondName").value = sn || "";
        $("thirdName").value = tn || "";
        $("lastName").value = ln || "";
        $("phoneEdit").value = (data.phone ?? data.Phone ?? "") || "";
        $("genderEdit").value = (data.gender ?? data.Gender ?? "") || "";
        $("birthDateEdit").value = toISODateInput(
          data.birthDate ?? data.BirthDate,
        );
        $("countryIdEdit").value = cId ? String(cId) : "";

        $("statusBadge").textContent = "✓ Loaded";
        $("alertBox").className = "alertBox success";
        $("alertBox").innerHTML = `
          <span class="alertIcon">✓</span>
          <div><strong>Profile loaded successfully!</strong> Your information is up to date.</div>
        `;

        // Profile image (supports ProfileImageUrl or profileImageUrl)
        const img =
          data.profileImageUrl ??
          data.ProfileImageUrl ??
          data.profileImage ??
          data.ProfileImage ??
          null;

        setAvatarUI(img, a);

        LAST_ME = data;
      }

      function buildUpdatePayload() {
        const fn = $("firstName").value.trim();
        const sn = $("secondName").value.trim();
        const tn = $("thirdName").value.trim();
        const ln = $("lastName").value.trim();
        const ph = $("phoneEdit").value.trim();
        const gd = $("genderEdit").value.trim();
        const bd = $("birthDateEdit").value;
        const cid = $("countryIdEdit").value.trim();

        // نفس Transaction/Keys عندك (Pascal + CountryID)
        return {
          FirstName: fn || null,
          SecondName: sn || null,
          ThirdName: tn || null,
          LastName: ln || null,
          Phone: ph || null,
          Gender: gd || null,
          BirthDate: bd ? bd : null,
          CountryID: cid ? Number(cid) : null,
        };
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
          console.error("Countries error:", e);
        }
      }

      async function loadProfile() {
        const token = getToken();
        if (!token) {
          window.location.href = "Login.html";
          return;
        }

        fillFromJwt();

        try {
          const me = await fetchJson(ENDPOINT_ME);
          console.log("ME RAW:", me);
          fillPerson(me);
        } catch (e) {
          console.error("Profile error:", e);
          showToast("error", e.message || "Failed to load profile");
          if (e.status === 401 || e.status === 403) logout();
        }
      }

      async function saveMe() {
        try {
          await fetchJson(ENDPOINT_ME, {
            method: "PUT",
            body: JSON.stringify(buildUpdatePayload()),
          });
          showToast("success", "Profile updated");
          await loadProfile();
        } catch (e) {
          console.error("Save error:", e);
          showToast("error", e.message || "Save failed");
        }
      }

      // =========================
      // UI: Edit toggle (same style/transaction)
      // =========================
      function toggleEdit(on) {
        const grid = $("profileGrid");
        const card = $("editCard");
        if (!grid || !card) return;

        if (on) {
          grid.classList.add("editing");
          card.classList.add("active");
        } else {
          grid.classList.remove("editing");
          card.classList.remove("active");
        }
      }

      // =========================
      // Events
      // =========================
      $("btnRefresh")?.addEventListener("click", loadProfile);

      $("btnEdit")?.addEventListener("click", () => {
        const card = $("editCard");
        const isActive = card?.classList.contains("active");
        toggleEdit(!isActive);
      });

      $("editForm")?.addEventListener("submit", (e) => {
        e.preventDefault();
        saveMe();
      });

      $("btnReset")?.addEventListener("click", () => {
        if (LAST_ME) fillPerson(LAST_ME);
      });

      $("btnLogout")?.addEventListener("click", logout);

      // Avatar upload
      $("btnAvatarEdit")?.addEventListener("click", () => {
        $("profileImageInput")?.click();
      });

      $("profileImageInput")?.addEventListener("change", async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Letter from current name
        const currentLetter = ($("mainAvatarLetter")?.textContent || "U")
          .trim()
          .slice(0, 1)
          .toUpperCase();

        // Preview immediately
        const previewUrl = URL.createObjectURL(file);
        setAvatarUI(previewUrl, currentLetter);

        try {
          const result = await uploadProfileImage(file); // { imageUrl }
          const serverImageUrl = result?.imageUrl;

          setAvatarUI(serverImageUrl, currentLetter);
          showToast("success", "Photo updated");

          // update cached
          if (LAST_ME) {
            LAST_ME.ProfileImageUrl = serverImageUrl;
            LAST_ME.profileImageUrl = serverImageUrl;
          }
        } catch (err) {
          console.error(err);
          showToast("error", err.message || "Upload failed");
          await loadProfile();
        } finally {
          e.target.value = "";
          try {
            URL.revokeObjectURL(previewUrl);
          } catch {}
        }
      });

      // Init
      loadCountries();
      loadProfile();
    