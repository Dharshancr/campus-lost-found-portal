const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const db = require('../db/database');
const { requireLogin } = require('../middleware/auth');

// ---------- Multer setup for image uploads ----------
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../public/uploads')),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, unique + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ok = allowed.test(path.extname(file.originalname).toLowerCase());
    cb(null, ok);
  }
});

const CATEGORIES = ['Electronics', 'Documents/ID Cards', 'Bags', 'Clothing', 'Accessories', 'Books', 'Keys', 'Other'];

// ---------- Browse / search items ----------
router.get('/items', (req, res) => {
  const { type, category, q, status } = req.query;

  let sql = `
    SELECT items.*, users.name AS owner_name
    FROM items
    JOIN users ON users.id = items.user_id
    WHERE 1=1
  `;
  const params = [];

  if (type === 'lost' || type === 'found') {
    sql += ' AND items.type = ?';
    params.push(type);
  }
  if (category && CATEGORIES.includes(category)) {
    sql += ' AND items.category = ?';
    params.push(category);
  }
  if (status === 'open' || status === 'resolved') {
    sql += ' AND items.status = ?';
    params.push(status);
  } else {
    sql += ` AND items.status = 'open'`;
  }
  if (q) {
    sql += ' AND (items.title LIKE ? OR items.description LIKE ? OR items.location LIKE ?)';
    const like = `%${q}%`;
    params.push(like, like, like);
  }

  sql += ' ORDER BY items.created_at DESC';

  const items = db.prepare(sql).all(...params);
  res.render('items/browse', {
    items,
    categories: CATEGORIES,
    filters: { type: type || '', category: category || '', q: q || '', status: status || 'open' }
  });
});

// ---------- New item form ----------
router.get('/items/new', requireLogin, (req, res) => {
  res.render('items/new', { categories: CATEGORIES, error: null });
});

router.post('/items/new', requireLogin, upload.single('image'), (req, res) => {
  const { type, title, description, category, location, event_date } = req.body;

  if (!type || !title || !description || !category || !location || !event_date) {
    return res.render('items/new', { categories: CATEGORIES, error: 'Please fill in all required fields.' });
  }

  const image_path = req.file ? '/uploads/' + req.file.filename : null;

  db.prepare(`
    INSERT INTO items (user_id, type, title, description, category, location, event_date, image_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(req.session.user.id, type, title, description, category, location, event_date, image_path);

  res.redirect('/items');
});

// ---------- My posted items ----------
router.get('/my-items', requireLogin, (req, res) => {
  const items = db.prepare(`
    SELECT * FROM items WHERE user_id = ? ORDER BY created_at DESC
  `).all(req.session.user.id);

  const itemIds = items.map(i => i.id);
  let claimsByItem = {};
  if (itemIds.length) {
    const placeholders = itemIds.map(() => '?').join(',');
    const claims = db.prepare(`
      SELECT claims.*, users.name AS claimer_name, users.email AS claimer_email, users.phone AS claimer_phone
      FROM claims JOIN users ON users.id = claims.claimer_id
      WHERE item_id IN (${placeholders})
      ORDER BY claims.created_at DESC
    `).all(...itemIds);
    claims.forEach(c => {
      if (!claimsByItem[c.item_id]) claimsByItem[c.item_id] = [];
      claimsByItem[c.item_id].push(c);
    });
  }

  res.render('items/my-items', { items, claimsByItem });
});

// ---------- Item detail ----------
router.get('/items/:id', (req, res) => {
  const item = db.prepare(`
    SELECT items.*, users.name AS owner_name, users.email AS owner_email, users.phone AS owner_phone
    FROM items JOIN users ON users.id = items.user_id
    WHERE items.id = ?
  `).get(req.params.id);

  if (!item) return res.status(404).render('error', { message: 'Item not found.' });

  const isOwner = req.session.user && req.session.user.id === item.user_id;
  res.render('items/detail', { item, isOwner });
});

// ---------- Submit a claim ("this is mine" / "I found your item") ----------
router.post('/items/:id/claim', requireLogin, (req, res) => {
  const { message } = req.body;
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).render('error', { message: 'Item not found.' });

  db.prepare(`
    INSERT INTO claims (item_id, claimer_id, message)
    VALUES (?, ?, ?)
  `).run(item.id, req.session.user.id, message || '');

  res.redirect('/items/' + item.id + '?claimed=1');
});

// ---------- Mark item resolved (owner only) ----------
router.post('/items/:id/resolve', requireLogin, (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).render('error', { message: 'Item not found.' });
  if (item.user_id !== req.session.user.id) {
    return res.status(403).render('error', { message: 'You can only resolve your own posts.' });
  }

  db.prepare(`UPDATE items SET status = 'resolved' WHERE id = ?`).run(item.id);
  res.redirect('/my-items');
});

// ---------- Delete item (owner only) ----------
router.post('/items/:id/delete', requireLogin, (req, res) => {
  const item = db.prepare('SELECT * FROM items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).render('error', { message: 'Item not found.' });
  if (item.user_id !== req.session.user.id) {
    return res.status(403).render('error', { message: 'You can only delete your own posts.' });
  }

  db.prepare('DELETE FROM items WHERE id = ?').run(item.id);
  res.redirect('/my-items');
});

module.exports = router;
