/**
 * DentalCare Clinic Management System - Frontend Core
 * Replicates the exact UI/UX and workflows of the Flutter GUI (programs/clinic/lib)
 */

// --- Global Application State ---
const State = {
  user: JSON.parse(localStorage.getItem('clinic_user') || 'null'), // { id, username, role }
  currentRoute: '/doctor',
  theme: localStorage.getItem('clinic_theme') || 'light',

  // Doctor Desk State
  selectedPatient: null,
  searchResults: [],
  xrayFile: null,
  searchDebounceTimer: null,

  // Search & Edit Patient State
  searchEditResults: [],
  selectedEditPatient: null,
  searchAllOffset: 0,
  searchAllHasMore: false,
  searchIsAllMode: false,

  // Report Grouped State
  reportGroupedPatients: [],

  // Delete Confirmation Pending ID
  pendingDeletePatientId: null,
  pendingDeletePatientName: '',
  pendingDeleteVisitId: null,

  // X-Ray Lightbox State
  xrayZoom: 1,
  xrayRotate: 0,

  // Live Patient Queue State
  todayQueue: { waiting: [], completed: [], pending_count: 0, completed_count: 0, total_tokens: 0 },
  activeQueueTab: 'waiting',
  queuePollTimer: null,
};

// --- Backend API Service Layer ---
const API = {
  baseUrl: '/clinic',

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint}`;
    try {
      const res = await fetch(url, options);
      const contentType = res.headers.get('content-type') || '';
      const isJson = contentType.includes('application/json');
      const data = isJson ? await res.json() : await res.text();
      return { ok: res.ok, status: res.status, data };
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err);
      return { ok: false, status: 0, error: err.message };
    }
  },

  async login(username, password) {
    return this.request('/login/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
  },

  async searchPatients(query, all = false, offset = 0, limit = 100) {
    if (all) {
      return this.request(`/search/?all=1&offset=${offset}&limit=${limit}`);
    }
    if (!query || !query.trim()) return { ok: true, data: [] };
    return this.request(`/search/?q=${encodeURIComponent(query.trim())}`);
  },

  async getNextOpNumber() {
    return this.request('/next_op/');
  },

  async getPatientDetail(patientId) {
    return this.request(`/patient/${patientId}/`);
  },

  async registerPatient(data) {
    return this.request('/register/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async updatePatient(patientId, data) {
    return this.request(`/update/${patientId}/`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async deletePatient(patientId) {
    return this.request(`/delete/${patientId}/`, {
      method: 'DELETE',
    });
  },

  async addVisit(formData) {
    return this.request('/add/', {
      method: 'POST',
      body: formData, // FormData automatically sets multipart/form-data with boundary
    });
  },

  async updateVisit(visitId, data) {
    return this.request(`/update_visit/${visitId}/`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async deleteVisit(visitId) {
    return this.request(`/delete_visit/${visitId}/`, {
      method: 'DELETE',
    });
  },

  async addUser(data) {
    return this.request('/add_user/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async changePassword(data) {
    return this.request('/change_password/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
  },

  async listUsers() {
    return this.request('/users/');
  },

  async getDailySummary(dateStr) {
    return this.request(`/day/?date=${dateStr}`);
  },

  async getRangeSummary(startDate, endDate) {
    return this.request(`/range/?start=${startDate}&end=${endDate}`);
  },

  async getClinicMetrics() {
    return this.request('/metrics/');
  },

  async getTodayQueue() {
    return this.request('/queue/today/');
  },

  async admitToQueue(patientId) {
    return this.request('/queue/admit/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: patientId }),
    });
  },

  async completeQueueEntry(entryId, patientId) {
    const endpoint = entryId ? `/queue/${entryId}/complete/` : '/queue/complete/';
    return this.request(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient_id: patientId }),
    });
  },

  async removeQueueEntry(entryId) {
    return this.request(`/queue/${entryId}/remove/`, {
      method: 'DELETE',
    });
  },
};

// --- Flutter-Style SnackBar Notification (Get.snackbar) ---
const SnackBar = {
  show(title, message, type = 'info', duration = 3000) {
    const container = document.getElementById('snackbar-container');
    if (!container) return;

    const snackbar = document.createElement('div');
    snackbar.className = `flutter-snackbar ${type}`;

    let icon = 'info-circle';
    if (type === 'success') icon = 'circle-check';
    if (type === 'error') icon = 'circle-xmark';
    if (type === 'warning') icon = 'triangle-exclamation';

    snackbar.innerHTML = `
      <i class="fas fa-${icon}"></i>
      <div style="flex: 1;">
        <strong style="display: block; font-size: 0.82rem; text-transform: uppercase; letter-spacing: 0.5px;">${escapeHtml(title)}</strong>
        <span style="font-size: 0.88rem;">${escapeHtml(message)}</span>
      </div>
    `;

    container.appendChild(snackbar);

    setTimeout(() => {
      snackbar.style.opacity = '0';
      snackbar.style.transform = 'translateY(16px)';
      snackbar.style.transition = 'all 0.25s ease';
      setTimeout(() => snackbar.remove(), 250);
    }, duration);
  },

  success(title, message) {
    this.show(title || 'Success', message, 'success');
  },

  error(title, message) {
    this.show(title || 'Error', message, 'error', 4500);
  },

  warning(title, message) {
    this.show(title || 'Warning', message, 'warning');
  },

  info(title, message) {
    this.show(title || 'Notice', message, 'info');
  },
};

// --- Utility Helpers ---
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function calculateAgeFromDob(dobString) {
  if (!dobString) return null;
  const dob = new Date(dobString);
  if (isNaN(dob.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age >= 0 ? age : 0;
}

function formatDateDisplay(dateStr) {
  if (!dateStr) return 'Select Date';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

// --- Theme Management ---
function initTheme() {
  document.documentElement.setAttribute('data-theme', State.theme);
  updateThemeIcon();
}

function toggleTheme() {
  State.theme = State.theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('clinic_theme', State.theme);
  document.documentElement.setAttribute('data-theme', State.theme);
  updateThemeIcon();
}

function updateThemeIcon() {
  const icon = document.getElementById('theme-toggle-icon');
  if (icon) {
    icon.className = State.theme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
  }
}

// --- Navigation & Route Management (Replicating Flutter Get.toNamed) ---
function navigateTo(route) {
  // If not logged in and not heading to login, redirect to login
  if (!State.user && route !== '/') {
    route = '/';
  }

  // Role permissions check (matching Flutter RoleMiddleware)
  if (State.user) {
    const role = State.user.role;
    if (route === '/doctor' && role !== 'doctor' && role !== 'admin') {
      SnackBar.warning('Restricted', 'Only Doctors have access to Doctor Desk.');
      return;
    }
    if (route === '/admin' && role !== 'admin') {
      SnackBar.warning('Restricted', 'Administrator rights required.');
      return;
    }
  }

  State.currentRoute = route;
  window.location.hash = route;

  // Hide all panes
  document.querySelectorAll('.route-pane').forEach((p) => {
    p.style.display = 'none';
    p.classList.remove('active');
  });

  // Update Appbar Title & Subtitle based on Route
  const titleMap = {
    '/': 'Clinic Login',
    '/doctor': 'Doctor Panel',
    '/reception': 'Receptionist Panel',
    '/register': 'Register Patient',
    '/search': 'Search Patient',
    '/reports': 'Reports',
    '/admin': 'Admin Panel',
  };

  const titleEl = document.getElementById('appbar-title');
  if (titleEl) titleEl.textContent = titleMap[route] || 'Clinic Management';

  // Toggle Appbar visibility (Hidden on Login screen, visible otherwise)
  const appbar = document.getElementById('flutter-appbar');
  if (route === '/') {
    if (appbar) appbar.style.display = 'none';
    stopQueuePolling();
  } else {
    if (appbar) appbar.style.display = 'flex';
    startQueuePolling();
    loadTodayQueue(true);
  }

  // Show active pane
  let activePaneId = 'pane-doctor';
  if (route === '/') activePaneId = 'pane-login';
  else if (route === '/reception') activePaneId = 'pane-reception';
  else if (route === '/register') activePaneId = 'pane-register';
  else if (route === '/search') activePaneId = 'pane-search';
  else if (route === '/reports') activePaneId = 'pane-reports';
  else if (route === '/admin') activePaneId = 'pane-admin';

  const pane = document.getElementById(activePaneId);
  if (pane) {
    pane.classList.add('active');
    pane.style.display = pane.classList.contains('centered-layout') ? 'flex' : 'block';
    if (pane.id === 'pane-doctor' || pane.id === 'pane-search') pane.style.display = 'flex';
  }

  // Update Active Navigation Tabs in Appbar & Drawer
  document.querySelectorAll('.appbar-nav-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.getAttribute('data-route') === route);
  });
  document.querySelectorAll('.drawer-item').forEach((item) => {
    item.classList.toggle('active', item.getAttribute('data-route') === route);
  });

  // Close Drawer if open
  closeDrawer();

  // Route-specific initializers
  if (route === '/doctor') {
    const searchInput = document.getElementById('doc-search-input');
    if (searchInput) searchInput.focus();
  } else if (route === '/register') {
    fetchAndFillNextOpNumber();
  } else if (route === '/search') {
    loadAllPatientsDesc(true);
  } else if (route === '/admin') {
    loadAdminUsersList();
    loadAdminMetrics();
  }
}

// Drawer Drawer Controls
function toggleDrawer() {
  const drawer = document.getElementById('flutter-drawer');
  const overlay = document.getElementById('drawer-overlay');
  if (!drawer || !overlay) return;

  const isOpen = drawer.classList.contains('open');
  if (isOpen) {
    closeDrawer();
  } else {
    drawer.classList.add('open');
    overlay.classList.add('open');
  }
}

function closeDrawer() {
  const drawer = document.getElementById('flutter-drawer');
  const overlay = document.getElementById('drawer-overlay');
  if (drawer) drawer.classList.remove('open');
  if (overlay) overlay.classList.remove('open');
}

// User UI Header Updating
function updateUserDataUI() {
  const user = State.user;
  const usernameEl = document.getElementById('appbar-username');
  const roleBadgeEl = document.getElementById('appbar-role-badge');
  const drawerTitle = document.getElementById('drawer-header-title');
  const drawerUserInfo = document.getElementById('drawer-user-info');
  const appbarNav = document.getElementById('appbar-nav-shortcuts');

  if (user) {
    if (usernameEl) usernameEl.textContent = user.username;
    if (roleBadgeEl) roleBadgeEl.textContent = user.role;
    if (drawerTitle) drawerTitle.textContent = `${user.role.toUpperCase()} PANEL`;
    if (drawerUserInfo) drawerUserInfo.textContent = `User: ${user.username} (${user.role})`;

    // Filter Navigation Tabs based on role
    if (appbarNav) {
      const doctorTab = appbarNav.querySelector('[data-route="/doctor"]');
      const adminTab = appbarNav.querySelector('[data-route="/admin"]');
      if (doctorTab) doctorTab.style.display = (user.role === 'doctor' || user.role === 'admin') ? 'inline-flex' : 'none';
      if (adminTab) adminTab.style.display = (user.role === 'admin') ? 'inline-flex' : 'none';
    }
  } else {
    if (usernameEl) usernameEl.textContent = 'Guest';
    if (roleBadgeEl) roleBadgeEl.textContent = 'none';
  }
}

// ==========================================================================
// 1. AUTHENTICATION (login.dart)
// ==========================================================================
function fillDemoCredentials(username, role) {
  const uInput = document.getElementById('login-username');
  const pInput = document.getElementById('login-password');
  if (uInput) uInput.value = username;
  if (pInput) pInput.value = username; // default demo password is username
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim();
  const password = document.getElementById('login-password').value.trim();
  const submitBtn = document.getElementById('btn-login-submit');

  if (!username || !password) {
    SnackBar.warning('Validation', 'Please provide username and password.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging in...';

  const res = await API.login(username, password);
  submitBtn.disabled = false;
  submitBtn.innerHTML = '<i class="fas fa-sign-in-alt"></i> Login';

  if (res.ok && res.data) {
    State.user = res.data;
    localStorage.setItem('clinic_user', JSON.stringify(res.data));
    updateUserDataUI();
    SnackBar.success('Welcome', `Signed in as ${res.data.username} (${res.data.role})`);

    // Redirect according to Flutter login.dart routing:
    if (res.data.role === 'doctor') {
      navigateTo('/doctor');
    } else if (res.data.role === 'receptionist') {
      navigateTo('/reception');
    } else {
      navigateTo('/admin');
    }
  } else {
    SnackBar.error('Login Failed', 'Invalid username or password.');
  }
}

function handleLogout() {
  closeDrawer();
  closeQueueModal();
  stopQueuePolling();

  State.user = null;
  State.selectedPatient = null;
  State.selectedEditPatient = null;
  State.todayQueue = { waiting: [], completed: [], pending_count: 0, completed_count: 0, total_tokens: 0 };
  localStorage.removeItem('clinic_user');
  sessionStorage.clear();

  // Reset login fields
  const userInp = document.getElementById('login-username');
  const pwdInput = document.getElementById('login-password');
  if (userInp) userInp.value = '';
  if (pwdInput) pwdInput.value = '';

  // Direct DOM view switch: Hide all panes, show login pane
  document.querySelectorAll('.route-pane').forEach((p) => {
    p.style.display = 'none';
    p.classList.remove('active');
  });

  const loginPane = document.getElementById('pane-login');
  if (loginPane) {
    loginPane.style.display = 'flex';
    loginPane.classList.add('active');
  }

  // Hide Appbar on login screen
  const appbar = document.getElementById('flutter-appbar');
  if (appbar) appbar.style.display = 'none';

  updateUserDataUI();

  State.currentRoute = '/';
  window.location.hash = '#/';

  SnackBar.info('Logged Out', 'You have been signed out.');
}

// ==========================================================================
// 2. DOCTOR DESK (doctor.dart)
// ==========================================================================
function handleDoctorSearch(query) {
  clearTimeout(State.searchDebounceTimer);
  const clearBtn = document.getElementById('btn-clear-search');
  if (clearBtn) clearBtn.style.display = query ? 'block' : 'none';

  if (!query || !query.trim()) {
    renderDoctorSearchResults([]);
    return;
  }

  if (query.trim() === '#') {
    const container = document.getElementById('doc-patient-list');
    if (container) {
      container.innerHTML = `
        <div class="empty-list-notice">
          <i class="fas fa-hashtag" style="font-size: 1.5rem; opacity: 0.5; margin-bottom: 0.5rem; display: block; color: var(--md-primary);"></i>
          Type OP number to search (e.g. #5619)
        </div>
      `;
    }
    return;
  }

  State.searchDebounceTimer = setTimeout(async () => {
    const res = await API.searchPatients(query.trim());
    if (res.ok) {
      State.searchResults = Array.isArray(res.data) ? res.data : [];
      renderDoctorSearchResults(State.searchResults);
    } else {
      renderDoctorSearchResults([]);
    }
  }, 250);
}

function clearDoctorSearch() {
  const input = document.getElementById('doc-search-input');
  if (input) {
    input.value = '';
    input.focus();
  }
  const clearBtn = document.getElementById('btn-clear-search');
  if (clearBtn) clearBtn.style.display = 'none';
  renderDoctorSearchResults([]);
}

function renderDoctorSearchResults(patients) {
  const container = document.getElementById('doc-patient-list');
  if (!container) return;

  if (!patients || patients.length === 0) {
    container.innerHTML = `
      <div class="empty-list-notice">
        <i class="fas fa-search" style="font-size: 1.5rem; opacity: 0.35; margin-bottom: 0.5rem; display: block;"></i>
        No matching patients found.
      </div>
    `;
    return;
  }

  container.innerHTML = patients
    .map((p) => {
      const isSelected = State.selectedPatient && State.selectedPatient.id === p.id;
      const phoneText = p.phone || 'N/A';
      const opText = p.op_number ? `OP: #${p.op_number}` : '';
      return `
        <div class="patient-list-item ${isSelected ? 'selected' : ''}" onclick="selectPatientInDoctorView(${p.id})">
          <div class="patient-list-name">${escapeHtml(p.name)}</div>
          <div class="patient-list-subtitle">${escapeHtml(phoneText)} ${opText ? `&bull; ${escapeHtml(opText)}` : ''}</div>
        </div>
      `;
    })
    .join('');
}

