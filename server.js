const express = require("express");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcryptjs");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");

const app = express();
const JWT_SECRET =
  process.env.JWT_SECRET || crypto.randomBytes(32).toString("hex");
const PORT = process.env.PORT || 3000;
app.use(cookieParser());

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// Assignment/demo storage.
// Replace these Maps with a database in the next stage.
const users = new Map();
const challenges = new Map();
const sessions = new Map();

const OTP_EXPIRY_MS = 3 * 60 * 1000;
const MAX_OTP_ATTEMPTS = 3;

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validPassword(password) {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

function validPhone(phone) {
  return /^\d{7,15}$/.test(phone);
}

function generateOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

app.post("/api/register", async (req, res) => {
  try {
    const {
      fullName,
      email,
      countryCode,
      mobileNumber,
      password,
      termsAccepted
    } = req.body;

    const normalizedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";
    const normalizedName =
      typeof fullName === "string" ? fullName.trim() : "";
    const normalizedCountry =
      typeof countryCode === "string" ? countryCode.trim() : "";
    const normalizedMobile =
      typeof mobileNumber === "string"
        ? mobileNumber.replace(/\D/g, "")
        : "";

    const errors = {};

    if (normalizedName.length < 2) {
      errors.fullName = "Please enter your full name.";
    }

    if (!validEmail(normalizedEmail)) {
      errors.email = "Enter a valid email address.";
    }

    if (!/^\+\d{1,4}$/.test(normalizedCountry)) {
      errors.countryCode = "Enter a valid country code.";
    }

    if (!validPhone(normalizedMobile)) {
      errors.mobileNumber = "Enter a valid mobile number.";
    }

    if (!validPassword(password)) {
      errors.password =
        "Password must contain 8+ characters, uppercase, lowercase, number and special character.";
    }

    if (termsAccepted !== true) {
      errors.termsAccepted = "You must accept the Terms & Conditions and Privacy Policy.";
    }

    if (Object.keys(errors).length) {
      return res.status(400).json({
        message: "Please correct the highlighted fields.",
        errors
      });
    }

    if (users.has(normalizedEmail)) {
      return res.status(409).json({
        message: "An account with this email already exists.",
        errors: { email: "Email is already registered." }
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const userId = crypto.randomUUID();
    users.set(normalizedEmail, {
      id: userId,
      fullName: normalizedName,
      email: normalizedEmail,
      countryCode: normalizedCountry,
      mobileNumber: normalizedMobile,
      passwordHash,
      emailVerified: false,
      mobileVerified: false,
      mfaEnabled: false,
      createdAt: new Date().toISOString()
    });
app.post("/api/verify-email-otp", (req, res) => {
  try {
    const { challengeId, otp } = req.body;

    if (
      typeof challengeId !== "string" ||
      typeof otp !== "string" ||
      !/^\d{6}$/.test(otp)
    ) {
      return res.status(400).json({
        message: "Enter the 6-digit verification code."
      });
    }

    const challenge = challenges.get(challengeId);

    if (
      !challenge ||
      challenge.channel !== "email" ||
      challenge.used
    ) {
      return res.status(400).json({
        message: "This verification code is no longer valid."
      });
      
    }

    if (Date.now() > challenge.expiresAt) {
      return res.status(410).json({
        message: "Your verification code has expired.",
        expired: true
      });
    }

    if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({
        message: "Maximum attempts reached. Please request a new code.",
        maxAttempts: true
      });
    }

    challenge.attempts += 1;

    const otpHash = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex");

    if (otpHash !== challenge.otpHash) {
      const remainingAttempts =
        MAX_OTP_ATTEMPTS - challenge.attempts;

      return res.status(401).json({
        message: "Incorrect verification code.",
        remainingAttempts
      });
    }

    challenge.used = true;

    const user = [...users.values()].find(
      user => user.id === challenge.userId
    );

    if (!user) {
      return res.status(404).json({
        message: "User account not found."
      });
    }

    user.emailVerified = true;

    return res.json({
      message: "Email verified successfully.",
      verified: true,
      userId: user.id
    });

  } catch (error) {
    console.error("Email OTP verification error:", error);

    return res.status(500).json({
      message: "Unable to verify the email code."
    });
  }
});
    const challengeId = crypto.randomUUID();
    const otp = generateOtp();

    challenges.set(challengeId, {
      challengeId,
      userId,
      channel: "email",
      otpHash: crypto.createHash("sha256").update(otp).digest("hex"),
      expiresAt: Date.now() + OTP_EXPIRY_MS,
      attempts: 0,
      used: false
    });

    // Simulated email delivery for the assignment.
    console.log("\n[SIMULATED EMAIL]");
    console.log(`To: ${normalizedEmail}`);
    console.log(`OTP: ${otp}`);
    console.log(`Challenge ID: ${challengeId}\n`);

    // IMPORTANT: the OTP is deliberately not returned to the browser.
    return res.status(201).json({
      message: "Account created. Email verification is required.",
      challengeId,
      next: "email-otp"
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Unable to create the account." });
  }
});
// ---------------- REGISTRATION SMS OTP ----------------

app.post("/api/send-sms-otp", (req, res) => {
  const { userId } = req.body;

  if (typeof userId !== "string") {
    return res.status(400).json({
      message: "A valid userId is required."
    });
  }

  const user = [...users.values()].find(
    candidate => candidate.id === userId
  );

  if (!user) {
    return res.status(404).json({
      message: "User account not found."
    });
  }

  if (!user.emailVerified) {
    return res.status(403).json({
      message: "Please verify your email first."
    });
  }

  const mobileNumber =
    user.mobileNumber ||
    user.mobile ||
    user.phone;

  if (!mobileNumber) {
    return res.status(400).json({
      message: "No mobile number is registered for this account."
    });
  }

  const challengeId = crypto.randomUUID();
  const otp = generateOtp();

  challenges.set(challengeId, {
    challengeId,
    userId: user.id,
    channel: "sms",
    otpHash: crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex"),
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    attempts: 0,
    used: false
  });

  console.log("\n[SIMULATED SMS]");
  console.log(`To: ${mobileNumber}`);
  console.log(`OTP: ${otp}`);
  console.log(`Challenge ID: ${challengeId}\n`);

  return res.json({
    message: "SMS verification code sent.",
    challengeId,
    mobileNumber: maskMobileNumber(mobileNumber),
    expiresInSeconds: OTP_EXPIRY_MS / 1000
  });
});


app.post("/api/verify-sms-otp", (req, res) => {
  const { challengeId, otp } = req.body;

  if (
    typeof challengeId !== "string" ||
    typeof otp !== "string" ||
    !/^\d{6}$/.test(otp)
  ) {
    return res.status(400).json({
      message: "Enter the 6-digit verification code."
    });
  }

  const challenge = challenges.get(challengeId);

  if (
    !challenge ||
    challenge.channel !== "sms" ||
    challenge.used
  ) {
    return res.status(400).json({
      message: "This verification code is no longer valid."
    });
  }

  if (Date.now() > challenge.expiresAt) {
    return res.status(410).json({
      message: "Code expired.",
      expired: true
    });
  }

  if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
    return res.status(429).json({
      message: "Maximum attempts reached. Please request a new code.",
      maxAttempts: true
    });
  }

  challenge.attempts += 1;

  const incomingHash = crypto
    .createHash("sha256")
    .update(otp)
    .digest("hex");

  if (incomingHash !== challenge.otpHash) {
    const remaining = Math.max(
      0,
      MAX_OTP_ATTEMPTS - challenge.attempts
    );

    return res.status(401).json({
      message: "Incorrect code. Please try again.",
      remainingAttempts: remaining
    });
  }

  challenge.used = true;

  const user = [...users.values()].find(
    candidate => candidate.id === challenge.userId
  );

  if (!user) {
    return res.status(404).json({
      message: "User account not found."
    });
  }

  user.mobileVerified = true;

  return res.json({
    message: "Mobile number verified successfully.",
    verified: true,
    userId: user.id,
    next: "mfa-setup"
  });
});
app.post("/api/complete-registration", (req, res) => {
    try {

        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                message: "User ID is required."
            });
        }


        const user =
            [...users.values()].find(
                user => user.id === userId
            );


        if (!user) {
            return res.status(404).json({
                message: "User not found."
            });
        }


        if (!user.emailVerified) {
            return res.status(403).json({
                message:
                    "Email verification is incomplete."
            });
        }


        if (!user.mobileVerified) {
            return res.status(403).json({
                message:
                    "Mobile verification is incomplete."
            });
        }


        user.mfaEnabled = true;


        return res.json({
            message:
                "MFA enabled successfully.",
            mfaEnabled: true,
            registrationComplete: true
        });

    } catch (error) {

        console.error(
            "Registration completion error:",
            error
        );

        return res.status(500).json({
            message:
                "Unable to complete registration."
        });
    }
});

app.post("/api/resend-sms-otp", (req, res) => {
  const { challengeId } = req.body;

  if (typeof challengeId !== "string") {
    return res.status(400).json({
      message: "A valid challengeId is required."
    });
  }

  const oldChallenge = challenges.get(challengeId);

  if (
    !oldChallenge ||
    oldChallenge.channel !== "sms"
  ) {
    return res.status(404).json({
      message: "Verification challenge not found."
    });
  }

  const user = [...users.values()].find(
    candidate => candidate.id === oldChallenge.userId
  );

  if (!user) {
    return res.status(404).json({
      message: "User account not found."
    });
  }

  oldChallenge.used = true;

  const mobileNumber =
    user.mobileNumber ||
    user.mobile ||
    user.phone;

  const newChallengeId = crypto.randomUUID();
  const otp = generateOtp();

  challenges.set(newChallengeId, {
    challengeId: newChallengeId,
    userId: user.id,
    channel: "sms",
    otpHash: crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex"),
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    attempts: 0,
    used: false
  });

  console.log("\n[SIMULATED SMS]");
  console.log(`To: ${mobileNumber}`);
  console.log(`OTP: ${otp}`);
  console.log(`Challenge ID: ${newChallengeId}\n`);

  return res.json({
    message: "A new SMS verification code has been sent.",
    challengeId: newChallengeId,
    mobileNumber: maskMobileNumber(mobileNumber),
    expiresInSeconds: OTP_EXPIRY_MS / 1000
  });
});


function maskMobileNumber(number) {
  const value = String(number);

  if (value.length <= 4) {
    return value;
  }

  return value.slice(0, 3) +
    " " +
    "•••• " +
    value.slice(-4);
}

// ---------------- LOGIN ----------------

const loginFailures = new Map();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_MS = 5 * 60 * 1000;

function getLoginFailure(email) {
  return loginFailures.get(email) || { count: 0, lockedUntil: 0 };
}

function registerLoginFailure(email) {
  const current = getLoginFailure(email);
  current.count += 1;

  if (current.count >= MAX_LOGIN_ATTEMPTS) {
    current.lockedUntil = Date.now() + LOCKOUT_MS;
  }

  loginFailures.set(email, current);
  return current;
}

function clearLoginFailures(email) {
  loginFailures.delete(email);
}

function createOtpChallenge(user, channel = "email") {
  const challengeId = crypto.randomUUID();
  const otp = generateOtp();

  challenges.set(challengeId, {
    challengeId,
    userId: user.id,
    channel,
    otpHash: crypto.createHash("sha256").update(otp).digest("hex"),
    expiresAt: Date.now() + OTP_EXPIRY_MS,
    attempts: 0,
    used: false
  });

  console.log(`\n[SIMULATED ${channel.toUpperCase()}]`);
  console.log(`To: ${channel === "email" ? user.email : user.countryCode + user.mobileNumber}`);
  console.log(`OTP: ${otp}`);
  console.log(`Challenge ID: ${challengeId}\n`);

  return challengeId;
}

app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});
// ===============================
// LOGIN
// ===============================

