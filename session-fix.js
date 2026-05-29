/**
 * session-fix.js — إصلاح استمرارية الجلسة
 * يعمل قبل script.js لاستعادة حالة تسجيل الدخول فوراً بدون وميض
 */
(function () {
  "use strict";

  const SESSION_KEY       = "drAliSession";
  const ADMIN_SESSION_KEY = "drAliAdminSession";
  const PREAUTH_ATTR      = "data-preauth";
  const PREAUTH_ADMIN     = "admin";
  const PREAUTH_USER      = "user";

  // ── قراءة الجلسة من localStorage / sessionStorage ──────────────
  function readSession() {
    try {
      const adminRaw = sessionStorage.getItem(ADMIN_SESSION_KEY);
      const userRaw  = localStorage.getItem(SESSION_KEY);
      const raw = adminRaw || userRaw;
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (!session || !session.currentUser) return null;
      if (Date.now() > session.expiresAt)   return null;
      return { session, isAdmin: !!adminRaw };
    } catch (_) { return null; }
  }

  // ── تطبيق حالة المصادقة فوراً على DOM ──────────────────────────
  function applyPreAuth() {
    const result = readSession();
    if (!result) return;
    const { isAdmin } = result;
    document.documentElement.setAttribute(PREAUTH_ATTR, isAdmin ? PREAUTH_ADMIN : PREAUTH_USER);
  }

  // ── شاشة التحميل ────────────────────────────────────────────────
  function createLoader() {
    const overlay = document.createElement("div");
    overlay.id = "appLoader";
    overlay.setAttribute("role", "status");
    overlay.setAttribute("aria-label", "جارٍ التحميل…");
    overlay.innerHTML = `
      <div class="loader-inner">
        <div class="loader-logo-ring">
          <div class="loader-ring"></div>
          <div class="loader-ring loader-ring-2"></div>
        </div>
        <p class="loader-text">جارٍ التحميل…</p>
      </div>`;
    document.body.appendChild(overlay);
    return overlay;
  }

  function removeLoader(overlay) {
    if (!overlay) return;
    overlay.classList.add("loader-exit");
    setTimeout(() => { overlay.remove(); }, 500);
  }

  // ── تطبيق الوضع الليلي فوراً ────────────────────────────────────
  function applyTheme() {
    const saved = localStorage.getItem("drAliDarkMode");
    // المنصة الآن dark-first — الافتراضي هو الوضع المظلم
    const isDark = saved !== "0";
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
  }

  // ── تهيئة زر الوضع الليلي ───────────────────────────────────────
  function initDarkToggle() {
    const btn = document.getElementById("darkModeToggle");
    if (!btn) return;
    const isDark = () => document.documentElement.getAttribute("data-theme") === "dark";
    btn.textContent = isDark() ? "☀️" : "🌙";
    btn.addEventListener("click", () => {
      const dark = !isDark();
      document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
      localStorage.setItem("drAliDarkMode", dark ? "1" : "0");
      btn.textContent = dark ? "☀️" : "🌙";
    });
  }

  // ── تمديد مدة جلسة المستخدم العادي تلقائياً ────────────────────
  // يمدد الـ TTL 7 أيام من آخر نشاط
  function renewSessionIfNeeded() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return;
      const session = JSON.parse(raw);
      if (!session || !session.currentUser) return;
      const timeLeft = session.expiresAt - Date.now();
      const oneDay   = 1000 * 60 * 60 * 24;
      // جدد لو تبقى أقل من يومين
      if (timeLeft > 0 && timeLeft < oneDay * 2) {
        session.expiresAt = Date.now() + (oneDay * 7);
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      }
    } catch (_) {}
  }

  // ── تشغيل كل شيء ────────────────────────────────────────────────
  applyTheme();
  applyPreAuth();
  renewSessionIfNeeded();

  document.addEventListener("DOMContentLoaded", function onReady() {
    document.removeEventListener("DOMContentLoaded", onReady);

    const loader = createLoader();
    initDarkToggle();

    // أزل شاشة التحميل بعد انتهاء script.js من التهيئة
    // نستخدم requestAnimationFrame مرتين لضمان تطبيق التغييرات بالكامل
    function waitForApp(tries) {
      tries = tries || 0;
      // انتظر أن يكون script.js قد أخفى صفحة auth أو أظهر محتوى
      const authPage    = document.getElementById("authPage");
      const studentPage = document.getElementById("studentPage");
      const homePage    = document.getElementById("homePage");
      const appReady    = homePage && (
        homePage.classList.contains("active") ||
        (studentPage && studentPage.classList.contains("active")) ||
        (authPage && authPage.classList.contains("active"))
      );

      if (appReady || tries > 30) {
        removeLoader(loader);
      } else {
        setTimeout(() => waitForApp(tries + 1), 100);
      }
    }
    setTimeout(() => waitForApp(), 300);
  });

  // ── تحذير إغلاق التاب أثناء الامتحانات ─────────────────────────
  window.DrAliSession = {
    read: readSession,
    renew: renewSessionIfNeeded,
    clear: function () {
      localStorage.removeItem(SESSION_KEY);
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      document.documentElement.removeAttribute(PREAUTH_ATTR);
    }
  };
})();