async function selectPatientInDoctorView(patientId) {
  const res = await API.getPatientDetail(patientId);
  if (!res.ok || !res.data) {
    SnackBar.error('Error', 'Failed to retrieve patient details.');
    return;
  }

  State.selectedPatient = res.data;
  renderDoctorSearchResults(State.searchResults); // re-render to reflect selection highlight
  renderDoctorPatientDetails();
  renderDoctorVisitHistory();
}

function renderDoctorPatientDetails() {
  const patient = State.selectedPatient;
  const placeholder = document.getElementById('doc-empty-patient-placeholder');
  const content = document.getElementById('doc-active-patient-content');

  if (!patient) {
    if (placeholder) placeholder.style.display = 'block';
    if (content) content.style.display = 'none';
    return;
  }

  if (placeholder) placeholder.style.display = 'none';
  if (content) content.style.display = 'flex';

  document.getElementById('doc-patient-op').textContent = `#${patient.op_number || 'N/A'}`;
  document.getElementById('doc-patient-name').textContent = patient.name || 'N/A';
  document.getElementById('doc-patient-age').textContent = patient.age !== undefined ? `${patient.age} yrs` : 'N/A';
  document.getElementById('doc-patient-gender').textContent = patient.gender || 'N/A';
  document.getElementById('doc-patient-phone').textContent = patient.phone || 'N/A';

  const address = patient.address ? (patient.address.address || 'N/A') : 'N/A';
  document.getElementById('doc-patient-address').textContent = address;
  document.getElementById('doc-patient-last-visit').textContent = patient.last_visit_days_ago || 'No previous visits';

  // Reset Add Visit Form Inputs
  document.getElementById('doc-visit-remarks').value = '';
  document.getElementById('doc-visit-prescription').value = '';
  clearSelectedXray();
}

