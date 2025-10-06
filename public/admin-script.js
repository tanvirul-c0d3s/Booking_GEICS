// ===== Backend base (Render) =====
// same-origin (localhost) default
const API_BASE = (typeof window !== 'undefined' && 'API_BASE' in window) ? window.API_BASE : '';
const api = (p) => `${API_BASE}${p}`;

let allAppointments = [];
let currentFilter = 'all';

// Load appointments on page load
document.addEventListener('DOMContentLoaded', function() {
  loadAppointments();
});

// Load appointments from server
async function loadAppointments() {
  try {
    const response = await fetch(api('/api/appointments'), { credentials: 'include' });
    if (!response.ok) throw new Error('Failed to load');
    allAppointments = await response.json();

    updateStats();
    displayAppointments();
  } catch (error) {
    console.error('Error loading appointments:', error);
    showErrorMessage('Failed to load appointments');
  }
}

// Update dashboard statistics
function updateStats() {
  const total = allAppointments.length;
  const pending = allAppointments.filter(apt => apt.status === 'pending').length;
  const confirmed = allAppointments.filter(apt => apt.status === 'confirmed').length;

  const today = new Date().toDateString();
  const todayAppointments = allAppointments.filter(apt =>
    apt.appointmentDate && new Date(apt.appointmentDate).toDateString() === today
  ).length;

  document.getElementById('totalAppointments').textContent = total;
  document.getElementById('pendingAppointments').textContent = pending;
  document.getElementById('confirmedAppointments').textContent = confirmed;
  document.getElementById('todayAppointments').textContent = todayAppointments;
}

// Display appointments based on current filter
function displayAppointments() {
  const container = document.getElementById('appointmentsContainer');

  let filteredAppointments = allAppointments;
  if (currentFilter !== 'all') {
    filteredAppointments = allAppointments.filter(apt => apt.status === currentFilter);
  }

  if (filteredAppointments.length === 0) {
    container.innerHTML = `
      <div class="loading-message">
        <i class="fas fa-calendar-times"></i>
        No appointments found
      </div>`;
    return;
  }

  container.innerHTML = filteredAppointments.map(appointment => `
    <div class="appointment-card">
      <div class="appointment-header">
        <div class="appointment-info">
          <h3>${appointment.name}</h3>
          <div class="appointment-meta">
            <span class="meta-item"><i class="fas fa-envelope"></i> ${appointment.email}</span>
            <span class="meta-item"><i class="fas fa-phone"></i> ${appointment.phone}</span>
            <span class="meta-item"><i class="fas fa-calendar-plus"></i> ${new Date(appointment.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
        <div class="appointment-status">
          <span class="status-badge ${appointment.status === 'confirmed' ? 'status-confirmed' : 'status-pending'}">
            ${appointment.status}
          </span>
        </div>
      </div>

      <div class="appointment-details">
        <h4>Consultation Details</h4>
        <p><strong>Preferred Country:</strong> ${appointment.preferredCountry}</p>
        <p><strong>Service Type:</strong> ${appointment.consultationType}</p>
        ${appointment.message ? `<p><strong>Message:</strong> ${appointment.message}</p>` : ''}
      </div>

      ${appointment.status === 'confirmed' && appointment.appointmentDate ? `
        <div class="confirmed-info">
          <h4>Confirmed Appointment</h4>
          <p><strong>Date:</strong> ${new Date(appointment.appointmentDate).toLocaleDateString()}</p>
          <p><strong>Time:</strong> ${appointment.appointmentTime}</p>
        </div>` : ''}

      <div class="appointment-actions">
        ${appointment.status === 'pending' ? `
          <button class="btn-primary btn-small" onclick="showConfirmModal('${appointment._id}')">
            <i class="fas fa-check"></i> Confirm
          </button>` : ''}
        <button class="btn-danger btn-small" onclick="deleteAppointment('${appointment._id}')">
          <i class="fas fa-trash"></i> Delete
        </button>
      </div>
    </div>
  `).join('');
}

// Filter appointments
function filterAppointments(status) {
  currentFilter = status;
  document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
  event.target.classList.add('active');
  displayAppointments();
}

// Show confirmation modal
function showConfirmModal(appointmentId) {
  document.getElementById('appointmentId').value = appointmentId;
  document.getElementById('confirmModal').style.display = 'block';
  document.body.style.overflow = 'hidden';

  const today = new Date().toISOString().split('T')[0];
  document.getElementById('appointmentDate').min = today;
}

// Close confirmation modal
function closeConfirmModal() {
  document.getElementById('confirmModal').style.display = 'none';
  document.body.style.overflow = 'auto';
  document.getElementById('confirmForm').reset();
}

// Handle confirmation form submission
document.getElementById('confirmForm').addEventListener('submit', async function(e) {
  e.preventDefault();

  const appointmentId = document.getElementById('appointmentId').value;
  const appointmentDate = document.getElementById('appointmentDate').value;
  const appointmentTime = document.getElementById('appointmentTime').value;

  try {
    const response = await fetch(api(`/api/appointments/${appointmentId}/confirm`), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ appointmentDate, appointmentTime })
    });

    const result = await response.json().catch(() => ({}));

    if (response.ok) {
      closeConfirmModal();
      showSuccessMessage('Appointment confirmed and email sent successfully!');
      loadAppointments();
    } else {
      showErrorMessage(result.error || 'Failed to confirm appointment');
    }
  } catch (error) {
    console.error('Error confirming appointment:', error);
    showErrorMessage('Network error. Please try again.');
  }
});

// Delete appointment
async function deleteAppointment(appointmentId) {
  if (!confirm('Are you sure you want to delete this appointment?')) return;

  try {
    const response = await fetch(api(`/api/appointments/${appointmentId}`), {
      method: 'DELETE',
      credentials: 'include'
    });

    const result = await response.json().catch(() => ({}));

    if (response.ok) {
      showSuccessMessage('Appointment deleted successfully');
      loadAppointments();
    } else {
      showErrorMessage(result.error || 'Failed to delete appointment');
    }
  } catch (error) {
    console.error('Error deleting appointment:', error);
    showErrorMessage('Network error. Please try again.');
  }
}

// Toast helpers
function showSuccessMessage(message) { const d = createMessageDiv(message, 'success'); document.body.appendChild(d); setTimeout(() => { d.classList.add('fade-out'); setTimeout(() => d.remove(), 300); }, 5000); }
function showErrorMessage(message) { const d = createMessageDiv(message, 'error');   document.body.appendChild(d); setTimeout(() => { d.classList.add('fade-out'); setTimeout(() => d.remove(), 300); }, 5000); }
function createMessageDiv(message, type) {
  const div = document.createElement('div');
  div.className = `message-popup ${type}`;
  div.innerHTML = `<div class="message-content"><i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i><span>${message}</span></div>`;
  div.style.cssText = `position:fixed; top:20px; right:20px; z-index:4000; max-width:400px; padding:1rem 1.5rem; border-radius:8px; box-shadow:0 4px 15px rgba(0,0,0,.2); color:#fff; font-weight:500; animation:slideInRight .3s ease-out; ${type==='success' ? 'background:linear-gradient(135deg,#059669,#047857)' : 'background:linear-gradient(135deg,#ef4444,#dc2626)'};`;
  return div;
}
