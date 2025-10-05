// Smooth scrolling for navigation links
function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

// Mobile navigation toggle
function toggleNavMenu() {
    const navMenu = document.querySelector('.nav-menu');
    navMenu.classList.toggle('active');
}

// Appointment Modal Functions
function showAppointmentModal() {
    document.getElementById('appointmentModal').style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeAppointmentModal() {
    document.getElementById('appointmentModal').style.display = 'none';
    document.body.style.overflow = 'auto';
    resetAppointmentForm();
}

function resetAppointmentForm() {
    document.getElementById('appointmentForm').reset();
}

// Loading spinner functions
function showLoading() {
    document.getElementById('loadingSpinner').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loadingSpinner').style.display = 'none';
}

// Form submission handler
document.getElementById('appointmentForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    
    showLoading();
    
    try {
        const formData = new FormData(this);
        const appointmentData = {
            name: formData.get('name'),
            email: formData.get('email'),
            phone: formData.get('phone'),
            preferredCountry: formData.get('preferredCountry'),
            consultationType: formData.get('consultationType'),
            message: formData.get('message')
        };

        const response = await fetch('/api/appointments', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(appointmentData)
        });

        const result = await response.json();

        hideLoading();

        if (response.ok) {
            closeAppointmentModal();
            showSuccessMessage('Appointment booked successfully! We will contact you soon to confirm the date and time.');
        } else {
            showErrorMessage(result.error || 'Failed to book appointment. Please try again.');
        }
    } catch (error) {
        hideLoading();
        showErrorMessage('Network error. Please check your connection and try again.');
    }
});

// Success and error message functions
function showSuccessMessage(message) {
    const messageDiv = createMessageDiv(message, 'success');
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.classList.add('fade-out');
        setTimeout(() => {
            document.body.removeChild(messageDiv);
        }, 300);
    }, 5000);
}

function showErrorMessage(message) {
    const messageDiv = createMessageDiv(message, 'error');
    document.body.appendChild(messageDiv);
    
    setTimeout(() => {
        messageDiv.classList.add('fade-out');
        setTimeout(() => {
            document.body.removeChild(messageDiv);
        }, 300);
    }, 5000);
}

function createMessageDiv(message, type) {
    const div = document.createElement('div');
    div.className = `message-popup ${type}`;
    div.innerHTML = `
        <div class="message-content">
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            <span>${message}</span>
        </div>
    `;
    
    // Add styles
    div.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 4000;
        max-width: 400px;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
        color: white;
        font-weight: 500;
        animation: slideInRight 0.3s ease-out;
        ${type === 'success' ? 'background: linear-gradient(135deg, #059669, #047857);' : 'background: linear-gradient(135deg, #ef4444, #dc2626);'}
    `;
    
    return div;
}

// Add CSS for message animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .message-popup.fade-out {
        animation: fadeOut 0.3s ease-out;
    }
    
    @keyframes fadeOut {
        to {
            opacity: 0;
            transform: translateY(-10px);
        }
    }
    
    .message-content {
        display: flex;
        align-items: center;
        gap: 0.75rem;
    }
    
    .message-content i {
        font-size: 1.2rem;
    }
`;
document.head.appendChild(style);

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const modal = document.getElementById('appointmentModal');
    if (event.target === modal) {
        closeAppointmentModal();
    }
});

// Header scroll effect
window.addEventListener('scroll', function() {
    const header = document.querySelector('.header');
    if (window.scrollY > 100) {
        header.style.background = 'rgba(255, 255, 255, 0.98)';
        header.style.boxShadow = '0 2px 25px rgba(0, 0, 0, 0.15)';
    } else {
        header.style.background = 'rgba(255, 255, 255, 0.95)';
        header.style.boxShadow = '0 2px 20px rgba(0, 0, 0, 0.1)';
    }
});

// Intersection Observer for fade-in animations
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver(function(entries) {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('fade-in');
        }
    });
}, observerOptions);

// Observe elements for animation
document.addEventListener('DOMContentLoaded', function() {
    const elementsToAnimate = document.querySelectorAll('.feature-card, .service-card, .country-card, .testimonial-card');
    elementsToAnimate.forEach(el => observer.observe(el));
});

// Form validation
function validateForm() {
    const requiredFields = ['name', 'email', 'phone', 'preferredCountry', 'consultationType'];
    let isValid = true;
    
    requiredFields.forEach(fieldName => {
        const field = document.getElementById(fieldName);
        const value = field.value.trim();
        
        if (!value) {
            field.style.borderColor = '#ef4444';
            isValid = false;
        } else {
            field.style.borderColor = '#e2e8f0';
        }
    });
    
    // Email validation
    const emailField = document.getElementById('email');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (emailField.value && !emailRegex.test(emailField.value)) {
        emailField.style.borderColor = '#ef4444';
        isValid = false;
    }
    
    // Phone validation
    const phoneField = document.getElementById('phone');
    const phoneRegex = /^[\+]?[0-9\s\-\(\)]{10,}$/;
    if (phoneField.value && !phoneRegex.test(phoneField.value)) {
        phoneField.style.borderColor = '#ef4444';
        isValid = false;
    }
    
    return isValid;
}

// Real-time validation
document.addEventListener('DOMContentLoaded', function() {
    const formFields = document.querySelectorAll('#appointmentForm input, #appointmentForm select');
    
    formFields.forEach(field => {
        field.addEventListener('blur', function() {
            if (this.hasAttribute('required') && !this.value.trim()) {
                this.style.borderColor = '#ef4444';
            } else {
                this.style.borderColor = '#e2e8f0';
            }
        });
        
        field.addEventListener('input', function() {
            if (this.style.borderColor === 'rgb(239, 68, 68)') {
                this.style.borderColor = '#e2e8f0';
            }
        });
    });
});