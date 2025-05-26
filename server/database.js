const sqlite3 = require('sqlite3').verbose();
// Use a single database file for both users and books
const db = new sqlite3.Database(__dirname + '/books.db');

// Users table
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      faculty TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    )
  `);

  // Books table
  db.run(`
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      genre TEXT NOT NULL,
      faculty TEXT,
      edition TEXT,
      year INTEGER NOT NULL,
      book_condition TEXT NOT NULL,
      price REAL,
      picture_url TEXT NOT NULL,
      for_what TEXT NOT NULL,
      owner_email TEXT NOT NULL,
      status TEXT DEFAULT 'available',
      desired_book TEXT
    )
  `);

  // Favorites table
  db.run(`
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (book_id) REFERENCES books(id),
      UNIQUE(user_id, book_id)
    )
  `);
});

module.exports = { db };