/**
 * exam-enhancements.js — تحسينات نظام الامتحانات
 * مؤقت · تسليم تلقائي · تصحيح تلقائي · لوحة ترتيب · كشف الغش · شهادات PDF
 * أضف في index.html: <script src="./exam-enhancements.js" defer></script>
 */

"use strict";

// ─── Exam Timer ───────────────────────────────────────────────────────────────
class ExamTimer {
  constructor({ totalSeconds, onTick, onWarning, onDanger, onExpire, warningAt = 120, dangerAt = 30 }) {
    this.total    = totalSeconds;
    this.remaining = totalSeconds;
    this.onTick    = onTick    || (() => {});
    this.onWarning = onWarning || (() => {});
    this.onDanger  = onDanger  || (() => {});
    this.onExpire  = onExpire  || (() => {});
    this.warningAt = warningAt;
    this.dangerAt  = dangerAt;
    this._timer    = null;
    this._warned   = false;
    this._dangered = false;
  }

  start() {
    if (this._timer) return;
    this._timer = setInterval(() => this._tick(), 1000);
    this._tick();
  }

  pause()  { clearInterval(this._timer); this._timer = null; }
  resume() { if (!this._timer) this.start(); }

  stop() {
    clearInterval(this._timer);
    this._timer = null;
    this.remaining = 0;
  }

  reset(seconds) {
    this.stop();
    this.remaining = seconds !== undefined ? seconds : this.total;
    this._warned   = false;
    this._dangered = false;
  }

  _tick() {
    if (this.remaining <= 0) {
      this.stop();
      this.onExpire();
      return;
    }
    this.remaining--;
    this.onTick(this.remaining, this.total);
    if (!this._warned && this.remaining <= this.warningAt) {
      this._warned = true;
      this.onWarning(this.remaining);
    }
    if (!this._dangered && this.remaining <= this.dangerAt) {
      this._dangered = true;
      this.onDanger(this.remaining);
    }
  }

