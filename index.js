require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const multer = require("multer");

const app = express();
// Serve static files from "uploads" folder
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());



// MongoDB connection
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

let adminsCollection;
let logoCollection;

async function run() {
  try {
    await client.connect();

    // Database & Collection
    const db = client.db("viks"); // database name
    adminsCollection = db.collection("admin-collection"); // collection name
    logoCollection = db.collection("logo");

    console.log("✅ MongoDB Connected Successfully!");
  } catch (error) {
    console.error("❌ MongoDB Connection Error:", error);
  }
}
run();

// ==== Multer Storage ====
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/"); // লোকাল uploads ফোল্ডারে save হবে
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname)); // unique নাম
  },
});
const upload = multer({ storage });

// ==== Serve static files ====
app.use("/uploads", express.static("uploads"));

// ================= ROUTES =================

// 1️⃣ Get all admins
app.get("/admins", async (req, res) => {
  try {
    const admins = await adminsCollection.find({}).toArray();
    res.json(admins);
  } catch (error) {
    res.status(500).json({ message: "Error fetching admins", error });
  }
});

// 2️⃣ Get single admin by email
app.get("/admins/:email", async (req, res) => {
  try {
    const { email } = req.params;
    const admin = await adminsCollection.findOne({ email });

    if (!admin) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(admin);
  } catch (error) {
    res.status(500).json({ message: "Error fetching admin", error });
  }
});

// 3️⃣ Create new admin
app.post("/api/admins", async (req, res) => {
  try {
    const newAdmin = req.body;

    if (!newAdmin.username || !newAdmin.email || !newAdmin.password) {
      return res
        .status(400)
        .json({ message: "Username, Email & Password are required" });
    }

    // Check if user already exists
    const exists = await adminsCollection.findOne({ email: newAdmin.email });
    if (exists) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const result = await adminsCollection.insertOne({
      ...newAdmin,
      balance: 0,
      status: "Activated",
      joinedAt: new Date(),
      lastLogin: "Never",
    });

    res.status(201).json({
      success: true,
      message: "Admin created successfully",
      insertedId: result.insertedId,
    });
  } catch (error) {
    res.status(500).json({ message: "Error creating admin", error });
  }
});

// 4️⃣ Login
app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await adminsCollection.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }

    // ⚠️ Plain text password (only for testing)
    if (password !== user.password) {
      return res.status(401).json({ message: "Invalid password" });
    }

    // ✅ Update lastLogin time
    const currentTime = new Date().toLocaleString();
    await adminsCollection.updateOne(
      { email },
      { $set: { lastLogin: currentTime } }
    );

    // Remove password before sending
    const { password: _, ...userData } = { ...user, lastLogin: currentTime };

    res.json({ message: "Login successful", user: userData });
  } catch (error) {
    res.status(500).json({ message: "Error logging in", error });
  }
});

// Create new admin
app.post("/api/admins", async (req, res) => {
  try {
    const newAdmin = req.body;
    if (!newAdmin.username || !newAdmin.email || !newAdmin.password) {
      return res
        .status(400)
        .json({ message: "Username, Email & Password required" });
    }

    const exists = await adminsCollection.findOne({ email: newAdmin.email });
    if (exists) {
      return res.status(400).json({ message: "Email already registered" });
    }

    const result = await adminsCollection.insertOne({
      ...newAdmin,
      balance: 0,
      status: "Activated",
      joinedAt: new Date(),
      lastLogin: "Never",
    });

    res.status(201).json({ success: true, insertedId: result.insertedId });
  } catch (error) {
    res.status(500).json({ message: "Error creating admin", error });
  }
});

// Deactivate user (Mother Admin only)
app.patch("/api/admins/:id/deactivate", async (req, res) => {
  try {
    const { role } = req.body;
    const { id } = req.params;

    if (role !== "Mother Admin") {
      return res
        .status(403)
        .json({ message: "Only Mother Admin can perform this action" });
    }

    const result = await adminsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: "Deactivated" } }
    );

    if (result.modifiedCount === 0) {
      return res
        .status(404)
        .json({ message: "User not found or already deactivated" });
    }

    res.json({ success: true, message: "User deactivated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Activate user (Mother Admin only)
app.patch("/api/admins/:id/activate", async (req, res) => {
  try {
    const { role } = req.body;
    const { id } = req.params;

    if (role !== "Mother Admin") {
      return res
        .status(403)
        .json({ message: "Only Mother Admin can perform this action" });
    }

    const result = await adminsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: "Activated" } }
    );

    if (result.modifiedCount === 0) {
      return res
        .status(404)
        .json({ message: "User not found or already deactivated" });
    }

    res.json({ success: true, message: "User deactivated successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// Ban user (Mother Admin only)
app.patch("/api/admins/:id/ban", async (req, res) => {
  try {
    const { role } = req.body;
    const { id } = req.params;

    if (role !== "Mother Admin") {
      return res
        .status(403)
        .json({ message: "Only Mother Admin can perform this action" });
    }

    const result = await adminsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: "Banned" } }
    );

    if (result.modifiedCount === 0) {
      return res
        .status(404)
        .json({ message: "User not found or already banned" });
    }

    res.json({ success: true, message: "User banned successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get logo
app.get("/api/logo", async (req, res) => {
  const logo = await logoCollection.findOne({});
  res.json(logo || {});
});

app.post("/api/logo", upload.single("logo"), async (req, res) => {
  try {
    if (!req.file) {
      console.log("❌ No file received");
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log("✅ File received:", req.file);

    const logoUrl = `http://localhost:5000/uploads/${req.file.filename}`;
    console.log("✅ Generated logoUrl:", logoUrl);

    const existing = await logoCollection.findOne({});
    if (existing) {
      await logoCollection.updateOne(
        { _id: existing._id },
        { $set: { logoUrl } }
      );
    } else {
      await logoCollection.insertOne({ logoUrl });
    }

    res.json({ logoUrl });
  } catch (err) {
    console.error("❌ Upload error:", err);   // 👈 এখানে আসল error দেখাবে
    res.status(500).json({ error: err.message });
  }
});


// ================= START SERVER =================
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
