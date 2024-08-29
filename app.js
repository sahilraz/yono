const express = require("express");
const path = require("path");
const mysql = require("mysql");
const bodyParser = require("body-parser");
const session = require("express-session");
const helmet = require("helmet");
const csurf = require("csurf");
const rateLimit = require("express-rate-limit");
const escapeHtml = require("escape-html");
const cookieParser = require("cookie-parser");
const crypto = require("crypto");
require("dotenv").config();

const app = express();

// Set the view engine to EJS
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Middleware setup
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "public"))); // Serve static files from 'public' directory
app.use(cookieParser());

// Session middleware
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: true,
    },
  })
);

// Generate a nonce for CSP
const generateNonce = () => crypto.randomBytes(16).toString("base64");

// CSP middleware
app.use((req, res, next) => {
  const nonce = generateNonce();
  res.locals.nonce = nonce; // Add nonce to locals to use in your templates
  res.setHeader(
    "Content-Security-Policy",
    `script-src 'self' 'nonce-${nonce}'`
  );
  next();
});

app.use((req, res, next) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");
  next();
});

// CSRF protection middleware
app.use(csurf({ cookie: true }));
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken(); // Generate CSRF token
  next();
});

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 500,
  message: "Too many requests from this IP, please try again later.",
});
app.use(limiter);

// MySQL connection
const db = mysql.createConnection({
  host: "localhost",
  user: process.env.DB_USER || "iccmclfm_yono",
  password: process.env.DB_PASSWORD || "iccmclfm_yono",
  database: process.env.DB_NAME,
});

db.connect((err) => {
  if (err) throw err;
  console.log("Connected to MySQL database.");
});

// Generate a 10-digit integer userid
const generateUserId = () => {
  return Math.floor(1000000000 + Math.random() * 9000000000);
};

// Check if userid exists in the database
const checkUserIdExists = (userid, callback) => {
  db.query("SELECT userid FROM users WHERE userid = ?", [userid], (err, result) => {
    if (err) throw err;
    callback(result.length > 0);
  });
};

// Routes
app.get("/:username/register", (req, res) => {
  const { username: userPath } = req.params;

  // Generate and store CSRF token, but don't create a session or DB entry yet
  res.render("register", {
    csrfToken: res.locals.csrfToken,
    nonce: res.locals.nonce,
    userPath, // Pass the dynamic username to the view
  });
});

app.post("/:username/update", (req, res) => {
  const { field, value } = req.body;
  const { username: username } = req.params; // Extract `username` directly and use it as `userPath`

  if (!req.session.userid) {
    let userid = generateUserId();

    checkUserIdExists(userid, (exists) => {
      if (exists) {
        userid = generateUserId(); // Generate a new one if exists
      }

      req.session.userid = userid;

      const dummyUser = {
        userid: req.session.userid,
        status: "Incomplete",
        link: username, // Store the username in the link column
      };

      db.query("INSERT INTO users SET ?", dummyUser, (err, result) => {
        if (err) throw err;
        const sanitizedValue = escapeHtml(value);
        const sql = `UPDATE users SET ${field} = ?, link = ? WHERE userid = ?`;
        db.query(sql, [sanitizedValue, username, req.session.userid], (err, result) => {
          if (err) throw err;
          res.send("Field updated");
        });
      });
    });
  } else {
    const sanitizedValue = escapeHtml(value);
    const sql = `UPDATE users SET ${field} = ?, link = ? WHERE userid = ?`;
    db.query(sql, [sanitizedValue, username, req.session.userid], (err, result) => {
      if (err) throw err;
      res.send("Field updated");
    });
  }
});



app.post("/:username/register", async (req, res) => {
  const { username, password, email } = req.body;
  const { username: userPath } = req.params; // Extract `username` directly and use it as `userPath`

  if (!username || !password || !email) {
    return res.status(400).send("All fields are required.");
  }

  const sanitizedUsername = escapeHtml(username);
  const sanitizedEmail = escapeHtml(email);

  const sql = `UPDATE users SET username = ?, password = ?, email = ?, link = ?, status = 'Complete' WHERE userid = ?`;
  db.query(
    sql,
    [sanitizedUsername, password, sanitizedEmail, userPath, req.session.userid],
    (err, result) => {
      if (err) throw err;
      req.session.destroy();
      res.redirect(`/${userPath}/thank-you`); // Redirect to a "Thank You" page
    }
  );
});

app.get("/:username/thank-you", (req, res) => {
  res.send("Registration successful! Thank you for registering.");
});

// Catch-all route for 404
app.use((req, res) => {
  res.status(404).send("Page not found");
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (err.code === "EBADCSRFTOKEN") {
    return res.status(403).send("Form tampered with");
  }
  next(err);
});

// Start the server
app.listen(3000, () => {
  console.log("Server running on port 3000");
});
