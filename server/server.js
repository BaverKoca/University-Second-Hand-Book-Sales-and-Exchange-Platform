const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { db } = require('./database');
const multer = require('multer');
const path = require('path');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Set up storage for uploaded images
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, 'uploads'));
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Serve uploaded images statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// CORS: allow all origins, methods, and headers for development
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Simple ping endpoint for connectivity testing
app.get('/api/ping', (req, res) => {
  res.json({ success: true, message: 'pong' });
});

// Register user
app.post('/api/register', (req, res) => {
  const { name, faculty, phone, email, password } = req.body;
  db.run('BEGIN TRANSACTION');
  db.run(
    'INSERT INTO users (name, faculty, phone, email, password) VALUES (?, ?, ?, ?, ?)',
    [name, faculty, phone, email, password],
    function (err) {
      if (err) {
        db.run('ROLLBACK');
        if (err.message.includes('UNIQUE constraint failed')) {
          return res.status(400).json({ error: 'Email already registered' });
        }
        return res.status(500).json({ error: err.message });
      }
      db.get('SELECT * FROM users WHERE id = ?', [this.lastID], (err, user) => {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: err.message });
        }
        db.run('COMMIT');
        res.json({ success: true, user });
      });
    }
  );
});

// Login user
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  db.get(
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
  const { name, faculty, phone, email } = req.body;
  
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  db.run('BEGIN TRANSACTION');
  db.run(
    'UPDATE users SET name = ?, faculty = ?, phone = ? WHERE email = ? COLLATE NOCASE',
    [name, faculty, phone, email],
    function(err) {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        db.run('ROLLBACK');
        return res.status(404).json({ error: 'User not found' });
      }
      db.run('COMMIT');
      res.json({ success: true });
    }
  );
});

// Get user's favorites
app.get('/api/favorites/:userId', (req, res) => {
  const userId = req.params.userId;
  db.all(`
    SELECT b.*, f.id as favorite_id 
    FROM favorites f
    JOIN books b ON f.book_id = b.id
    WHERE f.user_id = ? AND b.status = ?
    ORDER BY f.created_at DESC
  `, [userId, 'available'], (err, favorites) => {
    if (err) {
      console.error('Error fetching favorites:', err);
      return res.status(500).json({ error: err.message });
    }
    res.json(favorites || []);
  });
});

// Add to favorites
app.post('/api/favorites', (req, res) => {
  const { userId, bookId } = req.body;
  
  if (!userId || !bookId) {
    return res.status(400).json({ error: 'User ID and Book ID are required' });
  }

  db.serialize(() => {
    db.run('BEGIN TRANSACTION');
    
    // Check if book exists and is available
    db.get('SELECT id FROM books WHERE id = ? AND status = ?', [bookId, 'available'], (err, book) => {
      if (err) {
        console.error('Error checking book:', err);
        db.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }
      if (!book) {
        db.run('ROLLBACK');
        return res.status(404).json({ error: 'Book not found or not available' });
      }

      // Add to favorites
      db.run(
        'INSERT INTO favorites (user_id, book_id) VALUES (?, ?)',
        [userId, bookId],
        function(err) {
          if (err) {
            console.error('Error adding favorite:', err);
            db.run('ROLLBACK');
            if (err.message.includes('UNIQUE constraint failed')) {
              return res.status(400).json({ error: 'Book already in favorites' });
            }
            return res.status(500).json({ error: err.message });
          }
          db.run('COMMIT');
          res.json({ success: true, id: this.lastID });
        }
      );
    });
  });
});

// Remove from favorites
app.delete('/api/favorites/:userId/:bookId', (req, res) => {
  const { userId, bookId } = req.params;
  
  db.run('BEGIN TRANSACTION');
  db.run(
    'DELETE FROM favorites WHERE user_id = ? AND book_id = ?',
    [userId, bookId],
    function(err) {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        db.run('ROLLBACK');
        return res.status(404).json({ error: 'Favorite not found' });
      }
      db.run('COMMIT');
      res.json({ success: true });
    }
  );
});

// Mark book as sold
app.put('/api/books/:bookId/sold', (req, res) => {
  const { bookId } = req.params;
  
  db.run('BEGIN TRANSACTION');
  db.run(
    'UPDATE books SET status = ? WHERE id = ?',
    ['sold', bookId],
    function(err) {
      if (err) {
        db.run('ROLLBACK');
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        db.run('ROLLBACK');
        return res.status(404).json({ error: 'Book not found' });
      }
      
      // Also remove from all users' favorites
      db.run('DELETE FROM favorites WHERE book_id = ?', [bookId], function(err) {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: err.message });
        }
        db.run('COMMIT');
        res.json({ success: true });
      });
    }
  );
});