function renderDoctorVisitHistory() {
  const patient = State.selectedPatient;
  const container = document.getElementById('doc-visit-history-list');
  const countBadge = document.getElementById('doc-history-count-badge');
  if (!container) return;

  const visits = (patient && Array.isArray(patient.visits)) ? patient.visits : [];
  if (countBadge) countBadge.textContent = visits.length;

  if (visits.length === 0) {
    container.innerHTML = `
      <div class="empty-history-notice">
        <i class="fas fa-file-medical" style="font-size: 2.2rem; opacity: 0.35; margin-bottom: 0.5rem; display: block;"></i>
        ${patient ? 'No consultation visits recorded for this patient yet.' : 'Select a patient to view visit records.'}
      </div>
    `;
    return;
  }

  container.innerHTML = visits
    .map((v) => {
      const vDate = v.visit_date || 'N/A';
      const reason = v.reason || '';
      const prescriptions = v.prescriptions || [];
      const prescriptionLines = prescriptions
        .map((p) => `💊 ${escapeHtml(p.medicine_name || '')} ${p.instructions ? `- ${escapeHtml(p.instructions)}` : ''}`)
        .join('<br>');

      const xrayUrl = v.xray_url;
      const xrayHtml = xrayUrl
        ? `
          <button type="button" class="xray-thumbnail-btn" onclick="openXrayDialog('${escapeHtml(xrayUrl)}')" title="View X-Ray Image">
            <img src="${escapeHtml(xrayUrl)}" alt="X-Ray" class="xray-thumb-img">
          </button>
        `
        : '';

      return `
        <div class="visit-card">
          <div class="visit-card-row">
            <div class="visit-details-left">
              <div class="visit-date-badge">
                <i class="fas fa-calendar-day" style="color: var(--md-primary);"></i>
                <span>${escapeHtml(vDate)}</span>
              </div>
              ${reason ? `<div class="visit-reason-text">${escapeHtml(reason)}</div>` : ''}
              ${prescriptionLines ? `<div class="visit-prescription-box">${prescriptionLines}</div>` : ''}
            </div>

            <div class="visit-actions-right">
              ${xrayHtml}
              <button type="button" class="icon-button" style="color: var(--md-primary);" onclick="printVisitPrescription(${v.id})" title="Print Prescription Slip">
                <i class="fas fa-print"></i>
              </button>
              <button type="button" class="icon-button" style="color: var(--md-blue);" onclick="openEditVisitModal(${v.id})" title="Edit Visit">
                <i class="fas fa-pencil"></i>
              </button>
              <button type="button" class="icon-button" style="color: var(--md-error);" onclick="openDeleteVisitDialog(${v.id}, '${escapeHtml(vDate)}')" title="Delete Visit">
                <i class="fas fa-trash-can"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    })
    .join('');
}

// X-Ray File Picker Controls
function triggerXrayPicker() {
  const fileInput = document.getElementById('xray-file-input');
  if (fileInput) fileInput.click();
}

function handleXrayFileChosen(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  State.xrayFile = file;
  const badge = document.getElementById('xray-selected-badge');
  const nameLabel = document.getElementById('xray-selected-filename');
  if (badge && nameLabel) {
    nameLabel.textContent = file.name;
    badge.style.display = 'inline-flex';
  }
}

function clearSelectedXray() {
  State.xrayFile = null;
  const fileInput = document.getElementById('xray-file-input');
  if (fileInput) fileInput.value = '';
  const badge = document.getElementById('xray-selected-badge');
  if (badge) badge.style.display = 'none';
}

// Add Visit Submit Handler
async function handleAddVisitSubmit() {
  if (!State.selectedPatient) {
    SnackBar.warning('Warning', 'Please select a patient first.');
    return;
  }

  const reason = document.getElementById('doc-visit-remarks').value.trim();
  const prescriptionText = document.getElementById('doc-visit-prescription').value.trim();
  const addBtn = document.getElementById('btn-add-visit');

  if (!reason && !prescriptionText && !State.xrayFile) {
    SnackBar.warning('Empty Visit', 'Please enter remarks, prescription or attach an X-Ray.');
    return;
  }

  // Build Prescriptions List
  const prescriptions = [];
  if (prescriptionText) {
    const lines = prescriptionText.split('\n').filter((l) => l.trim().length > 0);
    lines.forEach((line) => {
      const parts = line.split('-');
      if (parts.length > 1) {
        prescriptions.push({
          medicine_name: parts[0].trim(),
          instructions: parts.slice(1).join('-').trim(),
        });
      } else {
        prescriptions.push({
          medicine_name: line.trim(),
          instructions: '',
        });
      }
    });
  }

  const formData = new FormData();
  formData.append('patient_id', State.selectedPatient.id);
  formData.append('reason', reason);
  formData.append('prescriptions', JSON.stringify(prescriptions));

  if (State.xrayFile) {
    formData.append('xray', State.xrayFile);
  }

  addBtn.disabled = true;
  addBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Adding...';

  const res = await API.addVisit(formData);
  addBtn.disabled = false;
  addBtn.innerHTML = '<i class="fas fa-plus"></i> Add Visit';

  if (res.ok) {
    SnackBar.success('Success', 'Visit added successfully.');
    // Refresh selected patient details to update visit history
    const detailRes = await API.getPatientDetail(State.selectedPatient.id);
    if (detailRes.ok && detailRes.data) {
      State.selectedPatient = detailRes.data;
      renderDoctorPatientDetails();
      renderDoctorVisitHistory();
    }
    // Automatically refresh today's queue so patient moves to Completed Today!
    loadTodayQueue(true);
  } else {
    SnackBar.error('Failed', res.data?.error || 'Failed to record visit.');
  }
}

// Delete Patient Controls (doctor.dart delete action)
function openDeletePatientDialog(fromSearchEdit = false) {
  const patient = fromSearchEdit ? State.selectedEditPatient : State.selectedPatient;
  if (!patient) return;

  State.pendingDeletePatientId = patient.id;
  State.pendingDeletePatientName = patient.name;

  const nameEl = document.getElementById('dialog-delete-patient-name');
  if (nameEl) nameEl.textContent = `Patient: ${patient.name} (OP #${patient.op_number})`;

  openDialog('dialog-delete-patient');
}

async function executeDeletePatient() {
  if (!State.pendingDeletePatientId) return;

  const patientId = State.pendingDeletePatientId;
  closeDialog('dialog-delete-patient');

  const res = await API.deletePatient(patientId);
  if (res.ok) {
    SnackBar.success('Deleted', 'Patient deleted successfully.');
    
    // Clear selection if currently viewing this patient
    if (State.selectedPatient && State.selectedPatient.id === patientId) {
      State.selectedPatient = null;
      renderDoctorPatientDetails();
      renderDoctorVisitHistory();
    }
    if (State.selectedEditPatient && State.selectedEditPatient.id === patientId) {
      State.selectedEditPatient = null;
      renderSearchPatientEditor();
    }

    // Refresh Doctor search list
    const query = document.getElementById('doc-search-input')?.value || '';
    if (query) handleDoctorSearch(query);
    else renderDoctorSearchResults([]);

    // Refresh Search view list if query present
    const searchViewQuery = document.getElementById('search-view-query')?.value || '';
    if (searchViewQuery) executePatientSearch();
    else if (State.searchIsAllMode) loadAllPatientsDesc(true);
  } else {
    SnackBar.error('Error', 'Failed to delete patient file.');
  }

  State.pendingDeletePatientId = null;
}

// Delete Visit Controls
function openDeleteVisitDialog(visitId, dateText) {
  State.pendingDeleteVisitId = visitId;
  const textEl = document.getElementById('dialog-delete-visit-text');
  if (textEl) {
    textEl.textContent = `Are you sure you want to delete this visit (${dateText || 'selected'})? This action cannot be undone.`;
  }
  openDialog('dialog-delete-visit');
}

async function executeDeleteVisit() {
  if (!State.pendingDeleteVisitId) return;
  const visitId = State.pendingDeleteVisitId;
  closeDialog('dialog-delete-visit');

  const res = await API.deleteVisit(visitId);
  if (res.ok) {
    SnackBar.success('Deleted', 'Visit deleted successfully.');
    if (State.selectedPatient) {
      const detailRes = await API.getPatientDetail(State.selectedPatient.id);
      if (detailRes.ok && detailRes.data) {
        State.selectedPatient = detailRes.data;
        renderDoctorVisitHistory();
      }
    }
  } else {
    SnackBar.error('Error', 'Failed to delete visit.');
  }

  State.pendingDeleteVisitId = null;
}

// Edit Visit Dialog (_showEditVisitDialog from doctor.dart)
function openEditVisitModal(visitId) {
  if (!State.selectedPatient || !State.selectedPatient.visits) return;
  const visit = State.selectedPatient.visits.find((v) => v.id === visitId);
  if (!visit) return;

  document.getElementById('edit-visit-id').value = visit.id;
  document.getElementById('edit-visit-reason').value = visit.reason || '';

  const prescriptions = visit.prescriptions || [];
  const lines = prescriptions
    .map((p) => {
      const name = p.medicine_name || '';
      const inst = p.instructions || '';
      return inst ? `${name} - ${inst}` : name;
    })
    .join('\n');

  document.getElementById('edit-visit-prescription').value = lines;
  openDialog('dialog-edit-visit');
}

async function executeSaveEditVisit() {
  const visitId = document.getElementById('edit-visit-id').value;
  const reason = document.getElementById('edit-visit-reason').value.trim();
  const rxText = document.getElementById('edit-visit-prescription').value.trim();

  const prescriptions = [];
  if (rxText) {
    rxText.split('\n').forEach((l) => {
      if (!l.trim()) return;
      const parts = l.split('-');
      prescriptions.push({
        medicine_name: parts[0].trim(),
        instructions: parts.slice(1).join('-').trim(),
      });
    });
  }

  const res = await API.updateVisit(visitId, {
    reason,
    prescriptions,
  });

  if (res.ok) {
    closeDialog('dialog-edit-visit');
    SnackBar.success('Saved', 'Visit updated successfully.');
    if (State.selectedPatient) {
      const detailRes = await API.getPatientDetail(State.selectedPatient.id);
      if (detailRes.ok && detailRes.data) {
        State.selectedPatient = detailRes.data;
        renderDoctorVisitHistory();
      }
    }
  } else {
    SnackBar.error('Error', 'Failed to save visit changes.');
  }
}

// X-Ray InteractiveViewer Modal
function openXrayDialog(imageUrl) {
  const img = document.getElementById('xray-full-image');
  if (img) img.src = imageUrl;
  resetXray();
  openDialog('dialog-xray-viewer');
}

function zoomXray(delta) {
  State.xrayZoom = Math.max(0.5, Math.min(4, State.xrayZoom + delta));
  applyXrayTransform();
}

function rotateXray(degrees) {
  State.xrayRotate = (State.xrayRotate + degrees) % 360;
  applyXrayTransform();
}

function resetXray() {
  State.xrayZoom = 1;
  State.xrayRotate = 0;
  applyXrayTransform();
}

function applyXrayTransform() {
  const img = document.getElementById('xray-full-image');
  if (img) {
    img.style.transform = `scale(${State.xrayZoom}) rotate(${State.xrayRotate}deg)`;
  }
}

// ==========================================================================
// 3. REGISTER PATIENT (register.dart)
// ==========================================================================
async function fetchAndFillNextOpNumber() {
  const badgeEl = document.getElementById('reg-next-op-num');
  const inputEl = document.getElementById('reg-op-number');
  if (badgeEl) badgeEl.textContent = '...';

  const res = await API.getNextOpNumber();
  if (res.ok && res.data && res.data.next_op_number) {
    const nextOp = res.data.next_op_number;
    if (badgeEl) badgeEl.textContent = `#${nextOp}`;
    if (inputEl) inputEl.value = nextOp;
  } else {
    if (badgeEl) badgeEl.textContent = 'Auto';
  }
}

function handleDobSelected(dobValue, prefix) {
  const labelEl = document.getElementById(`${prefix}-dob-display-label`);
  const ageInput = document.getElementById(`${prefix}-age`);

  if (labelEl) {
    labelEl.textContent = dobValue ? formatDateDisplay(dobValue) : 'Select Date';
  }

  if (dobValue && ageInput) {
    const age = calculateAgeFromDob(dobValue);
    if (age !== null) ageInput.value = age;
  }
}

async function handleRegisterSubmit(e) {
  e.preventDefault();

  const opNumberInput = document.getElementById('reg-op-number');
  const opNumberVal = opNumberInput ? parseInt(opNumberInput.value.trim(), 10) : null;
  const name = document.getElementById('reg-name').value.trim();
  const age = parseFloat(document.getElementById('reg-age').value);
  const dob = document.getElementById('reg-dob').value || null;
  const gender = document.getElementById('reg-gender').value;
  const phone = document.getElementById('reg-phone').value.trim();
  const address = document.getElementById('reg-address').value.trim();
  const submitBtn = document.getElementById('btn-submit-registration');

  if (!name || isNaN(age) || !phone) {
    SnackBar.warning('Incomplete', 'Please fill all required fields.');
    return;
  }

  const payload = {
    name,
    age,
    gender,
    phone,
    address: { address },
  };
  if (dob) payload.dob = dob;
  if (opNumberVal && !isNaN(opNumberVal)) {
    payload.op_number = opNumberVal;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Registering...';

  const res = await API.registerPatient(payload);
  submitBtn.disabled = false;
  submitBtn.innerHTML = '<i class="fas fa-check"></i> Submit';

  if (res.status === 201) {
    const opNumber = res.data?.op_number || 'N/A';
    const patientId = res.data?.id;
    SnackBar.success('Success', `Patient registered with OP #${opNumber}.`);

    // Auto-admit to doctor queue if checkbox checked
    const autoAdmitCheck = document.getElementById('reg-auto-admit');
    if (autoAdmitCheck && autoAdmitCheck.checked && patientId) {
      API.admitToQueue(patientId).then(() => {
        loadTodayQueue(true);
      });
    }

    // Show Flutter-style Dialog with OP Number
    showOpNumberDialog('OP Number', `New OP Number: #${opNumber}`, patientId);
    document.getElementById('form-register-patient').reset();
    document.getElementById('reg-dob-display-label').textContent = 'Select Date';
    fetchAndFillNextOpNumber();
  } else if (res.status === 400 && res.data?.existing_op_number) {
    const opNumber = res.data.existing_op_number;
    SnackBar.warning('Already Registered', 'Patient exists with this name and phone.');
    showOpNumberDialog('Patient Exists', `Existing OP Number: #${opNumber}`);
  } else if (res.status === 400 && res.data?.op_number) {
    const msg = Array.isArray(res.data.op_number) ? res.data.op_number.join(' ') : res.data.op_number;
    SnackBar.error('OP Number Conflict', msg);
  } else {
    SnackBar.error('Registration Failed', JSON.stringify(res.data || 'Unknown error'));
  }
}

function showOpNumberDialog(title, message, patientId = null) {
  document.getElementById('dialog-op-title').textContent = title;
  document.getElementById('dialog-op-message').textContent = message;
  openDialog('dialog-op-number');
}

function closeOpDialog() {
  closeDialog('dialog-op-number');
  navigateTo('/doctor');
}

// ==========================================================================
// 4. SEARCH & EDIT PATIENT (search_edit.dart)
// ==========================================================================
async function loadAllPatientsDesc(reset = true) {
  const container = document.getElementById('search-view-results-list');
  const modeLabel = document.getElementById('search-view-mode-label');
  const countBadge = document.getElementById('search-view-count-badge');
  const loadMoreBar = document.getElementById('search-load-more-bar');
  const loadMoreBtn = document.getElementById('btn-load-more-patients');

  if (reset) {
    State.searchAllOffset = 0;
    State.searchEditResults = [];
    const queryInput = document.getElementById('search-view-query');
    if (queryInput) queryInput.value = '';
    if (container) {
      container.innerHTML = `
        <div class="empty-list-notice">
          <i class="fas fa-spinner fa-spin" style="font-size: 1.5rem; margin-bottom: 0.5rem; display: block; color: var(--md-primary);"></i>
          Loading patients in descending OP order...
        </div>
      `;
    }
  }

  State.searchIsAllMode = true;
  if (modeLabel) {
    modeLabel.innerHTML = '<i class="fas fa-arrow-down-wide-short"></i> All Patients (OP &darr; Descending)';
  }

  const limit = 100;
  const res = await API.searchPatients('', true, State.searchAllOffset, limit);

  if (loadMoreBtn) {
    loadMoreBtn.disabled = false;
    loadMoreBtn.innerHTML = '<i class="fas fa-chevron-down"></i> Load More Patients (Next 100)';
  }

  if (res.ok && res.data && Array.isArray(res.data.patients)) {
    const list = res.data.patients;
    State.searchAllHasMore = !!res.data.has_more;
    State.searchAllOffset += list.length;

    if (reset) {
      State.searchEditResults = list;
    } else {
      State.searchEditResults = State.searchEditResults.concat(list);
    }

    if (countBadge) {
      countBadge.style.display = 'inline-block';
      countBadge.textContent = `${State.searchEditResults.length} / ${res.data.total_count || State.searchEditResults.length}`;
    }

    if (loadMoreBar) {
      loadMoreBar.style.display = State.searchAllHasMore ? 'block' : 'none';
    }

    renderSearchPatientList(State.searchEditResults);
  } else {
    if (reset) {
      renderSearchPatientList([]);
      if (countBadge) countBadge.style.display = 'none';
    }
    if (loadMoreBar) loadMoreBar.style.display = 'none';
  }
}

async function loadMorePatientsDesc() {
  if (!State.searchAllHasMore) return;
  const loadMoreBtn = document.getElementById('btn-load-more-patients');
  if (loadMoreBtn) {
    loadMoreBtn.disabled = true;
    loadMoreBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading more patients...';
  }
  await loadAllPatientsDesc(false);
}

async function executePatientSearch() {
  const queryInput = document.getElementById('search-view-query');
  const query = queryInput ? queryInput.value.trim() : '';
  const modeLabel = document.getElementById('search-view-mode-label');
  const countBadge = document.getElementById('search-view-count-badge');
  const loadMoreBar = document.getElementById('search-load-more-bar');

  if (!query) {
    loadAllPatientsDesc(true);
    return;
  }

  State.searchIsAllMode = false;
  if (loadMoreBar) loadMoreBar.style.display = 'none';

  if (query.startsWith('#')) {
    const opPart = query.replace(/^#\s*/, '');
    if (modeLabel) {
      modeLabel.innerHTML = `<i class="fas fa-hashtag"></i> OP Only: "#${escapeHtml(opPart)}"`;
    }
  } else {
    if (modeLabel) {
      modeLabel.innerHTML = `<i class="fas fa-search"></i> Search: "${escapeHtml(query)}"`;
    }
  }

  const container = document.getElementById('search-view-results-list');
  if (container) {
    container.innerHTML = `
      <div class="empty-list-notice">
        <i class="fas fa-spinner fa-spin" style="font-size: 1.5rem; margin-bottom: 0.5rem; display: block; color: var(--md-primary);"></i>
        Searching...
      </div>
    `;
  }

  const res = await API.searchPatients(query);
  if (res.ok) {
    State.searchEditResults = Array.isArray(res.data) ? res.data : [];
    if (countBadge) {
      countBadge.style.display = 'inline-block';
      countBadge.textContent = `${State.searchEditResults.length} found`;
    }
    renderSearchPatientList(State.searchEditResults);
  } else {
    State.searchEditResults = [];
    if (countBadge) countBadge.style.display = 'none';
    renderSearchPatientList([]);
  }
}

function renderSearchPatientList(patients) {
  const container = document.getElementById('search-view-results-list');
  if (!container) return;

  if (!patients || patients.length === 0) {
    const query = document.getElementById('search-view-query')?.value?.trim() || '';
    let msg = 'No patients found.';
    if (query.startsWith('#')) {
      const opNum = query.replace(/^#\s*/, '');
      msg = opNum ? `No patient found with OP #${escapeHtml(opNum)}.` : 'Please enter an OP number after # (e.g. #5619).';
    }
    container.innerHTML = `
      <div class="empty-list-notice">
        ${msg}
      </div>
    `;
    return;
  }

  container.innerHTML = patients
    .map((p) => {
      const isSelected = State.selectedEditPatient && State.selectedEditPatient.id === p.id;
      return `
        <div class="patient-list-item ${isSelected ? 'selected' : ''}" onclick="selectPatientForEditing(${p.id})">
          <div style="flex: 1; min-width: 0;">
            <div class="patient-list-name">${escapeHtml(p.name)}</div>
            <div class="patient-list-subtitle">OP: #${p.op_number || 'N/A'} &bull; ${escapeHtml(p.phone || 'N/A')}</div>
          </div>
          <button type="button" class="btn-admit-chip" onclick="event.stopPropagation(); admitPatientPrompt(${p.id}, '${escapeHtml(p.name)}')" title="Admit to Doctor Queue">
            <i class="fas fa-ticket-simple"></i> Admit
          </button>
        </div>
      `;
    })
    .join('');
}

async function selectPatientForEditing(patientId) {
  const res = await API.getPatientDetail(patientId);
  if (!res.ok || !res.data) {
    SnackBar.error('Error', 'Failed to retrieve patient profile.');
    return;
  }

  State.selectedEditPatient = res.data;
  renderSearchPatientList(State.searchEditResults);
  renderSearchPatientEditor();
}

function renderSearchPatientEditor() {
  const patient = State.selectedEditPatient;
  const emptyNotice = document.getElementById('search-empty-editor-notice');
  const activeEditor = document.getElementById('search-active-editor');

  if (!patient) {
    if (emptyNotice) emptyNotice.style.display = 'block';
    if (activeEditor) activeEditor.style.display = 'none';
    return;
  }

  if (emptyNotice) emptyNotice.style.display = 'none';
  if (activeEditor) activeEditor.style.display = 'block';

  document.getElementById('edit-patient-id').value = patient.id;
  document.getElementById('edit-patient-op-label').innerHTML = `
    OP Number: #${patient.op_number || 'N/A'}
    <button type="button" class="btn-admit-chip" style="margin-left: 10px;" onclick="admitPatientPrompt(${patient.id}, '${escapeHtml(patient.name)}')">
      <i class="fas fa-ticket-simple"></i> Admit to Queue
    </button>
  `;
  document.getElementById('edit-name').value = patient.name || '';
  document.getElementById('edit-age').value = patient.age !== undefined ? patient.age : '';
  document.getElementById('edit-phone').value = patient.phone || '';
  document.getElementById('edit-gender').value = patient.gender || 'Male';
  document.getElementById('edit-address').value = patient.address ? (patient.address.address || '') : '';

  const dobInput = document.getElementById('edit-dob');
  const dobLabel = document.getElementById('edit-dob-display-label');
  if (patient.dob) {
    dobInput.value = patient.dob;
    dobLabel.textContent = formatDateDisplay(patient.dob);
  } else {
    dobInput.value = '';
    dobLabel.textContent = 'Select Date';
  }
}

async function handlePatientUpdateSubmit(e) {
  e.preventDefault();
  if (!State.selectedEditPatient) return;

  const patientId = document.getElementById('edit-patient-id').value;
  const name = document.getElementById('edit-name').value.trim();
  const age = parseFloat(document.getElementById('edit-age').value);
  const dob = document.getElementById('edit-dob').value || null;
  const gender = document.getElementById('edit-gender').value;
  const phone = document.getElementById('edit-phone').value.trim();
  const address = document.getElementById('edit-address').value.trim();
  const saveBtn = document.getElementById('btn-save-edit-patient');

  const payload = {
    name,
    age,
    gender,
    phone,
    address: { address },
  };
  if (dob) payload.dob = dob;

  saveBtn.disabled = true;
  saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

  const res = await API.updatePatient(patientId, payload);
  saveBtn.disabled = false;
  saveBtn.innerHTML = '<i class="fas fa-floppy-disk"></i> Save Changes';

  if (res.ok) {
    SnackBar.success('Updated', 'Patient details updated successfully.');
    // Refresh patient data
    const refreshRes = await API.getPatientDetail(patientId);
    if (refreshRes.ok) {
      State.selectedEditPatient = refreshRes.data;
      renderSearchPatientEditor();
    }
  } else {
    SnackBar.error('Error', 'Failed to update patient.');
  }
}

// ==========================================================================
// 5. REPORTS & ANALYTICS (report.dart)
// ==========================================================================
async function runDailyReport() {
  const dateInput = document.getElementById('report-date-picker');
  const dateStr = dateInput ? dateInput.value : '';
  if (!dateStr) {
    SnackBar.warning('Date Required', 'Please select a date.');
    return;
  }

  const titleEl = document.getElementById('report-results-title');
  if (titleEl) titleEl.textContent = `Daily Summary for ${formatDateDisplay(dateStr)}`;

  renderReportLoading();
  const res = await API.getDailySummary(dateStr);
  if (res.ok && Array.isArray(res.data)) {
    renderReportTableResults(res.data);
  } else {
    renderReportTableResults([]);
  }
}

async function runDateRangeReport() {
  const start = document.getElementById('report-range-start').value;
  const end = document.getElementById('report-range-end').value;

  if (!start || !end) {
    SnackBar.warning('Range Required', 'Please select start and end dates.');
    return;
  }

  const titleEl = document.getElementById('report-results-title');
  if (titleEl) titleEl.textContent = `Summary between ${formatDateDisplay(start)} and ${formatDateDisplay(end)}`;

  renderReportLoading();
  const res = await API.getRangeSummary(start, end);
  if (res.ok && Array.isArray(res.data)) {
    renderReportTableResults(res.data);
  } else {
    renderReportTableResults([]);
  }
}

function renderReportLoading() {
  const tbody = document.getElementById('report-table-body');
  if (tbody) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-table-cell">
          <i class="fas fa-spinner fa-spin"></i> Loading consultation records...
        </td>
      </tr>
    `;
  }
}

function groupVisitsByPatient(visits) {
  const patientMap = new Map();

  for (const v of visits) {
    // Group primarily by patient_op, fallback to patient_id
    const key = (v.patient_op !== undefined && v.patient_op !== null) ? `op_${v.patient_op}` : `id_${v.patient_id}`;

    if (!patientMap.has(key)) {
      patientMap.set(key, {
        patient_id: v.patient_id,
        patient_op: v.patient_op,
        patient_name: v.patient_name || 'N/A',
        patient_phone: v.patient_phone || '',
        visits: [],
      });
    }

    patientMap.get(key).visits.push(v);
  }

  const grouped = Array.from(patientMap.values());

  // Sort each patient's visits with newest visit first
  for (const item of grouped) {
    item.visits.sort((a, b) => {
      const da = new Date(a.visit_date || 0);
      const db = new Date(b.visit_date || 0);
      return db - da || (b.id - a.id);
    });
  }

  // Sort patients: newest visit first
  grouped.sort((a, b) => {
    const da = a.visits[0] ? new Date(a.visits[0].visit_date || 0) : 0;
    const db = b.visits[0] ? new Date(b.visits[0].visit_date || 0) : 0;
    return db - da || ((b.patient_op || 0) - (a.patient_op || 0));
  });

  return grouped;
}

function renderReportTableResults(visits) {
  const tbody = document.getElementById('report-table-body');
  const countBadge = document.getElementById('report-results-count');
  const expandControls = document.getElementById('report-expand-controls');
  if (!tbody) return;

  if (!visits || visits.length === 0) {
    State.reportGroupedPatients = [];
    if (countBadge) countBadge.textContent = '0';
    if (expandControls) expandControls.style.display = 'none';
    tbody.innerHTML = `
      <tr>
        <td colspan="7" class="empty-table-cell">
          No consultation records found for the selected dates.
        </td>
      </tr>
    `;
    return;
  }

  const grouped = groupVisitsByPatient(visits);
  State.reportGroupedPatients = grouped;

  if (countBadge) {
    countBadge.textContent = `${grouped.length} Patient${grouped.length !== 1 ? 's' : ''} (${visits.length} Visit${visits.length !== 1 ? 's' : ''})`;
  }
  if (expandControls) {
    expandControls.style.display = 'flex';
  }

  tbody.innerHTML = grouped
    .map((p, i) => {
      const visitCount = p.visits.length;
      const latestVisit = p.visits[0] || {};
      const latestDate = latestVisit.visit_date || '&mdash;';
      const latestRemarks = latestVisit.reason ? latestVisit.reason.replace(/\n+/g, ' ').trim() : '&mdash;';

      // Build expanded visits list
      const visitsHtml = p.visits
        .map((v, vIndex) => {
          const rxList = (v.prescriptions || []).filter((rx) => rx && (rx.medicine_name || rx.instructions));
          const rxHtml = rxList.length > 0
            ? rxList
                .map(
                  (rx, rIndex) => `
                <div class="rx-mini-item">
                  <span class="rx-num">${rIndex + 1}.</span>
                  <span class="rx-name">${escapeHtml(rx.medicine_name || '')}</span>
                  ${rx.instructions ? `<span class="rx-inst">&bull; ${escapeHtml(rx.instructions)}</span>` : ''}
                </div>
              `
                )
                .join('')
            : '<span class="no-data-text"><i class="fas fa-prescription-bottle"></i> No medicines prescribed</span>';

          const xrayThumb = v.xray_url
            ? `
              <button type="button" class="xray-thumbnail-btn" onclick="event.stopPropagation(); openXrayDialog('${escapeHtml(v.xray_url)}')" title="Click to view full X-Ray">
                <img src="${escapeHtml(v.xray_url)}" class="xray-thumb-img" alt="X-Ray">
                <span class="xray-zoom-hint"><i class="fas fa-magnifying-glass-plus"></i> View</span>
              </button>
            `
            : '<span class="no-data-text"><i class="fas fa-ban"></i> No X-Ray</span>';

          const formattedReason = escapeHtml(v.reason || 'No remarks recorded.').replace(/\n/g, '<br>');

          return `
            <div class="report-visit-card">
              <div class="report-visit-header">
                <div class="report-visit-badge">
                  <i class="fas fa-calendar-check"></i>
                  <span>Visit #${visitCount - vIndex} &bull; ${escapeHtml(v.visit_date || '')}</span>
                </div>
                <div class="report-visit-actions">
                  ${p.patient_id ? `
                    <button type="button" class="chip-btn" onclick="event.stopPropagation(); openDoctorForPatient(${p.patient_id})" title="Open this patient in Doctor Desk">
                      <i class="fas fa-user-doctor"></i> Doctor Desk
                    </button>
                  ` : ''}
                </div>
              </div>

              <div class="report-visit-grid">
                <!-- Diagnosis / Remarks -->
                <div class="report-grid-col">
                  <div class="report-col-title"><i class="fas fa-stethoscope"></i> Diagnosis & Doctor Remarks</div>
                  <div class="visit-remarks-text">${formattedReason}</div>
                </div>

                <!-- Prescriptions -->
                <div class="report-grid-col">
                  <div class="report-col-title"><i class="fas fa-pills"></i> Prescriptions (${rxList.length})</div>
                  <div class="report-col-content">${rxHtml}</div>
                </div>

                <!-- X-Ray -->
                <div class="report-grid-col report-xray-col">
                  <div class="report-col-title"><i class="fas fa-x-ray"></i> X-Ray Image</div>
                  <div class="report-col-content">${xrayThumb}</div>
                </div>
              </div>
            </div>
          `;
        })
        .join('');

      return `
        <!-- Main Parent Row (1 Single Row per Patient/OP) -->
        <tr class="report-parent-row" id="report-parent-${i}" onclick="toggleReportDetailRow(${i})" title="Click row to view all visit details">
          <td style="width: 45px; text-align: center;">
            <i class="fas fa-chevron-right chevron-icon" id="report-chevron-${i}"></i>
            <span style="font-size: 0.82rem; margin-left: 4px; color: var(--text-subtle);">${i + 1}</span>
          </td>
          <td style="width: 90px;"><span class="op-chip">#${escapeHtml(p.patient_op || 'N/A')}</span></td>
          <td>
            <div style="font-weight: 700; color: var(--text-primary); font-size: 0.92rem;">${escapeHtml(p.patient_name || 'N/A')}</div>
            <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;">
              <i class="fas fa-phone" style="font-size: 0.72rem; opacity: 0.7;"></i> ${escapeHtml(p.patient_phone || 'No phone')}
            </div>
          </td>
          <td style="width: 110px; text-align: center;">
            <span class="badge ${visitCount > 1 ? 'badge-multi-visit' : 'badge-single-visit'}">
              <i class="fas ${visitCount > 1 ? 'fa-layer-group' : 'fa-check'}"></i> ${visitCount} visit${visitCount > 1 ? 's' : ''}
            </span>
          </td>
          <td style="width: 140px; font-size: 0.84rem; font-weight: 600; color: var(--text-primary);">
            ${latestDate}
          </td>
          <td>
            <div class="truncate-text" style="max-width: 320px;" title="${escapeHtml(latestRemarks)}">
              ${escapeHtml(latestRemarks)}
            </div>
          </td>
          <td style="width: 130px; text-align: center;">
            <button type="button" class="elevated-button btn-secondary btn-sm" onclick="event.stopPropagation(); toggleReportDetailRow(${i})" id="report-btn-toggle-${i}" style="font-size: 0.78rem; padding: 4px 10px; width: 100%; justify-content: center;">
              <i class="fas fa-eye" id="report-btn-icon-${i}"></i>
              <span id="report-btn-label-${i}">Details (${visitCount})</span>
            </button>
          </td>
        </tr>

        <!-- Expanded Details Sub-Row (Reveals All Visits on Click) -->
        <tr class="report-detail-row" id="report-detail-${i}" style="display: none;">
          <td colspan="7" style="padding: 0; background-color: var(--bg-surface-variant); border-bottom: 2px solid var(--divider-color);">
            <div class="report-detail-expanded-box">
              <div style="display: flex; justify-content: space-between; align-items: center; padding-bottom: 0.35rem; border-bottom: 1px dashed var(--divider-color); font-size: 0.82rem; color: var(--text-secondary);">
                <span><i class="fas fa-folder-open" style="color: var(--md-primary);"></i> Complete Visit History for <strong>${escapeHtml(p.patient_name)}</strong> (OP #${p.patient_op})</span>
                <span class="badge" style="background: rgba(0,121,107,0.1); color: var(--md-primary); font-weight: 700;">${visitCount} Record${visitCount !== 1 ? 's' : ''}</span>
              </div>
              ${visitsHtml}
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

function toggleReportDetailRow(index) {
  const detailRow = document.getElementById(`report-detail-${index}`);
  const parentRow = document.getElementById(`report-parent-${index}`);
  const chevron = document.getElementById(`report-chevron-${index}`);
  const btnLabel = document.getElementById(`report-btn-label-${index}`);
  const btnIcon = document.getElementById(`report-btn-icon-${index}`);

  if (!detailRow || !parentRow) return;

  const isHidden = detailRow.style.display === 'none';
  detailRow.style.display = isHidden ? 'table-row' : 'none';
  parentRow.classList.toggle('is-expanded', isHidden);

  if (chevron) {
    chevron.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
  }
  if (btnIcon) {
    btnIcon.className = isHidden ? 'fas fa-eye-slash' : 'fas fa-eye';
  }
  if (btnLabel) {
    const count = State.reportGroupedPatients[index]?.visits?.length || 0;
    btnLabel.textContent = isHidden ? 'Hide Details' : `Details (${count})`;
  }
}

function toggleAllReportRows(expand) {
  const count = State.reportGroupedPatients ? State.reportGroupedPatients.length : 0;
  for (let i = 0; i < count; i++) {
    const detailRow = document.getElementById(`report-detail-${i}`);
    const parentRow = document.getElementById(`report-parent-${i}`);
    const chevron = document.getElementById(`report-chevron-${i}`);
    const btnLabel = document.getElementById(`report-btn-label-${i}`);
    const btnIcon = document.getElementById(`report-btn-icon-${i}`);
    const visitCount = State.reportGroupedPatients[i]?.visits?.length || 0;

    if (detailRow && parentRow) {
      detailRow.style.display = expand ? 'table-row' : 'none';
      parentRow.classList.toggle('is-expanded', expand);
      if (chevron) {
        chevron.style.transform = expand ? 'rotate(90deg)' : 'rotate(0deg)';
      }
      if (btnIcon) {
        btnIcon.className = expand ? 'fas fa-eye-slash' : 'fas fa-eye';
      }
      if (btnLabel) {
        btnLabel.textContent = expand ? 'Hide Details' : `Details (${visitCount})`;
      }
    }
  }
}

function openDoctorForPatient(patientId) {
  navigateTo('/doctor');
  selectPatientInDoctorView(patientId);
}

// ==========================================================================
// 6. ADMIN & DATA SAFETY (usermanagment.dart + Backup/Export Feature)
// ==========================================================================
async function loadAdminMetrics() {
  const res = await API.getClinicMetrics();
  if (res.ok && res.data) {
    const data = res.data;
    const patEl = document.getElementById('metric-total-patients');
    const visEl = document.getElementById('metric-total-visits');
    const rxEl = document.getElementById('metric-total-rx');
    const userEl = document.getElementById('metric-total-users');

    if (patEl) patEl.textContent = Number(data.total_patients).toLocaleString();
    if (visEl) visEl.textContent = Number(data.total_visits).toLocaleString();
    if (rxEl) rxEl.textContent = Number(data.total_prescriptions).toLocaleString();
    if (userEl) userEl.textContent = Number(data.total_users).toLocaleString();
  }
}

function printVisitPrescription(visitId) {
  if (!State.selectedPatient || !State.selectedPatient.visits) return;
  const visit = State.selectedPatient.visits.find((v) => v.id === visitId);
  if (!visit) return;

  const patient = State.selectedPatient;
  const prescriptions = visit.prescriptions || [];
  const rxRows = prescriptions.length > 0
    ? prescriptions
        .map(
          (p, i) => `
      <tr>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0; width: 30px; font-weight: bold; color: #64748b;">${i + 1}.</td>
        <td style="padding: 10px 8px; border-bottom: 1px solid #e2e8f0;">
          <div style="font-size: 15px; font-weight: 700; color: #004d40;">${escapeHtml(p.medicine_name)}</div>
          ${p.instructions ? `<div style="font-size: 13px; color: #475569; margin-top: 3px;">Instructions: <strong>${escapeHtml(p.instructions)}</strong></div>` : ''}
        </td>
      </tr>`
        )
        .join('')
    : '<tr><td colspan="2" style="padding: 16px; text-align: center; color: #94a3b8;">No medications prescribed for this visit.</td></tr>';

  const printWindow = window.open('', '_blank', 'width=800,height=900');
  if (!printWindow) {
    SnackBar.warning('Popup Blocked', 'Please allow popups to open the prescription print view.');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Prescription - ${escapeHtml(patient.name)} (OP #${patient.op_number})</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 36px; color: #0f172a; margin: 0; }
        .header { display: flex; align-items: center; justify-content: space-between; border-bottom: 3px solid #00796b; padding-bottom: 16px; margin-bottom: 22px; }
        .clinic-name { font-size: 26px; font-weight: 800; color: #00796b; margin: 0; }
        .clinic-sub { font-size: 13px; color: #64748b; margin: 4px 0 0; }
        .badge { background: #e0f2f1; color: #004d40; padding: 4px 10px; border-radius: 4px; font-size: 13px; font-weight: 700; }
        .patient-box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 22px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; font-size: 14px; }
        .rx-title { font-size: 24px; font-weight: 800; color: #00796b; margin: 24px 0 10px; font-style: italic; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        .footer { margin-top: 70px; display: flex; justify-content: space-between; align-items: flex-end; padding-top: 20px; border-top: 1px dashed #cbd5e1; font-size: 12px; color: #64748b; }
        .sig-line { border-top: 1.5px solid #0f172a; width: 200px; margin-top: 60px; text-align: center; font-size: 13px; font-weight: 600; padding-top: 4px; }
        .print-btn-bar { text-align: right; margin-bottom: 15px; }
        .print-btn { background: #00796b; color: white; border: none; padding: 9px 18px; border-radius: 6px; font-weight: 700; cursor: pointer; font-size: 14px; }
        @media print { .print-btn-bar { display: none; } body { padding: 12mm; } }
      </style>
    </head>
    <body>
      <div class="print-btn-bar">
        <button class="print-btn" onclick="window.print()">
          🖨️ Print Prescription Slip
        </button>
      </div>

      <div class="header">
        <div>
          <h1 class="clinic-name">DentalCare Clinic</h1>
          <p class="clinic-sub">Advanced Dental Care, Oral Surgery & Patient Management</p>
        </div>
        <div style="text-align: right;">
          <span class="badge">CONSULTATION PRESCRIPTION</span>
          <div style="font-size: 13px; color: #64748b; margin-top: 6px;">Date: <strong>${escapeHtml(visit.visit_date || '')}</strong></div>
        </div>
      </div>

      <div class="patient-box">
        <div><strong>Patient:</strong> ${escapeHtml(patient.name)}</div>
        <div><strong>OP Number:</strong> #${escapeHtml(patient.op_number || '')}</div>
        <div><strong>Age / Gender:</strong> ${escapeHtml(patient.age !== undefined ? patient.age : '')} yrs / ${escapeHtml(patient.gender || '')}</div>
        <div><strong>Phone:</strong> ${escapeHtml(patient.phone || '')}</div>
        <div style="grid-column: span 2;"><strong>Address:</strong> ${escapeHtml(patient.address?.address || 'N/A')}</div>
      </div>

      ${visit.reason ? `
        <div style="margin-bottom: 22px; background: #fffde7; padding: 12px 16px; border-radius: 6px; border-left: 4px solid #fbc02d; font-size: 14px;">
          <strong>Clinical Remarks / Diagnosis:</strong>
          <div style="margin-top: 4px; color: #334155; line-height: 1.5;">${escapeHtml(visit.reason)}</div>
        </div>
      ` : ''}

      <div class="rx-title">&#8478; Prescriptions</div>
      <table>
        ${rxRows}
      </table>

      <div class="footer">
        <div>DentalCare Clinic Portal &bull; Electronically Generated</div>
        <div>
          <div class="sig-line">Doctor Signature & Stamp</div>
        </div>
      </div>
    </body>
    </html>
  `);
  printWindow.document.close();
}

async function loadAdminUsersList() {
  const container = document.getElementById('admin-user-roster-list');
  if (!container) return;

  const res = await API.listUsers();
  if (res.ok && Array.isArray(res.data)) {
    container.innerHTML = res.data
      .map(
        (u) => `
        <div class="user-roster-item">
          <div>
            <span class="user-roster-username">${escapeHtml(u.username)}</span>
            <span class="user-role-badge" style="margin-left: 0.5rem; background: var(--md-teal-50); color: var(--md-primary);">${escapeHtml(u.role)}</span>
          </div>
          <button type="button" class="text-button" style="font-size: 0.8rem; padding: 2px 6px;" onclick="prefillPasswordChange('${escapeHtml(u.username)}')">
            Change Password
          </button>
        </div>
      `
      )
      .join('');
  } else {
    container.innerHTML = '<div style="color: var(--text-subtle); font-size: 0.85rem;">Unable to load user list.</div>';
  }
}

function prefillPasswordChange(username) {
  const input = document.getElementById('admin-change-username');
  if (input) {
    input.value = username;
    document.getElementById('admin-change-new-password')?.focus();
  }
}

async function handleAdminAddUserSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('admin-new-username').value.trim();
  const password = document.getElementById('admin-new-password').value.trim();
  const role = document.getElementById('admin-new-role').value;

  if (!username || !password || !role) return;

  const res = await API.addUser({ username, password, role });
  if (res.ok) {
    SnackBar.success('User Created', `Account ${username} created.`);
    document.getElementById('form-admin-add-user').reset();
    loadAdminUsersList();
  } else {
    SnackBar.error('Failed', JSON.stringify(res.data?.error || res.data || 'Failed to add user'));
  }
}

async function handleAdminChangePasswordSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('admin-change-username').value.trim();
  const password = document.getElementById('admin-change-new-password').value.trim();

  if (!username || !password) return;

  const res = await API.changePassword({ username, password });
  if (res.ok) {
    SnackBar.success('Updated', `Password changed for user ${username}.`);
    document.getElementById('form-admin-change-password').reset();
  } else {
    SnackBar.error('Failed', res.data?.error || 'Failed to change password.');
  }
}

// ==========================================================================
// 7. PATIENT QUEUE & ADMISSION TOKEN SYSTEM (Doctor Notification & Tokens)
// ==========================================================================
async function loadTodayQueue(silent = false) {
  if (!State.user) return;

  const res = await API.getTodayQueue();
  if (!res.ok || !res.data) return;

  State.todayQueue = res.data;
  renderQueueBadges();
  renderDoctorQueueStrip();

  // If queue modal is open, re-render its list
  const modal = document.getElementById('dialog-patient-queue');
  if (modal && modal.style.display !== 'none') {
    renderQueueModalContent();
  }
}

function renderQueueBadges() {
  const pendingCount = State.todayQueue?.pending_count || 0;
  const completedCount = State.todayQueue?.completed_count || 0;
  const totalTokens = State.todayQueue?.total_tokens || 0;

  // Appbar Notification Bell Badge
  const bellBadge = document.getElementById('queue-pending-count');
  if (bellBadge) {
    bellBadge.textContent = pendingCount;
    bellBadge.style.display = pendingCount > 0 ? 'flex' : 'none';
  }

  // Drawer Badge
  const drawerBadge = document.getElementById('drawer-queue-count');
  if (drawerBadge) {
    drawerBadge.textContent = pendingCount;
    drawerBadge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
  }

  // Reception Panel Badge
  const receptionBadge = document.getElementById('reception-queue-count');
  if (receptionBadge) {
    receptionBadge.textContent = pendingCount;
  }

  // Doctor Desk Strip Counter
  const stripCount = document.getElementById('doc-strip-count');
  if (stripCount) {
    stripCount.textContent = pendingCount;
  }

  // Modal tab badges & subtitle
  const tabWaitingBadge = document.getElementById('tab-waiting-count-badge');
  if (tabWaitingBadge) tabWaitingBadge.textContent = pendingCount;

  const tabCompletedBadge = document.getElementById('tab-completed-count-badge');
  if (tabCompletedBadge) tabCompletedBadge.textContent = completedCount;

  const totalTokensLabel = document.getElementById('queue-total-tokens-label');
  if (totalTokensLabel) totalTokensLabel.textContent = totalTokens;
}

function renderDoctorQueueStrip() {
  const strip = document.getElementById('doc-queue-strip');
  const container = document.getElementById('doc-queue-chips');
  if (!strip || !container) return;

  const waiting = State.todayQueue?.waiting || [];
  if (waiting.length === 0) {
    strip.style.display = 'none';
    container.innerHTML = '';
    return;
  }

  strip.style.display = 'flex';
  container.innerHTML = waiting
    .map((item) => `
      <div class="queue-chip-item" onclick="callPatientFromQueue(${item.patient_id})" title="Click to open file for ${escapeHtml(item.patient_name)}">
        <span class="queue-chip-token">#${item.token_number}</span>
        <strong>${escapeHtml(item.patient_name)}</strong>
        <span style="opacity: 0.75; font-size: 0.75rem;">(OP #${item.patient_op})</span>
      </div>
    `)
    .join('');
}

function openQueueModal() {
  closeDrawer();
  const modal = document.getElementById('dialog-patient-queue');
  if (!modal) return;
  modal.style.display = 'flex';
  renderQueueModalContent();
  loadTodayQueue(true);
}

function closeQueueModal() {
  const modal = document.getElementById('dialog-patient-queue');
  if (modal) modal.style.display = 'none';
}

function switchQueueTab(tabName) {
  State.activeQueueTab = tabName;

  const waitingBtn = document.getElementById('tab-queue-waiting-btn');
  const completedBtn = document.getElementById('tab-queue-completed-btn');
  const waitingPane = document.getElementById('queue-pane-waiting');
  const completedPane = document.getElementById('queue-pane-completed');

  if (tabName === 'waiting') {
    if (waitingBtn) waitingBtn.classList.add('active');
    if (completedBtn) completedBtn.classList.remove('active');
    if (waitingPane) waitingPane.style.display = 'block';
    if (completedPane) completedPane.style.display = 'none';
  } else {
    if (waitingBtn) waitingBtn.classList.remove('active');
    if (completedBtn) completedBtn.classList.add('active');
    if (waitingPane) waitingPane.style.display = 'none';
    if (completedPane) completedPane.style.display = 'block';
  }

  renderQueueModalContent();
}

function renderQueueModalContent() {
  const waitingListEl = document.getElementById('queue-waiting-list');
  const completedListEl = document.getElementById('queue-completed-list');

  const waiting = State.todayQueue?.waiting || [];
  const completed = State.todayQueue?.completed || [];

  // 1. Render Waiting / Pending Queue
  if (waitingListEl) {
    if (waiting.length === 0) {
      waitingListEl.innerHTML = `
        <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-subtle);">
          <i class="fas fa-check-circle" style="font-size: 2.5rem; opacity: 0.4; margin-bottom: 0.75rem; display: block; color: var(--md-teal);"></i>
          <h4 style="margin: 0; color: var(--text-secondary);">No Patients in Waiting Queue</h4>
          <p style="font-size: 0.82rem; margin: 4px 0 0;">Receptionist can admit patients using "Search Patient" or "Register Patient".</p>
        </div>
      `;
    } else {
      waitingListEl.innerHTML = waiting
        .map((item) => `
          <div class="queue-card-entry" onclick="callPatientFromQueue(${item.patient_id})" style="cursor: pointer;" title="Click to open ${escapeHtml(item.patient_name)} in Doctor Desk">
            <div class="token-circle-badge">
              <span class="token-circle-sub">TOKEN</span>
              <span>#${item.token_number}</span>
            </div>
            <div class="queue-entry-info">
              <div class="queue-entry-name">
                ${escapeHtml(item.patient_name)}
                <span class="badge" style="background: rgba(0,121,107,0.1); color: var(--md-primary); font-size: 0.72rem; padding: 2px 6px; border-radius: 4px;">OP #${item.patient_op}</span>
              </div>
              <div class="queue-entry-meta">
                ${item.patient_age !== undefined ? `${item.patient_age} yrs` : ''} &bull; ${escapeHtml(item.patient_gender || '')} &bull; ${escapeHtml(item.patient_phone || '')}
              </div>
              <div class="queue-entry-time">
                <i class="fas fa-clock" style="font-size: 0.7rem;"></i> Admitted: <strong>${escapeHtml(item.admitted_time || 'Today')}</strong>
              </div>
            </div>
            <div class="queue-entry-actions">
              <button type="button" class="btn-call-patient" onclick="event.stopPropagation(); callPatientFromQueue(${item.patient_id})" title="Load Patient into Doctor Desk">
                <i class="fas fa-user-md"></i> Consult
              </button>
              <button type="button" class="btn-remove-queue" onclick="event.stopPropagation(); removePatientFromQueuePrompt(${item.id}, '${escapeHtml(item.patient_name)}')" title="Remove from Queue">
                <i class="fas fa-times"></i>
              </button>
            </div>
          </div>
        `)
        .join('');
    }
  }

  // 2. Render Completed Today
  if (completedListEl) {
    if (completed.length === 0) {
      completedListEl.innerHTML = `
        <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-subtle);">
          <i class="fas fa-user-clock" style="font-size: 2.5rem; opacity: 0.4; margin-bottom: 0.75rem; display: block;"></i>
          <h4 style="margin: 0; color: var(--text-secondary);">No Consultations Completed Yet Today</h4>
          <p style="font-size: 0.82rem; margin: 4px 0 0;">When Doctor adds a visit for a patient, they move here automatically.</p>
        </div>
      `;
    } else {
      completedListEl.innerHTML = completed
        .map((item) => `
          <div class="queue-card-entry" style="opacity: 0.9;">
            <div class="token-circle-badge completed">
              <i class="fas fa-check" style="font-size: 0.85rem; margin-bottom: 1px;"></i>
              <span style="font-size: 0.9rem;">#${item.token_number}</span>
            </div>
            <div class="queue-entry-info">
              <div class="queue-entry-name">
                ${escapeHtml(item.patient_name)}
                <span class="badge" style="background: rgba(16,185,129,0.12); color: #047857; font-size: 0.72rem; padding: 2px 6px; border-radius: 4px;">OP #${item.patient_op}</span>
              </div>
              <div class="queue-entry-meta">
                ${item.patient_age !== undefined ? `${item.patient_age} yrs` : ''} &bull; ${escapeHtml(item.patient_phone || '')}
              </div>
              <div class="queue-entry-time" style="color: #047857;">
                <i class="fas fa-check-circle" style="font-size: 0.7rem;"></i> Completed: <strong>${escapeHtml(item.completed_time || item.admitted_time || 'Today')}</strong>
              </div>
            </div>
            <div class="queue-entry-actions">
              <button type="button" class="elevated-button btn-secondary" style="padding: 6px 12px; font-size: 0.8rem;" onclick="callPatientFromQueue(${item.patient_id})" title="Review Patient File">
                <i class="fas fa-folder-open"></i> View File
              </button>
            </div>
          </div>
        `)
        .join('');
    }
  }
}

async function callPatientFromQueue(patientId) {
  closeQueueModal();
  if (State.currentRoute !== '/doctor') {
    navigateTo('/doctor');
  }
  await selectPatientInDoctorView(patientId);
  SnackBar.info('Patient Loaded', `Loaded patient into Doctor Desk for consultation.`);
}

async function admitPatientPrompt(patientId, patientName) {
  const res = await API.admitToQueue(patientId);
  if (res.ok && res.data) {
    if (res.data.already_waiting) {
      SnackBar.warning('Already in Queue', res.data.message);
    } else {
      SnackBar.success('Admitted to Queue', res.data.message);
    }
    loadTodayQueue(true);
  } else {
    SnackBar.error('Failed', res.data?.error || 'Failed to admit patient');
  }
}

async function removePatientFromQueuePrompt(entryId, patientName) {
  if (!confirm(`Are you sure you want to remove ${patientName} from today's queue?`)) return;

  const res = await API.removeQueueEntry(entryId);
  if (res.ok) {
    SnackBar.info('Removed', res.data?.message || 'Patient removed from queue.');
    loadTodayQueue(true);
  } else {
    SnackBar.error('Failed', res.data?.error || 'Failed to remove patient from queue.');
  }
}

function startQueuePolling() {
  if (State.queuePollTimer) clearInterval(State.queuePollTimer);
  State.queuePollTimer = setInterval(() => {
    if (State.user) {
      loadTodayQueue(true);
    }
  }, 12000);
}

function stopQueuePolling() {
  if (State.queuePollTimer) {
    clearInterval(State.queuePollTimer);
    State.queuePollTimer = null;
  }
}

// ==========================================================================
// MODAL DIALOG CONTROLS
// ==========================================================================
function openDialog(dialogId) {
  const dialog = document.getElementById(dialogId);
  if (dialog) dialog.style.display = 'flex';
}

function closeDialog(dialogId) {
  const dialog = document.getElementById(dialogId);
  if (dialog) dialog.style.display = 'none';
}

// Global Escape Key Listener for Modals & Drawer
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeDrawer();
    document.querySelectorAll('.dialog-backdrop').forEach((d) => (d.style.display = 'none'));
  }
});

// ==========================================================================
// APP INITIALIZATION & HASH ROUTING
// ==========================================================================
window.addEventListener('DOMContentLoaded', () => {
  initTheme();
  updateUserDataUI();

  // Set today's date on Report Date Pickers
  const todayStr = new Date().toISOString().substring(0, 10);
  const reportDayPicker = document.getElementById('report-date-picker');
  const reportStartPicker = document.getElementById('report-range-start');
  const reportEndPicker = document.getElementById('report-range-end');
  if (reportDayPicker) reportDayPicker.value = todayStr;
  if (reportStartPicker) reportStartPicker.value = todayStr;
  if (reportEndPicker) reportEndPicker.value = todayStr;

  // Determine Initial Route
  const hash = window.location.hash.replace('#', '');
  if (!State.user) {
    navigateTo('/');
  } else {
    startQueuePolling();
    loadTodayQueue(true);

    if (hash && ['/doctor', '/reception', '/register', '/search', '/reports', '/admin'].includes(hash)) {
      navigateTo(hash);
    } else {
      if (State.user.role === 'doctor') navigateTo('/doctor');
      else if (State.user.role === 'receptionist') navigateTo('/reception');
      else navigateTo('/admin');
    }
  }
});

window.addEventListener('hashchange', () => {
  const hash = window.location.hash.replace('#', '');
  if (!State.user) {
    navigateTo('/');
    return;
  }
  if (hash && hash !== State.currentRoute) {
    navigateTo(hash);
  }
});
