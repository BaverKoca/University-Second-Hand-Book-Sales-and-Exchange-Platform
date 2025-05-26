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
  // Drop existing books table to recreate with new schema
  dbBooks.run(`DROP TABLE IF EXISTS books`, (err) => {
    if (err) {
      console.error('Error dropping books table:', err.message);
      return;
    }

    // Create books table with status column
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
        owner_email TEXT NOT NULL,
        status TEXT DEFAULT 'available'
      )
    `, (err) => {
      if (err) {
        console.error('Error creating books table:', err.message);
      } else {
        console.log('Books table created successfully with status column.');
      }
    });
  });

  // Transactions table
  dbBooks.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      buyer_id INTEGER NOT NULL,
      seller_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      price REAL,
      transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (book_id) REFERENCES books(id),
      FOREIGN KEY (buyer_id) REFERENCES users(id),
      FOREIGN KEY (seller_id) REFERENCES users(id)
    )
  `, (err) => {
    if (err) console.error('Error creating transactions table:', err.message);
    else console.log('Transactions table ready.');
  });

  // Favorites table
  dbBooks.run(`
    CREATE TABLE IF NOT EXISTS favorites (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      book_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (book_id) REFERENCES books(id),
      UNIQUE(user_id, book_id)
    )
  `, (err) => {
    if (err) console.error('Error creating favorites table:', err.message);
    else console.log('Favorites table ready.');
  });
});

module.exports = { dbUsers, dbBooks };