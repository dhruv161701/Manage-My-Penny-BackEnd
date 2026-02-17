import Department from '../models/Department.js';
import Expense from '../models/Expense.js';
import { body, validationResult } from 'express-validator';
import { calculateDepartmentSpending } from '../services/analyticsService.js';
import { scheduleReportGeneration } from '../services/reportService.js';

/**
 * @desc    Create new department
 * @route   POST /api/departments
 * @access  Private/Admin
 */
export const createDepartment = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: errors.array(),
            });
        }

        const { name, description, head, allocatedBudget, status, month, year } = req.body;

        const department = await Department.create({
            name,
            description,
            head,
            allocatedBudget: allocatedBudget || 0,
            status: status || 'Active',
            month,
            year,
            createdBy: req.user?.id,
        });

        res.status(201).json({
            success: true,
            message: 'Department created successfully',
            data: department,
        });
    } catch (error) {
        console.error('Create Department Error:', error);

        // Handle duplicate key error
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Department with this name already exists',
            });
        }

        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
};

/**
 * @desc    Get all departments
 * @route   GET /api/departments
 * @access  Private
 */
export const getAllDepartments = async (req, res) => {
    try {
        const { month, year } = req.query;

        const filter = {};
        if (month) filter.month = parseInt(month);
        if (year) filter.year = parseInt(year);

        const departments = await Department.find(filter)
            .populate('createdBy', 'name email')
            .lean()
            .sort({ createdAt: -1 });

        // Calculate spending for each department
        const departmentsWithSpending = await Promise.all(
            departments.map(async (dept) => {
                const totalSpent = await calculateDepartmentSpending(dept._id, dept.month, dept.year);
                const remaining = dept.allocatedBudget - totalSpent;
                const percentageUsed = (totalSpent / dept.allocatedBudget) * 100;

                return {
                    ...dept,
                    totalSpent,
                    spentBudget: totalSpent,
                    remaining,
                    percentageUsed: parseFloat(percentageUsed.toFixed(2)),
                };
            })
        );

        res.status(200).json({
            success: true,
            count: departmentsWithSpending.length,
            data: departmentsWithSpending,
        });
    } catch (error) {
        console.error('Get Departments Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
};

/**
 * @desc    Get single department
 * @route   GET /api/departments/:id
 * @access  Private
 */
export const getDepartmentById = async (req, res) => {
    try {
        const department = await Department.findById(req.params.id)
            .populate('createdBy', 'name email')
            .lean();

        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found',
            });
        }

        // Calculate spending
        const totalSpent = await calculateDepartmentSpending(department._id, department.month, department.year);
        const remaining = department.allocatedBudget - totalSpent;
        const percentageUsed = (totalSpent / department.allocatedBudget) * 100;

        res.status(200).json({
            success: true,
            data: {
                ...department,
                totalSpent,
                spentBudget: totalSpent,
                remaining,
                percentageUsed: parseFloat(percentageUsed.toFixed(2)),
            },
        });
    } catch (error) {
        console.error('Get Department Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
};

/**
 * @desc    Update department
 * @route   PUT /api/departments/:id
 * @access  Private/Admin
 */
export const updateDepartment = async (req, res) => {
    try {
        const { name, description, head, allocatedBudget, status, month, year } = req.body;

        const department = await Department.findById(req.params.id);

        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found',
            });
        }

        if (name) department.name = name;
        if (description !== undefined) department.description = description;
        if (head !== undefined) department.head = head;
        if (allocatedBudget !== undefined) department.allocatedBudget = allocatedBudget;
        if (status) department.status = status;
        if (month) department.month = month;
        if (year) department.year = year;

        await department.save();

        // Trigger AI Report Generation (Async)
        const reportMonth = department.month || new Date().getMonth() + 1;
        const reportYear = department.year || new Date().getFullYear();
        scheduleReportGeneration(reportMonth, reportYear);

        res.status(200).json({
            success: true,
            message: 'Department updated successfully',
            data: department,
        });
    } catch (error) {
        console.error('Update Department Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
};

/**
 * @desc    Add budget to department
 * @route   PUT /api/departments/:id/add-budget
 * @access  Private/Admin
 */
export const addBudget = async (req, res) => {
    try {
        const { amount } = req.body;

        if (!amount || amount <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid amount greater than 0',
            });
        }

        const department = await Department.findById(req.params.id);

        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found',
            });
        }

        // Add to existing budget
        department.allocatedBudget += parseFloat(amount);

        await department.save();

        // Trigger AI Report Generation (Async)
        // Use department's month/year if available, else current date
        const reportMonth = department.month || new Date().getMonth() + 1;
        const reportYear = department.year || new Date().getFullYear();
        scheduleReportGeneration(reportMonth, reportYear);

        res.status(200).json({
            success: true,
            message: `Successfully added ${amount} to department budget`,
            data: department,
        });
    } catch (error) {
        console.error('Add Budget Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
};

/**
 * @desc    Delete department
 * @route   DELETE /api/departments/:id
 * @access  Private/Admin
 */
export const deleteDepartment = async (req, res) => {
    try {
        const department = await Department.findById(req.params.id);

        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found',
            });
        }

        // Check if there are expenses associated
        const expenseCount = await Expense.countDocuments({ departmentId: department._id });

        if (expenseCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete department. It has ${expenseCount} associated expenses.`,
            });
        }

        await department.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Department deleted successfully',
        });
    } catch (error) {
        console.error('Delete Department Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
};

// Validation rules
export const departmentValidation = [
    body('name').trim().notEmpty().withMessage('Department name is required'),
    body('allocatedBudget').optional().isNumeric().withMessage('Allocated budget must be a number').isFloat({ min: 0 }).withMessage('Budget cannot be negative'),
];
