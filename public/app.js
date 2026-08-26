const form = document.getElementById("registrationForm");
const password = document.getElementById("password");
const togglePassword = document.getElementById("togglePassword");
const button = document.getElementById("createAccountButton");
const formMessage = document.getElementById("formMessage");

const rules = {
  length: value => value.length >= 8,
  uppercase: value => /[A-Z]/.test(value),
  number: value => /\d/.test(value),
  special: value => /[^A-Za-z0-9]/.test(value)
};

function updatePasswordRules() {
  const value = password.value;

  Object.entries(rules).forEach(([name, test]) => {
    const element = document.querySelector(`[data-rule="${name}"]`);
    element.classList.toggle("invalid", !test(value));
  });
}

password.addEventListener("input", updatePasswordRules);

togglePassword.addEventListener("click", () => {
  const showing = password.type === "text";
  password.type = showing ? "password" : "text";
  togglePassword.setAttribute("aria-label", showing ? "Show password" : "Hide password");
  togglePassword.textContent = showing ? "◉" : "◉";
});

function setError(field, message) {
  const input = document.getElementById(field);
  const error = document.querySelector(`[data-error-for="${field}"]`);

  if (input) input.classList.toggle("input-error", Boolean(message));
  if (error) error.textContent = message || "";
}

function clearErrors() {
  ["fullName", "email", "countryCode", "mobileNumber", "password", "termsAccepted"]
    .forEach(field => setError(field, ""));
  formMessage.textContent = "";
  formMessage.className = "form-message";
}

function clientValidate(data) {
  const errors = {};

  if (data.fullName.trim().length < 2) {
    errors.fullName = "Please enter your full name.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
    errors.email = "Enter a valid email address.";
  }

  if (!/^\+\d{1,4}$/.test(data.countryCode)) {
    errors.countryCode = "Select a valid country code.";
  }

  if (!/^\d{7,15}$/.test(data.mobileNumber.replace(/\D/g, ""))) {
    errors.mobileNumber = "Enter a valid mobile number.";
  }

  if (!rules.length(data.password)) {
    errors.password = "Password does not meet the required rules.";
  }

  if (!data.termsAccepted) {
    errors.termsAccepted = "Please accept the Terms & Conditions and Privacy Policy.";
  }

  return errors;
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  clearErrors();

  const data = {
    fullName: document.getElementById("fullName").value,
    email: document.getElementById("email").value,
    countryCode: document.getElementById("countryCode").value,
    mobileNumber: document.getElementById("mobileNumber").value,
    password: password.value,
    termsAccepted: document.getElementById("termsAccepted").checked
  };

  const clientErrors = clientValidate(data);

  if (Object.keys(clientErrors).length) {
    Object.entries(clientErrors).forEach(([field, message]) => setError(field, message));
    return;
  }

  button.disabled = true;
  button.classList.add("loading");
  formMessage.textContent = "";

  try {
    const response = await fetch("/api/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        ...data,
        mobileNumber: data.mobileNumber.replace(/\D/g, "")
      })
    });

    const result = await response.json();

    if (!response.ok) {
      if (result.errors) {
        Object.entries(result.errors).forEach(([field, message]) => {
          setError(field, message);
        });
      }
      throw new Error(result.message || "Registration failed.");
    }

    formMessage.className = "form-message success";
    formMessage.textContent = "Account created. Opening email verification…";

    // Keep this for the next step of the assignment.
    sessionStorage.setItem(
    "registrationChallengeId",
    result.challengeId
);

sessionStorage.setItem(
    "registrationEmail",
    data.email
);

window.location.href =
    "/email-otp.html";

    // For now, we stop here. The next screen will be the Email OTP page.
    console.log("Registration response:", result);
  } catch (error) {
    formMessage.className = "form-message error";
    formMessage.textContent = error.message;
  } finally {
    button.disabled = false;
    button.classList.remove("loading");
  }
});

updatePasswordRules();