app.post("/api/login", async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    const normalizedEmail =
      typeof email === "string"
        ? email.trim().toLowerCase()
        : "";

    if (!normalizedEmail || typeof password !== "string") {
      return res.status(400).json({
        message: "Email and password are required."
      });
    }

    const user = users.get(normalizedEmail);

    // Generic error prevents revealing whether
    // an email account exists.
    if (!user) {
      return res.status(401).json({
        message: "Invalid email or password."
      });
    }

    // Create login security fields if they don't exist.
    if (typeof user.failedLoginAttempts !== "number") {
      user.failedLoginAttempts = 0;
    }

    if (!user.lockedUntil) {
      user.lockedUntil = null;
    }

    // Temporary lockout: 5 minutes
    if (
      user.lockedUntil &&
      Date.now() < user.lockedUntil
    ) {
      const remaining =
        Math.ceil(
          (user.lockedUntil - Date.now()) / 1000
        );

      return res.status(423).json({
        message:
          "Account temporarily locked. Please try again later.",
        locked: true,
        retryAfter: remaining
      });
    }

    // Clear expired lock
    if (
      user.lockedUntil &&
      Date.now() >= user.lockedUntil
    ) {
      user.lockedUntil = null;
      user.failedLoginAttempts = 0;
    }

    const passwordCorrect =
      await bcrypt.compare(
        password,
        user.passwordHash
      );

    if (!passwordCorrect) {

      user.failedLoginAttempts += 1;

      // Lock after 5 failed attempts
      if (user.failedLoginAttempts >= 5) {

        user.lockedUntil =
          Date.now() + (5 * 60 * 1000);

        user.failedLoginAttempts = 0;

        return res.status(423).json({
          message:
            "Too many failed attempts. Your account is temporarily locked.",
          locked: true
        });
      }

      return res.status(401).json({
        message: "Invalid email or password.",
        attemptsRemaining:
          5 - user.failedLoginAttempts
      });
    }

    // Correct credentials
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;

    // Registration must be completely verified
    if (
      !user.emailVerified ||
      !user.mobileVerified ||
      !user.mfaEnabled
    ) {
      return res.status(403).json({
        message:
          "Your account registration is incomplete."
      });
    }

    // Generate login MFA OTP
    const challengeId =
      crypto.randomUUID();

    const otp =
      generateOtp();

    challenges.set(challengeId, {
      challengeId,
      userId: user.id,
      channel: "email",
      purpose: "login",
      otpHash:
        crypto
          .createHash("sha256")
          .update(otp)
          .digest("hex"),
      expiresAt:
        Date.now() + OTP_EXPIRY_MS,
      attempts: 0,
      used: false
    });

    console.log("\n[SIMULATED LOGIN EMAIL]");
    console.log(`To: ${user.email}`);
    console.log(`OTP: ${otp}`);
    console.log(`Challenge ID: ${challengeId}\n`);

    return res.json({
      message:
        "Credentials verified. MFA is required.",
      mfaRequired: true,
      method: "email",
      challengeId,
      rememberMe: rememberMe === true
    });

  } catch (error) {

    console.error(
      "Login error:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to process login."
    });
  }
});
// ===============================
// VERIFY LOGIN OTP
// ===============================

