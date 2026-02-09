import mongoose, { Schema, Document } from 'mongoose';

export interface IPushToken extends Document {
    userId: mongoose.Schema.Types.ObjectId;
    token: string;
    platform: 'ios' | 'android' | 'web';
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}

const PushTokenSchema: Schema = new Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    token: {
        type: String,
        required: true,
        unique: true
    },
    platform: {
        type: String,
        enum: ['ios', 'android', 'web'],
        default: 'android'
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

export default mongoose.model<IPushToken>('PushToken', PushTokenSchema);
