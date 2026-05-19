
      /************************************************************
       * Register.js (FULL)
       * - Loads countries into 2 dropdowns:
       *   countryId (person country) + issueCountryId (doc issue country)
       * - Register -> save token/userId/clientId/email
       * - Optional upload profile image after register
       ************************************************************/

      const API_BASE_URL =
        "https://bookingtrip-api-2026-cyh0f4dhfednh3fj.westeurope-01.azurewebsites.net";

      const ENDPOINTS = {
        countries: "/api/Country/All",
        register: "/api/Login/register",
        uploadProfileImage: "/api/profile/me/image",
      };

      const NEXT_PAGE = "Home.html";

      const form = document.getElementById("registerForm");
      const registerBtn = document.getElementById("registerBtn");
      const spinner = document.getElementById("spinner");
      const errorBox = document.getElementById("errorBox");
      const successBox = document.getElementById("successBox");
      const backToLoginBtn = document.getElementById("backToLoginBtn");
      const clearBtn = document.getElementById("clearBtn");
      const resultMini = document.getElementById("resultMini");
      const pillUser = document.getElementById("pillUser");
      const pillClient = document.getElementById("pillClient");

      const countrySelect = document.getElementById("countryId");
      const issueCountrySelect = document.getElementById("issueCountryId");

      const profileImageInput = document.getElementById("profileImage");
      const imgPreviewWrap = document.getElementById("imgPreviewWrap");
      const imgPreview = document.getElementById("imgPreview");

      function setLoading(isLoading) {
        registerBtn.disabled = isLoading;
        spinner.style.display = isLoading ? "inline-block" : "none";
        registerBtn.style.opacity = isLoading ? "0.9" : "1";
      }

      function showError(msg) {
        successBox.style.display = "none";
        errorBox.textContent = msg || "Request failed.";
        errorBox.style.display = "block";
      }

      function showSuccess(msg) {
        errorBox.style.display = "none";
        successBox.textContent = msg || "Success.";
        successBox.style.display = "block";
      }

      function extractErrorMessage(data) {
        if (!data) return "Request failed.";
        if (typeof data === "string") return data;
        return (
          data.detail ||
          data.message ||
          data.error ||
          data.title ||
          (Array.isArray(data.errors) ? data.errors.join(", ") : null) ||
          (data.errors && typeof data.errors === "object"
            ? Object.values(data.errors).flat().join(", ")
            : null) ||
          "Request failed."
        );
      }

      // Show/hide password for both fields
      document.querySelectorAll("[data-toggle]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const targetId = btn.getAttribute("data-toggle");
          const input = document.getElementById(targetId);
          const isPassword = input.type === "password";
          input.type = isPassword ? "text" : "password";
          btn.setAttribute(
            "aria-label",
            isPassword ? "Hide password" : "Show password",
          );
        });
      });

      // Profile image preview
      profileImageInput?.addEventListener("change", () => {
        const f = profileImageInput.files?.[0];
        if (!f) {
          imgPreviewWrap.style.display = "none";
          imgPreview.removeAttribute("src");
          return;
        }
        imgPreview.src = URL.createObjectURL(f);
        imgPreviewWrap.style.display = "block";
      });

      function toIsoDateOrNull(v) {
        return v ? v : null; // yyyy-mm-dd
      }

      function clearAuthStorage() {
        localStorage.removeItem("token");
        localStorage.removeItem("userId");
        localStorage.removeItem("clientId");
        localStorage.removeItem("email");
        localStorage.removeItem("profileImageUrl");
      }

      function saveAuthStorage({ token, userId, clientId, email }) {
        localStorage.setItem("token", token);
        localStorage.setItem("userId", String(userId));
        localStorage.setItem("clientId", String(clientId));
        if (email) localStorage.setItem("email", String(email));
      }

      async function readBody(res) {
        const text = await res.text().catch(() => "");
        if (!text) return null;
        try {
          return JSON.parse(text);
        } catch {
          return text;
        }
      }

      async function apiFetch(url, options = {}) {
        const headers = {
          Accept: "application/json, text/plain, */*",
          ...(options.headers || {}),
        };

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
        const body = await readBody(res);

        if (!res.ok) {
          throw new Error(extractErrorMessage(body) || `HTTP ${res.status}`);
        }
        return body;
      }

      async function loadCountriesIntoSelects() {
        countrySelect.innerHTML = `<option value="">Loading countries...</option>`;
        issueCountrySelect.innerHTML = `<option value="">Loading countries...</option>`;

        try {
          const data = await apiFetch(API_BASE_URL + ENDPOINTS.countries, {
            method: "GET",
          });

          const list = Array.isArray(data) ? data : [];

          const baseOpt = `<option value="">Select country</option>`;
          countrySelect.innerHTML = baseOpt;
          issueCountrySelect.innerHTML = baseOpt;

          list.forEach((c) => {
            const id = c.countryID ?? c.countryId ?? c.CountryID ?? c.CountryId;
            const name =
              c.countryName ?? c.CountryName ?? (id ? `Country #${id}` : null);
            if (!id || !name) return;

            const opt = document.createElement("option");
            opt.value = String(id);
            opt.textContent = name;
            countrySelect.appendChild(opt);

            const opt2 = document.createElement("option");
            opt2.value = String(id);
            opt2.textContent = name;
            issueCountrySelect.appendChild(opt2);
          });
        } catch (e) {
          console.error("Countries load failed:", e);
          countrySelect.innerHTML = `<option value="">(Failed to load countries)</option>`;
          issueCountrySelect.innerHTML = `<option value="">(Failed to load countries)</option>`;
          showError("Failed to load countries.");
        }
      }

      async function uploadProfileImage(file, token) {
        const fd = new FormData();
        // ? ???? ??? ????? "image" ???? ????? API
        fd.append("image", file);

        const res = await fetch(API_BASE_URL + ENDPOINTS.uploadProfileImage, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
          body: fd,
        });

        const body = await readBody(res);
        if (!res.ok) throw new Error(extractErrorMessage(body));
        return body; // { imageUrl: "/uploads/profiles/..." }
      }

      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        errorBox.style.display = "none";
        successBox.style.display = "none";
        resultMini.style.display = "none";

        clearAuthStorage();

        const email = form.email.value.trim();
        const password = form.password.value;
        const confirmPassword = form.confirmPassword.value;

        if (!email || !password || !confirmPassword) {
          showError("All account fields are required.");
          return;
        }
        if (password.length < 6) {
          showError("Password must be at least 6 characters.");
          return;
        }
        if (password !== confirmPassword) {
          showError("Passwords do not match.");
          return;
        }

        const firstName = form.firstName.value.trim();
        const lastName = form.lastName.value.trim();

        const countryId = Number(countrySelect.value || 0) || 0;

        const documentationType = form.documentationType.value;
        const issueCountryId = Number(issueCountrySelect.value || 0) || 0;
        const expirationDate = form.expirationDate.value;

        if (!firstName || !lastName || !countryId) {
          showError("First Name, Last Name, and Country are required.");
          return;
        }
        if (!documentationType || !issueCountryId || !expirationDate) {
          showError(
            "Documentation Type, Issue Country, and Expiration Date are required.",
          );
          return;
        }

        const payload = {
          email,
          password,

          firstName,
          secondName: form.secondName.value.trim() || null,
          thirdName: form.thirdName.value.trim() || null,
          lastName,

          phone: form.phone.value.trim() || null,
          gender: form.gender.value || null,
          countryID: countryId,
          birthDate: toIsoDateOrNull(form.birthDate.value),

          documentationType,
          issueCountryID: issueCountryId,
          expirationDate: expirationDate,
        };

        setLoading(true);

        try {
          const data = await apiFetch(API_BASE_URL + ENDPOINTS.register, {
            method: "POST",
            body: JSON.stringify(payload),
          });

          const token = data?.token ?? data?.Token ?? null;
          const userId = data?.userId ?? data?.userID ?? data?.UserID ?? null;
          const clientId =
            data?.clientId ?? data?.clientID ?? data?.ClientID ?? null;

          if (!token || !userId || !clientId) {
            console.log("REGISTER RESPONSE RAW:", data);
            showError(
              "Register succeeded but token/userId/clientId missing in response.",
            );
            return;
          }

          saveAuthStorage({ token, userId, clientId, email });

          pillUser.textContent = `UserID: ${userId}`;
          pillClient.textContent = `ClientID: ${clientId}`;
          resultMini.style.display = "block";

          showSuccess("Registered ? (logged in automatically)");

          // ? optional upload profile image
          const file = document.getElementById("profileImage").files?.[0];
          if (file) {
            try {
              const up = await uploadProfileImage(file, token);
              if (up?.imageUrl)
                localStorage.setItem("profileImageUrl", up.imageUrl);
              showSuccess("Registered ? and profile image uploaded ?");
            } catch (uploadErr) {
              showError(
                `Registered ? ??? ??? ??? ???? ?????????: ${uploadErr?.message || "Upload failed"}`,
              );
            }
          }

          setTimeout(() => {
            window.location.href = NEXT_PAGE;
          }, 400);
        } catch (err) {
          console.error(err);
          showError(err?.message || "Network error or API not reachable.");
        } finally {
          setLoading(false);
        }
      });

      backToLoginBtn.addEventListener("click", () => {
        window.location.href = "Login.html";
      });

      clearBtn.addEventListener("click", () => {
        form.reset();
        errorBox.style.display = "none";
        successBox.style.display = "none";
        resultMini.style.display = "none";
        imgPreviewWrap.style.display = "none";
        imgPreview.removeAttribute("src");
        loadCountriesIntoSelects();
      });

      document.addEventListener("DOMContentLoaded", () => {
        loadCountriesIntoSelects();
      });
    