app.post("/api/verify-login-otp", (req, res) => {
  try {
    const { challengeId, otp, rememberMe } = req.body;

    if (
      typeof challengeId !== "string" ||
      typeof otp !== "string" ||
      !/^\d{6}$/.test(otp)
    ) {
      return res.status(400).json({
        message: "Enter the 6-digit verification code."
      });
    }

    const challenge = challenges.get(challengeId);

    if (
      !challenge ||
      challenge.channel !== "email" ||
      challenge.purpose !== "login" ||
      challenge.used
    ) {
      return res.status(400).json({
        message: "This verification code is no longer valid."
      });
    }

    if (Date.now() > challenge.expiresAt) {
      return res.status(410).json({
        message: "Your verification code has expired.",
        expired: true
      });
    }

    if (challenge.attempts >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({
        message: "Maximum attempts reached.",
        maxAttempts: true
      });
    }

    challenge.attempts += 1;

    const otpHash = crypto
      .createHash("sha256")
      .update(otp)
      .digest("hex");

    if (otpHash !== challenge.otpHash) {
      return res.status(401).json({
        message: "Incorrect verification code.",
        remainingAttempts:
          MAX_OTP_ATTEMPTS - challenge.attempts
      });
    }

    // OTP is single-use
    challenge.used = true;

    const user = [...users.values()].find(
      user => user.id === challenge.userId
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found."
      });
    }

    // Create server-side session
    const sessionId = crypto.randomUUID();

    sessions.set(sessionId, {
      sessionId,
      userId: user.id,
      createdAt: Date.now(),
      expiresAt:
        Date.now() +
        (rememberMe === true
          ? 7 * 24 * 60 * 60 * 1000
          : 60 * 60 * 1000)
    });

    const maxAge =
      rememberMe === true
        ? 7 * 24 * 60 * 60
        : 60 * 60;

    res.cookie(
      "sessionId",
      sessionId,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: maxAge * 1000,
        path: "/"
      }
    );

    return res.json({
      message: "Login successful.",
      authenticated: true
    });

  } catch (error) {
    console.error(
      "Login OTP verification error:",
      error
    );

    return res.status(500).json({
      message:
        "Unable to verify the login code."
    });
  }
});
// ===============================
// SESSION AUTHENTICATION
// ===============================

