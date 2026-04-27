const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Setup intentional vulnerabilities
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Initialize in-memory database
const db = new sqlite3.Database(':memory:');

db.serialize(() => {
  db.run("CREATE TABLE users (id INT, username TEXT, password TEXT)");
  db.run("INSERT INTO users VALUES (1, 'admin', 'supersecret')");
  db.run("INSERT INTO users VALUES (2, 'john', 'password123')");
});

// A simple landing page
app.get('/', (req, res) => {
    res.send(`
        <h1>E-Commerce Simulator (Vulnerable)</h1>
        <p>This application contains intentional vulnerabilities such as SQLi and XSS for testing the WAF.</p>
        <form action="/login" method="POST">
            <h3>Login</h3>
            Username: <input type="text" name="username" /><br/>
            Password: <input type="password" name="password" /><br/>
            <button type="submit">Login</button>
        </form>
        <hr/>
        <form action="/search" method="GET">
            <h3>Search Products</h3>
            Query: <input type="text" name="q" /><br/>
            <button type="submit">Search</button>
        </form>
    `);
});

// Vulnerable Login Route (SQL Injection)
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    // VERY INSECURE - DO NOT DO THIS IN PRODUCTION
    const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;
    
    db.get(query, (err, row) => {
        if (err) {
            return res.status(500).send("Database Error");
        }
        if (row) {
            res.send(`<h1>Welcome, ${row.username}!</h1><p>You have successfully logged in.</p>`);
        } else {
            res.status(401).send("<h1>Invalid credentials</h1>");
        }
    });
});

// Vulnerable Search Route (Reflected XSS)
app.get('/search', (req, res) => {
    const query = req.query.q;
    // VERY INSECURE - Reflections without sanitization
    res.send(`
        <h1>Search Results</h1>
        <p>You searched for: ${query}</p>
        <p>No products found.</p>
        <a href="/">Back</a>
    `);
});

app.listen(port, () => {
    console.log(`Vulnerable app listening on port ${port}`);
});
