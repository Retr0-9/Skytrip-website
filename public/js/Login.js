
      const API_BASE_URL =
        "https://bookingtrip-api-2026-cyh0f4dhfednh3fj.westeurope-01.azurewebsites.net";
      const LOGIN_ENDPOINT = "/api/Login/login";
      const NEXT_PAGE = "../index.html";

      const form = document.getElementById("loginForm");
      const signInBtn = document.getElementById("signInBtn");
      const spinner = document.getElementById("spinner");
      const errorBox = document.getElementById("errorBox");
      const successBox = document.getElementById("successBox");
      const togglePass = document.getElementById("togglePass");
      const passwordInput = document.getElementById("password");
      const signUpLink = document.getElementById("signUpLink");

      function setLoading(isLoading) {
        signInBtn.disabled = isLoading;
        spinner.style.display = isLoading ? "inline-block" : "none";
        signInBtn.style.opacity = isLoading ? "0.9" : "1";
      }

      function showError(msg) {
        successBox.style.display = "none";
        errorBox.textContent = msg || "Login failed.";
        errorBox.style.display = "block";
      }

      function showSuccess(msg) {
        errorBox.style.display = "none";
        successBox.textContent = msg || "Success.";
        successBox.style.display = "block";
      }

      function safeJson(res) {
        return res.text().then((t) => {
          try {
            return t ? JSON.parse(t) : null;
          } catch {
            return t;
          }
        });
      }

      // ? ???? ??? ???????? (?? localStorage ???)
      function clearAuthStorage() {
        [
          "token",
          "auth_token",
          "userId",
          "userID",
          "clientId",
          "clientID",
          "personId",
          "personID",
          "email",
          "role",
        ].forEach((k) => localStorage.removeItem(k));
      }

      // ? Decode JWT payload
      function parseJwt(token) {
        try {
          const payload = token.split(".")[1];
          const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
          return JSON.parse(decodeURIComponent(escape(json)));
        } catch {
          return null;
        }
      }

      // ? ????? claims ?????? ??????
      function pick(obj, ...keys) {
        for (const k of keys) {
          const v = obj?.[k];
          if (v !== undefined && v !== null && v !== "") return v;
        }
        return null;
      }

      togglePass?.addEventListener("click", () => {
        const isPassword = passwordInput.type === "password";
        passwordInput.type = isPassword ? "text" : "password";
        togglePass.setAttribute(
          "aria-label",
          isPassword ? "Hide password" : "Show password",
        );
      });

      signUpLink?.addEventListener("click", (e) => {
        e.preventDefault();
        window.location.href = "Register.html";
      });

      form.addEventListener("submit", async (e) => {
        e.preventDefault();

        errorBox.style.display = "none";
        successBox.style.display = "none";

        const email = form.email.value.trim();
        const password = form.password.value;

        if (!email || !password) {
          showError("Email and password are required.");
          return;
        }

        setLoading(true);

        try {
          clearAuthStorage();

          const res = await fetch(API_BASE_URL + LOGIN_ENDPOINT, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Accept: "application/json",
            },
            body: JSON.stringify({ email, password }),
          });

          const data = await safeJson(res);

          if (!res.ok) {
            const msg =
              (data &&
                (data.message || data.title || data.error || data.detail)) ||
              "Invalid email or password";
            showError(msg);
            return;
          }

          // =========================
          // ? 1) token from response
          // =========================
          const token =
            data?.token ||
            data?.Token ||
            data?.accessToken ||
            data?.jwt ||
            null;

          if (!token) {
            console.log("LOGIN RESPONSE:", data);
            showError("Login response did not include a token.");
            return;
          }

          // ? ??? ????: ???? ?????? ???????? ???? ?????? ????????
          localStorage.setItem("token", token);
          // optional backward compatibility:
          localStorage.setItem("auth_token", token);

          // =========================
          // ? 2) Try read ids from response, if missing decode JWT
          // =========================
          let userId =
            data?.userId ??
            data?.userID ??
            data?.UserId ??
            data?.UserID ??
            null;
          let clientId =
            data?.clientId ??
            data?.clientID ??
            data?.ClientId ??
            data?.ClientID ??
            null;
          let personId =
            data?.personId ??
            data?.personID ??
            data?.PersonId ??
            data?.PersonID ??
            null;
          let role = (data?.role ?? data?.Role ?? "").toString();
          let returnedEmail = data?.email ?? data?.Email ?? email;

          const jwt = parseJwt(token);
          if (jwt) {
            // UserID
            userId =
              userId ??
              pick(
                jwt,
                "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier",
                "userId",
                "UserId",
                "sub",
              );

            // Role
            role =
              role ||
              pick(
                jwt,
                "http://schemas.microsoft.com/ws/2008/06/identity/claims/role",
                "role",
                "Role",
              ) ||
              "";

            // Email
            returnedEmail =
              returnedEmail ||
              pick(
                jwt,
                "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress",
                "email",
                "Email",
              ) ||
              email;

            // personId/clientId claims (?? ???? ??? ?????? ????????)
            personId =
              personId ?? pick(jwt, "personId", "personID", "PersonId");
            clientId =
              clientId ?? pick(jwt, "clientId", "clientID", "ClientId");
          }

          // =========================
          // ? 3) Store normalized keys ONLY
          // =========================
          if (userId) localStorage.setItem("userId", String(userId));
          if (clientId) localStorage.setItem("clientId", String(clientId));
          if (personId) localStorage.setItem("personId", String(personId));
          if (returnedEmail)
            localStorage.setItem("email", String(returnedEmail));
          if (role) localStorage.setItem("role", String(role));

          showSuccess("Login successful ?");

          // =========================
          // ? 4) Redirect
          // =========================
          if (role.toLowerCase() === "admin") {
            window.location.href = "Admin.html";
            return;
          }
          if (role.toLowerCase() === "employee") {
            window.location.href = "Employee.html";
            return;
          }
          if (role.toLowerCase() === "client") {
            window.location.href = "../index.html";
            return;
          }
          window.location.href = NEXT_PAGE;
        } catch (err) {
          console.error(err);
          showError(
            "Network error. Check API_BASE_URL, CORS, and whether the API is running.",
          );
        } finally {
          setLoading(false);
        }
      });
    