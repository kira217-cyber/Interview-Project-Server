require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
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
let sliderCollection;
let settingsCollection;
let signupImageCollection;
let loginImageCollection;
let adminLoginImageCollection;
let navbarSettingsCollection;
let webMenuSettingsCollection;
let mobileMenuSettingsCollection;
let mobileSidebarStyleCollection
let footerSettingsCollection;
let mobileSidebarMenuCollection
async function run() {
  try {
    await client.connect();

    // Database & Collection
    const db = client.db("viks"); // database name
    adminsCollection = db.collection("admin-collection"); // collection name
    logoCollection = db.collection("logo");
    sliderCollection = db.collection("sliders");
    settingsCollection = db.collection("settings");
    signupImageCollection = db.collection("signupImage");
    loginImageCollection = db.collection("loginImage");
    adminLoginImageCollection = db.collection("admin-login-image");
    navbarSettingsCollection = db.collection("navbar_settings");
    webMenuSettingsCollection = db.collection("web_menu_settings");
    mobileMenuSettingsCollection =db.collection("mobile_menu_settings");
    mobileSidebarStyleCollection = db.collection("mobile_sidebar_settings");
    footerSettingsCollection = db.collection("footer_settings");
    mobileSidebarMenuCollection = db.collection("url_settings")

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

// ==== Multer Config for Sliders ====
const sliderStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  },
});
const uploadSlider = multer({ storage: sliderStorage });

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


// GET /api/admins/:id
app.get('/api/admins/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const admin = await adminsCollection.findOne({ _id: new ObjectId(id) }, { projection: { password: 0 } }); // password বাদ দিয়ে
    if (!admin) return res.status(404).json({ error: 'Admin not found' });
    res.json(admin);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});


// PUT /api/admins/:id


// role hierarchy
const roleHierarchy2 = [
  "Mother Admin",
  "Sub Admin",
  "Master",
  "Agent",
  "Sub Agent",
  "User",
];

// Update Admin Profile with Role Check
app.put("/api/admins/:id", async (req, res) => {
  try {
    const id = req.params.id; // যে user modify হবে
    const editorId = req.headers["x-admin-id"]; // কে modify করছে
    const updateData = { ...req.body };

    if (!editorId) {
      return res.status(401).json({ error: "Unauthorized: Missing editor ID" });
    }

    // modifier কে খুঁজে বের করা
    const editor = await adminsCollection.findOne({ _id: new ObjectId(editorId) });
    if (!editor) {
      return res.status(403).json({ error: "Invalid editor" });
    }

    // target admin কে খুঁজে বের করা
    const target = await adminsCollection.findOne({ _id: new ObjectId(id) });
    if (!target) {
      return res.status(404).json({ error: "Target admin not found" });
    }

    // role hierarchy (উচ্চ থেকে নিম্ন)
    const hierarchy = [
      "Mother Admin",
      "Sub Admin",
      "Master",
      "Agent",
      "Sub Agent",
      "User"
    ];

    const editorRank = hierarchy.indexOf(editor.role);
    const targetRank = hierarchy.indexOf(target.role);

    // Rule: editor কেবল তার চেয়ে "নিচের rank" modify করতে পারবে
    if (editorRank === -1 || targetRank === -1) {
      return res.status(400).json({ error: "Invalid role" });
    }

    if (editorRank >= targetRank) {
      return res.status(403).json({ error: "You are not allowed to modify this admin" });
    }

    // password খালি থাকলে বাদ দিন
    if (!updateData.password) {
      delete updateData.password;
    }

    const result = await adminsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).json({ error: "No changes applied" });
    }

    res.json({ success: true, message: "Admin updated successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
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


// role hierarchy define করে দিচ্ছি
const roleHierarchy = {
  "Mother Admin": ["Sub Admin", "Master", "Agent", "Sub Agent", "User"],
  "Sub Admin": ["Master", "Agent", "Sub Agent", "User"],
  "Master": ["Agent", "Sub Agent", "User"],
  "Agent": ["Sub Agent", "User"],
  "Sub Agent" : ["User"]
};

// ✅ Update user status (Activate/Deactivate)
app.patch("/api/admins/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { action, requesterRole, targetRole } = req.body;

    // Action valid কিনা check
    if (!["Activate", "Deactivate"].includes(action)) {
      return res.status(400).json({ success: false, message: "Invalid action" });
    }

    // Permission check
    if (
      requesterRole !== "Mother Admin" &&
      !roleHierarchy[requesterRole]?.includes(targetRole)
    ) {
      return res.status(403).json({
        success: false,
        message: "You don’t have permission to manage this role",
      });
    }

    const result = await adminsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: { status: action === "Activate" ? "Activated" : "Deactivated" } }
    );

    if (result.modifiedCount === 0) {
      return res
        .status(404)
        .json({ success: false, message: "User not found or already same status" });
    }

    res.json({
      success: true,
      message: `User ${action.toLowerCase()}d successfully`,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
    console.error("❌ Upload error:", err); // 👈 এখানে আসল error দেখাবে
    res.status(500).json({ error: err.message });
  }
});

// =======================
// =======================
// Delete logo
app.delete("/api/logo/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const logo = await logoCollection.findOne({ _id: new ObjectId(id) });

    if (!logo) {
      return res.status(404).json({ message: "Logo not found" });
    }

    // file delete (DB তে filename রাখতে হবে)
    if (logo.filename) {
      const filePath = path.join(__dirname, "uploads", logo.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // mongo থেকে delete
    await logoCollection.deleteOne({ _id: new ObjectId(id) });

    res.json({ message: "Logo deleted successfully" });
  } catch (error) {
    console.error("❌ Delete error:", error);
    res.status(500).json({ message: "Error deleting logo" });
  }
});

// ================= SLIDER ROUTES =================

// Get all sliders
app.get("/api/sliders", async (req, res) => {
  try {
    const sliders = await sliderCollection.find({}).toArray();
    res.json(sliders);
  } catch (err) {
    res.status(500).json({ message: "Error fetching sliders", error: err });
  }
});

// Upload slider
app.post("/api/sliders", uploadSlider.single("slider"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const imageUrl = `http://localhost:5000/uploads/${req.file.filename}`;
    const newSlider = { imageUrl, filename: req.file.filename };

    const result = await sliderCollection.insertOne(newSlider);

    res.json({ success: true, insertedId: result.insertedId, imageUrl });
  } catch (err) {
    res.status(500).json({ message: "Error uploading slider", error: err });
  }
});