  static format(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const pad = n => String(n).padStart(2, "0");
    return h > 0 ? `${pad(h)}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  }
}

// ─── Exam Timer Bar UI ────────────────────────────────────────────────────────
class ExamTimerBar {
  constructor({ totalSeconds, onSubmit, label = "الوقت المتبقي" }) {
    this.timer = new ExamTimer({
      totalSeconds,
      onTick:    (rem, total) => this._update(rem, total),
      onWarning: ()           => this._setState("warning"),
      onDanger:  ()           => this._setState("danger"),
      onExpire:  ()           => { this._setState("danger"); onSubmit && onSubmit("timeout"); }
    });
    this.label    = label;
    this.onSubmit = onSubmit;
    this._bar     = null;
  }

  mount(container) {
    container = container || document.body;
    const bar = document.createElement("div");
    bar.className = "exam-timer-bar";
    bar.setAttribute("role", "timer");
    bar.setAttribute("aria-live", "polite");
    bar.innerHTML = `
      <div class="exam-timer-display" id="examTimerDisplay">
        <span style="font-size:20px">⏱</span>
        <span id="examTimerText">${ExamTimer.format(this.timer.total)}</span>
      </div>
      <div class="exam-timer-progress" role="progressbar" aria-valuemin="0" aria-valuemax="${this.timer.total}" aria-valuenow="${this.timer.total}">
        <div class="exam-timer-progress-bar" id="examTimerProgressBar" style="width:100%"></div>
      </div>
      <button class="btn btn-primary small" id="examSubmitBtn" type="button">تسليم الامتحان</button>
    `;
    this._bar = bar;
    container.insertAdjacentElement("afterbegin", bar);

    document.getElementById("examSubmitBtn").addEventListener("click", () => {
      if (confirm("هل تريد تسليم الامتحان الآن؟")) {
        this.timer.stop();
        this.onSubmit && this.onSubmit("manual");
      }
    });

    this.timer.start();
    return bar;
  }

  unmount() {
    this.timer.stop();
    this._bar && this._bar.remove();
    this._bar = null;
  }

  _update(remaining, total) {
    const text = document.getElementById("examTimerText");
    const prog = document.getElementById("examTimerProgressBar");
    const aria = this._bar && this._bar.querySelector("[role=progressbar]");
    if (text) text.textContent = ExamTimer.format(remaining);
    if (prog) prog.style.width = ((remaining / total) * 100).toFixed(2) + "%";
    if (aria) aria.setAttribute("aria-valuenow", remaining);
  }

  _setState(state) {
    const display = document.getElementById("examTimerDisplay");
    const prog    = document.getElementById("examTimerProgressBar");
    if (display) { display.className = "exam-timer-display " + state; }
    if (prog)    { prog.className    = "exam-timer-progress-bar " + state; }
  }
}

// ─── Auto Grader ─────────────────────────────────────────────────────────────
class AutoGrader {
  /**
   * answers: { [questionId]: correctAnswer }  — الإجابات الصحيحة
   * responses: { [questionId]: userAnswer }   — إجابات الطالب
   */
  static grade(answers, responses) {
    let correct = 0, wrong = 0, skipped = 0;
    const details = {};

    for (const [qid, correct_ans] of Object.entries(answers)) {
      const user = responses[qid];
      if (user === undefined || user === null || user === "") {
        skipped++;
        details[qid] = "skipped";
      } else if (String(user).trim().toLowerCase() === String(correct_ans).trim().toLowerCase()) {
        correct++;
        details[qid] = "correct";
      } else {
        wrong++;
        details[qid] = "wrong";
      }
    }

    const total = Object.keys(answers).length;
    const score = total > 0 ? Math.round((correct / total) * 100) : 0;

    return { correct, wrong, skipped, total, score, details };
  }

  /** عرض نتيجة الامتحان داخل container */
  static renderResult(result, container) {
    if (!container) return;
    const { correct, wrong, skipped, total, score } = result;
    const pass = score >= 50;
    container.innerHTML = `
      <div style="text-align:center;padding:32px 16px;animation:fadeInUp .4s ease">
        <div style="font-size:72px;margin-bottom:16px">${pass ? "🏆" : "📋"}</div>
        <h2 style="font-size:clamp(28px,5vw,42px);font-weight:900;margin:0 0 8px;
                   background:var(--gradient-main);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text">
          ${score}%
        </h2>
        <p style="color:var(--muted);font-size:18px;margin:0 0 24px">${pass ? "أحسنت! لقد اجتزت الامتحان" : "لم تحقق النتيجة المطلوبة"}</p>
        <div style="display:flex;justify-content:center;gap:16px;flex-wrap:wrap;margin-bottom:24px">
          <div style="background:rgba(25,135,84,.10);border-radius:14px;padding:16px 24px">
            <div style="font-size:28px;font-weight:900;color:var(--success)">${correct}</div>
            <div style="color:var(--muted);font-size:14px">صحيحة</div>
          </div>
          <div style="background:rgba(220,53,69,.10);border-radius:14px;padding:16px 24px">
            <div style="font-size:28px;font-weight:900;color:var(--danger)">${wrong}</div>
            <div style="color:var(--muted);font-size:14px">خطأ</div>
          </div>
          <div style="background:rgba(25,118,185,.10);border-radius:14px;padding:16px 24px">
            <div style="font-size:28px;font-weight:900;color:var(--primary)">${skipped}</div>
            <div style="color:var(--muted);font-size:14px">متروكة</div>
          </div>
          <div style="background:rgba(20,32,51,.07);border-radius:14px;padding:16px 24px">
            <div style="font-size:28px;font-weight:900">${total}</div>
            <div style="color:var(--muted);font-size:14px">الإجمالي</div>
          </div>
        </div>
        ${pass ? `<button class="btn btn-certificate" id="downloadCertBtn" type="button">📄 تحميل الشهادة</button>` : ""}
      </div>
    `;
  }
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────
class Leaderboard {
  /**
   * entries: [{ name, score, time, avatar? }]
   */
  static render(entries, container) {
    if (!container) return;
    const sorted = [...entries].sort((a, b) => b.score - a.score || a.time - b.time);

    const rankIcon = (i) => {
      if (i === 0) return `<span class="rank-badge gold">🥇</span>`;
      if (i === 1) return `<span class="rank-badge silver">🥈</span>`;
      if (i === 2) return `<span class="rank-badge bronze">🥉</span>`;
      return `<span class="rank-badge other">${i + 1}</span>`;
    };

    container.innerHTML = `
      <table class="leaderboard-table" style="animation:fadeInUp .4s ease">
        <thead>
          <tr>
            <th>الترتيب</th>
            <th>الاسم</th>
            <th>النتيجة</th>
            <th>الوقت المستغرق</th>
          </tr>
        </thead>
        <tbody>
          ${sorted.map((e, i) => `
            <tr class="${i < 3 ? "rank-" + (i + 1) : ""}">
              <td>${rankIcon(i)}</td>
              <td style="font-weight:${i < 3 ? "900" : "400"}">${_esc(e.name)}</td>
              <td>
                <span style="font-weight:900;color:${e.score >= 50 ? "var(--success)" : "var(--danger)"}">
                  ${e.score}%
                </span>
              </td>
              <td style="color:var(--muted);font-size:13px">${ExamTimer.format(e.time || 0)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  }
}

// ─── Certificate PDF Generator ───────────────────────────────────────────────
class CertificateGenerator {
  /**
   * name: اسم الطالب
   * examTitle: عنوان الامتحان
   * score: النتيجة
   * date: التاريخ (اختياري)
   * platformName: اسم المنصة
   */
  static generate({ name, examTitle, score, date, platformName = "منصة الدكتور علي سعد" }) {
    const certDate = date || new Date().toLocaleDateString("ar-EG");
    // HTML → Canvas → PDF via print
    const win = window.open("", "_blank", "width=900,height=680");
    if (!win) { alert("يرجى السماح بالنوافذ المنبثقة لتحميل الشهادة"); return; }

    win.document.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>شهادة — ${_esc(name)}</title>
<link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&display=swap" rel="stylesheet"/>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Cairo',Arial,sans-serif;background:#f0f5fb;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:16px}
  .cert{width:794px;min-height:560px;background:#fff;border-radius:28px;padding:56px 64px;text-align:center;
        border:3px solid transparent;
        background-clip:padding-box;
        box-shadow:0 24px 80px rgba(20,32,51,.18);
        position:relative;overflow:hidden}
  .cert::before{content:"";position:absolute;inset:0;border-radius:inherit;
                background:linear-gradient(135deg,#1976b9,#7c3aed) border-box;
                -webkit-mask:linear-gradient(#fff 0 0) padding-box,linear-gradient(#fff 0 0);
                -webkit-mask-composite:destination-out;mask-composite:exclude;
                border:4px solid transparent}
  .watermark{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
              font-size:120px;opacity:.04;font-weight:900;pointer-events:none;transform:rotate(-30deg)}
  .logo{font-size:52px;margin-bottom:8px}
  .platform{font-size:15px;color:#687587;margin-bottom:32px}
  .heading{font-size:32px;font-weight:900;color:#142033;margin-bottom:6px}
  .sub{font-size:16px;color:#687587;margin-bottom:36px}
  .name{font-size:38px;font-weight:900;background:linear-gradient(135deg,#1976b9,#7c3aed);
        -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;margin-bottom:10px}
  .exam-line{font-size:18px;color:#142033;margin-bottom:8px}
  .score-box{display:inline-block;background:linear-gradient(135deg,rgba(25,118,185,.10),rgba(124,58,237,.10));
              border-radius:16px;padding:14px 32px;margin:16px 0 32px}
  .score-num{font-size:42px;font-weight:900;color:#1976b9}
  .score-lbl{font-size:14px;color:#687587}
  .date{font-size:14px;color:#687587;margin-top:8px}
  .divider{width:120px;height:3px;background:linear-gradient(135deg,#1976b9,#7c3aed);border-radius:999px;margin:24px auto}
  .footer-sig{font-size:13px;color:#687587;margin-top:32px}
  @media print{body{background:white;padding:0}.cert{box-shadow:none;width:100%;border:3px solid #1976b9}}
</style>
</head>
<body>
<div class="cert">
  <div class="watermark">✓</div>
  <div class="logo">🏅</div>
  <div class="platform">${_esc(platformName)}</div>
  <div class="heading">شهادة إتمام</div>
  <div class="sub">يُشهد بأن الطالب/ة</div>
  <div class="divider"></div>
  <div class="name">${_esc(name)}</div>
  <div class="exam-line">قد أتم/ت بنجاح اختبار:</div>
  <div style="font-size:20px;font-weight:900;color:#142033;margin:6px 0 16px">${_esc(examTitle)}</div>
  <div class="score-box">
    <div class="score-num">${score}%</div>
    <div class="score-lbl">الدرجة النهائية</div>
  </div>
  <div class="date">📅 تاريخ الإصدار: ${certDate}</div>
  <div class="divider"></div>
  <div class="footer-sig">د. علي سعد — المنصة التعليمية</div>
</div>
<script>window.onload=()=>setTimeout(()=>window.print(),600)<\/script>
</body>
</html>`);
    win.document.close();
  }
}

// ─── Anti-Cheat System ────────────────────────────────────────────────────────
class AntiCheat {
  constructor({ onCheat, allowedSwitches = 1, warningMessage = "تحذير! مغادرة الصفحة خلال الامتحان تُعدّ غشًا." }) {
    this.onCheat        = onCheat || (() => {});
    this.allowedSwitches = allowedSwitches;
    this.warningMessage  = warningMessage;
    this._count          = 0;
    this._active         = false;
    this._handlers       = {};
    this._overlay        = null;
  }

