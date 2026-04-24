import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { request, escapeHtml } from '../utils/api';

export default function SettingsPage() {
  const navigate = useNavigate();
  const { currentUser: authCurrentUser, logout, setCurrentUser } = useAuth();

  useEffect(() => {
    if (!authCurrentUser) return;
    let currentUser = authCurrentUser;

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
    if (!normalized) {
      return;
    }

    const lookupKey = normalized.toLowerCase();
    if (seen.has(lookupKey)) {
      return;
    }

    seen.add(lookupKey);
    uniqueTags.push(normalized);
  });

  tagState[key] = uniqueTags;
  renderTagList(key);
}

function addTagValues(key, values) {
  setTagValues(key, [...tagState[key], ...values]);
}

function commitPendingTag(key) {
  const config = tagConfig[key];
  const input = document.getElementById(config.inputId);
  if (!input) {
    return;
  }

  const nextTags = parseTagInput(input.value);
  if (nextTags.length > 0) {
    addTagValues(key, nextTags);
  }

  input.value = "";
}

function renderTagList(key) {
  const config = tagConfig[key];
  const container = document.getElementById(config.listId);
  if (!container) {
    return;
  }

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

function wireTagInput(key) {
  const config = tagConfig[key];
  const input = document.getElementById(config.inputId);
  const list = document.getElementById(config.listId);

  if (!input || !list) {
    return;
  }

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
    if (!removeButton) {
      return;
    }

    const tagValue = String(removeButton.dataset.tagValue || "");
    setTagValues(
      key,
      tagState[key].filter((tag) => tag.toLowerCase() !== tagValue.toLowerCase())
    );
  });
}

async function bootstrap() {
  try {

    document.getElementById("name").value = currentUser.name || "";
    document.getElementById("course").value = currentUser.course || "";
    document.getElementById("about").value = currentUser.about || "";
    setTagValues("skills", Array.isArray(currentUser.skills) ? currentUser.skills : []);
    setTagValues("workFocus", Array.isArray(currentUser.workFocus) ? currentUser.workFocus : []);
  } catch (err) {
    window.location.assign("/?auth=login");
  }
}

document.getElementById("settings-form").addEventListener("submit", async (event) => {
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
    setTagValues("skills", Array.isArray(currentUser.skills) ? currentUser.skills : []);
    setTagValues("workFocus", Array.isArray(currentUser.workFocus) ? currentUser.workFocus : []);
    alert("Looking good! Profile updated.");
  } catch (err) {
    alert("Failed to save: " + err.message);
  } finally {
    button.textContent = originalText;
    button.disabled = false;
  }
});

Object.keys(tagConfig).forEach(wireTagInput);
bootstrap();

    
    // Listen for static nav
    const handleStaticNav = (e) => {
      const el = e.currentTarget;
      if (el.dataset.navigate) {
        navigate(el.dataset.navigate.replace('.html', ''));
      }
    };
    
    bootstrap();

    return () => {
    };
  }, [authCurrentUser, navigate, logout, setCurrentUser]);

  return (
    <>
      

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
          <span>Edit Profile</span>
        </button>
      </nav>
      
      <div className="sidebar-footer">
        <button data-navigate="/home.html" className="sidebar-nav-item">Return to Dashboard</button>
      </div>
    </aside>

    <main className="app-main">
      <div className="app-main-header">
        <h1 className="app-main-title">Edit Profile</h1>
        <p className="app-main-subtitle">Manage your identity, interests, and the kind of work you usually take on.</p>
      </div>
      
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
    </main>
  </div>

  


    </>
  );
}
