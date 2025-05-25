const sqlite3 = require('sqlite3').verbose();
const dbUsers = new sqlite3.Database(__dirname + '/users.db');
const dbBooks = new sqlite3.Database(__dirname + '/books.db');

dbUsers.serialize(() => {
  // Users table
  dbUsers.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      faculty TEXT NOT NULL,
      department TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL
    )
  `);
});

dbBooks.serialize(() => {
  // Books table
  dbBooks.run(`
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      genre TEXT NOT NULL,
      course_code TEXT,
      edition TEXT,
      year INTEGER NOT NULL,
      book_condition TEXT NOT NULL,
      price REAL,
      picture_url TEXT NOT NULL,
      for_what TEXT NOT NULL,
      owner_email TEXT NOT NULL
    )
  `, (err) => {
    if (err) console.error('Error creating books table:', err.message);
    else console.log('Books table ready.');
  });
});

module.exports = { dbUsers, dbBooks };