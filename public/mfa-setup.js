const continueButton =
    document.getElementById(
        "continueButton"
    );


continueButton.addEventListener(
    "click",
    async () => {

        try {

            const userId =
                sessionStorage.getItem(
                    "registrationUserId"
                );

            if (!userId) {

                alert(
                    "Registration session expired. Please register again."
                );

                window.location.href = "/";

                return;
            }


            /*
             * Tell the backend that both
             * verification steps are complete.
             */

            const response =
                await fetch(
                    "/api/complete-registration",
                    {
                        method: "POST",

                        headers: {
                            "Content-Type":
                                "application/json"
                        },

                        body:
                            JSON.stringify({
                                userId
                            })
                    }
                );


            const result =
                await response.json();


            if (!response.ok) {

                alert(
                    result.message ||
                    "Unable to complete registration."
                );

                return;
            }


            sessionStorage.setItem(
                "registrationComplete",
                "true"
            );


            window.location.href =
                "/registration-success.html";

        }

        catch (error) {

            console.error(error);

            alert(
                "Unable to complete registration."
            );

        }

    }
);