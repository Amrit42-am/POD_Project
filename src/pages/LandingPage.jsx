import React, { useEffect } from 'react';
import { gsap } from 'gsap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function LandingPage() {
  const navigate = useNavigate();
  const { currentUser, login, register, logout } = useAuth();

  useEffect(() => {
    document.body.classList.add("landing-body");
    const landingRoot = document.querySelector(".landing-page");
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

      const landingCanvas = landingRoot.querySelector(".landing-wave-canvas");

      if (landingCanvas instanceof HTMLCanvasElement) {
        const context = landingCanvas.getContext("2d");

        if (context) {
          let frameId = 0;
          let renderWidth = 0;
          let renderHeight = 0;
          let dpr = 1;
          const smoothedPointer = { x: pointerState.x, y: pointerState.y };
          const waveBands = Array.from({ length: 8 }, (_, index) => ({
            progress: 0.2 + index * 0.092,
            amplitude: 0.004 + (1 - index / 7) * 0.0038,
            speed: 0.26 + index * 0.055,
            phase: index * 0.68,
            stroke: `rgba(196, 216, 255, ${0.14 - index * 0.01})`,
            glow: `rgba(${index % 2 === 0 ? "120, 136, 255" : "96, 184, 255"}, ${0.08 - index * 0.005})`,
            fill: `rgba(${index % 2 === 0 ? "88, 106, 210" : "72, 132, 214"}, ${0.05 - index * 0.004})`,
            width: 0.95 + (1 - index / 7) * 0.55
          }));

          const resizeScene = () => {
            renderWidth = Math.max(1, Math.round(landingRoot.clientWidth));
            renderHeight = Math.max(1, Math.round(landingRoot.scrollHeight));
            dpr = Math.min(window.devicePixelRatio || 1, 2);
            landingCanvas.width = Math.round(renderWidth * dpr);
            landingCanvas.height = Math.round(renderHeight * dpr);
            landingCanvas.style.width = `${renderWidth}px`;
            landingCanvas.style.height = `${renderHeight}px`;
            context.setTransform(dpr, 0, 0, dpr, 0, 0);
          };

          const buildWaveGeometry = (band, timeSeconds) => {
            const baseY =
              renderHeight * band.progress +
              Math.sin(timeSeconds * band.speed * 0.55 + band.phase) * renderHeight * 0.0035;
            const step = Math.max(44, Math.round(renderWidth / 18));
            const pointerBandFalloff = Math.exp(-Math.pow(band.progress - smoothedPointer.y, 2) * 24);
            const points = [];

            for (let x = -step; x <= renderWidth + step; x += step) {
              const normalizedX = x / renderWidth;
              const cursorDistance = normalizedX - smoothedPointer.x;
              const rippleFalloff = Math.exp(-cursorDistance * cursorDistance * 16);
              const swell =
                Math.sin(normalizedX * 7.2 - timeSeconds * (band.speed * 1.55) + band.phase) *
                  renderHeight *
                  band.amplitude +
                Math.cos(normalizedX * 2.8 + timeSeconds * 0.52 + band.phase * 1.25) *
                  renderHeight *
                  band.amplitude *
                  0.48;
              const pointerRipple =
                Math.sin(cursorDistance * 18 - timeSeconds * 3.6 + band.phase) *
                renderHeight *
                band.amplitude *
                1.6 *
                rippleFalloff *
                pointerBandFalloff *
                (pointerState.active ? 0.85 : 0.12);
              points.push({ x, y: baseY + swell + pointerRipple });
            }

            return points;
          };

          const buildWaveStrokePath = (points) => {
            const path = new Path2D();
            if (!points.length) return path;
            path.moveTo(points[0].x, points[0].y);

            for (let i = 1; i < points.length; i += 1) {
              const current = points[i];
              const previous = points[i - 1];
              const midX = (previous.x + current.x) * 0.5;
              const midY = (previous.y + current.y) * 0.5;
              path.quadraticCurveTo(previous.x, previous.y, midX, midY);
            }

            const last = points[points.length - 1];
            path.lineTo(last.x, last.y);
            return path;
          };

          const buildWaveFillPath = (points) => {
            const path = buildWaveStrokePath(points);
            if (!points.length) return path;
            const first = points[0];
            const last = points[points.length - 1];
            path.lineTo(last.x, renderHeight + 80);
            path.lineTo(first.x, renderHeight + 80);
            path.closePath();
            return path;
          };

          const renderScene = (timeMs) => {
            const timeSeconds = timeMs * 0.001;
            smoothedPointer.x += (pointerState.x - smoothedPointer.x) * 0.05;
            smoothedPointer.y += (pointerState.y - smoothedPointer.y) * 0.05;

            context.clearRect(0, 0, renderWidth, renderHeight);
            waveBands.forEach((band, index) => {
              const wavePoints = buildWaveGeometry(band, timeSeconds + index * 0.08);
              const strokePath = buildWaveStrokePath(wavePoints);

              if (index >= 3) {
                const fillPath = buildWaveFillPath(wavePoints);
                const fillGradient = context.createLinearGradient(0, renderHeight * band.progress, 0, renderHeight + 80);
                fillGradient.addColorStop(0, band.fill);
                fillGradient.addColorStop(1, "rgba(9, 18, 38, 0)");
                context.save();
                context.fillStyle = fillGradient;
                context.fill(fillPath);
                context.restore();
              }

              context.save();
              context.strokeStyle = band.glow;
              context.lineWidth = band.width * 2.2;
              context.stroke(strokePath);
              context.restore();

              context.save();
              const lineGradient = context.createLinearGradient(0, renderHeight * band.progress, renderWidth, renderHeight * (band.progress + 0.04));
              lineGradient.addColorStop(0, band.stroke);
              lineGradient.addColorStop(0.52, "rgba(222, 234, 255, 0.2)");
              lineGradient.addColorStop(1, band.stroke);
              context.strokeStyle = lineGradient;
              context.lineWidth = band.width;
              context.stroke(strokePath);
              context.restore();
            });

            const pointerGlow = context.createRadialGradient(
              smoothedPointer.x * renderWidth,
              smoothedPointer.y * renderHeight,
              0,
              smoothedPointer.x * renderWidth,
              smoothedPointer.y * renderHeight,
              Math.max(renderWidth, renderHeight) * 0.12
            );
            pointerGlow.addColorStop(0, "rgba(184, 219, 255, 0.08)");
            pointerGlow.addColorStop(0.42, "rgba(126, 158, 255, 0.035)");
            pointerGlow.addColorStop(1, "rgba(126, 158, 255, 0)");
            context.fillStyle = pointerGlow;
            context.fillRect(0, 0, renderWidth, renderHeight);

            frameId = window.requestAnimationFrame(renderScene);
          };

          resizeScene();
          frameId = window.requestAnimationFrame(renderScene);

          const resizeObserver =
            typeof ResizeObserver !== "undefined"
              ? new ResizeObserver(() => resizeScene())
              : null;

          if (resizeObserver) {
            resizeObserver.observe(landingRoot);
          } else {
            window.addEventListener("resize", resizeScene);
          }

          disposeLandingScene = () => {
            window.cancelAnimationFrame(frameId);
            resizeObserver?.disconnect();
            if (!resizeObserver) window.removeEventListener("resize", resizeScene);
          };
        }
      }
    }

    if (
      landingRoot &&
      !prefersReducedMotion &&
      window.matchMedia("(pointer: fine)").matches &&
      window.matchMedia("(hover: hover)").matches
    ) {
      const cursor = landingRoot.querySelector(".landing-cursor");
      const atmosphere = landingRoot.querySelector(".landing-atmosphere");

      if (cursor || atmosphere) {
        document.body.classList.add("has-custom-cursor");

        const moveCursorX = cursor ? gsap.quickTo(cursor, "x", { duration: 0.2, ease: "power3.out" }) : null;
        const moveCursorY = cursor ? gsap.quickTo(cursor, "y", { duration: 0.2, ease: "power3.out" }) : null;

        handlePointerMove = (event) => {
          document.body.classList.add("cursor-active");
          moveCursorX?.(event.clientX);
          moveCursorY?.(event.clientY);

          if (atmosphere) {
            const bounds = landingRoot.getBoundingClientRect();
            const relativeX = (event.clientX - bounds.left) / bounds.width;
            const relativeY = (event.clientY - bounds.top) / bounds.height;
            pointerState.x = Math.min(1, Math.max(0, relativeX));
            pointerState.y = Math.min(1, Math.max(0, relativeY));
            pointerState.active = true;

            atmosphere.style.setProperty("--pointer-x", `${(relativeX * 100).toFixed(2)}%`);
            atmosphere.style.setProperty("--pointer-y", `${(relativeY * 100).toFixed(2)}%`);
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

        landingRoot.addEventListener("pointermove", handlePointerMove);
        landingRoot.addEventListener("pointerleave", handlePointerLeave);
        cursorTargets.forEach((target) => {
          target.addEventListener("pointerenter", handleHoverEnter);
          target.addEventListener("pointerleave", handleHoverLeave);
        });
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
    const handleDialogClose = () => setFeedback("");
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
      if (landingRoot && handlePointerMove) landingRoot.removeEventListener("pointermove", handlePointerMove);
      if (landingRoot && handlePointerLeave) landingRoot.removeEventListener("pointerleave", handlePointerLeave);
      cursorTargets.forEach((target) => {
        if (handleHoverEnter) target.removeEventListener("pointerenter", handleHoverEnter);
        if (handleHoverLeave) target.removeEventListener("pointerleave", handleHoverLeave);
      });
      document.body.classList.remove("landing-body", "has-custom-cursor", "cursor-active", "cursor-hover");
      for (const trigger of authTriggers) trigger.removeEventListener("click", handleAuthTriggerClick);
      for (const tab of authTabs) tab.removeEventListener("click", handleTabClick);
      if (registerForm) { registerForm.removeEventListener("submit", handleRegisterSubmit); registerForm.removeEventListener("input", handleInput); }
      if (loginForm) { loginForm.removeEventListener("submit", handleLoginSubmit); loginForm.removeEventListener("input", handleInput); }
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
        <canvas className="landing-wave-canvas"></canvas>
      </div>
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
