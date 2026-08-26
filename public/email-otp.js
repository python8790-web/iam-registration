const challengeId =
    sessionStorage.getItem(
        "registrationChallengeId"
    );

const email =
    sessionStorage.getItem(
        "registrationEmail"
    );


const inputs =
    Array.from(
        document.querySelectorAll(
            "#otpContainer input"
        )
    );


const message =
    document.getElementById(
        "message"
    );


const expiry =
    document.getElementById(
        "expiry"
    );


const resendButton =
    document.getElementById(
        "resendButton"
    );


const resendTimer =
    document.getElementById(
        "resendTimer"
    );


const emailAddress =
    document.getElementById(
        "emailAddress"
    );


let expiresIn = 165;

let resendIn = 25;

let verifying = false;

let expiryInterval;

let resendInterval;


/* -------------------------
   EMAIL DISPLAY
------------------------- */

emailAddress.textContent =
    email || "your email";


/* -------------------------
   FORMAT TIME
------------------------- */

function formatTime(seconds) {

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


/* -------------------------
   MESSAGE
------------------------- */

function showMessage(
    text,
    type = ""
) {

    message.textContent = text;

    message.className =
        "message " + type;
}


/* -------------------------
   CLEAR OTP
------------------------- */

function clearOtp() {

    inputs.forEach(
        input => {
            input.value = "";
        }
    );

    inputs[0].focus();
}


/* -------------------------
   UPDATE TIMER
------------------------- */

function updateTimer() {

    expiry.innerHTML =
        `Code expires in <strong>${
            formatTime(expiresIn)
        }</strong>`;


    if (resendIn > 0) {

        resendButton.innerHTML =
            `Resend code
             <span>
                (00:${String(resendIn).padStart(2, "0")})
             </span>`;

    } else {

        resendButton.textContent =
            "Resend code";
    }
}


/* -------------------------
   START TIMER
------------------------- */

function startTimers() {

    clearInterval(
        expiryInterval
    );

    clearInterval(
        resendInterval
    );


    expiresIn = 165;

    resendIn = 25;


    resendButton.disabled = true;


    updateTimer();


    expiryInterval =
        setInterval(() => {

            expiresIn--;

            if (expiresIn <= 0) {

                clearInterval(
                    expiryInterval
                );

                expiry.innerHTML =
                    "<strong>Code expired.</strong>";

                showMessage(
                    "Your verification code has expired.",
                    "error"
                );

                resendButton.disabled =
                    false;

                resendButton.textContent =
                    "Resend New Code";

                return;
            }

            updateTimer();

        }, 1000);


    resendInterval =
        setInterval(() => {

            resendIn--;

            if (resendIn <= 0) {

                clearInterval(
                    resendInterval
                );

                resendButton.disabled =
                    false;

                resendButton.textContent =
                    "Resend code";

                return;
            }

            updateTimer();

        }, 1000);
}


/* -------------------------
   OTP INPUT
------------------------- */

inputs.forEach(
    (input, index) => {

        input.addEventListener(
            "input",
            () => {

                input.value =
                    input.value
                        .replace(/\D/g, "")
                        .slice(0, 1);


                document
                    .getElementById(
                        "otpContainer"
                    )
                    .classList.remove(
                        "error"
                    );


                showMessage("");


                if (
                    input.value &&
                    index <
                    inputs.length - 1
                ) {

                    inputs[index + 1]
                        .focus();
                }


                if (
                    index ===
                    inputs.length - 1
                    &&
                    input.value
                ) {

                    verifyOtp();
                }

            }
        );


        input.addEventListener(
            "keydown",
            event => {

                if (
                    event.key ===
                    "Backspace"
                    &&
                    !input.value
                    &&
                    index > 0
                ) {

                    inputs[index - 1]
                        .focus();
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

                            if (
                                inputs[i]
                            ) {

                                inputs[i].value =
                                    digit;
                            }

                        }
                    );


                if (
                    pasted.length === 6
                ) {

                    verifyOtp();

                } else {

                    inputs[
                        pasted.length
                    ]?.focus();

                }

            }
        );

    }
);


/* -------------------------
   VERIFY OTP
------------------------- */

