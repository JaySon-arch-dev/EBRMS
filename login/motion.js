/* =========================================================
   EBRMS LOGIN — MOTION
   File: login/motion.js
   Load BEFORE /login/script.js.

   Gives script.js one helper to call after a successful login:
       await window.EBRMSLoginExit();
   It only plays the fade-out. It does not touch sessions,
   roles or the /api/login request.
   ========================================================= */

(() => {
  "use strict";

  window.EBRMSLoginExit = () =>
    new Promise((resolve) => {
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        resolve();
        return;
      }

      document.body.classList.add("lm-leaving");
      setTimeout(resolve, 340);
    });

  // Coming back with the Back button should not show a faded page.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) document.body.classList.remove("lm-leaving");
  });
})(); 
