require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Create a MongoClient
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Keep reference to DB
let adminsCollection;

async function run() {
  try {
    // Connect client
    await client.connect();
    const db = client.db("viks"); // database name
    adminsCollection = db.collection("admin-collection"); // collection name

    // Ping database
    await db.command({ ping: 1 });
    console.log("Connected successfully to MongoDB!");
  } catch (err) {
    console.error(err);
  }
}
run().catch(console.dir);

// --- ROUTES ---
// Get admin by email
app.get("/admins/:email", async (req, res) => {
  try {
    const email = req.params.email;
    const admin = await adminsCollection.findOne({ email });
    if (!admin) return res.status(404).json({ message: "User Not Found." });
    res.json(admin);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Get all admins
app.get("/admins", async (req, res) => {
  try {
    const admins = await adminsCollection.find({}).toArray();
    res.json(admins);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

app.post("/api/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const user = await adminsCollection.findOne({ email });
    if (!user) return res.status(401).json({ message: "User not found" });

    // Compare password (plaintext for testing)
    if (password !== user.password)
      return res.status(401).json({ message: "Invalid password" });

    // Return user info (without password)
    const { password: pwd, ...userData } = user;
    res.json({ message: "Login successful", user: userData });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