async function verifyOtp() {

    if (verifying) {
        return;
    }


    const otp =
        inputs
            .map(
                input => input.value
            )
            .join("");


    if (
        otp.length !== 6
        ||
        !challengeId
    ) {

        return;
    }


    verifying = true;


    try {

        const response =
            await fetch(
                "/api/verify-email-otp",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            challengeId,
                            otp
                        })
                }
            );


        const result =
            await response.json();


        if (!response.ok) {

            document
                .getElementById(
                    "otpContainer"
                )
                .classList.add(
                    "error"
                );


            if (result.expired) {

                clearInterval(
                    expiryInterval
                );

                expiry.innerHTML =
                    "<strong>Code expired.</strong>";

                resendButton.disabled =
                    false;

                resendButton.textContent =
                    "Resend New Code";

                showMessage(
                    "Your verification code has expired.",
                    "error"
                );

            }

            else if (
                result.maxAttempts
            ) {

                resendButton.disabled =
                    false;

                resendButton.textContent =
                    "Resend New Code";

                showMessage(
                    "Maximum attempts reached. Please request a new code.",
                    "error"
                );

            }

            else {

                showMessage(
                    `Incorrect code. ${
                        result.remainingAttempts ?? 0
                    } attempts remaining.`,
                    "error"
                );

            }

            return;
        }


        /* -------------------------
           EMAIL VERIFIED
        ------------------------- */

        clearInterval(
            expiryInterval
        );

        clearInterval(
            resendInterval
        );


        showMessage(
            "Email verified successfully.",
            "success"
        );


        /*
          Save user information for
          the SMS step.
        */

        sessionStorage.setItem(
            "registrationUserId",
            result.userId
        );


        sessionStorage.setItem(
            "emailVerified",
            "true"
        );


        /*
          Ask backend to generate
          the SMS OTP.
        */

        const smsResponse =
            await fetch(
                "/api/send-sms-otp",
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify({
                            userId:
                                result.userId
                        })
                }
            );


        const smsResult =
            await smsResponse.json();


        if (!smsResponse.ok) {

            showMessage(
                smsResult.message ||
                "Unable to send SMS OTP.",
                "error"
            );

            return;
        }


        sessionStorage.setItem(
            "smsChallengeId",
            smsResult.challengeId
        );


        sessionStorage.setItem(
            "mobileNumber",
            smsResult.mobileNumber
        );


        setTimeout(
            () => {

                window.location.href =
                    "/sms-otp.html";

            },
            500
        );

    }

    catch (error) {

        console.error(error);

        showMessage(
            "Unable to verify the code. Please try again.",
            "error"
        );

    }

    finally {

        verifying = false;

    }
}


/* -------------------------
   RESEND OTP
------------------------- */

resendButton.addEventListener(
    "click",
    async () => {

        if (
            resendButton.disabled
        ) {

            return;
        }


        try {

            resendButton.disabled =
                true;


            showMessage("");


            const response =
                await fetch(
                    "/api/resend-email-otp",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                challengeId
                            })
                    }
                );


            const result =
                await response.json();


            if (!response.ok) {

                showMessage(
                    result.message ||
                    "Unable to resend code.",
                    "error"
                );

                resendButton.disabled =
                    false;

                return;
            }


            sessionStorage.setItem(
                "registrationChallengeId",
                result.challengeId
            );


            /*
              Important:
              update the local challengeId
              variable too.
            */

            window.location.reload();

        }

        catch (error) {

            showMessage(
                "Unable to resend code.",
                "error"
            );

            resendButton.disabled =
                false;
        }

    }
);


/* -------------------------
   BACK
------------------------- */

document
    .getElementById(
        "backButton"
    )
    .addEventListener(
        "click",
        () => {

            window.location.href =
                "/";

        }
    );


/* -------------------------
   START
------------------------- */

if (!challengeId) {

    showMessage(
        "Registration session expired. Please register again.",
        "error"
    );

    inputs.forEach(
        input => {
            input.disabled = true;
        }
    );

    resendButton.disabled =
        true;

} else {

    startTimers();

    inputs[0].focus();
}