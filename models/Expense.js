import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema(
    {
        departmentId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Department',
            required: [true, 'Department is required'],
        },
        amount: {
            type: Number,
            required: [true, 'Amount is required'],
            min: [0, 'Amount cannot be negative'],
        },
        category: {
            type: String,
            required: [true, 'Category is required'],
            trim: true,
            enum: [
                'Salaries',
                'Office Supplies',
                'Marketing',
                'Travel',
                'Equipment',
                'Software',
                'Utilities',
                'Training',
                'Consulting',
                'Other',
            ],
        },
        description: {
            type: String,
            trim: true,
            maxlength: [500, 'Description cannot exceed 500 characters'],
        },
        date: {
            type: Date,
            required: [true, 'Date is required'],
            default: Date.now,
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
        },
    },
    {
        timestamps: true,
    }
);

// Index for faster queries
expenseSchema.index({ departmentId: 1, date: -1 });
expenseSchema.index({ createdBy: 1 });

const Expense = mongoose.model('Expense', expenseSchema);

export default Expense;
