const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../db/database');

// ---------- Login ----------
router.get('/login', (req, res) => {
  if (req.session.user) return res.redirect('/items');
  res.render('login', { error: null });
});

router.post('/login', (req, res) => {
  const { email, password } = req.body;
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.render('login', { error: 'Invalid email or password.' });
  }

  req.session.user = { id: user.id, name: user.name, email: user.email, phone: user.phone };
  const dest = req.session.returnTo || '/items';
  delete req.session.returnTo;
  res.redirect(dest);
});

// ---------- Register ----------
router.get('/register', (req, res) => {
  if (req.session.user) return res.redirect('/items');
  res.render('register', { error: null });
});

router.post('/register', (req, res) => {
  const { name, email, password, phone } = req.body;

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (existing) {
    return res.render('register', { error: 'An account with this email already exists.' });
  }

  const hashed = bcrypt.hashSync(password, 10);
  const result = db.prepare(`
    INSERT INTO users (name, email, password, phone)
    VALUES (?, ?, ?, ?)
  `).run(name, email, hashed, phone);

  req.session.user = { id: result.lastInsertRowid, name, email, phone };
  res.redirect('/items');
});

// ---------- Logout ----------
router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
