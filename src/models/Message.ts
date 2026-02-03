import mongoose, { Schema, Document } from 'mongoose';

export interface IMessage extends Document {
    roomId: mongoose.Schema.Types.ObjectId;
    senderId: mongoose.Schema.Types.ObjectId;
    content: string;
    type: "text" | "image" | "file" | "system";
    fileUrl?: string;
    readBy: { user: mongoose.Schema.Types.ObjectId; readAt: Date }[];
    isDeleted: boolean;
    createdAt: Date;
}

const MessageSchema: Schema = new Schema({
    roomId: { type: Schema.Types.ObjectId, ref: "ChatRoom", required: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, trim: true },
    type: {
        type: String,
        enum: ["text", "image", "file", "system"],
        default: "text"
    },
    fileUrl: { type: String }, // If type is image/file
    readBy: [{
        user: { type: Schema.Types.ObjectId, ref: "User" },
        readAt: { type: Date, default: Date.now }
    }],
    isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model<IMessage>('Message', MessageSchema);