// Add a new book (with image upload)
app.post('/api/books', (req, res, next) => {
  // Debug: log request headers and content-type
  console.log('POST /api/books headers:', req.headers);
  next();
}, upload.single('image'), (req, res) => {
  try {
    // Debug: log file and body
    console.log('File:', req.file);
    console.log('Body:', req.body);
    const {
      title, author, genre, faculty, edition, year,
      book_condition, price, for_what, owner_email, desired_book
    } = req.body;
    const picture_url = req.file ? `/uploads/${req.file.filename}` : null;

    if (!title || !author || !genre || !year || !book_condition || !picture_url || !for_what || !owner_email) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    if (genre === 'education' && !faculty) {
      return res.status(400).json({ error: 'Faculty required for Education genre' });
    }
    if (for_what === 'Sell' && (price === undefined || price === null || price === '')) {
      return res.status(400).json({ error: 'Price required for selling' });
    }

    db.run('BEGIN TRANSACTION');
    db.run(
      `INSERT INTO books (
        title, author, genre, faculty, edition, year,
        book_condition, price, picture_url, for_what,
        owner_email, status, desired_book
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        title, author, genre, faculty, edition, year,
        book_condition, price, picture_url, for_what,
        owner_email, 'available', desired_book || null
      ],
      function (err) {
        if (err) {
          db.run('ROLLBACK');
          console.error('DB error:', err);
          return res.status(500).json({ error: err.message });
        }
        db.run('COMMIT');
        res.json({ success: true, id: this.lastID });
      }
    );
  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all available books
app.get('/api/books', (req, res) => {
  const query = `
    SELECT b.*, u.name as owner_name, u.faculty as owner_faculty 
    FROM books b 
    LEFT JOIN users u ON b.owner_email = u.email 
    WHERE b.status = ? 
    ORDER BY b.created_at DESC
  `;
  db.all(query, ['available'], (err, books) => {
    if (err) {
      console.error('Error fetching books:', err.message);
      return res.status(500).json({ error: err.message });
    }
    res.json(books || []);
  });
});

// Get personalized book recommendations
app.get('/api/recommendations/:userId', (req, res) => {
  const { userId } = req.params;
  
  // Get user's faculty
  db.get('SELECT faculty FROM users WHERE id = ?', [userId], (err, user) => {
    if (err) {
      console.error('Error getting user faculty:', err);
      return res.status(500).json({ error: err.message });
    }
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's favorites and faculty books
    db.all(`
      SELECT DISTINCT b.*, u.name as owner_name, u.faculty as owner_faculty,
             CASE 
               WHEN f.user_id IS NOT NULL THEN 2  -- Favorite books get higher priority
               WHEN b.faculty = ? THEN 1  -- Faculty books get medium priority
               ELSE 0  -- Other books get lowest priority
             END as relevance_score
      FROM books b
      LEFT JOIN users u ON b.owner_email = u.email
      LEFT JOIN favorites f ON b.id = f.book_id AND f.user_id = ?
      WHERE b.status = 'available'
      ORDER BY relevance_score DESC, b.created_at DESC
    `, [user.faculty, userId], (err, books) => {
      if (err) {
        console.error('Error getting recommended books:', err);
        return res.status(500).json({ error: err.message });
      }
      res.json(books || []);
    });
  });
});

// Get user by email
app.get('/api/users/by-email/:email', (req, res) => {
  const { email } = req.params;
  
  db.get(
    'SELECT name, faculty FROM users WHERE email = ?',
    [email],
    (err, user) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!user) return res.status(404).json({ error: 'User not found' });
      res.json(user);
    }
  );
});

// Handle book transactions (purchase/exchange)
app.post('/api/transactions', async (req, res) => {
  const { userId, bookId, type } = req.body;

  if (!userId || !bookId || !type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // First check if the book is still available
    db.get('SELECT * FROM books WHERE id = ? AND status = ?', [bookId, 'available'], async (err, book) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (!book) {
        return res.status(404).json({ error: 'Book not available' });
      }

      // Mark the book as sold/exchanged
      db.run('BEGIN TRANSACTION');
      db.run('UPDATE books SET status = ? WHERE id = ?', ['sold', bookId], function(err) {
        if (err) {
          db.run('ROLLBACK');
          return res.status(500).json({ error: err.message });
        }

        // Remove from all favorites since it's no longer available
        db.run('DELETE FROM favorites WHERE book_id = ?', [bookId], function(err) {
          if (err) {
            db.run('ROLLBACK');
            return res.status(500).json({ error: err.message });
          }
          db.run('COMMIT');
          res.json({ success: true });
        });
      });
    });
  } catch (error) {
    console.error('Transaction error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete a book (when sold)
app.delete('/api/books/:id', (req, res) => {
  const id = req.params.id;
  db.run('DELETE FROM books WHERE id = ?', [id], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

const port = 3001;
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});