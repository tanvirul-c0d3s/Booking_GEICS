// server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const path = require('path');
const session = require('express-session');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

/* ------------------------- CORS + Session for cross-site ------------------------- */
// IMPORTANT: your frontend lives at https://appointments.geics.net
// Your backend is on Render (https://<your-app>.onrender.com)
app.set('trust proxy', 1); // required behind Render's proxy to set secure cookies

app.use(cors({
  origin: ['https://appointments.geics.net'], // your frontend origin
  credentials: true
}));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use(session({
  name: 'geics.sid',
  secret: process.env.SESSION_SECRET || 'geics-super-secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'none',     // allow cross-site cookies
    secure: true,         // only over HTTPS (Render provides HTTPS)
    maxAge: 1000 * 60 * 60 * 8 // 8 hours
  }
}));

// You can keep this; it won't hurt if you don't host static files on Render
app.use(express.static(path.join(__dirname, 'public')));

/* ------------------- MongoDB (with graceful fallback) ------------------- */
let appointments = [];
let appointmentCounter = 1;

const connectToMongoDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/geics_appointments', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    });
    console.log('Connected to MongoDB');
    return true;
  } catch (error) {
    console.log('MongoDB not available, using in-memory storage');
    return false;
  }
};

let isMongoConnected = false;
connectToMongoDB().then(connected => { isMongoConnected = connected; });

/* --------------------------- Mongoose Model --------------------------- */
const appointmentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: { type: String, required: true },
  preferredCountry: { type: String, required: true },
  consultationType: { type: String, required: true },
  message: { type: String },
  status: { type: String, default: 'pending' },
  appointmentDate: { type: Date },
  appointmentTime: { type: String },
  createdAt: { type: Date, default: Date.now }
});
const Appointment = mongoose.model('Appointment', appointmentSchema);

/* --------------------------- Email Transport (Gmail SMTP) --------------------------- */
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER, // Gmail address
    pass: process.env.EMAIL_PASS  // 16-char app password
  }
});

transporter.verify(err => {
  if (err) console.error('SMTP error:', err.message);
  else console.log('SMTP ready');
});

function mailFrom() {
  const name = process.env.FROM_NAME || 'GEICS Consultancy';
  return `"${name}" <${process.env.EMAIL_USER}>`;
}

/* ----------------------------- Auth Helpers ---------------------------- */
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

function authRequired(req, res, next) {
  if (req.session && req.session.user === ADMIN_USER) return next();
  // For API calls: 401; for pages: redirect to /login
  if (req.accepts('html')) return res.redirect('/login');
  return res.status(401).json({ error: 'Unauthorized' });
}

/* -------------------------------- Routes ------------------------------- */
// Public pages (kept for convenience; frontend is actually on cPanel)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Login page
app.get('/login', (req, res) => {
  if (req.session && req.session.user === ADMIN_USER) {
    return res.redirect('/admin');
  }
  res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

// Admin page (protected)
app.get('/admin', authRequired, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// Auth API
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (username === ADMIN_USER && password === ADMIN_PASS) {
    req.session.user = ADMIN_USER;
    return res.json({ message: 'Logged in', user: ADMIN_USER });
  }
  return res.status(401).json({ error: 'Invalid credentials' });
});

app.get('/api/auth/me', (req, res) => {
  if (req.session && req.session.user === ADMIN_USER) {
    return res.json({ authenticated: true, user: ADMIN_USER });
  }
  return res.json({ authenticated: false });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('geics.sid');
    res.json({ message: 'Logged out' });
  });
});

/* ---------------------------- Appointments API ---------------------------- */
// Public: create appointment
app.post('/api/appointments', async (req, res) => {
  try {
    if (isMongoConnected) {
      const appointment = new Appointment(req.body);
      await appointment.save();
      return res.status(201).json({ message: 'Appointment booked successfully!', appointmentId: appointment._id });
    } else {
      const appointment = {
        _id: appointmentCounter++,
        ...req.body,
        status: 'pending',
        createdAt: new Date()
      };
      appointments.push(appointment);
      return res.status(201).json({ message: 'Appointment booked successfully!', appointmentId: appointment._id });
    }
  } catch (error) {
    console.error('Error creating appointment:', error);
    return res.status(500).json({ error: 'Failed to book appointment' });
  }
});

