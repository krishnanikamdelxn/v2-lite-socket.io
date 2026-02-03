import mongoose from 'mongoose';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import Project from '../models/Project';
import User from '../models/User';
import connectDB from '../config/db';

dotenv.config();

const generateTestData = async () => {
    await connectDB();

    try {
        // 1. Find a Project with a Manager
        const project = await Project.findOne({ manager: { $exists: true } });

        if (!project) {
            console.log("❌ No projects found in DB.");
            process.exit(1);
        }

        // 2. Find the Manager User
        const user = await User.findById(project.manager);
        if (!user) {
            console.log("❌ Manager user not found.");
            process.exit(1);
        }

        // 3. Generate Token
        const payload = {
            _id: user._id,
            role: user.role,
            name: user.name
        };

        const token = jwt.sign(payload, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });

        console.log("\n============================================");
        console.log("✅ TEST DATA GENERATED");
        console.log("============================================");
        console.log(`📂 Project ID:  "${project._id}"`);
        console.log(`👤 User (Manager): ${user.name} (${user.role})`);
        console.log(`🔑 Auth Token:`);
        console.log(token);
        console.log("============================================\n");

    } catch (error) {
        console.error(error);
    } finally {
        mongoose.connection.close();
    }
};

generateTestData();