  start() {
    if (this._active) return;
    this._active = true;

    this._handlers.visibility = () => {
      if (document.hidden) {
        this._count++;
        if (this._count > this.allowedSwitches) {
          this._showWarning();
          this.onCheat({ type: "tab_switch", count: this._count });
        }
      }
    };
    this._handlers.blur = () => {
      this._count++;
      if (this._count > this.allowedSwitches) {
        this.onCheat({ type: "window_blur", count: this._count });
      }
    };
    this._handlers.contextmenu = (e) => e.preventDefault();
    this._handlers.keydown = (e) => {
      // منع F12 وCtrl+Shift+I وCtrl+U
      if (e.key === "F12" || (e.ctrlKey && e.shiftKey && ["I","J"].includes(e.key)) || (e.ctrlKey && e.key === "u")) {
        e.preventDefault();
        this.onCheat({ type: "devtools_attempt" });
      }
    };

    document.addEventListener("visibilitychange", this._handlers.visibility);
    window.addEventListener("blur", this._handlers.blur);
    document.addEventListener("contextmenu", this._handlers.contextmenu);
    document.addEventListener("keydown", this._handlers.keydown);
  }

  stop() {
    if (!this._active) return;
    this._active = false;
    document.removeEventListener("visibilitychange", this._handlers.visibility);
    window.removeEventListener("blur", this._handlers.blur);
    document.removeEventListener("contextmenu", this._handlers.contextmenu);
    document.removeEventListener("keydown", this._handlers.keydown);
    this._hideWarning();
  }