// Delete slider
app.delete("/api/sliders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const slider = await sliderCollection.findOne({ _id: new ObjectId(id) });

    if (!slider) {
      return res.status(404).json({ message: "Slider not found" });
    }

    // Delete local file
    if (slider.filename) {
      const filePath = path.join(__dirname, "uploads", slider.filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }

    // Delete from DB
    await sliderCollection.deleteOne({ _id: new ObjectId(id) });

    res.json({ success: true, message: "Slider deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting slider", error: err });
  }
});

// ========= Fav icon and Title Routes ===============

app.get("/api/settings", async (req, res) => {
  try {
    const settings = await settingsCollection.findOne({});
    res.json(settings || {});
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch settings" });
  }
});

app.post("/api/settings", upload.single("favicon"), async (req, res) => {
  try {
    const { title } = req.body;
    let faviconUrl = null;

    if (req.file) {
      faviconUrl = `http://localhost:5000/uploads/${req.file.filename}`;
    }

    const existing = await settingsCollection.findOne({});
    if (existing) {
      await settingsCollection.updateOne(
        { _id: existing._id },
        { $set: { title, ...(faviconUrl && { faviconUrl }) } }
      );
    } else {
      await settingsCollection.insertOne({ title, faviconUrl });
    }

    res.json({ message: "Settings updated successfully", title, faviconUrl });
  } catch (err) {
    console.error("❌ Settings error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/settings/favicon/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const settings = await settingsCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!settings)
      return res.status(404).json({ message: "Settings not found" });

    await settingsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $unset: { faviconUrl: "" } }
    );

    res.json({ message: "Favicon deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: "Error deleting favicon" });
  }
});

// Upload Signup Image
app.post(
  "/api/signup-image",
  upload.single("signupImage"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const imageUrl = `http://localhost:5000/uploads/${req.file.filename}`;
      const existing = await signupImageCollection.findOne({});

      if (existing) {
        await signupImageCollection.updateOne(
          { _id: existing._id },
          { $set: { imageUrl, filename: req.file.filename } }
        );
      } else {
        await signupImageCollection.insertOne({
          imageUrl,
          filename: req.file.filename,
        });
      }

      res.json({ imageUrl });
    } catch (err) {
      console.error("❌ Upload error:", err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Get Signup Image
app.get("/api/signup-image", async (req, res) => {
  const signupImage = await signupImageCollection.findOne({});
  res.json(signupImage || {});
});

// Delete Signup Image
app.delete("/api/signup-image/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const image = await signupImageCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!image) {
      return res.status(404).json({ message: "Signup image not found" });
    }

    if (image.filename) {
      const filePath = path.join(__dirname, "uploads", image.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await signupImageCollection.deleteOne({ _id: new ObjectId(id) });

    res.json({ message: "Signup image deleted successfully" });
  } catch (err) {
    console.error("❌ Delete error:", err);
    res.status(500).json({ message: "Error deleting signup image" });
  }
});

// ================= LOGIN IMAGE =================

// Get login image
app.get("/api/login-image", async (req, res) => {
  const loginImage = await loginImageCollection.findOne({});
  res.json(loginImage || {});
});

// Upload Login Image

app.post("/api/login-image", upload.single("loginImage"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const imageUrl = `http://localhost:5000/uploads/${req.file.filename}`;
    const existing = await loginImageCollection.findOne({});

    if (existing) {
      await loginImageCollection.updateOne(
        { _id: existing._id },
        { $set: { imageUrl, filename: req.file.filename } }
      );
    } else {
      await loginImageCollection.insertOne({
        imageUrl,
        filename: req.file.filename,
      });
    }

    res.json({ imageUrl });
  } catch (err) {
    console.error("❌ Upload error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Delete login image
app.delete("/api/login-image/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const image = await loginImageCollection.findOne({ _id: new ObjectId(id) });

    if (!image) {
      return res.status(404).json({ message: "Signup image not found" });
    }

    if (image.filename) {
      const filePath = path.join(__dirname, "uploads", image.filename);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    await loginImageCollection.deleteOne({ _id: new ObjectId(id) });

    res.json({ message: "Signup image deleted successfully" });
  } catch (err) {
    console.error("❌ Delete error:", err);
    res.status(500).json({ message: "Error deleting signup image" });
  }
});

// Get Login Image
app.get("/api/admin-login-image", async (req, res) => {
  try {
    const image = await adminLoginImageCollection.findOne({});
    res.json(image || {});
  } catch (error) {
    res.status(500).json({ message: "Error fetching login image", error });
  }
});

// Upload Login Image
app.post(
  "/api/admin-login-image",
  upload.single("loginImage"),
  async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ error: "No file uploaded" });

      const loginImageUrl = `http://localhost:5000/uploads/${req.file.filename}`;

      const existing = await adminLoginImageCollection.findOne({});
      if (existing) {
        await adminLoginImageCollection.updateOne(
          { _id: existing._id },
          { $set: { loginImageUrl } }
        );
      } else {
        await adminLoginImageCollection.insertOne({ loginImageUrl });
      }

      res.json({ loginImageUrl });
    } catch (error) {
      res.status(500).json({ message: "Error uploading login image", error });
    }
  }
);

// Delete Login Image
app.delete("/api/admin-login-image/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const image = await adminLoginImageCollection.findOne({
      _id: new ObjectId(id),
    });

    if (!image) {
      return res.status(404).json({ message: "Login image not found" });
    }

    await adminLoginImageCollection.deleteOne({ _id: new ObjectId(id) });
    res.json({ message: "Login image deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Error deleting login image", error });
  }
});

