const loginButton =
    document.getElementById(
        "loginButton"
    );


loginButton.addEventListener(
    "click",
    () => {

        /*
         * Part 2 will implement the
         * actual login journey.
         *
         * For now, return to the
         * existing login page.
         */

        window.location.href =
            "/login.html";
    }
);