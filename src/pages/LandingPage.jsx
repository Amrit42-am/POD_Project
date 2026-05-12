import React, { useEffect } from 'react';
import { gsap } from 'gsap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { request as apiRequest } from '../utils/api';
import CollabNodesBackground from '../components/CollabNodesBackground';
import ThemeToggle from '../components/ThemeToggle';
import logoImg from '../images/Logo.png';

export default function LandingPage() {
  const navigate = useNavigate();
  const { currentUser, login, register, logout } = useAuth();

  useEffect(() => {
    document.body.classList.add("landing-body");
    const landingRoot = document.querySelector(".landing-page");
    const nav = window.navigator;
    const prefersDataSaver = Boolean(nav?.connection?.saveData);
    const lowCpuDevice = (nav?.hardwareConcurrency ?? 8) <= 4;
    const lowMemoryDevice = (nav?.deviceMemory ?? 8) <= 4;
    const isLowPerformanceDevice = prefersDataSaver || lowCpuDevice || lowMemoryDevice;
    if (isLowPerformanceDevice) {
      document.body.classList.add("landing-performance-guard");
    }
    let motionContext = null;
    let disposeLandingScene = null;
    let sectionObserver = null;
    let handlePointerMove = null;
    let handlePointerLeave = null;
    let handleHoverEnter = null;
    let handleHoverLeave = null;
    let cursorTargets = [];
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointerState = { x: 0.5, y: 0.34, active: false };
    let rootBounds = null;
    let pointerMoveRaf = 0;

    if (landingRoot && !prefersReducedMotion) {
      motionContext = gsap.context(() => {
        const heroIntro = gsap.timeline({
          defaults: { duration: 0.4, ease: "power2.out" }
        });

        heroIntro
          .from(".site-header", { y: -14, opacity: 0, duration: 0.34 })
          .from(".hero-visual-frame", { y: 18, opacity: 0, scale: 0.992, duration: 0.46 }, 0.08);
      }, landingRoot);

      const revealTargets = Array.from(landingRoot.querySelectorAll("main .section .reveal"));
      if (revealTargets.length) {
        landingRoot.classList.add("landing-motion-ready");
        sectionObserver = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              entry.target.classList.add("is-visible");
              sectionObserver?.unobserve(entry.target);
            });
          },
          {
            threshold: 0.16,
            rootMargin: "0px 0px -10% 0px"
          }
        );

        revealTargets.forEach((target) => sectionObserver.observe(target));
      }

    }

    if (
      landingRoot &&
      !prefersReducedMotion &&
      !isLowPerformanceDevice &&
      window.matchMedia("(pointer: fine)").matches &&
      window.matchMedia("(hover: hover)").matches
    ) {
      const cursor = landingRoot.querySelector(".landing-cursor");
      const atmosphere = landingRoot.querySelector(".landing-atmosphere");

      if (cursor || atmosphere) {
        document.body.classList.add("has-custom-cursor");

        const setCursorX = cursor ? gsap.quickSetter(cursor, "x", "px") : null;
        const setCursorY = cursor ? gsap.quickSetter(cursor, "y", "px") : null;
        const updateBounds = () => {
          rootBounds = landingRoot.getBoundingClientRect();
        };
        updateBounds();
        window.addEventListener("resize", updateBounds);
        window.addEventListener("scroll", updateBounds, { passive: true });

        handlePointerMove = (event) => {
          document.body.classList.add("cursor-active");
          setCursorX?.(event.clientX);
          setCursorY?.(event.clientY);

          if (atmosphere && rootBounds) {
            const relativeX = (event.clientX - rootBounds.left) / rootBounds.width;
            const relativeY = (event.clientY - rootBounds.top) / rootBounds.height;
            pointerState.x = Math.min(1, Math.max(0, relativeX));
            pointerState.y = Math.min(1, Math.max(0, relativeY));
            pointerState.active = true;
            if (pointerMoveRaf) cancelAnimationFrame(pointerMoveRaf);
            pointerMoveRaf = requestAnimationFrame(() => {
              atmosphere.style.setProperty("--pointer-x", `${(relativeX * 100).toFixed(2)}%`);
              atmosphere.style.setProperty("--pointer-y", `${(relativeY * 100).toFixed(2)}%`);
            });
          }
        };

        handlePointerLeave = () => {
          document.body.classList.remove("cursor-active", "cursor-hover");
          pointerState.x = 0.5;
          pointerState.y = 0.34;
          pointerState.active = false;
          if (atmosphere) {
            atmosphere.style.setProperty("--pointer-x", "50%");
            atmosphere.style.setProperty("--pointer-y", "34%");
          }
        };

        handleHoverEnter = () => document.body.classList.add("cursor-hover");
        handleHoverLeave = () => document.body.classList.remove("cursor-hover");

        cursorTargets = Array.from(
          landingRoot.querySelectorAll(
            "a, button, .proof-card, .feature-card, .step-card, .testimonial-card, .cta-panel"
          )
        );

        window.addEventListener("pointermove", handlePointerMove, { passive: true });
        window.addEventListener("pointerleave", handlePointerLeave);
        cursorTargets.forEach((target) => {
          target.addEventListener("pointerenter", handleHoverEnter);
          target.addEventListener("pointerleave", handleHoverLeave);
        });
        disposeLandingScene = () => {
          window.removeEventListener("resize", updateBounds);
          window.removeEventListener("scroll", updateBounds);
          if (pointerMoveRaf) cancelAnimationFrame(pointerMoveRaf);
        };
      }
    }

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
      forgot: document.getElementById("forgot-panel"),
      login: document.getElementById("login-panel"),
      register: document.getElementById("register-panel"),
      verify: document.getElementById("verify-panel")
    };
    const forgotForm = document.getElementById("forgot-form");
    const verifyForm = document.getElementById("verify-form");
    const resendVerifyButton = document.getElementById("resend-verify-code");
    const forgotCodeRequestButton = document.getElementById("forgot-request-code");
    const forgotResetButton = document.getElementById("forgot-reset-password");
    const forgotEmailInput = document.getElementById("forgot-email");
    const forgotCodeInput = document.getElementById("forgot-code");

    let currentAuthMode = "register";
    let pendingVerificationEmail = "";
    let pendingForgotEmail = "";

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

    function normalizeOtp(value) {
      return String(value || "").replace(/\D/g, "").slice(0, 6);
    }

    async function requestVerificationCode(email) {
      const payload = await apiRequest("/api/auth/verify-email/request", {
        body: JSON.stringify(email ? { email } : {}),
        method: "POST"
      });
      if (payload.devCode) {
        showToast(`Dev verification code: ${payload.devCode}`, "info");
      }
      return payload;
    }

    async function requestPasswordResetCode(email) {
      const payload = await apiRequest("/api/auth/password/forgot/request", {
        body: JSON.stringify({ email }),
        method: "POST"
      });
      if (payload.devCode) {
        showToast(`Dev reset code: ${payload.devCode}`, "info");
      }
      return payload;
    }

    function setAuthMode(mode) {
      currentAuthMode = mode;
      const isRegister = mode === "register";
      const isLogin = mode === "login";

      for (const tab of authTabs) {
        const isActive = tab.dataset.authTab === mode;
        tab.classList.toggle("is-active", isActive);
        tab.setAttribute("aria-selected", String(isActive));
      }

      Object.entries(authPanels).forEach(([key, panel]) => {
        if (!panel) return;
        const isActive = key === mode;
        panel.hidden = !isActive;
        panel.classList.toggle("is-active", isActive);
      });

      authTabs.forEach((tab) => {
        if (isRegister || isLogin) {
          tab.removeAttribute("hidden");
        } else {
          tab.setAttribute("hidden", "true");
        }
      });
      clearFieldValidation(registerForm);
      clearFieldValidation(loginForm);
      setFeedback("");
    }

    function openAuthDialog(mode = "register") {
      setAuthMode(mode);
      if (authDialog && !authDialog.open) {
        authDialog.showModal();
      }
      document.body.classList.add("auth-dialog-open");
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
        const registerEmail = String(form.get("email") || "").trim();
        await register({
          name: form.get("name"),
          email: registerEmail,
          course: form.get("course"),
          password: form.get("password")
        });
        pendingVerificationEmail = registerEmail;
        await requestVerificationCode(registerEmail);
        showToast("Account created. Verify your email to secure your account.", "success");
        setAuthMode("verify");
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

    async function handleVerifySubmit(event) {
      event.preventDefault();
      const submitButton = verifyForm?.querySelector('button[type="submit"]');
      const codeInput = document.getElementById("verify-code");
      const code = normalizeOtp(codeInput?.value);
      if (!/^\d{6}$/.test(code)) {
        setFeedback("Enter the 6-digit verification code.");
        return;
      }
      setButtonBusy(submitButton, true, "Verifying...");
      try {
        const payload = await apiRequest("/api/auth/verify-email/confirm", {
          body: JSON.stringify({ code }),
          method: "POST"
        });
        showToast(payload.message || "Email verified.", "success");
        setFeedback("");
        setTimeout(() => navigate('/home?view=profile'), 700);
      } catch (error) {
        setFeedback(error.message);
      } finally {
        setButtonBusy(submitButton, false, "");
      }
    }

    async function handleForgotRequestCode(event) {
      event.preventDefault();
      const email = String(forgotEmailInput?.value || "").trim();
      if (!isValidEmail(email)) {
        setFeedback("Enter a valid email to receive a reset code.");
        forgotEmailInput?.focus();
        return;
      }
      setButtonBusy(forgotCodeRequestButton, true, "Sending...");
      try {
        await requestPasswordResetCode(email);
        pendingForgotEmail = email;
        showToast("Reset code sent. Check your email.", "success");
        setFeedback("");
      } catch (error) {
        setFeedback(error.message);
      } finally {
        setButtonBusy(forgotCodeRequestButton, false, "");
      }
    }

    async function handleForgotResetPassword(event) {
      event.preventDefault();
      const email = String(forgotEmailInput?.value || "").trim() || pendingForgotEmail;
      const code = normalizeOtp(forgotCodeInput?.value);
      const newPasswordInput = document.getElementById("forgot-new-password");
      const newPassword = String(newPasswordInput?.value || "");
      if (!isValidEmail(email)) {
        setFeedback("Enter your account email first.");
        forgotEmailInput?.focus();
        return;
      }
      if (!/^\d{6}$/.test(code)) {
        setFeedback("Enter the 6-digit reset code.");
        forgotCodeInput?.focus();
        return;
      }
      if (newPassword.length < 8) {
        setFeedback("Use a new password with at least 8 characters.");
        newPasswordInput?.focus();
        return;
      }
      setButtonBusy(forgotResetButton, true, "Resetting...");
      try {
        await apiRequest("/api/auth/password/reset-otp", {
          body: JSON.stringify({ code, email, newPassword }),
          method: "POST"
        });
        showToast("Password reset successful. Please log in.", "success");
        setAuthMode("login");
      } catch (error) {
        setFeedback(error.message);
      } finally {
        setButtonBusy(forgotResetButton, false, "");
      }
    }

    async function handleResendVerifyCode() {
      try {
        await requestVerificationCode(pendingVerificationEmail);
        showToast("A new verification code has been sent.", "success");
      } catch (error) {
        setFeedback(error.message);
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
    const modeSwitchers = document.querySelectorAll("[data-auth-mode]");
    const handleModeSwitch = (e) => {
      const mode = e.currentTarget.dataset.authMode;
      if (mode === "forgot" && forgotEmailInput && loginForm) {
        const loginEmail = String(new FormData(loginForm).get("email") || "").trim();
        if (loginEmail) forgotEmailInput.value = loginEmail;
      }
      if (mode) setAuthMode(mode);
    };
    modeSwitchers.forEach((node) => node.addEventListener("click", handleModeSwitch));

    if (registerForm) registerForm.addEventListener("submit", handleRegisterSubmit);
    if (loginForm) loginForm.addEventListener("submit", handleLoginSubmit);
    if (verifyForm) verifyForm.addEventListener("submit", handleVerifySubmit);
    if (forgotCodeRequestButton) forgotCodeRequestButton.addEventListener("click", handleForgotRequestCode);
    if (forgotResetButton) forgotResetButton.addEventListener("click", handleForgotResetPassword);
    if (resendVerifyButton) resendVerifyButton.addEventListener("click", handleResendVerifyCode);
    if (navLogoutButton) navLogoutButton.addEventListener("click", handleLogout);
    const handleCloseAuthDialog = () => authDialog.close();
    if (closeAuthDialogButton) closeAuthDialogButton.addEventListener("click", handleCloseAuthDialog);

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
    const handleDialogClose = () => {
      setFeedback("");
      document.body.classList.remove("auth-dialog-open");
    };
    if (authDialog) authDialog.addEventListener("click", handleBackdropClick);
    if (authDialog) authDialog.addEventListener("close", handleDialogClose);

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
      motionContext?.revert();
      disposeLandingScene?.();
      sectionObserver?.disconnect();
      landingRoot?.classList.remove("landing-motion-ready");
      if (handlePointerMove) window.removeEventListener("pointermove", handlePointerMove);
      if (handlePointerLeave) window.removeEventListener("pointerleave", handlePointerLeave);
      cursorTargets.forEach((target) => {
        if (handleHoverEnter) target.removeEventListener("pointerenter", handleHoverEnter);
        if (handleHoverLeave) target.removeEventListener("pointerleave", handleHoverLeave);
      });
      document.body.classList.remove(
        "landing-body",
        "has-custom-cursor",
        "cursor-active",
        "cursor-hover",
        "landing-performance-guard",
        "auth-dialog-open"
      );
      for (const trigger of authTriggers) trigger.removeEventListener("click", handleAuthTriggerClick);
      for (const tab of authTabs) tab.removeEventListener("click", handleTabClick);
      modeSwitchers.forEach((node) => node.removeEventListener("click", handleModeSwitch));
      if (registerForm) { registerForm.removeEventListener("submit", handleRegisterSubmit); registerForm.removeEventListener("input", handleInput); }
      if (loginForm) { loginForm.removeEventListener("submit", handleLoginSubmit); loginForm.removeEventListener("input", handleInput); }
      if (verifyForm) verifyForm.removeEventListener("submit", handleVerifySubmit);
      if (forgotCodeRequestButton) forgotCodeRequestButton.removeEventListener("click", handleForgotRequestCode);
      if (forgotResetButton) forgotResetButton.removeEventListener("click", handleForgotResetPassword);
      if (resendVerifyButton) resendVerifyButton.removeEventListener("click", handleResendVerifyCode);
      if (navLogoutButton) navLogoutButton.removeEventListener("click", handleLogout);
      if (closeAuthDialogButton) closeAuthDialogButton.removeEventListener("click", handleCloseAuthDialog);
      passwordToggleButtons.forEach(button => button.removeEventListener("click", handlePasswordToggle));
      if (authDialog) { authDialog.removeEventListener("click", handleBackdropClick); authDialog.removeEventListener("close", handleDialogClose); }
      document.querySelectorAll('a').forEach(anchor => {
        const href = anchor.getAttribute('href');
        if (href && (href.startsWith('#') || href.startsWith('/'))) anchor.removeEventListener("click", handleAnchorClick);
      });
    };
  }, [currentUser, navigate, login, register, logout]);

  return (
    <div className="landing-page">
      <div className="toast-container" id="toast-container"></div>
      <div className="landing-cursor" aria-hidden="true">
        <span className="landing-cursor-ring"></span>
        <span className="landing-cursor-core"></span>
      </div>
      <div className="landing-atmosphere" aria-hidden="true">
        <CollabNodesBackground />
      </div>
      <header className="site-header">
        <div className="shell header-shell">
          <a className="brand" href="/">
            <img src={logoImg} alt="CollabSpace Logo" className="brand-logo" style={{ height: '32px', width: 'auto', transform: 'scale(2.5)', transformOrigin: 'left center', marginRight: '25px' }} />
            <span className="brand-copy" style={{ zIndex: 1, position: 'relative' }}><strong>CollabSpace</strong></span>
          </a>
          <nav className="site-nav" aria-label="Main navigation">
            <a href="#problem">Problem</a>
            <a href="#solution">Features</a>
            <a href="#how">Integration</a>
            <a href="#testimonials">Customers</a>
          </nav>
          <div className="header-actions">
            <ThemeToggle />
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
            <div className="hero-copy reveal is-visible">
              <span className="hero-pill">Built for serious student teams</span>
              <span className="hero-kicker">Planning, ownership, and momentum in one workspace</span>
              <h1>Group projects, without the chaos.</h1>
              <p className="hero-text">
                A polished collaboration workspace for college teams that need clarity fast. Plan the work, see who owns what, and keep every deliverable moving without the last-night confusion.
              </p>
              <div className="hero-actions">
                <button className="btn btn-primary" data-open-auth="register">Start a Project →</button>
                <a className="btn btn-secondary" href="#solution">Explore the Flow</a>
              </div>
              <div className="hero-proof">
                <div className="proof-card"><strong>84%</strong><span>Say group work feels unfair.</span></div>
                <div className="proof-card"><strong>Live</strong><span>Shared board, chat, and team visibility.</span></div>
                <div className="proof-card"><strong>Smart</strong><span>AI-assisted task routing and role balance.</span></div>
              </div>
            </div>
            <div className="hero-visual reveal reveal-delay-2" aria-hidden="true">
              <div className="hero-visual-frame">
                <div className="hero-console">
                  <div className="hero-console-head">
                    <span className="hero-console-status">Workspace Preview</span>
                    <span className="hero-console-title">Sprint Overview</span>
                  </div>
                  <div className="hero-console-grid">
                    <div className="console-metric"><strong>04</strong><span>Active members</span></div>
                    <div className="console-metric"><strong>12</strong><span>Tasks in flight</span></div>
                    <div className="console-metric"><strong>03</strong><span>AI suggestions</span></div>
                    <div className="console-metric"><strong>02D</strong><span>Until review</span></div>
                  </div>
                  <div className="hero-console-lanes">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                  <div className="hero-console-feed">
                    <div>Research deck assigned to the teammate with the strongest matching focus.</div>
                    <div>Contribution view updated after the latest sprint handoff.</div>
                    <div>Deadline sync pushed to the full workspace in real time.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section" id="problem">
          <div className="shell">
            <div className="section-heading reveal">
              <span className="section-label">01 // Why teams break</span>
              <h2>Why group projects usually suck</h2>
              <p>Most student teams fall apart because nobody knows what the other person is actually doing.</p>
            </div>
            <div className="card-grid four-col">
              <article className="feature-card reveal reveal-delay-1"><div className="icon-badge">01</div><h3>One Person Does Everything</h3><p>You know exactly what I mean. One person ends up carrying the whole team at 3 AM.</p></article>
              <article className="feature-card reveal reveal-delay-2"><div className="icon-badge">02</div><h3>Missed Deadlines</h3><p>We forget stuff until the night before it's due. It happens.</p></article>
              <article className="feature-card reveal reveal-delay-3"><div className="icon-badge">03</div><h3>Who Did What?</h3><p>When the professor asks who wrote which part, nobody remembers. Grading becomes a guessing game.</p></article>
              <article className="feature-card reveal reveal-delay-4"><div className="icon-badge">04</div><h3>"I thought you were doing that"</h3><p>Tasks get completely forgotten because we assume someone else claimed it.</p></article>
            </div>
          </div>
        </section>

        <section className="section" id="solution">
          <div className="shell">
            <div className="section-heading reveal">
              <span className="section-label">02 // What changes</span>
              <h2>Built to actually get work done</h2>
            </div>
            <div className="card-grid two-col">
              <article className="feature-card reveal reveal-delay-1"><div className="icon-badge">📋</div><h3>Simple Task Board</h3><p>A basic To-Do board that updates for everyone. Stop asking in the group chat if the intro is done.</p></article>
              <article className="feature-card reveal reveal-delay-2"><div className="icon-badge">📊</div><h3>Contribution Graph</h3><p>A clear log of who finished what. Useful for proving to the TA that you actually did work.</p></article>
              <article className="feature-card reveal reveal-delay-3"><div className="icon-badge">⏰</div><h3>Countdown Clock</h3><p>A giant deadline timer right on the dashboard. Stressful, but it keeps us moving.</p></article>
              <article className="feature-card reveal reveal-delay-4"><div className="icon-badge">💬</div><h3>Project Chat</h3><p>A place to talk about the project without it getting buried under memes in your iMessage group.</p></article>
            </div>
          </div>
        </section>

        <section className="section" id="how">
          <div className="shell">
            <div className="section-heading reveal">
              <span className="section-label">03 // How it fits together</span>
              <h2>How the workflow snaps together</h2>
              <p>CollabSpace is still simple at heart. The difference is that the system now feels more intentional, more guided, and more premium.</p>
            </div>
            <div className="card-grid three-col">
              <article className="step-card reveal reveal-delay-1"><div className="icon-badge">01</div><h3>Open a workspace</h3><p>Create the squad, invite your teammates, and turn a messy assignment into one shared operating table.</p></article>
              <article className="step-card reveal reveal-delay-2"><div className="icon-badge">02</div><h3>Route the work</h3><p>Push tasks into the board, let the system assign intelligently, and keep deadlines visible from day one.</p></article>
              <article className="step-card reveal reveal-delay-3"><div className="icon-badge">03</div><h3>Track the output</h3><p>Use the board, chat, and contribution view to see what is moving, what is blocked, and who is carrying momentum.</p></article>
            </div>
          </div>
        </section>

        <section className="section" id="testimonials">
          <div className="shell">
            <div className="section-heading reveal">
              <span className="section-label">04 // Experience principles</span>
              <h2>A landing page that feels stronger, not louder</h2>
              <p>The goal is a more original product identity: cleaner than an agency portfolio, more alive than a basic SaaS template, and still easy to trust.</p>
            </div>
            <div className="card-grid three-col">
              <article className="testimonial-card reveal reveal-delay-1"><p>Clear hierarchy, stronger spacing, and better product framing so the first impression feels intentional.</p><strong>Editorial structure</strong><span>Inspired by premium product sites</span></article>
              <article className="testimonial-card reveal reveal-delay-2"><p>Motion that guides attention instead of shouting for it, with smoother entrances and a more refined hero rhythm.</p><strong>Purposeful motion</strong><span>Lightweight, stable animation</span></article>
              <article className="testimonial-card reveal reveal-delay-3"><p>Layered visuals that feel modern and interactive without turning the product into a clone of any one reference site.</p><strong>Original polish</strong><span>Adapted to your brand</span></article>
            </div>
          </div>
        </section>

        <section className="section cta-section">
          <div className="shell">
            <div className="cta-panel reveal">
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
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '0.5rem' }}>
              <img src={logoImg} alt="CollabSpace Logo" style={{ height: '32px', width: 'auto', transform: 'scale(2.5)', transformOrigin: 'left center', marginRight: '25px' }} />
              <h3 style={{ margin: 0, zIndex: 1, position: 'relative' }}>CollabSpace</h3>
            </div>
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
            <h2>Welcome Back</h2>
            <p>Sign in or create an account to open your workspace.</p>
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
              <button className="btn btn-primary wide-button" type="submit">Create Account</button>
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
              <button className="btn btn-primary wide-button" type="submit">Continue to Workspace</button>
              <button className="btn btn-ghost wide-button" type="button" data-auth-mode="forgot">Forgot Password?</button>
            </form>
          </section>
          <section className="auth-panel" id="verify-panel" hidden={true}>
            <form id="verify-form">
              <p className="modal-subtitle">Enter the 6-digit code sent to your email to verify your account.</p>
              <label className="field"><span>Verification Code</span><input type="text" id="verify-code" inputMode="numeric" maxLength="6" placeholder="123456" required={true} /></label>
              <button className="btn btn-primary wide-button" type="submit">Verify Email</button>
              <button className="btn btn-secondary wide-button" type="button" id="resend-verify-code">Resend Code</button>
              <button className="btn btn-ghost wide-button" type="button" data-auth-mode="login">Back to Login</button>
            </form>
          </section>
          <section className="auth-panel" id="forgot-panel" hidden={true}>
            <form id="forgot-form">
              <p className="modal-subtitle">Reset password using a one-time code sent to your email.</p>
              <label className="field"><span>Email</span><input type="email" id="forgot-email" required={true} /></label>
              <div className="auth-inline-actions">
                <button className="btn btn-secondary wide-button" type="button" id="forgot-request-code">Send Reset Code</button>
              </div>
              <label className="field"><span>Reset Code</span><input type="text" id="forgot-code" inputMode="numeric" maxLength="6" placeholder="123456" /></label>
              <label className="field">
                <span>New Password</span>
                <div className="input-action-row">
                  <input type="password" id="forgot-new-password" required={true} />
                  <button className="input-action" type="button" data-toggle-password="forgot-new-password">Show</button>
                </div>
              </label>
              <button className="btn btn-primary wide-button" type="button" id="forgot-reset-password">Reset Password</button>
              <button className="btn btn-ghost wide-button" type="button" data-auth-mode="login">Back to Login</button>
            </form>
          </section>
        </div>
      </dialog>
    </div>
  );
}
