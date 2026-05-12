const API_BASE_URL = "https://localhost:7216";
const LOGIN_ENDPOINT = "/api/Login/login";

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
  return res.json().catch(() => null);
}

// ✅ امسح كل أثر للحساب القديم (مهم جدًا)
function clearAuthStorage() {
  localStorage.removeItem("auth_token");
  localStorage.removeItem("token"); // بعض الصفحات القديمة يمكن تقرأه
  localStorage.removeItem("personID");
  localStorage.removeItem("clientId");
  localStorage.removeItem("userID");
  localStorage.removeItem("email");
  localStorage.removeItem("role");
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
    // ✅ قبل أي login: نظّف القديم
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
      showError(
        data?.message ||
          data?.title ||
          data?.error ||
          "Invalid email or password",
      );
      return;
    }

    // =========================
    // ✅ Normalize response
    // =========================
    const token = data?.token || data?.accessToken || data?.jwt || null;

    const personID = data?.personID ?? data?.personId ?? data?.PersonID ?? null;

    const clientId = data?.clientID ?? data?.clientId ?? data?.ClientID ?? null;

    const userID = data?.userID ?? data?.userId ?? data?.UserID ?? null;

    const role = (data?.role ?? data?.Role ?? "").toString();

    const returnedEmail = data?.email ?? data?.Email ?? email;

    // =========================
    // ✅ Store (ONE source of truth)
    // =========================
    if (!token) {
      showError("Login response did not include a token.");
      return;
    }

    // ✅ خليه الاسم الأساسي auth_token + نظف token القديم
    localStorage.setItem("auth_token", token);
    localStorage.removeItem("token");

    if (personID !== null && personID !== undefined && Number(personID) !== 0) {
      localStorage.setItem("personID", String(personID));
    } else {
      localStorage.removeItem("personID");
    }

    if (clientId !== null && clientId !== undefined && Number(clientId) !== 0) {
      localStorage.setItem("clientId", String(clientId));
    } else {
      localStorage.removeItem("clientId");
    }

    if (userID !== null && userID !== undefined) {
      localStorage.setItem("userID", String(userID));
    }

    if (returnedEmail) localStorage.setItem("email", returnedEmail);
    if (role) localStorage.setItem("role", role);

    // =========================
    // ✅ Redirect
    // =========================
    if (role.toLowerCase() === "admin") {
      window.location.href = "Admin.html";
      return;
    }
    window.location.href = "home.html";
  } catch (err) {
    console.error(err);
    showError(
      "Network error. Check API_BASE_URL, CORS, and whether the API is running.",
    );
  } finally {
    setLoading(false);
  }
});