app.get("/api/me", (req, res) => {
  try {
    const sessionId = req.cookies.sessionId;

    if (!sessionId) {
      return res.status(401).json({
        authenticated: false,
        message: "Not authenticated."
      });
    }

    const session = sessions.get(sessionId);

    if (!session) {
      return res.status(401).json({
        authenticated: false,
        message: "Session is invalid."
      });
    }

    // Check session expiry
    if (Date.now() > session.expiresAt) {
      sessions.delete(sessionId);

      res.clearCookie("sessionId", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/"
      });

      return res.status(401).json({
        authenticated: false,
        message: "Session has expired."
      });
    }

    const user = [...users.values()].find(
      candidate => candidate.id === session.userId
    );

    if (!user) {
      sessions.delete(sessionId);

      res.clearCookie("sessionId", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/"
      });

      return res.status(401).json({
        authenticated: false,
        message: "User account not found."
      });
    }

    return res.json({
      authenticated: true,
      user: {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        mobileNumber: user.mobileNumber,
        mfaEnabled: user.mfaEnabled
      }
    });

  } catch (error) {
    console.error("GET /api/me error:", error);

    return res.status(500).json({
      message: "Unable to retrieve account information."
    });
  }
});


app.post("/api/logout", (req, res) => {
  try {
    const sessionId = req.cookies.sessionId;

    if (sessionId) {
      sessions.delete(sessionId);
    }

    res.clearCookie("sessionId", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/"
    });

    return res.json({
      message: "Logged out successfully.",
      authenticated: false
    });

  } catch (error) {
    console.error("Logout error:", error);

    return res.status(500).json({
      message: "Unable to log out."
    });
  }
});
// ===============================
// JWT TOKEN
// ===============================

