const challengeKey = "smsChallengeId";
const mobileKey = "mobileNumber";

let challengeId =
  sessionStorage.getItem(challengeKey);

const mobileNumber =
  sessionStorage.getItem(mobileKey) ||
  "+91 •••• 43210";


const inputs = [
  ...document.querySelectorAll(
    "#otpInputs input"
  )
];

const message =
  document.getElementById("message");

const expiry =
  document.getElementById("expiry");

const resend =
  document.getElementById("resend");

const resendTimer =
  document.getElementById("resendTimer");

const phoneIcon =
  document.getElementById("phoneIcon");

const mobileElement =
  document.getElementById("mobileNumber");


let expiresIn = 165;

let resendIn = 25;

let expiryInterval;

let resendInterval;

let verifying = false;


mobileElement.textContent =
  mobileNumber;


/* --------------------------------
   TIME FORMAT
-------------------------------- */

function format(seconds) {

  const minutes =
    Math.floor(seconds / 60);

  const remaining =
    seconds % 60;

  return (
    String(minutes).padStart(2, "0") +
    ":" +
    String(remaining).padStart(2, "0")
  );
}


/* --------------------------------
   MESSAGE
-------------------------------- */

function setMessage(
  text,
  type = ""
) {

  message.textContent = text;

  message.className =
    `message ${type}`;
}


/* --------------------------------
   CLEAR OTP
-------------------------------- */

function clearOtp() {

  inputs.forEach(
    input => input.value = ""
  );

  inputs[0].focus();
}


/* --------------------------------
   ERROR STATE
-------------------------------- */

function setWrongState() {

  document
    .getElementById("otpInputs")
    .classList.add("error");

  phoneIcon.style.color =
    "#ef4444";

  phoneIcon.style.background =
    "#fff0f0";
}


function clearWrongState() {

  document
    .getElementById("otpInputs")
    .classList.remove("error");

  phoneIcon.style.color =
    "#18a957";

  phoneIcon.style.background =
    "#e8f8ee";
}


/* --------------------------------
   TIMER
-------------------------------- */

function updateTimers() {

  expiry.innerHTML =
    `Code expires in <strong>${
      format(expiresIn)
    }</strong>`;

  resend.innerHTML =
    `Resend code <span>${
      resendIn > 0
        ? `(00:${String(resendIn).padStart(2, "0")})`
        : ""
    }</span>`;
}


function startTimers() {

  clearInterval(expiryInterval);

  clearInterval(resendInterval);


  expiresIn = 165;

  resendIn = 25;


  resend.disabled = true;


  updateTimers();


  /* Expiry */

  expiryInterval =
    setInterval(() => {

      expiresIn--;

      if (expiresIn <= 0) {

        clearInterval(
          expiryInterval
        );

        expiry.innerHTML =
          "<strong>Code expired.</strong>";

        setMessage(
          "This code expired. Please request a new code.",
          "error"
        );

        resend.disabled = false;

        resend.textContent =
          "Resend New Code";

        return;
      }

      updateTimers();

    }, 1000);


  /* Resend timer */

  resendInterval =
    setInterval(() => {

      resendIn--;

      if (resendIn <= 0) {

        clearInterval(
          resendInterval
        );

        resend.disabled = false;

        resend.textContent =
          "Resend code";

        return;
      }

      updateTimers();

    }, 1000);
}


/* --------------------------------
   OTP INPUT
-------------------------------- */

inputs.forEach(
  (input, index) => {

    input.addEventListener(
      "input",
      () => {

        clearWrongState();

        setMessage("");

        input.value =
          input.value
            .replace(/\D/g, "")
            .slice(0, 1);


        if (
          input.value &&
          index < inputs.length - 1
        ) {

          inputs[index + 1].focus();
        }


        if (
          index === inputs.length - 1 &&
          input.value
        ) {

          verify();
        }

      }
    );


    input.addEventListener(
      "keydown",
      event => {

        if (
          event.key === "Backspace" &&
          !input.value &&
          index > 0
        ) {

          inputs[index - 1].focus();
        }

      }
    );


    input.addEventListener(
      "paste",
      event => {

        const pasted =
          event.clipboardData
            .getData("text")
            .replace(/\D/g, "")
            .slice(0, 6);


        if (!pasted) {
          return;
        }


        event.preventDefault();


        pasted
          .split("")
          .forEach(
            (digit, i) => {

              if (inputs[i]) {
                inputs[i].value =
                  digit;
              }

            }
          );


        if (pasted.length === 6) {

          verify();

        } else {

          inputs[pasted.length]?.focus();

        }

      }
    );

  }
);


