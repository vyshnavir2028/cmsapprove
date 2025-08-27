const express = require("express");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const admin = require("firebase-admin");

const app = express();
app.use(bodyParser.json());

// ---- Firebase Admin (local: use JSON file) ----
const serviceAccount = require("./serviceAccountKey.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://cme-access-management-default-rtdb.firebaseio.com/" // <-- replace
});

// ---- Email transporter (Gmail App Password) ----
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: "vaishnavir2028@gmail.com",      // <-- replace
    pass: "xdlkkdgyhtjfigyq"   // <-- replace
  }
});

// Replace this with your local/deployed URL:
// Local testing:
const BACKEND_URL = "http://localhost:3000";
// After deploy to Render, change to:
// const BACKEND_URL = "https://YOUR-RENDER-APP.onrender.com";

// 1) Android will call this after signup
app.post("/send-approval", async (req, res) => {
  const { uid, email, name } = req.body;
  if (!uid || !email || !name) {
    return res.status(400).send({ success: false, message: "uid, email, name required" });
  }

  const approveLink = `${BACKEND_URL}/approve?uid=${encodeURIComponent(uid)}`;

  const mailOptions = {
    from: "youradmin@gmail.com",
    to: "youradmin@gmail.com", // admin receives the mail
    subject: "New User Signup Approval Needed",
    html: `
      <h2>New user signed up</h2>
      <p><b>Name:</b> ${name}</p>
      <p><b>Email:</b> ${email}</p>
      <p>Click below to approve this user:</p>
      <a href="${approveLink}"
         style="background:#28a745;color:#fff;padding:10px 16px;text-decoration:none;border-radius:6px;display:inline-block">
         Approve User
      </a>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    res.send({ success: true, message: "Approval email sent to admin" });
  } catch (err) {
    console.error(err);
    res.status(500).send({ success: false, message: err.message });
  }
});

// 2) Admin clicks this link in the email
app.get("/approve", async (req, res) => {
  const { uid } = req.query;
  if (!uid) return res.status(400).send("<h3>Missing uid</h3>");

  try {
    await admin.database().ref(`/users/${uid}`).update({ approved: true });
    res.send("<h2>✅ User approved successfully!</h2>");
  } catch (err) {
    console.error(err);
    res.status(500).send("<h2>❌ Error approving user</h2>");
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
