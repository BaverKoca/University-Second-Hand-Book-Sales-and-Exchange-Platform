const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { dbUsers, dbBooks } = require('./database');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Register user
app.post('/api/register', (req, res) => {
  const { name, faculty, department, phone, email, password } = req.body;
  dbUsers.run(
    'INSERT INTO users (name, faculty, department, phone, email, password) VALUES (?, ?, ?, ?, ?, ?)',
    [name, faculty, department, phone, email, password],
    function (err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Email already registered' });
        }
        return res.status(500).json({ error: err.message });
      }
      res.json({ success: true, id: this.lastID });
    }
  );
});

// Login user
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  dbUsers.get(
    'SELECT * FROM users WHERE email = ? AND password = ?',
    [email, password],
    (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(401).json({ error: 'Invalid credentials' });
      res.json({ success: true, user });
    }
  );
});

// Update user profile
app.put('/api/users/update', (req, res) => {
  const { name, faculty, department, phone, email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  dbUsers.run(
    'UPDATE users SET name = ?, faculty = ?, department = ?, phone = ? WHERE email = ?',
    [name, faculty, department, phone, email],
    function(err) {
      if (err) return res.status(500).json({ error: err.message });
      if (this.changes === 0) return res.status(404).json({ error: 'User not found' });
      res.json({ success: true });
    }
  );
});

// Get all users (for admin/testing)
app.get('/api/users', (req, res) => {
  dbUsers.all('SELECT name, faculty, department, phone, email FROM users', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Add a new book
app.post('/api/books', (req, res) => {
  const {
    title, author, genre, course_code, edition, year,
    book_condition, price, picture_url, for_what, owner_email
  } = req.body;

  if (!title || !author || !genre || !year || !book_condition || !picture_url || !for_what || !owner_email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (genre === 'Education' && !course_code) {
    return res.status(400).json({ error: 'Course code required for Education genre' });
  }
  if (for_what === 'Sell' && (price === undefined || price === null || price === '')) {
    return res.status(400).json({ error: 'Price required for selling' });
  }

  dbBooks.run(
    `INSERT INTO books (title, author, genre, course_code, edition, year, book_condition, price, picture_url, for_what, owner_email)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, author, genre, course_code, edition, year, book_condition, price, picture_url, for_what, owner_email],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, id: this.lastID });
    }
  );
});

// Get all books
app.get('/api/books', (req, res) => {
  dbBooks.all('SELECT * FROM books', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Get books by owner
app.get('/api/books/user/:email', (req, res) => {
  const { email } = req.params;
  dbBooks.all('SELECT * FROM books WHERE owner_email = ?', [email], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

// Delete a book (when sold)
app.delete('/api/books/:id', (req, res) => {
  const id = req.params.id;
  dbBooks.run('DELETE FROM books WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

const PORT = 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));