
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const jwt = require('jsonwebtoken');
const { io } = require('socket.io-client');

// Load env
dotenv.config();
// Force usage of the correct DB (Hardcoded for safety in test script)
process.env.MONGODB_URI = "mongodb+srv://pratham:16451645@cluster0.zk7z6bv.mongodb.net/constructionApp?appName=Cluster0";

// Define Schemas locally to avoid import mismatches
const UserSchema = new mongoose.Schema({ name: String, email: String, role: String });
const ProjectSchema = new mongoose.Schema({ manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, clientEmail: String });

const User = mongoose.models.User || mongoose.model('User', UserSchema);
const Project = mongoose.models.Project || mongoose.model('Project', ProjectSchema);

async function runTest() {
    console.log("🚀 Starting Final Connectivity Test...");

    // 1. Connect DB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log("✅ DB Connected");

    // 2. Fetch Data
    const projects = await Project.find({ manager: { $exists: true } }).limit(1);
    const project = projects[0];

    if (!project) { console.error("❌ No Project Found"); process.exit(1); }
    const user = await User.findById(project.manager);
    if (!user) { console.error("❌ Manager Found"); process.exit(1); }

    console.log(`📋 Using Project: ${project._id}`);

    // 3. Generate Token
    const token = jwt.sign(
        { _id: user._id, role: user.role, name: user.name },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '1h' }
    );

    // 4. Connect Socket
    // Note: Test with 'extraHeaders' if CORS gives trouble, but Node client handles it better.
    // Origin is important if server enforces it.
    const socket = io("http://localhost:4000", {
        auth: { token },
        transports: ['websocket'],
        extraHeaders: {
            // Emulate the frontend origin to pass the new CORS check
            "Origin": "https://v2-lite-backend.vercel.app"
        }
    });

    socket.on('connect', () => {
        console.log("✅ Socket Connected! (ID: " + socket.id + ")");
        socket.emit('join_project_chat', { projectId: project._id.toString() });
    });

    socket.on('room_joined', (data) => {
        console.log("✅ SUCCESS: Joined Room!", data);
        socket.disconnect();
        mongoose.connection.close();
        process.exit(0);
    });

    socket.on('error', (err) => {
        console.error("❌ Socket Error:", err);
        process.exit(1);
    });

    // Timeout
    setTimeout(() => {
        console.error("❌ Timeout: No response from server.");
        process.exit(1);
    }, 5000);
}

runTest();
