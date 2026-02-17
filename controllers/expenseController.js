import Expense from '../models/Expense.js';
import Department from '../models/Department.js';
import { body, validationResult } from 'express-validator';

import { scheduleReportGeneration } from '../services/reportService.js';

/**
 * @desc    Create new expense
 * @route   POST /api/expenses
 * @access  Private
 */
export const createExpense = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array(),
            });
        }

        const { departmentId, amount, category, description, date } = req.body;

        // Verify department exists
        const department = await Department.findById(departmentId);
        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found',
            });
        }

        // If user is department head, verify they can only add expenses to their department
        if (req.user.role === 'department_head') {
            if (req.user.departmentId.toString() !== departmentId) {
                return res.status(403).json({
                    success: false,
                    message: 'You can only add expenses to your own department',
                });
            }
        }

        const expenseDate = date ? new Date(date) : new Date();
        const expense = await Expense.create({
            departmentId,
            amount,
            category,
            description,
            date: expenseDate,
            createdBy: req.user.id,
        });

        // Trigger AI Report Generation (Async)
        const reportMonth = expenseDate.getMonth() + 1;
        const reportYear = expenseDate.getFullYear();
        scheduleReportGeneration(reportMonth, reportYear);

        await expense.populate('departmentId', 'name');
        await expense.populate('createdBy', 'name email');

        res.status(201).json({
            success: true,
            message: 'Expense created successfully',
            data: expense,
        });
    } catch (error) {
        console.error('Create Expense Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
};

/**
 * @desc    Get all expenses
 * @route   GET /api/expenses
 * @access  Private
 */
export const getAllExpenses = async (req, res) => {
    try {
        const { departmentId, month, year, category, startDate, endDate } = req.query;

        const filter = {};

        // Role-based filtering
        if (req.user.role === 'department_head') {
            filter.departmentId = req.user.departmentId;
        } else if (departmentId) {
            filter.departmentId = departmentId;
        }

        // Category filter
        if (category) {
            filter.category = category;
        }

        // Date filters
        if (month && year) {
            const start = new Date(year, month - 1, 1);
            const end = new Date(year, month, 0, 23, 59, 59);
            filter.date = { $gte: start, $lte: end };
        } else if (startDate && endDate) {
            filter.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }

        const expenses = await Expense.find(filter)
            .populate('departmentId', 'name allocatedBudget')
            .populate('createdBy', 'name email')
            .sort({ date: -1 });

        res.status(200).json({
            success: true,
            count: expenses.length,
            data: expenses,
        });
    } catch (error) {
        console.error('Get Expenses Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
};

/**
 * @desc    Get single expense
 * @route   GET /api/expenses/:id
 * @access  Private
 */
export const getExpenseById = async (req, res) => {
    try {
        const expense = await Expense.findById(req.params.id)
            .populate('departmentId', 'name allocatedBudget')
            .populate('createdBy', 'name email');

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found',
            });
        }

        // Department heads can only view their own department's expenses
        if (req.user.role === 'department_head') {
            if (expense.departmentId._id.toString() !== req.user.departmentId.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied',
                });
            }
        }

        res.status(200).json({
            success: true,
            data: expense,
        });
    } catch (error) {
        console.error('Get Expense Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
};

/**
 * @desc    Update expense
 * @route   PUT /api/expenses/:id
 * @access  Private
 */
export const updateExpense = async (req, res) => {
    try {
        const { amount, category, description, date } = req.body;

        const expense = await Expense.findById(req.params.id);

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found',
            });
        }

        // Department heads can only update their own department's expenses
        if (req.user.role === 'department_head') {
            if (expense.departmentId.toString() !== req.user.departmentId.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied',
                });
            }
        }

        expense.amount = amount || expense.amount;
        expense.category = category || expense.category;
        expense.description = description !== undefined ? description : expense.description;
        expense.date = date || expense.date;

        await expense.save();

        // Trigger AI Report Generation (Async)
        const expenseDate = new Date(expense.date);
        const reportMonth = expenseDate.getMonth() + 1;
        const reportYear = expenseDate.getFullYear();
        scheduleReportGeneration(reportMonth, reportYear);

        await expense.populate('departmentId', 'name');
        await expense.populate('createdBy', 'name email');

        res.status(200).json({
            success: true,
            message: 'Expense updated successfully',
            data: expense,
        });
    } catch (error) {
        console.error('Update Expense Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
};

/**
 * @desc    Delete expense
 * @route   DELETE /api/expenses/:id
 * @access  Private
 */
export const deleteExpense = async (req, res) => {
    try {
        const expense = await Expense.findById(req.params.id);

        if (!expense) {
            return res.status(404).json({
                success: false,
                message: 'Expense not found',
            });
        }

        // Department heads can only delete their own department's expenses
        if (req.user.role === 'department_head') {
            if (expense.departmentId.toString() !== req.user.departmentId.toString()) {
                return res.status(403).json({
                    success: false,
                    message: 'Access denied',
                });
            }
        }

        await expense.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Expense deleted successfully',
        });
    } catch (error) {
        console.error('Delete Expense Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
};

/**
 * @desc    Export expenses to CSV
 * @route   GET /api/expenses/export/csv
 * @access  Private/Admin
 */
export const exportExpenses = async (req, res) => {
    try {
        const { departmentId, month, year } = req.query;

        const filter = {};
        if (departmentId) filter.departmentId = departmentId;

        if (month && year) {
            const start = new Date(year, month - 1, 1);
            const end = new Date(year, month, 0, 23, 59, 59);
            filter.date = { $gte: start, $lte: end };
        }

        const expenses = await Expense.find(filter)
            .populate('departmentId', 'name')
            .populate('createdBy', 'name email')
            .sort({ date: -1 });

        // Create CSV
        let csv = 'Date,Department,Category,Amount,Description,Created By\n';

        expenses.forEach((expense) => {
            const date = new Date(expense.date).toLocaleDateString();
            const department = expense.departmentId.name;
            const category = expense.category;
            const amount = expense.amount;
            const description = (expense.description || '').replace(/,/g, ';');
            const createdBy = expense.createdBy.name;

            csv += `${date},${department},${category},${amount},"${description}",${createdBy}\n`;
        });

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=expenses.csv');
        res.status(200).send(csv);
    } catch (error) {
        console.error('Export Expenses Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
};

// Validation rules
export const expenseValidation = [
    body('departmentId').notEmpty().withMessage('Department is required'),
    body('amount').isNumeric().withMessage('Amount must be a number').isFloat({ min: 0 }).withMessage('Amount cannot be negative'),
    body('category').notEmpty().withMessage('Category is required'),
];
