const express = require("express");
const sqlite3 = require("sqlite3").verbose();

const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const db = new sqlite3.Database(":memory:");

db.serialize(() => {
  db.run("CREATE TABLE users (id INT, username TEXT, password TEXT)");
  db.run("INSERT INTO users VALUES (1, 'admin', 'supersecret')");
  db.run("INSERT INTO users VALUES (2, 'john', 'password123')");
});

const styles = `
  :root {
    --bg: #0c0e12;
    --surface: #151922;
    --elevated: #1c2230;
    --border: rgba(255,255,255,.08);
    --text: #f4f6fb;
    --muted: #8b93a7;
    --accent: #6366f1;
    --accent-soft: rgba(99,102,241,.15);
    --success: #22c55e;
    --radius: 14px;
    --font: "DM Sans", system-ui, sans-serif;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    font-family: var(--font);
    background: radial-gradient(1200px 600px at 10% -10%, rgba(99,102,241,.25), transparent),
                radial-gradient(900px 500px at 90% 0%, rgba(34,197,94,.12), transparent),
                var(--bg);
    color: var(--text);
    min-height: 100vh;
    line-height: 1.6;
  }
  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }
  .shell { max-width: 1100px; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
  nav {
    display: flex; align-items: center; justify-content: space-between;
    padding: 1rem 0 2rem; border-bottom: 1px solid var(--border); margin-bottom: 2rem;
  }
  .brand { font-weight: 700; font-size: 1.25rem; letter-spacing: -.02em; display: flex; align-items: center; gap: .5rem; }
  .brand span { color: var(--accent); }
  .nav-links { display: flex; gap: 1.5rem; font-size: .9rem; }
  .nav-links a { color: var(--muted); }
  .nav-links a:hover { color: var(--text); text-decoration: none; }
  .hero {
    display: grid; gap: 2rem;
    grid-template-columns: 1fr;
    align-items: center;
    margin-bottom: 3rem;
  }
  @media (min-width: 840px) {
    .hero { grid-template-columns: 1.1fr .9fr; }
  }
  .hero h1 {
    font-size: clamp(2rem, 4vw, 2.75rem);
    font-weight: 700;
    letter-spacing: -.03em;
    line-height: 1.15;
    margin-bottom: 1rem;
  }
  .hero p.lead { color: var(--muted); font-size: 1.05rem; max-width: 34ch; margin-bottom: 1.5rem; }
  .pill {
    display: inline-flex; align-items: center; gap: .4rem;
    padding: .35rem .75rem; border-radius: 999px;
    background: var(--accent-soft); color: #c7c9ff; font-size: .75rem; font-weight: 600;
    margin-bottom: 1rem;
  }
  .cta-row { display: flex; flex-wrap: wrap; gap: .75rem; }
  .btn {
    display: inline-flex; align-items: center; justify-content: center;
    padding: .65rem 1.15rem; border-radius: 10px; font-weight: 600; font-size: .9rem;
    border: none; cursor: pointer; transition: transform .15s, box-shadow .15s;
    font-family: inherit;
  }
  .btn-primary {
    background: linear-gradient(135deg, #6366f1, #4f46e5);
    color: #fff; box-shadow: 0 8px 24px rgba(99,102,241,.35);
  }
  .btn-primary:hover { transform: translateY(-1px); }
  .btn-ghost {
    background: transparent; color: var(--muted); border: 1px solid var(--border);
  }
  .glass {
    background: linear-gradient(145deg, rgba(28,34,48,.9), rgba(21,25,34,.85));
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 1.5rem;
    box-shadow: 0 24px 48px rgba(0,0,0,.35);
  }
  .glass h2 { font-size: 1rem; margin-bottom: 1rem; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: .06em; }
  label { display: block; font-size: .75rem; color: var(--muted); margin-bottom: .35rem; font-weight: 500; }
  input[type="text"], input[type="password"], input[type="search"] {
    width: 100%; padding: .65rem .85rem; border-radius: 10px;
    border: 1px solid var(--border); background: var(--elevated); color: var(--text);
    font-family: inherit; font-size: .95rem;
  }
  input:focus { outline: none; border-color: rgba(99,102,241,.5); box-shadow: 0 0 0 3px var(--accent-soft); }
  .field { margin-bottom: 1rem; }
  .grid-cards {
    display: grid; gap: 1rem;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    margin-top: 2rem;
  }
  .card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 1.25rem;
    transition: border-color .2s, transform .2s;
  }
  .card:hover { border-color: rgba(99,102,241,.35); transform: translateY(-2px); }
  .card .price { font-size: 1.35rem; font-weight: 700; margin-top: .5rem; }
  .card .meta { font-size: .8rem; color: var(--muted); margin-top: .25rem; }
  .tag { font-size: .7rem; color: var(--success); font-weight: 600; }
  .notice {
    margin-top: 2.5rem; padding: 1rem 1.25rem; border-radius: var(--radius);
    border: 1px dashed rgba(251,191,36,.35); background: rgba(251,191,36,.06);
    font-size: .85rem; color: #fcd34d;
  }
  .page-title { font-size: 1.75rem; margin-bottom: .5rem; }
  .muted { color: var(--muted); margin-bottom: 1.5rem; }
`;

