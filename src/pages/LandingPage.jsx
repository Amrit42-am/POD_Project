import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LandingPage() {
  const navigate = useNavigate();
  const { currentUser, login, register, logout } = useAuth();

  useEffect(() => {
    // Porting exact app.js logic using DOM APIs inside useEffect
    const authDialog = document.getElementById("auth-dialog");
    const authFeedback = document.getElementById("auth-feedback");
    const closeAuthDialogButton = document.getElementById("close-auth-dialog");
    const registerForm = document.getElementById("register-form");
    const loginForm = document.getElementById("login-form");
    const navLogoutButton = document.getElementById("nav-logout");
    const navUserChip = document.getElementById("nav-user-chip");
    const toastContainer = document.getElementById("toast-container");
    const passwordToggleButtons = document.querySelectorAll("[data-toggle-password]");
    const guestOnlyElements = document.querySelectorAll(".guest-only");
    const authOnlyElements = document.querySelectorAll(".auth-only");
    const authTabs = document.querySelectorAll("[data-auth-tab]");
    const authPanels = {
      login: document.getElementById("login-panel"),
      register: document.getElementById("register-panel")
    };

    let currentAuthMode = "register";

    function showToast(message, type = "info") {
      const toast = document.createElement("div");
      toast.className = `toast toast-${type}`;
      toast.textContent = message;
      toastContainer.appendChild(toast);
      setTimeout(() => {
        toast.classList.add("toast-exit");
        setTimeout(() => toast.remove(), 300);
      }, 3500);
    }

    function setFeedback(message, type = "error") {
      if (!authFeedback) return;
      if (!message) {
        authFeedback.hidden = true;
        authFeedback.textContent = "";
        authFeedback.dataset.state = "";
        return;
      }
      authFeedback.hidden = false;
      authFeedback.textContent = message;
      authFeedback.dataset.state = type;
    }

    function setButtonBusy(button, isBusy, busyLabel) {
      if (!button) return;
      if (!button.dataset.idleLabel) {
        button.dataset.idleLabel = button.textContent.trim();
      }
      button.disabled = isBusy;
      button.textContent = isBusy ? busyLabel : button.dataset.idleLabel;
    }

    function clearFieldValidation(form) {
      if (!form) return;
      form.querySelectorAll(".field").forEach((field) => field.classList.remove("is-invalid"));
      form.querySelectorAll("input, select").forEach((input) => input.removeAttribute("aria-invalid"));
    }

    function markFieldInvalid(form, name, message) {
      const input = form.querySelector(`[name="${name}"]`);
      if (!input) {
        setFeedback(message);
        return false;
      }
      clearFieldValidation(form);
      input.setAttribute("aria-invalid", "true");
      input.closest(".field")?.classList.add("is-invalid");
      setFeedback(message);
      input.focus();
      return false;
    }

    function isValidEmail(value) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
    }

    function validateRegister(form) {
      const data = new FormData(form);
      const name = String(data.get("name") || "").trim();
      const email = String(data.get("email") || "").trim();
      const password = String(data.get("password") || "");

      if (name.length < 2) return markFieldInvalid(form, "name", "Please enter your full name.");
      if (!isValidEmail(email)) return markFieldInvalid(form, "email", "Please enter a valid email address.");
      if (password.length < 8) return markFieldInvalid(form, "password", "Use a password with at least 8 characters.");

      clearFieldValidation(form);
      setFeedback("");
      return true;
    }

    function validateLogin(form) {
      const data = new FormData(form);
      const email = String(data.get("email") || "").trim();
      const password = String(data.get("password") || "");

      if (!isValidEmail(email)) return markFieldInvalid(form, "email", "Please enter the email you signed up with.");
      if (!password) return markFieldInvalid(form, "password", "Please enter your password.");

      clearFieldValidation(form);
      setFeedback("");
      return true;
    }

    function setAuthMode(mode) {
      currentAuthMode = mode;
      const isRegister = mode === "register";

      for (const tab of authTabs) {
        const isActive = tab.dataset.authTab === mode;
        tab.classList.toggle("is-active", isActive);
        tab.setAttribute("aria-selected", String(isActive));
      }

      if (authPanels.register && authPanels.login) {
        authPanels.register.hidden = !isRegister;
        authPanels.login.hidden = isRegister;
        authPanels.register.classList.toggle("is-active", isRegister);
        authPanels.login.classList.toggle("is-active", !isRegister);
      }
      clearFieldValidation(registerForm);
      clearFieldValidation(loginForm);
      setFeedback("");
    }

    function openAuthDialog(mode = "register") {
      setAuthMode(mode);
      if (authDialog && !authDialog.open) {
        authDialog.showModal();
      }
    }

    function initialsFor(name) {
      return String(name || "").trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() || "").join("");
    }

    function updateAuthState(user) {
      const isAuthenticated = Boolean(user);
      for (const element of guestOnlyElements) element.hidden = isAuthenticated;
      for (const element of authOnlyElements) element.hidden = !isAuthenticated;

      if (!isAuthenticated) {
        if (navUserChip) navUserChip.textContent = "";
        return;
      }
      if (navUserChip) {
        navUserChip.textContent = `${initialsFor(user.name)} · ${user.name}`;
      }
    }

    updateAuthState(currentUser);

    async function handleRegisterSubmit(event) {
      event.preventDefault();
      setFeedback("");
      if (!validateRegister(registerForm)) return;

      const form = new FormData(registerForm);
      const submitButton = registerForm.querySelector('button[type="submit"]');
      setButtonBusy(submitButton, true, "Creating account...");

      try {
        await register({
          name: form.get("name"),
          email: form.get("email"),
          course: form.get("course"),
          password: form.get("password")
        });
        showToast("Account created! Redirecting to dashboard...", "success");
        setTimeout(() => navigate('/home?view=profile'), 800);
      } catch (error) {
        setFeedback(error.message);
      } finally {
        setButtonBusy(submitButton, false, "");
      }
    }

    async function handleLoginSubmit(event) {
      event.preventDefault();
      setFeedback("");
      if (!validateLogin(loginForm)) return;

      const form = new FormData(loginForm);
      const submitButton = loginForm.querySelector('button[type="submit"]');
      setButtonBusy(submitButton, true, "Logging in...");

      try {
        await login(form.get("email"), form.get("password"));
        showToast("Welcome back! Opening dashboard...", "success");
        setTimeout(() => navigate('/home?view=profile'), 800);
      } catch (error) {
        setFeedback(error.message);
      } finally {
        setButtonBusy(submitButton, false, "");
      }
    }

    async function handleLogout() {
      await logout();
      showToast("Signed out successfully.", "success");
    }

    const authTriggers = document.querySelectorAll("[data-open-auth]");
    const handleAuthTriggerClick = (e) => {
      const trigger = e.currentTarget;
      if (currentUser) {
        navigate('/home?view=profile');
        return;
      }
      openAuthDialog(trigger.dataset.openAuth || "register");
    };
    for (const trigger of authTriggers) trigger.addEventListener("click", handleAuthTriggerClick);

    const handleTabClick = (e) => setAuthMode(e.currentTarget.dataset.authTab || "register");
    for (const tab of authTabs) tab.addEventListener("click", handleTabClick);

    if (registerForm) registerForm.addEventListener("submit", handleRegisterSubmit);
    if (loginForm) loginForm.addEventListener("submit", handleLoginSubmit);
    if (navLogoutButton) navLogoutButton.addEventListener("click", handleLogout);
    if (closeAuthDialogButton) closeAuthDialogButton.addEventListener("click", () => authDialog.close());

    const handleInput = (event) => {
      if (!(event.target instanceof HTMLElement)) return;
      event.target.closest(".field")?.classList.remove("is-invalid");
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) {
        event.target.removeAttribute("aria-invalid");
      }
      if (authFeedback && !authFeedback.hidden) setFeedback("");
    };
    if (registerForm) registerForm.addEventListener("input", handleInput);
    if (loginForm) loginForm.addEventListener("input", handleInput);

    const handlePasswordToggle = (e) => {
      const button = e.currentTarget;
      const inputId = button.dataset.togglePassword;
      const input = inputId ? document.getElementById(inputId) : null;
      if (!(input instanceof HTMLInputElement)) return;
      const reveal = input.type === "password";
      input.type = reveal ? "text" : "password";
      button.textContent = reveal ? "Hide" : "Show";
      button.setAttribute("aria-label", reveal ? "Hide password" : "Show password");
    };
    passwordToggleButtons.forEach(button => button.addEventListener("click", handlePasswordToggle));

    const handleBackdropClick = (event) => {
      if (!authDialog) return;
      const box = authDialog.querySelector(".auth-shell");
      const target = event.target;
      if (box && target && !box.contains(target)) authDialog.close();
    };
    if (authDialog) authDialog.addEventListener("click", handleBackdropClick);
    if (authDialog) authDialog.addEventListener("close", () => setFeedback(""));

    function initScrollReveal() {
      const reveals = document.querySelectorAll(".reveal");
      if (!("IntersectionObserver" in window)) {
        reveals.forEach((el) => el.classList.add("is-visible"));
        return;
      }
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        }
      }, { threshold: 0.1, rootMargin: "0px 0px -40px 0px" });
      for (const el of reveals) observer.observe(el);
    }
    initScrollReveal();

    const handleAnchorClick = (e) => {
      const href = e.currentTarget.getAttribute("href");
      if (href.startsWith('#')) {
        const target = document.querySelector(href);
        if (target) {
          e.preventDefault();
          target.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      } else {
        e.preventDefault();
        navigate(href);
      }
    };
    document.querySelectorAll('a').forEach(anchor => {
      const href = anchor.getAttribute('href');
      if (href && (href.startsWith('#') || href.startsWith('/'))) {
        anchor.addEventListener("click", handleAnchorClick);
      }
    });

    return () => {
      for (const trigger of authTriggers) trigger.removeEventListener("click", handleAuthTriggerClick);
      for (const tab of authTabs) tab.removeEventListener("click", handleTabClick);
      if (registerForm) { registerForm.removeEventListener("submit", handleRegisterSubmit); registerForm.removeEventListener("input", handleInput); }
      if (loginForm) { loginForm.removeEventListener("submit", handleLoginSubmit); loginForm.removeEventListener("input", handleInput); }
      if (navLogoutButton) navLogoutButton.removeEventListener("click", handleLogout);
      if (closeAuthDialogButton) closeAuthDialogButton.removeEventListener("click", () => authDialog.close());
      passwordToggleButtons.forEach(button => button.removeEventListener("click", handlePasswordToggle));
      if (authDialog) { authDialog.removeEventListener("click", handleBackdropClick); authDialog.removeEventListener("close", () => setFeedback("")); }
      document.querySelectorAll('a').forEach(anchor => {
        const href = anchor.getAttribute('href');
        if (href && (href.startsWith('#') || href.startsWith('/'))) anchor.removeEventListener("click", handleAnchorClick);
      });
    };
  }, [currentUser, navigate, login, register, logout]);

  return (
    <div className="landing-page">
      <div className="toast-container" id="toast-container"></div>
      <header className="site-header">
        <div className="shell header-shell">
          <a className="brand" href="/">
            <span className="brand-mark">C</span>
            <span className="brand-copy"><strong>CollabSpace</strong></span>
          </a>
          <nav className="site-nav" aria-label="Main navigation">
            <a href="#problem">Problem</a>
            <a href="#solution">Features</a>
            <a href="#how">Integration</a>
            <a href="#testimonials">Customers</a>
          </nav>
          <div className="header-actions">
            <a className="user-chip auth-only" id="nav-user-chip" href="/home" hidden={true}></a>
            <button className="btn btn-ghost guest-only" data-open-auth="login">Log In</button>
            <button className="btn btn-primary guest-only" data-open-auth="register">Deploy Workspace</button>
            <button className="btn btn-ghost auth-only" id="nav-logout" hidden={true}>Log Out</button>
          </div>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="shell hero-shell">
            <div className="hero-copy">
              <span className="hero-pill">Still tweaking the UI</span>
              <h1>Group projects, without the chaos.</h1>
              <p className="hero-text">
                A simple, slightly messy, but super effective workspace for college teams. See what everyone's doing, assign tasks automatically, and make sure nobody slacks off.
              </p>
              <div className="hero-actions">
                <button className="btn btn-primary" data-open-auth="register">Start a Project →</button>
                <a className="btn btn-secondary" href="#solution">See How it Works</a>
              </div>
              <div className="hero-proof">
                <div className="proof-card"><strong>84%</strong><span>Say group work is unfair.</span></div>
                <div className="proof-card"><strong>Much</strong><span>Faster handoffs.</span></div>
                <div className="proof-card"><strong>Zero</strong><span>Last-minute panics. (Hopefully)</span></div>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="problem">
          <div className="shell">
            <div className="section-heading">
              <span className="section-label">The Problem</span>
              <h2>Why group projects usually suck</h2>
              <p>Most student teams fall apart because nobody knows what the other person is actually doing.</p>
            </div>
            <div className="card-grid four-col">
              <article className="feature-card"><div className="icon-badge">01</div><h3>One Person Does Everything</h3><p>You know exactly what I mean. One person ends up carrying the whole team at 3 AM.</p></article>
              <article className="feature-card"><div className="icon-badge">02</div><h3>Missed Deadlines</h3><p>We forget stuff until the night before it's due. It happens.</p></article>
              <article className="feature-card"><div className="icon-badge">03</div><h3>Who Did What?</h3><p>When the professor asks who wrote which part, nobody remembers. Grading becomes a guessing game.</p></article>
              <article className="feature-card"><div className="icon-badge">04</div><h3>"I thought you were doing that"</h3><p>Tasks get completely forgotten because we assume someone else claimed it.</p></article>
            </div>
          </div>
        </section>

        <section className="section" id="solution">
          <div className="shell">
            <div className="section-heading">
              <span className="section-label">The Solution</span>
              <h2>Built to actually get work done</h2>
            </div>
            <div className="card-grid two-col">
              <article className="feature-card"><div className="icon-badge">📋</div><h3>Simple Task Board</h3><p>A basic To-Do board that updates for everyone. Stop asking in the group chat if the intro is done.</p></article>
              <article className="feature-card"><div className="icon-badge">📊</div><h3>Contribution Graph</h3><p>A clear log of who finished what. Useful for proving to the TA that you actually did work.</p></article>
              <article className="feature-card"><div className="icon-badge">⏰</div><h3>Countdown Clock</h3><p>A giant deadline timer right on the dashboard. Stressful, but it keeps us moving.</p></article>
              <article className="feature-card"><div className="icon-badge">💬</div><h3>Project Chat</h3><p>A place to talk about the project without it getting buried under memes in your iMessage group.</p></article>
            </div>
          </div>
        </section>

        <section className="section cta-section">
          <div className="shell">
            <div className="cta-panel">
              <h2>Let's build something cool</h2>
              <p>Set up your team's workspace and try out CollabSpace for your next big assignment.</p>
              <div className="cta-actions">
                <button className="btn btn-primary" data-open-auth="register">Create Workspace →</button>
                <button className="btn btn-secondary" data-open-auth="login">Log In</button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="shell footer-shell">
          <div>
            <h3>CollabSpace</h3>
            <p>Systematizing student collaboration.</p>
          </div>
          <div className="footer-links">
            <a href="#problem">Architecture</a>
            <a href="#solution">Features</a>
            <a href="/dashboard">Console</a>
          </div>
        </div>
      </footer>

      <dialog className="auth-dialog" id="auth-dialog">
        <div className="auth-shell">
          <button className="close-dialog" id="close-auth-dialog">×</button>
          <div className="auth-header">
            <h2>Authentication</h2>
            <p>Access your workspace.</p>
          </div>
          <div className="auth-tabs">
            <button className="auth-tab is-active" id="register-tab" data-auth-tab="register">Register</button>
            <button className="auth-tab" id="login-tab" data-auth-tab="login">Log In</button>
          </div>
          <p className="form-feedback" id="auth-feedback" hidden={true}></p>
          <section className="auth-panel is-active" id="register-panel">
            <form id="register-form">
              <label className="field"><span>Name</span><input type="text" name="name" required={true} /></label>
              <label className="field"><span>Email</span><input type="email" name="email" required={true} /></label>
              <label className="field"><span>Course</span><input type="text" name="course" /></label>
              <label className="field">
                <span>Password</span>
                <div className="input-action-row">
                  <input type="password" id="register-password" name="password" required={true} />
                  <button className="input-action" type="button" data-toggle-password="register-password">Show</button>
                </div>
              </label>
              <button className="btn btn-primary wide-button" type="submit">Initialize Account</button>
            </form>
          </section>
          <section className="auth-panel" id="login-panel" hidden={true}>
            <form id="login-form">
              <label className="field"><span>Email</span><input type="email" name="email" required={true} /></label>
              <label className="field">
                <span>Password</span>
                <div className="input-action-row">
                  <input type="password" id="login-password" name="password" required={true} />
                  <button className="input-action" type="button" data-toggle-password="login-password">Show</button>
                </div>
              </label>
              <button className="btn btn-primary wide-button" type="submit">Authenticate</button>
            </form>
          </section>
        </div>
      </dialog>
    </div>
  );
}
