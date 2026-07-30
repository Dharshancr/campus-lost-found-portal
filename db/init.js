const db = require('./database');
const bcrypt = require('bcryptjs');

// ---------- Schema ----------
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  phone TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('lost','found')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT NOT NULL CHECK(category IN ('Electronics','Documents/ID Cards','Bags','Clothing','Accessories','Books','Keys','Other')),
  location TEXT NOT NULL,
  event_date TEXT NOT NULL,
  image_path TEXT,
  status TEXT NOT NULL CHECK(status IN ('open','resolved')) DEFAULT 'open',
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER NOT NULL,
  claimer_id INTEGER NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE,
  FOREIGN KEY (claimer_id) REFERENCES users(id) ON DELETE CASCADE
);
`);

// ---------- Seed demo data (only if empty) ----------
const userCount = db.prepare('SELECT COUNT(*) AS c FROM users').get().c;

if (userCount === 0) {
  const insertUser = db.prepare(`
    INSERT INTO users (name, email, password, phone)
    VALUES (?, ?, ?, ?)
  `);

  const pass = bcrypt.hashSync('demo1234', 10);
  const u1 = insertUser.run('Aarav Kumar', 'aarav@campus.edu', pass, '9876543210');
  const u2 = insertUser.run('Priya Sharma', 'priya@campus.edu', pass, '9876500000');

  const insertItem = db.prepare(`
    INSERT INTO items (user_id, type, title, description, category, location, event_date, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertItem.run(u1.lastInsertRowid, 'lost', 'Black Wallet', 'Lost a black leather wallet with college ID and some cash near the library entrance.', 'Documents/ID Cards', 'Main Library, Ground Floor', '2026-07-25', 'open');
  insertItem.run(u2.lastInsertRowid, 'found', 'Blue Water Bottle', 'Found a blue steel water bottle in Lecture Hall 3 after the 2pm class.', 'Other', 'Lecture Hall 3', '2026-07-27', 'open');
  insertItem.run(u1.lastInsertRowid, 'found', 'USB Pen Drive', 'Found a 32GB SanDisk pen drive near the computer lab printer.', 'Electronics', 'CS Computer Lab', '2026-07-26', 'open');

  console.log('Database seeded successfully!');
  console.log('Demo login 1 -> aarav@campus.edu / demo1234');
  console.log('Demo login 2 -> priya@campus.edu / demo1234');
} else {
  console.log('Database already has data. Skipping seed.');
}
