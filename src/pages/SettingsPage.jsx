import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { currentUser: authCurrentUser, logout, setCurrentUser } = useAuth();

  useEffect(() => {
    if (!authCurrentUser) return;
    let currentUser = authCurrentUser;
    const toastContainer = document.getElementById("toast-container");

    async function request(url, options = {}) {
      const response = await fetch(url, {
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", ...(options.headers || {}) },
        ...options
      });
      let payload = {};
      try { payload = await response.json(); } catch { payload = {}; }
      if (!response.ok) throw new Error(payload.error || "Request failed.");
      return payload;
    }

    function showToast(message, type = "success") {
      if (!toastContainer) {
        return;
      }

      const toast = document.createElement("div");
      toast.className = `toast toast-${type}`;
      toast.textContent = message;
      toastContainer.appendChild(toast);
      setTimeout(() => {
        toast.classList.add("toast-exit");
        setTimeout(() => toast.remove(), 280);
      }, 2800);
    }

    const tagState = {
      skills: [],
      workFocus: []
    };

    const tagConfig = {
      skills: {
        inputId: "skills-input",
        listId: "skills-tags",
        emptyLabel: "No skills added yet"
      },
      workFocus: {
        inputId: "work-focus-input",
        listId: "work-focus-tags",
        emptyLabel: "No focus areas added yet"
      }
    };

    function escapeHtml(value) {
      return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    }

    function normalizeTag(tag) {
      return String(tag || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 36);
    }

    function parseTagInput(rawValue) {
      return String(rawValue || "")
        .split(/[,\n]/g)
        .map(normalizeTag)
        .filter(Boolean);
    }

    function setTagValues(key, values) {
      const uniqueTags = [];
      const seen = new Set();

      values.forEach((value) => {
        const normalized = normalizeTag(value);
        if (!normalized) return;
        const lookupKey = normalized.toLowerCase();
        if (seen.has(lookupKey)) return;
        seen.add(lookupKey);
        uniqueTags.push(normalized);
      });

      tagState[key] = uniqueTags;
      renderTagList(key);
      renderSettingsPreview();
    }

    function addTagValues(key, values) {
      setTagValues(key, [...tagState[key], ...values]);
    }

    function commitPendingTag(key) {
      const config = tagConfig[key];
      const input = document.getElementById(config.inputId);
      if (!input) return;

      const nextTags = parseTagInput(input.value);
      if (nextTags.length > 0) {
        addTagValues(key, nextTags);
      }
      input.value = "";
    }

    function renderTagList(key) {
      const config = tagConfig[key];
      const container = document.getElementById(config.listId);
      if (!container) return;

      const tags = Array.isArray(tagState[key]) ? tagState[key] : [];

      if (tags.length === 0) {
        container.innerHTML = `<span class="tag-editor-empty">${config.emptyLabel}</span>`;
        return;
      }

      container.innerHTML = tags.map((tag) => `
        <span class="tag-editor-pill">
          <span>${escapeHtml(tag)}</span>
          <button type="button" class="tag-editor-remove" data-tag-key="${key}" data-tag-value="${escapeHtml(tag)}" aria-label="Remove ${escapeHtml(tag)}">×</button>
        </span>
      `).join("");
    }

    function getPreviewInitials(name) {
      return String(name || "")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("") || "?";
    }

    function renderPreviewTags(containerId, tags, emptyLabel) {
      const container = document.getElementById(containerId);
      if (!container) {
        return;
      }

      if (!Array.isArray(tags) || tags.length === 0) {
        container.innerHTML = `<span class="skill-tag skill-tag-empty">${escapeHtml(emptyLabel)}</span>`;
        return;
      }

      container.innerHTML = tags
        .map((tag) => `<span class="skill-tag">${escapeHtml(tag)}</span>`)
        .join("");
    }

    function renderSettingsPreview() {
      const name = String(document.getElementById("name")?.value || "").trim();
      const course = String(document.getElementById("course")?.value || "").trim();
      const about = String(document.getElementById("about")?.value || "").trim();
      const completionParts = [
        name,
        course,
        about,
        tagState.skills.length > 0 ? "skills" : "",
        tagState.workFocus.length > 0 ? "focus" : ""
      ];
      const completionScore = Math.round((completionParts.filter(Boolean).length / completionParts.length) * 100);

      const previewName = document.getElementById("settings-preview-name");
      const previewCourse = document.getElementById("settings-preview-course");
      const previewAbout = document.getElementById("settings-preview-about");
      const previewAvatar = document.getElementById("settings-preview-avatar");
      const previewCompletion = document.getElementById("settings-preview-completion");
      const previewSkillsCount = document.getElementById("settings-preview-skills-count");
      const previewFocusCount = document.getElementById("settings-preview-focus-count");

      if (previewName) previewName.textContent = name || "Your Name";
      if (previewCourse) previewCourse.textContent = course || "Course or major not added yet";
      if (previewAbout) {
        previewAbout.textContent = about || "Add a short summary about how you like to work so teammates know where you shine.";
      }
      if (previewAvatar) previewAvatar.textContent = getPreviewInitials(name);
      if (previewCompletion) previewCompletion.textContent = `${completionScore}%`;
      if (previewSkillsCount) previewSkillsCount.textContent = String(tagState.skills.length);
      if (previewFocusCount) previewFocusCount.textContent = String(tagState.workFocus.length);

      renderPreviewTags("settings-preview-skills", tagState.skills, "Your strongest skills will show up here");
      renderPreviewTags("settings-preview-focus", tagState.workFocus, "Add your usual work lanes to guide assignments");
    }

    function wireTagInput(key) {
      const config = tagConfig[key];
      const input = document.getElementById(config.inputId);
      const list = document.getElementById(config.listId);
      if (!input || !list) return;

      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === ",") {
          event.preventDefault();
          commitPendingTag(key);
          return;
        }
        if (event.key === "Backspace" && !input.value.trim() && tagState[key].length > 0) {
          const nextTags = tagState[key].slice(0, -1);
          setTagValues(key, nextTags);
        }
      });

      input.addEventListener("blur", () => {
        commitPendingTag(key);
      });

      list.addEventListener("click", (event) => {
        const removeButton = event.target.closest("[data-tag-key]");
        if (!removeButton) return;
        const tagValue = String(removeButton.dataset.tagValue || "");
        setTagValues(
          key,
          tagState[key].filter((tag) => tag.toLowerCase() !== tagValue.toLowerCase())
        );
      });
    }

    // Bootstrap: populate form fields from current user
    function bootstrap() {
      try {
        document.getElementById("name").value = currentUser.name || "";
        document.getElementById("course").value = currentUser.course || "";
        document.getElementById("about").value = currentUser.about || "";
        setTagValues("skills", Array.isArray(currentUser.skills) ? currentUser.skills : []);
        setTagValues("workFocus", Array.isArray(currentUser.workFocus) ? currentUser.workFocus : []);
        renderSettingsPreview();
      } catch (err) {
        navigate("/?auth=login");
      }
    }

    // Form submit handler — use cloneNode to prevent duplicate listeners
    const form = document.getElementById("settings-form");
    if (form) {
      const newForm = form.cloneNode(true);
      form.parentNode.replaceChild(newForm, form);
      newForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        commitPendingTag("skills");
        commitPendingTag("workFocus");

        const button = event.target.querySelector('button[type="submit"]');
        const originalText = button.textContent;
        button.textContent = "Saving...";
        button.disabled = true;

        try {
          const body = {
            about: document.getElementById("about").value,
            course: document.getElementById("course").value,
            name: document.getElementById("name").value,
            skills: tagState.skills,
            workFocus: tagState.workFocus
          };

          const payload = await request("/api/users/profile", {
            method: "PUT",
            body: JSON.stringify(body)
          });

          currentUser = payload.user || currentUser;
          if (payload.user) {
            setCurrentUser(payload.user);
          }
          setTagValues("skills", Array.isArray(currentUser.skills) ? currentUser.skills : []);
          setTagValues("workFocus", Array.isArray(currentUser.workFocus) ? currentUser.workFocus : []);
          showToast("Profile updated.", "success");
        } catch (err) {
          showToast("Failed to save: " + err.message, "error");
        } finally {
          button.textContent = originalText;
          button.disabled = false;
        }
      });
    }

    // Global click handler for navigation
    const handleGlobalClick = (e) => {
      const target = e.target.closest('[data-navigate]');
      if (!target) return;
      navigate(target.dataset.navigate.replace('.html', ''));
    };
    document.addEventListener('click', handleGlobalClick);

    // Wire up tag inputs and populate form
    Object.keys(tagConfig).forEach(wireTagInput);
    bootstrap();
    ["name", "course", "about"].forEach((fieldId) => {
      document.getElementById(fieldId)?.addEventListener("input", renderSettingsPreview);
    });

    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, [authCurrentUser, navigate, logout, setCurrentUser]);

  return (
    <>
    <div className="app-shell-theme">
    <div className="toast-container" id="toast-container"></div>
    <div className="app-layout">
      
      
      <aside className="app-sidebar">
        <div className="sidebar-header">
          <div className="sidebar-brand" data-navigate="/">
            <div className="brand-mark">C</div>
            CollabSpace
          </div>
        </div>
        
        <nav className="sidebar-nav">
          
          <button className="sidebar-nav-item active">
            <span>Profile Settings</span>
          </button>
        </nav>
        
        <div className="sidebar-footer">
          <ThemeToggle className="sidebar-nav-item" />
          <button data-navigate="/home.html" className="sidebar-nav-item">Back to Hub</button>
        </div>
      </aside>

      <main className="app-main">
        <div className="app-main-header">
          <h1 className="app-main-title">Profile Settings</h1>
          <p className="app-main-subtitle">Manage your identity, interests, and the kind of work you usually take on.</p>
        </div>

        <div className="settings-shell">
          <section className="dashboard-panel settings-profile-card">
            <form id="settings-form" className="settings-profile-form">
              <div className="settings-field">
                <label htmlFor="name">Your Name</label>
                <input className="settings-input" type="text" id="name" required={true} />
              </div>

              <div className="settings-field">
                <label htmlFor="course">Course / Major</label>
                <input className="settings-input" type="text" id="course" placeholder="e.g. CS 101" />
              </div>

              <div className="settings-field">
                <label htmlFor="about">About You</label>
                <textarea className="settings-input settings-textarea" id="about" rows="4" placeholder="Share what you enjoy building, how you like to collaborate, and what makes you effective on a team."></textarea>
              </div>

              <div className="settings-field">
                <label htmlFor="skills-input">Skills & Interests</label>
                <div className="tag-editor" id="skills-editor">
                  <div id="skills-tags" className="tag-editor-list"></div>
                  <input className="tag-editor-input" type="text" id="skills-input" placeholder="Type a skill and press Enter" />
                </div>
                <p className="settings-helper">Add the things you're good at or enjoy working with.</p>
              </div>

              <div className="settings-field">
                <label htmlFor="work-focus-input">What I Usually Work On</label>
                <div className="tag-editor" id="work-focus-editor">
                  <div id="work-focus-tags" className="tag-editor-list"></div>
                  <input className="tag-editor-input" type="text" id="work-focus-input" placeholder="Frontend, backend, design, research..." />
                </div>
                <p className="settings-helper">Press Enter or comma to add each area.</p>
              </div>

              <div className="settings-actions">
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </section>

          <aside className="settings-aside">
            <section className="dashboard-panel settings-preview-card">
              <span className="settings-kicker">Live Preview</span>
              <div className="settings-preview-header">
                <div id="settings-preview-avatar" className="avatar-circle">?</div>
                <div className="settings-preview-copy">
                  <strong id="settings-preview-name" className="settings-preview-name">Your Name</strong>
                  <span id="settings-preview-course" className="settings-preview-course">Course or major not added yet</span>
                </div>
              </div>
              <p id="settings-preview-about" className="settings-preview-about">Add a short summary about how you like to work so teammates know where you shine.</p>

              <div className="settings-preview-stats">
                <div className="settings-preview-stat">
                  <span className="settings-preview-label">Profile Completion</span>
                  <strong id="settings-preview-completion" className="settings-preview-value">0%</strong>
                </div>
                <div className="settings-preview-stat">
                  <span className="settings-preview-label">Skills Added</span>
                  <strong id="settings-preview-skills-count" className="settings-preview-value">0</strong>
                </div>
                <div className="settings-preview-stat">
                  <span className="settings-preview-label">Focus Areas</span>
                  <strong id="settings-preview-focus-count" className="settings-preview-value">0</strong>
                </div>
              </div>

              <div className="settings-preview-block">
                <span className="profile-section-title">Skills & Interests</span>
                <div id="settings-preview-skills" className="skills-list"></div>
              </div>

              <div className="settings-preview-block">
                <span className="profile-section-title">What I Usually Work On</span>
                <div id="settings-preview-focus" className="skills-list"></div>
              </div>
            </section>

            <section className="dashboard-panel settings-tips-card">
              <span className="settings-kicker">Assignment Quality</span>
              <h2 className="settings-tips-title">Small profile details make the whole workspace smarter.</h2>
              <div className="settings-tip-list">
                <div className="settings-tip-item">Clear skills help task assignment feel intentional instead of random.</div>
                <div className="settings-tip-item">A short bio helps teammates know when to pull you into the right part of a project.</div>
                <div className="settings-tip-item">Focus areas make contribution views easier to interpret during reviews and grading.</div>
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
    </div>

    </>
  );
}
