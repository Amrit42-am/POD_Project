# CollabSpace

> **Group projects, without the chaos.**

CollabSpace is a web-based team collaboration platform designed for college students to manage group projects efficiently. It solves the most common problems students face during team assignments — unequal work distribution, missed deadlines, unclear task ownership, and poor communication.

**Live URL**: [https://pod-project.onrender.com](https://pod-project.onrender.com)

---

## What Problem Does It Solve?

Most student teams fall apart because nobody knows what the other person is actually doing:

- **One person does everything** — One member ends up carrying the whole team at 3 AM.
- **Missed deadlines** — Tasks are forgotten until the night before submission.
- **Who did what?** — When the professor asks for individual contributions, nobody can prove their work.
- **"I thought you were doing that"** — Tasks get lost because everyone assumes someone else is handling it.

CollabSpace fixes all of this by giving teams a shared workspace where tasks, roles, contributions, and communication are all in one place.

---

## Key Features

### 1. Workspace Management
Create and manage multiple project workspaces. Each workspace is an independent team environment with its own tasks, members, chat, and analytics. Users can lead multiple projects and be members of others simultaneously.

### 2. AI-Powered Role Assignment
When team members join a workspace, CollabSpace uses **Google Gemini AI** to automatically assign the best-fit project role to each member based on their skills and interests. Roles include Developer, Designer, Tester, Project Manager, and Researcher. For small teams (3 or less), the AI assigns combined roles (e.g., "Developer + Tester") to ensure all responsibilities are covered.

Roles are not static — they automatically recalculate when:
- A new member joins the team
- Any member updates their profile (skills or work focus)
- A periodic check runs every hour (only if profiles have changed)

### 3. Task Board (Kanban)
A simple, visual task management system organized into three columns:
- **To Do** — Tasks waiting to be started
- **In Progress** — Tasks currently being worked on
- **Done** — Completed tasks

The team leader creates tasks and can either manually assign them to members or let the AI auto-assign based on each member's role and skillset. Team members can update the status of tasks assigned to them.

### 4. AI-Powered Task Assignment
When creating a new task, the leader can let CollabSpace's AI analyze the task description and match it with the most suitable team member based on their role, skills, and current workload.

### 5. Team Invitation System
Team leaders can invite members by email. The invited user receives a notification in their dashboard and can choose to accept or reject the invitation. Upon accepting, the AI recalculates optimal roles for the entire team.

### 6. Contribution Tracking & Analytics
A built-in analytics dashboard shows:
- **Team overview** — Total tasks, completion rate, tasks in progress
- **Contribution chart** — Visual donut chart showing each member's share of completed work
- **Member breakdown** — Table with each member's assigned tasks, completed tasks, and completion rate
- **Task timeline** — History of task creation and completion

This gives clear, data-backed proof of who did what — useful for fair grading and accountability.

### 7. Team Chat
A real-time messaging system built into every workspace. Team members can discuss the project without switching to WhatsApp or iMessage. Messages are persistent and survive server restarts, so conversation history is always available.

### 8. Task Archive
Completed tasks can be archived by the team leader to keep the active board clean while preserving a full record of all finished work.

### 9. User Profiles
Each user has a profile with:
- Name, course/major, and bio
- Skills & interests (e.g., React, Python, UI Design)
- Work focus areas (e.g., Frontend, Backend, Research)

These profile details feed directly into the AI role assignment system, making role suggestions more accurate as users fill out their profiles.

---

## How It Works — User Flow

### Step 1: Sign Up
Visit the landing page and create an account with your name, email, course, and password.

### Step 2: Create a Workspace
From the Workspace Hub, click "+ New Workspace" and give your project a name and alias. You automatically become the team Leader.

### Step 3: Set Up Your Profile
Go to Edit Profile and add your skills (e.g., "React", "Python") and work focus areas (e.g., "Frontend", "Design"). This helps the AI assign you the right role in teams you join.

### Step 4: Invite Your Team
Enter your teammates' email addresses to send invitations. They'll see the invite in their dashboard and can accept with one click.

### Step 5: Roles Are Auto-Assigned
As each member joins, CollabSpace's AI analyzes everyone's skills and assigns project roles automatically (Developer, Designer, Tester, etc.).

### Step 6: Create & Manage Tasks
The team leader creates tasks on the Kanban board. Tasks can be manually assigned or auto-assigned by AI. Members update their task status as they work.

### Step 7: Communicate
Use the built-in Team Chat to discuss the project. No need for external messaging apps.

### Step 8: Track Progress
Check the Contributions dashboard to see who's doing what. The analytics show completion rates, contribution breakdowns, and activity timelines.

---

## Who Is It For?

- **College students** working on group assignments and projects
- **Student teams** that want transparent task tracking and fair workload distribution
- **Anyone** tired of one person doing all the work while others slack off

---

## What Makes It Different?

| Feature | WhatsApp Group | Google Docs | CollabSpace |
|---|---|---|---|
| Task assignment | ❌ | ❌ | ✅ AI-powered |
| Role assignment | ❌ | ❌ | ✅ AI-powered |
| Contribution tracking | ❌ | ❌ | ✅ Built-in analytics |
| Project chat | ✅ (but messy) | ❌ | ✅ Focused on project |
| Visual task board | ❌ | ❌ | ✅ Kanban board |
| Accountability | ❌ | ❌ | ✅ Clear proof of work |

---

## Technology

- **Frontend**: React with Vite
- **Backend**: Node.js
- **Database**: MongoDB Atlas (cloud-hosted, persistent)
- **AI**: Google Gemini API for role and task assignment
- **Hosting**: Render.com with auto-deploy from GitHub

---