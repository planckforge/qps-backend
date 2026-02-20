const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const passport = require('passport');
const session = require('express-session');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const LinkedInStrategy = require('passport-linkedin-oauth2').Strategy;
require('dotenv').config();

const app = express();

// 🔧 PRODUCTION READY MIDDLEWARE - Cloudflare + Hostinger
app.set('trust proxy', 1); // Cloudflare proxy trust

app.use(cors({ 
  origin: "https://quantumshell.live", 
  credentials: true 
}));
app.use(express.json());

// 🔐 SECURE SESSION CONFIG - Cross-origin + HTTPS
app.use(session({
  secret: process.env.SESSION_SECRET || 'QPS_LOGIC_SECRET_FALLBACK',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,           // HTTPS only
    sameSite: 'none',       // Cross-site cookies (quantumshell.live ↔ api.quantumshell.live)
    maxAge: 24 * 60 * 60 * 1000  // 24 hours
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// 🗄️ MONGO CONNECTION - Secure .env
const mongoURI = process.env.MONGO_URI;
if (!mongoURI) {
  console.error('❌ MONGO_URI not found in .env file!');
  process.exit(1);
}

mongoose.connect(mongoURI)
  .then(() => console.log("✅ Connected to Echovium MongoDB"))
  .catch(err => {
    console.error("❌ MongoDB Connection Error:", err);
    process.exit(1);
  });

// 👤 User Schema (Zishan Ali - QPS Framework Design)
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  fullName: String,
  country: String,
  profession: String,
  source: String,
  provider: { type: String, default: 'local' },
  registeredAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// 🔑 Passport Logic (Social Auth)
passport.serializeUser((user, done) => done(null, user._id));
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

// 🌐 Google Strategy - Production Ready
passport.use(new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENT_ID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "https://api.quantumshell.live/auth/google/callback"
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.emails?.[0]?.value;
    if (!email) return done(new Error("No email in Google profile"));

    const user = await User.findOneAndUpdate(
      { email },
      { 
        email, 
        provider: 'google',
        fullName: profile.displayName 
      },
      { upsert: true, new: true }
    );
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

// 💼 LinkedIn Strategy - Production Ready
passport.use(new LinkedInStrategy({
  clientID: process.env.LINKEDIN_CLIENT_ID,
  clientSecret: process.env.LINKEDIN_CLIENT_SECRET,
  callbackURL: "https://api.quantumshell.live/auth/linkedin/callback",
  scope: ['openid', 'profile', 'email']
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const email = profile.email || profile.emails?.[0]?.value;
    if (!email) return done(new Error("No email in LinkedIn profile"));

    const user = await User.findOneAndUpdate(
      { email },
      { 
        email, 
        provider: 'linkedin',
        fullName: profile.displayName 
      },
      { upsert: true, new: true }
    );
    return done(null, user);
  } catch (err) {
    return done(err);
  }
}));

// 🚪 Auth Routes
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
app.get('/auth/linkedin', passport.authenticate('linkedin'));

app.get('/auth/google/callback', 
  passport.authenticate('google', { session: true, failureRedirect: '/error' }),
  (req, res) => {
    res.redirect(`https://quantumshell.live/details?email=${encodeURIComponent(req.user.email)}`);
  }
);

app.get('/auth/linkedin/callback',
  passport.authenticate('linkedin', { session: true, failureRedirect: '/error' }),
  (req, res) => {
    res.redirect(`https://quantumshell.live/details?email=${encodeURIComponent(req.user.email)}`);
  }
);

// 📊 API Routes

// 1️⃣ Initial Email Capture (QPS Kernel Seeding)
app.post('/api/register-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: "Valid email required" });
    }

    const user = await User.findOneAndUpdate(
      { email }, 
      { email }, 
      { upsert: true, new: true }
    );
    
    res.status(200).json({ 
      message: "✅ Logic Seeded", 
      userId: user._id 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// 2️⃣ Final Details (Synaptic Evolution Core)
app.post('/api/update-details', async (req, res) => {
  try {
    const { email, fullName, country, profession, source } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: "Email required" });
    }

    const updatedUser = await User.findOneAndUpdate(
      { email },
      { fullName, country, profession, source },
      { new: true }
    );

    res.status(200).json({ 
      message: "Details saved. You're now part of QPS waitlist!", 
      data: updatedUser 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "System Latency Error" });
  }
});

// 🛡️ Health Check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'QPS Kernel Active', timestamp: new Date() });
});

// 🚀 PORT BINDING - Hostinger VPS Ready
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 QPS Kernel live on port ${PORT}`);
  console.log(`📍 Listening on all interfaces (0.0.0.0:${PORT})`);
});