app.post("/api/token", (req, res) => {
  try {
    const sessionId = req.cookies.sessionId;

    if (!sessionId) {
      return res.status(401).json({
        message: "Authentication required."
      });
    }

    const session = sessions.get(sessionId);

    if (!session) {
      return res.status(401).json({
        message: "Invalid session."
      });
    }

    if (Date.now() > session.expiresAt) {
      sessions.delete(sessionId);

      res.clearCookie("sessionId", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/"
      });

      return res.status(401).json({
        message: "Session has expired."
      });
    }

    const user = [...users.values()].find(
      candidate => candidate.id === session.userId
    );

    if (!user) {
      return res.status(401).json({
        message: "User not found."
      });
    }

    const token = jwt.sign(
      {
        sub: user.id,
        email: user.email
      },
      JWT_SECRET,
      {
        expiresIn: "15m"
      }
    );

    return res.json({
      tokenType: "Bearer",
      expiresIn: 900,
      accessToken: token
    });

  } catch (error) {
    console.error("JWT token error:", error);

    return res.status(500).json({
      message: "Unable to issue access token."
    });
  }
});
function authenticateJWT(req, res, next) {
  const authorization = req.headers.authorization;

  if (
    !authorization ||
    !authorization.startsWith("Bearer ")
  ) {
    return res.status(401).json({
      message: "Bearer token required."
    });
  }

  const token = authorization.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    req.jwtUser = decoded;

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Invalid or expired JWT."
    });
  }
}
app.get("/api/protected", authenticateJWT, (req, res) => {
  return res.json({
    message: "You have accessed a protected API.",
    authenticated: true,
    user: req.jwtUser
  });
});
app.listen(PORT, () => {
  console.log(`IAM registration app running at http://localhost:${PORT}`);
});