// Admin-only: list appointments
app.get('/api/appointments', authRequired, async (req, res) => {
  try {
    if (isMongoConnected) {
      const appointmentList = await Appointment.find().sort({ createdAt: -1 });
      return res.json(appointmentList);
    } else {
      const sortedAppointments = appointments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      return res.json(sortedAppointments);
    }
  } catch (error) {
    console.error('Error fetching appointments:', error);
    return res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// Admin-only: confirm appointment (send email to client)
app.put('/api/appointments/:id/confirm', authRequired, async (req, res) => {
  try {
    const { appointmentDate, appointmentTime } = req.body;

    let appointment;
    if (isMongoConnected) {
      appointment = await Appointment.findByIdAndUpdate(
        req.params.id,
        { status: 'confirmed', appointmentDate: new Date(appointmentDate), appointmentTime },
        { new: true }
      );
    } else {
      const idx = appointments.findIndex(a => a._id == req.params.id);
      if (idx !== -1) {
        appointments[idx] = { ...appointments[idx], status: 'confirmed', appointmentDate: new Date(appointmentDate), appointmentTime };
        appointment = appointments[idx];
      }
    }

    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });

    // Send email to the client's email provided in the booking form
    try {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #2563eb; padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0;">GEICS Consultancy</h1>
            <p style="color: #e5e7eb; margin: 5px 0;">Global Education & Immigration Consultancy Services</p>
          </div>
          <div style="padding: 30px; background-color: #f8fafc;">
            <h2 style="color: #1e40af;">Appointment Confirmed!</h2>
            <p>Dear ${appointment.name},</p>
            <p>Your appointment has been confirmed. Please find the details below:</p>
            
            <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #2563eb; margin-top: 0;">Appointment Details</h3>
              <p><strong>Date:</strong> ${new Date(appointmentDate).toLocaleDateString()}</p>
              <p><strong>Time:</strong> ${appointmentTime}</p>
              <p><strong>Consultation Type:</strong> ${appointment.consultationType}</p>
              <p><strong>Preferred Country:</strong> ${appointment.preferredCountry}</p>
            </div>

            <div style="background-color: #dbeafe; padding: 15px; border-radius: 8px; margin: 20px 0;">
              <h4 style="color: #1e40af; margin-top: 0;">Office Address</h4>
              <p style="margin: 5px 0;">GEICS Consultancy Office</p>
              <p style="margin: 5px 0;">123 Business District</p>
              <p style="margin: 5px 0;">Your City, Your Country</p>
              <p style="margin: 5px 0;">Phone: +1 (555) 123-4567</p>
            </div>

            <p>Please arrive 10 minutes early. For reschedules, reply to this email at least 24 hours in advance.</p>
            <p>Thank you for choosing GEICS Consultancy!</p>

            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px;">
                Best regards,<br>
                GEICS Consultancy Team<br>
                Email: info@geics.com<br>
                Phone: +1 (555) 123-4567
              </p>
            </div>
          </div>
        </div>
      `;

      await transporter.sendMail({
        from: mailFrom(),
        to: appointment.email,                 // client's email from the form
        replyTo: process.env.REPLY_TO || process.env.EMAIL_USER,
        subject: 'Appointment Confirmed - GEICS Consultancy',
        html
      });

      return res.json({ message: 'Appointment confirmed and email sent!' });
    } catch (emailErr) {
      console.log('Email sending failed:', emailErr.message);
      // Appointment is confirmed even if email failed
      return res.json({ message: 'Appointment confirmed, but email failed to send.' });
    }
  } catch (error) {
    console.error('Error confirming appointment:', error);
    return res.status(500).json({ error: 'Failed to confirm appointment' });
  }
});

// Admin-only: delete appointment
app.delete('/api/appointments/:id', authRequired, async (req, res) => {
  try {
    if (isMongoConnected) {
      await Appointment.findByIdAndDelete(req.params.id);
    } else {
      const idx = appointments.findIndex(a => a._id == req.params.id);
      if (idx !== -1) appointments.splice(idx, 1);
    }
    return res.json({ message: 'Appointment deleted successfully' });
  } catch (error) {
    console.error('Error deleting appointment:', error);
    return res.status(500).json({ error: 'Failed to delete appointment' });
  }
});

/* ------------------------- Optional: SMTP Test ------------------------- */
app.get('/api/test-email', async (_req, res) => {
  try {
    await transporter.sendMail({
      from: mailFrom(),
      to: process.env.REPLY_TO || process.env.EMAIL_USER,
      subject: 'SMTP Test – GEICS',
      text: 'If you received this, SMTP is working ✅'
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

/* ------------------------------- Start -------------------------------- */
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