/* --------------------------------
   VERIFY SMS OTP
-------------------------------- */

async function verify() {

  if (verifying) {
    return;
  }


  const otp =
    inputs
      .map(input => input.value)
      .join("");


  if (
    otp.length !== 6 ||
    !challengeId
  ) {

    return;
  }


  verifying = true;


  try {

    const response =
      await fetch(
        "/api/verify-sms-otp",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body: JSON.stringify({
            challengeId,
            otp
          })
        }
      );


    const result =
      await response.json();


    if (!response.ok) {

      if (result.expired) {

        clearInterval(
          expiryInterval
        );

        expiry.innerHTML =
          "<strong>Code expired.</strong>";

        setMessage(
          "This code expired. Please request a new code.",
          "error"
        );

        resend.disabled = false;

        resend.textContent =
          "Resend New Code";

      }

      else if (result.maxAttempts) {

        setMessage(
          "Maximum attempts reached. Please request a new code.",
          "error"
        );

        resend.disabled = false;

        resend.textContent =
          "Resend New Code";

      }

      else {

        setWrongState();

        setMessage(
          `Incorrect code. Please try again. You have ${
            result.remainingAttempts ?? 0
          } attempt${
            result.remainingAttempts === 1
              ? ""
              : "s"
          } left.`,
          "error"
        );

      }

      return;
    }


    /* Successful verification */

    clearInterval(
      expiryInterval
    );

    clearInterval(
      resendInterval
    );


    sessionStorage.setItem(
      "mobileVerified",
      "true"
    );


    setMessage(
      "Mobile number verified successfully.",
      "success"
    );


    /*
      NEXT STEP:
      MFA SETUP

      We will change this redirect
      when we build the MFA page.
    */

    setTimeout(() => {

      window.location.href =
        "/mfa-setup.html";

    }, 500);

  }

  catch (error) {

    setMessage(
      "Unable to verify the code. Please try again.",
      "error"
    );

  }

  finally {

    verifying = false;

  }

}


/* --------------------------------
   RESEND SMS OTP
-------------------------------- */

resend.addEventListener(
  "click",
  async () => {

    if (
      resend.disabled ||
      !challengeId
    ) {

      return;
    }


    resend.disabled = true;

    setMessage("");


    try {

      const response =
        await fetch(
          "/api/resend-sms-otp",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body: JSON.stringify({
              challengeId
            })
          }
        );


      const result =
        await response.json();


      if (!response.ok) {

        setMessage(
          result.message ||
          "Unable to resend the code.",
          "error"
        );

        resend.disabled = false;

        return;
      }


      challengeId =
        result.challengeId;


      sessionStorage.setItem(
        challengeKey,
        challengeId
      );


      if (result.mobileNumber) {

        sessionStorage.setItem(
          mobileKey,
          result.mobileNumber
        );

        mobileElement.textContent =
          result.mobileNumber;
      }


      clearOtp();

      clearWrongState();

      setMessage(
        "A new verification code has been sent.",
        "success"
      );


      startTimers();

    }

    catch (error) {

      setMessage(
        "Unable to resend the code.",
        "error"
      );

      resend.disabled = false;

    }

  }
);


/* --------------------------------
   CHANGE MOBILE NUMBER
-------------------------------- */

document
  .getElementById("changeNumber")
  .addEventListener(
    "click",
    () => {

      /*
        For now return to registration.

        Later we can create a proper
        "Change Mobile Number" screen.
      */

      window.location.href = "/";

    }
  );


/* --------------------------------
   BACK
-------------------------------- */

document
  .getElementById("backButton")
  .addEventListener(
    "click",
    () => {

      window.location.href =
        "/email-otp.html";

    }
  );


/* --------------------------------
   INITIALIZE
-------------------------------- */

if (!challengeId) {

  setMessage(
    "Your verification session has expired. Please start registration again.",
    "error"
  );


  inputs.forEach(
    input => input.disabled = true
  );


  resend.disabled = true;

}

else {

  startTimers();

  inputs[0].focus();

}