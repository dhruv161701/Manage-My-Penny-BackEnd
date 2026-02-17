import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Department name is required'],
            trim: true,
        },
        description: {
            type: String,
            trim: true,
            default: '',
        },
        head: {
            type: String,
            trim: true,
            default: '',
        },
        allocatedBudget: {
            type: Number,
            required: [true, 'Allocated budget is required'],
            min: [0, 'Budget cannot be negative'],
            default: 0,
        },
        spentBudget: {
            type: Number,
            min: [0, 'Spent budget cannot be negative'],
            default: 0,
        },
        status: {
            type: String,
            enum: ['Active', 'Inactive'],
            default: 'Active',
        },
        month: {
            type: Number,
            min: 1,
            max: 12,
        },
        year: {
            type: Number,
            min: 2020,
            max: 2100,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
        },
    },
    {
        timestamps: true,
    }
);

// Virtual for remaining budget
departmentSchema.virtual('remainingBudget').get(function () {
    return this.allocatedBudget - this.spentBudget;
});

// Virtual for usage percentage
departmentSchema.virtual('usagePercentage').get(function () {
    if (this.allocatedBudget === 0) return 0;
    return Math.round((this.spentBudget / this.allocatedBudget) * 100);
});

// Ensure virtuals are included in JSON
departmentSchema.set('toJSON', { virtuals: true });
departmentSchema.set('toObject', { virtuals: true });

const Department = mongoose.model('Department', departmentSchema);

export default Department;