  _showWarning() {
    if (this._overlay) return;
    const el = document.createElement("div");
    el.className = "cheat-warning-overlay";
    el.innerHTML = `
      <h2>⚠️ تحذير</h2>
      <p>${_esc(this.warningMessage)}</p>
      <p style="font-size:14px;opacity:.8">عدد المرات: ${this._count}</p>
      <button class="btn btn-light" id="cheatWarningClose" type="button">فهمت، العودة للامتحان</button>
    `;
    document.body.appendChild(el);
    this._overlay = el;
    el.querySelector("#cheatWarningClose").addEventListener("click", () => this._hideWarning());
  }

  _hideWarning() {
    this._overlay && this._overlay.remove();
    this._overlay = null;
  }

  getCount() { return this._count; }
}

// ─── Toast Notifications ──────────────────────────────────────────────────────
class ToastNotifications {
  constructor() {
    this._container = null;
    this._init();
  }

  _init() {
    let c = document.getElementById("notifToastContainer");
    if (!c) {
      c = document.createElement("div");
      c.id = "notifToastContainer";
      c.className = "notif-toast-container";
      document.body.appendChild(c);
    }
    this._container = c;
  }

  show({ title, body, icon = "🔔", duration = 5000 }) {
    const toast = document.createElement("div");
    toast.className = "notif-toast";
    toast.innerHTML = `
      <div class="notif-toast-icon">${icon}</div>
      <div class="notif-toast-body">
        <strong>${_esc(title)}</strong>
        <span>${_esc(body || "")}</span>
      </div>
      <button class="notif-toast-close" type="button" aria-label="إغلاق">×</button>
    `;
    this._container.appendChild(toast);

    const close = () => {
      toast.classList.add("leaving");
      setTimeout(() => toast.remove(), 300);
    };
    toast.querySelector(".notif-toast-close").addEventListener("click", close);
    toast.addEventListener("click", close);
    if (duration > 0) setTimeout(close, duration);
    return close;
  }

