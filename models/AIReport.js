import mongoose from 'mongoose';

const aiReportSchema = new mongoose.Schema(
    {
        type: {
            type: String,
            enum: ['Department', 'Global'],
            default: 'Department',
        },
        departmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Department',
            required: function () { return this.type === 'Department'; }
        },
        month: {
            type: Number,
            required: [true, 'Month is required'],
            min: 1,
            max: 12,
        },
        year: {
            type: Number,
            required: [true, 'Year is required'],
            min: 2020,
            max: 2100,
        },
        reportText: {
            type: String, // Full markdown report from AI
        },
        // Existing fields for backward compatibility or structured data
        summary: {
            type: String,
        },
        riskLevel: {
            type: String,
            enum: ['Low', 'Medium', 'High'],
        },
        recommendations: {
            type: [String],
            default: [],
        },
        // Global Report specific fields
        totalBudget: Number,
        totalSpent: Number,
        departmentsSnapshot: [{
            departmentName: String,
            allocatedBudget: Number,
            totalSpent: Number,
            percentageUsed: Number,
            status: String
        }],
        // Department Report specific
        dataSnapshot: {
            allocatedBudget: Number,
            totalSpent: Number,
            remainingBudget: Number,
            percentageUsed: Number,
            previousMonthSpent: Number,
            monthOverMonthChange: Number,
        },
        generatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            // System generated reports might not have a user
            required: false,
        },
    },
    {
        timestamps: true,
    }
);

// Compound index for unique report per type/department/month/year
// For global reports, departmentId is null, so uniqueness is on type+month+year.
aiReportSchema.index({ type: 1, departmentId: 1, month: 1, year: 1 }, { unique: true });

const AIReport = mongoose.model('AIReport', aiReportSchema);

export default AIReport;
