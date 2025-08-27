const express = require("express");
const bodyParser = require("body-parser");
const nodemailer = require("nodemailer");
const admin = require("firebase-admin");

const app = express();
app.use(bodyParser.json());

/* =============================
   🔹 Firebase Admin Setup
   ============================= */
let serviceAccount;
try {
  // On Render: load from environment variable
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch (e) {
  // Local development: fallback to JSON file
  serviceAccount = require("./serviceAccountKey.json");
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://cme-access-management-default-rtdb.firebaseio.com/"
});

/* =============================
   🔹 Nodemailer Setup
   (use Gmail App Password)
   ============================= */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER || "vaishnavir2028@gmail.com",   // ✅ set in Render
    pass: process.env.GMAIL_PASS || "xdlkkdgyhtjfigyq"            // ✅ set in Render
  }
});

/* =============================
   🔹 Backend URL
   ============================= */
const BACKEND_URL =
  process.env.RENDER_EXTERNAL_URL || "http://localhost:3000";

/* =============================
   1) Android calls after signup
   ============================= */
app.post("/send-approval", async (req, res) => {
  const { uid, email, name } = req.body;
  if (!uid || !email || !name) {
    return res
      .status(400)
      .send({ success: false, message: "uid, email, name required" });
  }

  // Save initial user record in Firebase
  await admin.database().ref(`/users/${uid}`).set({
    email,
    name,
    approved: false
  });

  const approveLink = `${BACKEND_URL}/approve?uid=${encodeURIComponent(uid)}`;

  const mailOptions = {
    from: process.env.GMAIL_USER || "youradmin@gmail.com",
    to: process.env.ADMIN_EMAIL || "youradmin@gmail.com", // admin receives
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

/* =============================
   2) Admin clicks approval link
   ============================= */
app.get("/approve", async (req, res) => {
  const { uid } = req.query;
  if (!uid) return res.status(400).send("<h3>Missing uid</h3>");

  try {
    // Update approved flag
    await admin.database().ref(`/users/${uid}`).update({ approved: true });

    // Fetch user data (email & name)
    const snapshot = await admin.database().ref(`/users/${uid}`).once("value");
    const user = snapshot.val();

    if (user && user.email) {
      // Send approval email to the user
      const userMailOptions = {
        from: process.env.GMAIL_USER || "youradmin@gmail.com",
        to: user.email,
        subject: "🎉 Your Account Has Been Approved",
        html: `
          <h2>Hello ${user.name || "User"},</h2>
          <p>✅ Your account has been <b>approved</b> by the admin.</p>
          <p>You can now log in and start using the system.</p>
          <br/>
          <p style="color:gray;font-size:12px">CME Access Management System</p>
        `
      };

      await transporter.sendMail(userMailOptions);
    }

    res.send("<h2>✅ User approved successfully and confirmation email sent!</h2>");
  } catch (err) {
    console.error(err);
    res.status(500).send("<h2>❌ Error approving user</h2>");
  }
});

/* =============================
   Start Server
   ============================= */
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
