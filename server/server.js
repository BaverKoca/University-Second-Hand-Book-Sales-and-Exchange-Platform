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
  
  dbUsers.run('BEGIN TRANSACTION');
  dbUsers.run(
    'INSERT INTO users (name, faculty, department, phone, email, password) VALUES (?, ?, ?, ?, ?, ?)',
    [name, faculty, department, phone, email, password],
    function (err) {
      if (err) {
        dbUsers.run('ROLLBACK');
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Email already registered' });
        }
        return res.status(500).json({ error: err.message });
      }
      dbUsers.run('COMMIT');
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

  dbUsers.run('BEGIN TRANSACTION');
  dbUsers.run(
    'UPDATE users SET name = ?, faculty = ?, department = ?, phone = ? WHERE email = ?',
    [name, faculty, department, phone, email],
    function(err) {
      if (err) {
        dbUsers.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        dbUsers.run('ROLLBACK');
        return res.status(404).json({ error: 'User not found' });
      }
      dbUsers.run('COMMIT');
      res.json({ success: true });
    }
  );
});

// Get user's transactions
app.get('/api/transactions/:userId', (req, res) => {
  const userId = req.params.userId;
  dbBooks.all(`
    SELECT t.*, b.*, u.name as seller_name
    FROM transactions t
    JOIN books b ON t.book_id = b.id
    JOIN users u ON t.seller_id = u.id
    WHERE t.buyer_id = ?
    ORDER BY t.transaction_date DESC
  `, [userId], (err, transactions) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(transactions);
  });
});

// Create new transaction
app.post('/api/transactions', (req, res) => {
  const { userId, bookId, type } = req.body;
  
  dbBooks.run('BEGIN TRANSACTION');
  
  // First get the book details to get the seller and price
  dbBooks.get('SELECT * FROM books WHERE id = ? AND status = ?', [bookId, 'available'], (err, book) => {
    if (err) {
      dbBooks.run('ROLLBACK');
      return res.status(500).json({ error: err.message });
    }
    if (!book) {
      dbBooks.run('ROLLBACK');
      return res.status(404).json({ error: 'Book not found or already sold' });
    }

    // Get seller's user ID
    dbUsers.get('SELECT id FROM users WHERE email = ?', [book.owner_email], (err, seller) => {
      if (err || !seller) {
        dbBooks.run('ROLLBACK');
        return res.status(500).json({ error: 'Seller not found' });
      }

      // Create the transaction
      dbBooks.run(
        `INSERT INTO transactions (book_id, buyer_id, seller_id, type, price)
         VALUES (?, ?, ?, ?, ?)`,
        [bookId, userId, seller.id, type, book.price],
        function(err) {
          if (err) {
            dbBooks.run('ROLLBACK');
            return res.status(500).json({ error: err.message });
          }

          // Update book status to sold
          dbBooks.run('UPDATE books SET status = ? WHERE id = ?', ['sold', bookId], function(err) {
            if (err) {
              dbBooks.run('ROLLBACK');
              return res.status(500).json({ error: err.message });
            }
            
            dbBooks.run('COMMIT');
            res.json({ success: true, transactionId: this.lastID });
          });
        }
      );
    });
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

  dbBooks.run('BEGIN TRANSACTION');
  dbBooks.run(
    `INSERT INTO books (title, author, genre, course_code, edition, year, book_condition, price, picture_url, for_what, owner_email, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, author, genre, course_code, edition, year, book_condition, price, picture_url, for_what, owner_email, 'available'],
    function (err) {
      if (err) {
        dbBooks.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }
      dbBooks.run('COMMIT');
      res.json({ success: true, id: this.lastID });
    }
  );
});

// Get all available books
app.get('/api/books', (req, res) => {
  const query = 'SELECT * FROM books WHERE status = ? ORDER BY id DESC';
  dbBooks.all(query, ['available'], (err, books) => {
    if (err) {
      console.error('Error fetching books:', err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json(books || []);
  });
});

// Get user's favorites
app.get('/api/favorites/:userId', (req, res) => {
  const userId = req.params.userId;
  dbBooks.all(`
    SELECT b.*, f.id as favorite_id 
    FROM favorites f
    JOIN books b ON f.book_id = b.id
    WHERE f.user_id = ? AND b.status = ?
    ORDER BY f.created_at DESC
  `, [userId, 'available'], (err, favorites) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(favorites);
  });
});

// Add to favorites
app.post('/api/favorites', (req, res) => {
  const { userId, bookId } = req.body;
  
  if (!userId || !bookId) {
    return res.status(400).json({ error: 'User ID and Book ID are required' });
  }

  dbBooks.run('BEGIN TRANSACTION');
  dbBooks.run(
    'INSERT INTO favorites (user_id, book_id) VALUES (?, ?)',
    [userId, bookId],
    function(err) {
      if (err) {
        dbBooks.run('ROLLBACK');
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Book already in favorites' });
        }
        return res.status(500).json({ error: err.message });
      }
      dbBooks.run('COMMIT');
      res.json({ success: true, id: this.lastID });
    }
  );
});

// Remove from favorites
app.delete('/api/favorites/:userId/:bookId', (req, res) => {
  const { userId, bookId } = req.params;
  
  dbBooks.run('BEGIN TRANSACTION');
  dbBooks.run(
    'DELETE FROM favorites WHERE user_id = ? AND book_id = ?',
    [userId, bookId],
    function(err) {
      if (err) {
        dbBooks.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        dbBooks.run('ROLLBACK');
        return res.status(404).json({ error: 'Favorite not found' });
      }
      dbBooks.run('COMMIT');
      res.json({ success: true });
    }
  );
});

const port = 3001;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});