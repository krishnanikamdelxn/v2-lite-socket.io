import mongoose, { Schema, Document } from 'mongoose';

export interface IChatRoom extends Document {
    type: "project";
    projectId: mongoose.Schema.Types.ObjectId;
    members: mongoose.Schema.Types.ObjectId[];
    lastMessage?: mongoose.Schema.Types.ObjectId;
    isActive: boolean;
}

const ChatRoomSchema: Schema = new Schema({
    type: {
        type: String,
        enum: ["project"],
        default: "project",
        required: true
    },
    projectId: {
        type: Schema.Types.ObjectId,
        ref: "Project",
        required: true,
        unique: true // Ensure one room per project
    },
    members: [{ type: Schema.Types.ObjectId, ref: "User" }],
    lastMessage: { type: Schema.Types.ObjectId, ref: "Message" },
    isActive: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model<IChatRoom>('ChatRoom', ChatRoomSchema);
