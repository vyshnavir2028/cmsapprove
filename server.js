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
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} catch (e) {
  serviceAccount = require("./serviceAccountKey.json");
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://cme-access-management-default-rtdb.firebaseio.com/"
});

/* =============================
   🔹 Nodemailer Setup
   ============================= */
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER || "vaishnavir2028@gmail.com",
    pass: process.env.GMAIL_PASS || "xdlkkdgyhtjfigyq"
  }
});

transporter.verify((error, success) => {
  if (error) console.error("Email transporter error:", error);
  else console.log("Email transporter is ready");
});

/* =============================
   🔹 Backend URL
   ============================= */
const BACKEND_URL = process.env.RENDER_EXTERNAL_URL || "https://cms-approve.onrender.com";

/* =============================
   1) Android calls after signup
   ============================= */
app.post("/send-approval", async (req, res) => {
  try {
    const { uid, email, name, role } = req.body;
    console.log("Received request:", req.body);

    if (!uid || !email || !name || !role) {
      return res.status(400).send({ success: false, message: "uid, email, name, and role are required" });
    }

    const path =
      role === "staff" ? `/staff/${uid}` :
      role === "rp" ? `/rp/${uid}` :
      `/users/${uid}`;

    await admin.database().ref(path).set({ email, name, role, approved: false });

    const approveLink = `${BACKEND_URL}/approve?uid=${encodeURIComponent(uid)}&role=${encodeURIComponent(role)}`;

    const mailOptions = {
      from: process.env.GMAIL_USER || "youradmin@gmail.com",
      to: process.env.ADMIN_EMAIL || "youradmin@gmail.com",
      subject: "New User Signup Approval Needed",
      html: `
        <h2>New user signed up</h2>
        <p><b>Name:</b> ${name}</p>
        <p><b>Email:</b> ${email}</p>
        <p><b>Role:</b> ${role}</p>
        <p>Click below to approve this user:</p>
        <a href="${approveLink}"
           style="background:#28a745;color:#fff;padding:10px 16px;text-decoration:none;border-radius:6px;display:inline-block">
           Approve User
        </a>
      `
    };

    console.log("Sending email with options:", mailOptions);
    await transporter.sendMail(mailOptions);

    res.send({ success: true, message: "Approval email sent to admin" });

  } catch (err) {
    console.error("Backend error:", err);
    res.status(500).send({ success: false, message: err.message });
  }
});

/* =============================
   2) Admin clicks approval link
   ============================= */
app.get("/approve", async (req, res) => {
  const { uid, role } = req.query;

  if (!uid || !role)
    return res.status(400).send("<h3>Missing uid or role</h3>");

  const path =
    role === "staff" ? `/staff/${uid}` :
    role === "rp" ? `/rp/${uid}` :
    `/users/${uid}`;

  try {
    // Mark user as approved
    await admin.database().ref(path).update({ approved: true });

    // Fetch user data
    const snapshot = await admin.database().ref(path).once("value");
    const user = snapshot.val();

    if (user && user.email) {
      // Send approval email to user
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