// GET Navbar Settings
app.get("/api/navbar", async (req, res) => {
  try {
    const settings = await navbarSettingsCollection.findOne({});
    if (!settings)
      return res.status(404).json({ message: "Navbar settings not found" });
    res.json(settings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// CREATE or UPDATE Navbar Settings
app.post("/api/navbar", async (req, res) => {
  try {
    const { bgColor, textColor, fontSize, bgButtonColor, signUpButtonBgColor } =
      req.body;
    const existing = await navbarSettingsCollection.findOne({});

    if (existing) {
      // Update existing
      await navbarSettingsCollection.updateOne(
        { _id: existing._id },
        {
          $set: {
            bgColor,
            textColor,
            fontSize,
            bgButtonColor,
            signUpButtonBgColor,
          },
        }
      );
      res.json({
        ...existing,
        bgColor,
        textColor,
        fontSize,
        bgButtonColor,
        signUpButtonBgColor,
      });
    } else {
      // Insert new
      const result = await navbarSettingsCollection.insertOne({
        bgColor,
        textColor,
        fontSize,
        bgButtonColor,
        signUpButtonBgColor,
      });
      res.json({
        _id: result.insertedId,
        bgColor,
        textColor,
        fontSize,
        bgButtonColor,
        signUpButtonBgColor,
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


// GET Web Menu Settings
app.get("/api/webmenu", async (req, res) => {
  try {
    const menuSettings = await webMenuSettingsCollection.findOne({});
    if (!menuSettings)
      return res.status(404).json({ message: "Web menu settings not found" });

    res.json(menuSettings);
  } catch (error) {
    console.error("Error fetching web menu settings:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// CREATE or UPDATE Web Menu Settings
app.post("/api/webmenu", async (req, res) => {
  try {
    const { webMenuBgColor, webMenuTextColor, webMenuFontSize, webMenuHoverColor } = req.body;
    const existing = await webMenuSettingsCollection.findOne({});

    if (existing) {
      // Update
      await webMenuSettingsCollection.updateOne(
        { _id: existing._id },
        { $set: { webMenuBgColor, webMenuTextColor, webMenuFontSize, webMenuHoverColor } }
      );
      res.json({ ...existing, webMenuBgColor, webMenuTextColor, webMenuFontSize, webMenuHoverColor });
    } else {
      // Insert new
      const result = await webMenuSettingsCollection.insertOne({
        webMenuBgColor,
        webMenuTextColor,
        webMenuFontSize,
        webMenuHoverColor,
      });
      res.json({
        _id: result.insertedId,
        webMenuBgColor,
        webMenuTextColor,
        webMenuFontSize,
        webMenuHoverColor,
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// =======================
// MOBILE MENU API ROUTES
// =======================

// GET Mobile Menu Settings
app.get("/api/mobilemenu", async (req, res) => {
  try {
    const menuSettings = await mobileMenuSettingsCollection.findOne({});
    if (!menuSettings)
      return res.status(404).json({ message: "Mobile menu settings not found" });

    res.json(menuSettings);
  } catch (error) {
    console.error("Error fetching mobile menu settings:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// CREATE or UPDATE Mobile Menu Settings
app.post("/api/mobilemenu", async (req, res) => {
  try {
    const {
      loginBtnColor,
      signupBtnColor,
      btnFontSize,
      pageBgColor,
      pageFontSize,
      buttonFontColor,
      loginPageBgColor,
    } = req.body;

    const existing = await mobileMenuSettingsCollection.findOne({});

    if (existing) {
      // Update
      await mobileMenuSettingsCollection.updateOne(
        { _id: existing._id },
        {
          $set: {
            loginBtnColor,
            signupBtnColor,
            btnFontSize,
            pageBgColor,
            pageFontSize,
            buttonFontColor,
            loginPageBgColor
          },
        }
      );
      res.json({
        ...existing,
        loginBtnColor,
        signupBtnColor,
        btnFontSize,
        pageBgColor,
        pageFontSize,
        buttonFontColor,
        loginPageBgColor
      });
    } else {
      // Insert new
      const result = await mobileMenuSettingsCollection.insertOne({
        loginBtnColor,
        signupBtnColor,
        btnFontSize,
        pageBgColor,
        pageFontSize,
        buttonFontColor,
        loginPageBgColor
      });
      res.json({
        _id: result.insertedId,
        loginBtnColor,
        signupBtnColor,
        btnFontSize,
        pageBgColor,
        pageFontSize,
        buttonFontColor,
        loginPageBgColor
      });
    }
  } catch (error) {
    console.error("Error saving mobile menu settings:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


// GET Mobile Sidebar Style
app.get("/api/mobile-sidebar-style", async (req, res) => {
  try {
    const style = await mobileSidebarStyleCollection.findOne({});
    if (!style) {
      return res.status(404).json({ message: "Mobile sidebar style not found" });
    }
    res.json(style);
  } catch (error) {
    console.error("Error fetching sidebar style:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// CREATE or UPDATE Mobile Sidebar Style
app.post("/api/mobile-sidebar-style", async (req, res) => {
  try {
    const { gradientDirection, gradientFrom, gradientTo, sideTextColor, fontSize } =
      req.body;

    const existing = await mobileSidebarStyleCollection.findOne({});

    if (existing) {
      // Update
      await mobileSidebarStyleCollection.updateOne(
        { _id: existing._id },
        {
          $set: {
            gradientDirection,
            gradientFrom,
            gradientTo,
            sideTextColor,
            fontSize,
          },
        }
      );

      res.json({
        _id: existing._id,
        gradientDirection,
        gradientFrom,
        gradientTo,
        sideTextColor,
        fontSize,
      });
    } else {
      // Insert new
      const result = await mobileSidebarStyleCollection.insertOne({
        gradientDirection,
        gradientFrom,
        gradientTo,
        sideTextColor,
        fontSize,
      });

      res.json({
        _id: result.insertedId,
        gradientDirection,
        gradientFrom,
        gradientTo,
        sideTextColor,
        fontSize,
      });
    }
  } catch (error) {
    console.error("Error saving mobile sidebar style:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


// GET Footer Settings
app.get("/api/footer", async (req, res) => {
  try {
    const footerSettings = await footerSettingsCollection.findOne({});
    if (!footerSettings)
      return res.status(404).json({ message: "Footer settings not found" });

    res.json(footerSettings);
  } catch (error) {
    console.error("Error fetching footer settings:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// CREATE or UPDATE Footer Settings
app.post("/api/footer", async (req, res) => {
  try {
    const { footerTextColor, footerFontSize } = req.body;

    const existing = await footerSettingsCollection.findOne({});

    if (existing) {
      // Update
      await footerSettingsCollection.updateOne(
        { _id: existing._id },
        { $set: { footerTextColor, footerFontSize } }
      );
      res.json({
        ...existing,
        footerTextColor,
        footerFontSize,
      });
    } else {
      // Insert new
      const result = await footerSettingsCollection.insertOne({
        footerTextColor,
        footerFontSize,
      });
      res.json({
        _id: result.insertedId,
        footerTextColor,
        footerFontSize,
      });
    }
  } catch (error) {
    console.error("Error saving footer settings:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// GET Sidebar Menu Links
app.get("/api/sidebar-menu", async (req, res) => {
  try {
    const menu = await mobileSidebarMenuCollection.findOne({});
    if (!menu) return res.status(404).json({ message: "Sidebar menu not found" });
    res.json(menu);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// CREATE or UPDATE Sidebar Menu Links
app.post("/api/sidebar-menu", async (req, res) => {
  try {
    const { sidebarMenu } = req.body; // sidebarMenu = [{label, icon, url}, ...]

    const existing = await mobileSidebarMenuCollection.findOne({});

    if (existing) {
      await mobileSidebarMenuCollection.updateOne(
        { _id: existing._id },
        { $set: { sidebarMenu } }
      );
      res.json({ ...existing, sidebarMenu });
    } else {
      const result = await mobileSidebarMenuCollection.insertOne({ sidebarMenu });
      res.json({ _id: result.insertedId, sidebarMenu });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// ---------------------- GET Mother Admin Balance ----------------------
app.get("/api/admin/balance", async (req, res) => {
  try {
    const { role, id } = req.query; // frontend থেকে role + id পাঠানো হবে

    if (!role || !id) {
      return res.status(400).json({ message: "Role and id required" });
    }

    const admin = await adminsCollection.findOne({ role, _id: new ObjectId(id) });

    if (!admin) {
      return res.status(404).json({ message: `${role} not found` });
    }

    res.status(200).json({
      message: "Balance fetched successfully",
      balance: admin.balance || 0,
      admin,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal Server Error", error });
  }
});

// ---------------------- PUT Update Mother Admin Balance ----------------------

app.put("/api/mother-admin/balance", async (req, res) => {
  try {
    const { amount, role } = req.body;
    const value = parseFloat(amount);

    if (role !== "Mother Admin") {
      return res.status(403).json({ message: "Only Mother Admin can add balance" });
    }

    if (isNaN(value) || value <= 0) {
      return res.status(400).json({ message: "Invalid amount" });
    }

    const filter = { role: "Mother Admin" };
    const updateDoc = { $inc: { balance: value } };

    const result = await adminsCollection.updateOne(filter, updateDoc);

    if (result.matchedCount > 0) {
      const updatedAdmin = await adminsCollection.findOne(filter);
      return res.status(200).json({
        message: "Balance updated successfully",
        admin: updatedAdmin,
      });
    }

    return res.status(404).json({ message: "Mother Admin not found" });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal Server Error", error });
  }
});


// Update Admin Profile
app.put("/api/profile/:id", async (req, res) => {
    try {
    const id = req.params.id;
    const updateData = { ...req.body };

    // যদি password খালি থাকে তাহলে বাদ দিন
    if (!updateData.password) {
      delete updateData.password;
    }

    const result = await adminsCollection.updateOne(
      { _id: new ObjectId(id) },
      { $set: updateData }
    );

    if (result.modifiedCount === 0) {
      return res.status(400).json({ error: 'No changes applied' });
    }

    res.json({ success: true, message: 'Admin updated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});



// ================= START SERVER =================
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});
