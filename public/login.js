const screens = {
  login: document.getElementById("screen-login"),
  method: document.getElementById("screen-method"),
  otp: document.getElementById("screen-otp"),
  success: document.getElementById("screen-success")
};

const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("loginButton");
const loginError = document.getElementById("loginError");
const togglePassword = document.getElementById("togglePassword");
const methods = [...document.querySelectorAll(".method")];
const otpInputs = [...document.querySelectorAll("#otpInputs input")];
const otpMessage = document.getElementById("otpMessage");
const timerText = document.getElementById("timerText");
const resendButton = document.getElementById("resendButton");
const maskedEmail = document.getElementById("maskedEmail");

let selectedMethod = "email";
let loginChallengeId = null;
let secondsLeft = 165;
let resendSeconds = 25;
let timerInterval = null;
let resendInterval = null;

function showScreen(name) {
  Object.values(screens).forEach(screen => screen.classList.remove("active"));
  screens[name].classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

togglePassword.addEventListener("click", () => {
  const visible = passwordInput.type === "text";
  passwordInput.type = visible ? "password" : "text";
  togglePassword.setAttribute("aria-label", visible ? "Show password" : "Hide password");
});

methods.forEach(method => {
  method.addEventListener("click", () => {
    methods.forEach(item => item.classList.remove("selected"));
    method.classList.add("selected");
    selectedMethod = method.dataset.method;
  });
});

document.getElementById("continueMethod").addEventListener("click", () => {
  if (selectedMethod === "email") {
    showScreen("otp");
    startTimers();
    otpInputs[0].focus();
  } else {
    // These two methods are intentionally visual placeholders for the next MFA stage.
    showScreen("otp");
    document.querySelector("#screen-otp h1").textContent =
      selectedMethod === "sms" ? "SMS Verification" : "Authenticator Verification";
    document.querySelector("#screen-otp .subtitle").innerHTML =
      selectedMethod === "sms"
        ? "Enter the 6-digit code sent to<br /><strong>your mobile number</strong>"
        : "Enter the 6-digit code from your<br /><strong>authenticator app</strong>";
    otpInputs[0].focus();
    startTimers();
  }
});

document.getElementById("otpBack").addEventListener("click", () => {
  showScreen("method");
  stopTimers();
});

document.getElementById("backButton").addEventListener("click", () => {
  window.location.href = "/";
});

otpInputs.forEach((input, index) => {
  input.addEventListener("input", () => {
    input.value = input.value.replace(/\D/g, "").slice(0, 1);
    if (input.value && index < otpInputs.length - 1) {
      otpInputs[index + 1].focus();
    }
    if (index === otpInputs.length - 1 && input.value) {
      verifyLoginOtp();
    }
  });

  input.addEventListener("keydown", event => {
    if (event.key === "Backspace" && !input.value && index > 0) {
      otpInputs[index - 1].focus();
    }
  });

  input.addEventListener("paste", event => {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    pasted.split("").forEach((digit, i) => {
      if (otpInputs[i]) otpInputs[i].value = digit;
    });
    otpInputs[Math.min(pasted.length, 6) - 1].focus();
    if (pasted.length === 6) verifyLoginOtp();
  });
});

loginForm.addEventListener("submit", async event => {
  event.preventDefault();

  loginError.textContent = "";
  document.getElementById("emailWrap").classList.remove("invalid");
  document.getElementById("passwordWrap").classList.remove("invalid");

  const email = emailInput.value.trim();
  const password = passwordInput.value;

  if (!email || !password) {
    loginError.textContent = "Please enter your email and password.";
    return;
  }

  loginButton.disabled = true;
  loginButton.textContent = "Signing in...";

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const result = await response.json();

    if (!response.ok) {
      loginError.textContent = result.message || "Invalid email or password. Please try again.";
      document.getElementById("emailWrap").classList.add("invalid");
      document.getElementById("passwordWrap").classList.add("invalid");
      return;
    }

    loginChallengeId = result.challengeId;
    sessionStorage.setItem("loginChallengeId", loginChallengeId);

    maskedEmail.textContent = result.maskedEmail || email;
    document.querySelector("#screen-otp h1").textContent = "Email Verification";
    document.querySelector("#screen-otp .subtitle").innerHTML =
      `Enter the 6-digit code sent to<br /><strong>${result.maskedEmail || email}</strong>`;

    clearOtp();
    showScreen("method");
  } catch (error) {
    loginError.textContent = "Unable to connect to the server.";
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "Login";
  }
});

async function verifyLoginOtp() {
  const otp = otpInputs.map(input => input.value).join("");

  if (otp.length !== 6 || !loginChallengeId) return;

  otpMessage.className = "message";
  otpMessage.textContent = "";

  try {
    const response = await fetch("/api/verify-login-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        challengeId: loginChallengeId,
        otp
      })
    });

    const result = await response.json();

    if (!response.ok) {
      otpMessage.className = "message error";
      otpMessage.textContent = result.message || "Incorrect code. Please try again.";
      return;
    }

    stopTimers();
    showScreen("success");
  } catch {
    otpMessage.className = "message error";
    otpMessage.textContent = "Unable to verify the code.";
  }
}

resendButton.addEventListener("click", () => {
  // The actual resend endpoint will be added with the OTP stage.
  otpMessage.className = "message";
  otpMessage.textContent = "Resend will be connected to the backend in the OTP stage.";
});

function clearOtp() {
  otpInputs.forEach(input => input.value = "");
  otpMessage.textContent = "";
  otpMessage.className = "message";
}

function startTimers() {
  stopTimers();
  secondsLeft = 165;
  resendSeconds = 25;
  updateTimers();

  timerInterval = setInterval(() => {
    secondsLeft -= 1;
    updateTimers();

    if (secondsLeft <= 0) {
      clearInterval(timerInterval);
      otpMessage.className = "message error";
      otpMessage.textContent = "Code expired.";
    }
  }, 1000);

  resendInterval = setInterval(() => {
    resendSeconds -= 1;
    updateTimers();
    if (resendSeconds <= 0) clearInterval(resendInterval);
  }, 1000);
}

function stopTimers() {
  if (timerInterval) clearInterval(timerInterval);
  if (resendInterval) clearInterval(resendInterval);
  timerInterval = null;
  resendInterval = null;
}

function updateTimers() {
  const minutes = String(Math.max(0, Math.floor(secondsLeft / 60))).padStart(2, "0");
  const seconds = String(Math.max(0, secondsLeft % 60)).padStart(2, "0");
  timerText.innerHTML = secondsLeft > 0
    ? `Code expires in <strong>${minutes}:${seconds}</strong>`
    : `<strong>Code expired.</strong>`;

  const resend = String(Math.max(0, resendSeconds)).padStart(2, "0");
  resendButton.innerHTML = resendSeconds > 0
    ? `Resend code <span>(00:${resend})</span>`
    : `Resend code`;
}
