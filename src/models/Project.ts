import mongoose, { Schema, Document } from 'mongoose';

export interface IProject extends Document {
    name: string;
    projectCode?: string;
    manager: mongoose.Schema.Types.ObjectId;
    clientEmail?: string;
    engineers: mongoose.Schema.Types.ObjectId[];
    // Add other fields if needed for chat validation
}

const ProjectSchema: Schema = new Schema(
    {
        name: { type: String, required: true },
        projectCode: { type: String },
        location: { type: String },
        description: { type: String },
        category: { type: String },
        startDate: { type: Date },
        plans: [{ type: Object }],
        landArea: { type: String },
        endDate: { type: Date },
        projectImages: { type: String },
        projectDocuments: [{ type: Object }],
        clientName: { type: String },
        needsNewSiteSurvey: { type: Boolean },
        clientEmail: { type: String },
        clientPhone: { type: Number },
        assignedSiteSurvey: { type: Schema.Types.ObjectId, ref: "User" },
        budget: { type: Number },
        selectedItems: [{ type: String }],
        projectType: { type: Schema.Types.ObjectId, ref: "ProjectType" },
        rejectionReason: { type: String },
        manager: { type: Schema.Types.ObjectId, ref: "User", required: true },
        engineers: [{ type: Schema.Types.ObjectId, ref: "User" }],
        status: { type: String, default: "ongoing" },
        createdBy: { type: Schema.Types.ObjectId, ref: "User" },
        handover: {
            handoverRequested: { type: Boolean, default: false },
            handoverDate: { type: Date },
            handoverBy: { type: Schema.Types.ObjectId, ref: "User" },
            handoverAccepted: { type: Boolean, default: false },
            handoverAcceptedDate: { type: Date },
            handoverAcceptedBy: { type: Schema.Types.ObjectId, ref: "User" },
        },
        handoverDocuments: [{ type: String }],
        versionDetails: {
            currentVersion: { type: String },
            lastUpdated: { type: Date },
            history: [
                {
                    version: String,
                    updatedBy: { type: Schema.Types.ObjectId, ref: "User" },
                    updatedAt: Date,
                    notes: String,
                },
            ],
        },
    },
    { timestamps: true }
);

export default mongoose.model<IProject>('Project', ProjectSchema);