function layout(title, inner) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${title}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,600;0,9..40,700;1,9..40,400&display=swap" rel="stylesheet"/>
  <style>${styles}</style>
</head>
<body>
  <div class="shell">
    ${inner}
  </div>
</body>
</html>`;
}

app.get("/", (req, res) => {
  res.send(
    layout(
      "Nimbus Commerce — Demo Store",
      `
    <nav>
      <div class="brand">Nimbus<span>.</span></div>
      <div class="nav-links">
        <a href="#catalog">Catalog</a>
        <a href="#login">Account</a>
      </div>
    </nav>
    <section class="hero">
      <div>
        <div class="pill">Season drop · Limited run</div>
        <h1>Elevated essentials for how you move.</h1>
        <p class="lead">
          A polished storefront simulator with intentional weaknesses for WAF validation.
          Browse featured picks, sign in, or search the catalog.
        </p>
        <div class="cta-row">
          <a class="btn btn-primary" href="#catalog">Shop featured</a>
          <a class="btn btn-ghost" href="#login">Member login</a>
        </div>
      </div>
      <div class="glass" id="login">
        <h2>Member access</h2>
        <form action="/login" method="POST">
          <div class="field">
            <label for="username">Username</label>
            <input id="username" type="text" name="username" autocomplete="username" placeholder="you@example.com"/>
          </div>
          <div class="field">
            <label for="password">Password</label>
            <input id="password" type="password" name="password" autocomplete="current-password" placeholder="••••••••"/>
          </div>
          <button class="btn btn-primary" type="submit" style="width:100%; margin-top:.25rem;">Sign in</button>
        </form>
      </div>
    </section>

    <section id="catalog" style="margin-top:1rem;">
      <h2 style="font-size:1.1rem; margin-bottom:1rem; color:var(--muted);">Featured</h2>
      <div class="grid-cards">
        <article class="card">
          <div class="tag">New</div>
          <h3 style="margin-top:.5rem; font-size:1.05rem;">Meridian Shell Jacket</h3>
          <p class="meta">Weather-ready layers</p>
          <div class="price">$248</div>
        </article>
        <article class="card">
          <div class="tag">Trending</div>
          <h3 style="margin-top:.5rem; font-size:1.05rem;">Arc Runner Pro</h3>
          <p class="meta">Responsive cushioning</p>
          <div class="price">$189</div>
        </article>
        <article class="card">
          <div class="tag">Staff pick</div>
          <h3 style="margin-top:.5rem; font-size:1.05rem;">Studio Tote</h3>
          <p class="meta">Carry-all minimalism</p>
          <div class="price">$92</div>
        </article>
      </div>
    </section>

    <section style="margin-top:2.5rem;">
      <div class="glass">
        <h2>Catalog search</h2>
        <form action="/search" method="GET" style="display:flex; gap:.75rem; flex-wrap:wrap; align-items:flex-end;">
          <div style="flex:1; min-width:200px;">
            <label for="q">Query</label>
            <input id="q" type="search" name="q" placeholder="Try a product name…"/>
          </div>
          <button class="btn btn-primary" type="submit">Search</button>
        </form>
      </div>
    </section>

    <p class="notice">
      Lab notice: This build keeps deliberate SQL injection and reflected XSS paths for security testing only.
    </p>
    `
    )
  );
});

app.post("/login", (req, res) => {
  const { username, password } = req.body;
  const query = `SELECT * FROM users WHERE username = '${username}' AND password = '${password}'`;

  db.get(query, (err, row) => {
    if (err) {
      return res.status(500).send(
        layout(
          "Error",
          `<h1 class="page-title">Something went wrong</h1><p class="muted">Database error.</p><p><a href="/">← Back home</a></p>`
        )
      );
    }
    if (row) {
      res.send(
        layout(
          "Welcome",
          `
        <nav style="border:none; padding-bottom:0; margin-bottom:1rem;"><div class="brand">Nimbus<span>.</span></div></nav>
        <div class="glass" style="max-width:480px;">
          <div class="pill" style="margin-bottom:1rem;">Signed in</div>
          <h1 class="page-title">Welcome, ${row.username}</h1>
          <p class="muted">You are authenticated in this demo session.</p>
          <a class="btn btn-primary" href="/">Continue shopping</a>
        </div>
        `
        )
      );
    } else {
      res.status(401).send(
        layout(
          "Sign in failed",
          `
        <h1 class="page-title">Invalid credentials</h1>
        <p class="muted">Double-check your username and password.</p>
        <a class="btn btn-ghost" href="/">Try again</a>
        `
        )
      );
    }
  });
});

app.get("/search", (req, res) => {
  const query = req.query.q;
  res.send(
    layout(
      "Search",
      `
    <nav>
      <div class="brand">Nimbus<span>.</span></div>
      <div class="nav-links"><a href="/">Home</a></div>
    </nav>
    <h1 class="page-title">Search results</h1>
    <p style="margin-bottom:1rem;">You searched for: ${query}</p>
    <div class="glass" style="max-width:560px;">
      <p class="muted">No indexed products matched that phrase in this simulator.</p>
      <a href="/">← Back to storefront</a>
    </div>
    `
    )
  );
});

app.listen(port, () => {
  console.log(`Vulnerable app listening on port ${port}`);
});
