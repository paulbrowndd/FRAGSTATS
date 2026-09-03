/**
 * Client-side gate for FRAG stats tabs (Edania chest tracker stays public).
 * Default password: fragstats — change with ./tools/set-site-password.sh
 */
(function () {
  const PUBLIC_VIEW = "edania-chests";
  const SESSION_KEY = "frag-site-auth-v1";
  const REMEMBER_KEY = "frag-site-auth-remember-v1";
  const PASSWORD_HASH =
    "444099ae103894b903f9d9b2912cecde6d25fad1fa4d9f14a53d363225bb4a55";

  let gateEl = null;
  let formEl = null;
  let inputEl = null;
  let errorEl = null;
  let rememberEl = null;
  let onUnlockCallback = null;

  function callOnUnlock(result) {
    if (typeof onUnlockCallback === "function") onUnlockCallback(result);
  }

  async function sha256(text) {
    const buf = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(text)
    );
    return [...new Uint8Array(buf)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function isUnlocked() {
    try {
      return (
        sessionStorage.getItem(SESSION_KEY) === "1" ||
        localStorage.getItem(REMEMBER_KEY) === "1"
      );
    } catch {
      return false;
    }
  }

  function requiresAuth(view) {
    return view !== PUBLIC_VIEW;
  }

  function canAccess(view) {
    return !requiresAuth(view) || isUnlocked();
  }

  async function unlock(password, remember) {
    const hash = await sha256(String(password || ""));
    if (hash !== PASSWORD_HASH) return false;
    try {
      sessionStorage.setItem(SESSION_KEY, "1");
      if (remember) localStorage.setItem(REMEMBER_KEY, "1");
      else localStorage.removeItem(REMEMBER_KEY);
    } catch {
      /* ignore */
    }
    return true;
  }

  function lock() {
    try {
      sessionStorage.removeItem(SESSION_KEY);
      localStorage.removeItem(REMEMBER_KEY);
    } catch {
      /* ignore */
    }
  }

  function hideGate() {
    if (!gateEl) return;
    gateEl.hidden = true;
    if (inputEl) inputEl.value = "";
    if (errorEl) errorEl.hidden = true;
    document.body.classList.remove("site-auth-open");
  }

  function showGate() {
    if (!gateEl) return;
    gateEl.hidden = false;
    document.body.classList.add("site-auth-open");
    if (errorEl) errorEl.hidden = true;
    window.requestAnimationFrame(() => inputEl?.focus());
  }

  function mount() {
    gateEl = document.getElementById("site-auth-gate");
    formEl = document.getElementById("site-auth-form");
    inputEl = document.getElementById("site-auth-input");
    errorEl = document.getElementById("site-auth-error");
    rememberEl = document.getElementById("site-auth-remember");

    if (!gateEl || !formEl) return;

    formEl.addEventListener("submit", async (e) => {
      e.preventDefault();
      const ok = await unlock(inputEl?.value || "", !!rememberEl?.checked);
      if (!ok) {
        if (errorEl) errorEl.hidden = false;
        inputEl?.select();
        return;
      }
      hideGate();
      callOnUnlock();
    });

    document.getElementById("site-auth-back")?.addEventListener("click", () => {
      hideGate();
      callOnUnlock("back");
    });

    document.getElementById("site-auth-lock")?.addEventListener("click", () => {
      lock();
      hideGate();
      callOnUnlock("locked");
    });
  }

  window.FRAGSiteAuth = {
    PUBLIC_VIEW,
    mount,
    isUnlocked,
    requiresAuth,
    canAccess,
    unlock,
    lock,
    showGate,
    hideGate,
    setOnUnlock(fn) {
      onUnlockCallback = fn;
    },
  };
})();