  success(title, body) { return this.show({ title, body, icon: "✅" }); }
  error  (title, body) { return this.show({ title, body, icon: "❌", duration: 7000 }); }
  info   (title, body) { return this.show({ title, body, icon: "ℹ️" }); }
  warn   (title, body) { return this.show({ title, body, icon: "⚠️", duration: 6000 }); }
}

// ─── Push Notifications Helper ────────────────────────────────────────────────
const PushNotifications = {
  async requestPermission() {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    const perm = await Notification.requestPermission();
    return perm === "granted";
  },

  async send(title, options = {}) {
    if (!("Notification" in window)) return null;
    const granted = await this.requestPermission();
    if (!granted) return null;
    return new Notification(title, {
      icon: "./favicon.ico",
      badge: "./favicon.ico",
      dir: "rtl",
      lang: "ar",
      ...options
    });
  }
};

// ─── Scroll Reveal ────────────────────────────────────────────────────────────
function initScrollReveal() {
  if (!("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add("visible"); observer.unobserve(e.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll(".category-card, .feature-card, .item-card, .text-section").forEach(el => {
    el.classList.add("reveal");
    observer.observe(el);
  });
}

// ─── Dark Mode init ───────────────────────────────────────────────────────────
function initDarkMode() {
  const saved = localStorage.getItem("drAliDarkMode");
  const prefersDark = saved === "1" || (saved === null && window.matchMedia("(prefers-color-scheme: dark)").matches);
  if (prefersDark) document.documentElement.setAttribute("data-theme", "dark");

  document.addEventListener("DOMContentLoaded", () => {
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
  });
}

// ─── Lazy Image Loading ───────────────────────────────────────────────────────
function initLazyImages() {
  if (!("IntersectionObserver" in window)) return;
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const img = e.target;
        if (img.dataset.src) { img.src = img.dataset.src; delete img.dataset.src; }
        observer.unobserve(img);
      }
    });
  }, { rootMargin: "100px" });
  document.querySelectorAll("img[data-src]").forEach(img => observer.observe(img));
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function _esc(v) {
  return String(v || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// ─── Auto-init ────────────────────────────────────────────────────────────────
initDarkMode();

document.addEventListener("DOMContentLoaded", () => {
  initScrollReveal();
  initLazyImages();
});

// ─── Global exports (attach to window for script.js to use) ──────────────────
window.DrAliExam = {
  ExamTimer,
  ExamTimerBar,
  AutoGrader,
  Leaderboard,
  CertificateGenerator,
  AntiCheat,
  ToastNotifications,
  PushNotifications
};

// Auto-create global toast instance
window.drAliToast = null;
document.addEventListener("DOMContentLoaded", () => {
  window.drAliToast = new ToastNotifications();
});
