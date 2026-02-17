import AIReport from '../models/AIReport.js';
import Department from '../models/Department.js';
import Expense from '../models/Expense.js';
import { generateFinancialAnalysis, generateGlobalAnalysis } from '../services/aiService.js';
import {
    calculateDepartmentSpending,
    getExpenseBreakdown,
    calculateTotalBudget,
    calculateTotalSpent,
    getDepartmentBreakdown,
    getMonthlyTrend
} from '../services/analyticsService.js';
import { body, validationResult } from 'express-validator';

/**
 * @desc    Generate AI report for department
 * @route   POST /api/ai-reports/generate
 * @access  Private/Admin
 */
export const generateReport = async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array(),
            });
        }

        const { departmentId, month, year } = req.body;

        // Verify department exists
        const department = await Department.findById(departmentId);
        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found',
            });
        }

        // Check if report already exists
        const existingReport = await AIReport.findOne({ departmentId, month, year });
        if (existingReport) {
            return res.status(400).json({
                success: false,
                message: 'Report already exists for this department and period. Delete the existing report first.',
            });
        }

        // Calculate current month spending
        const totalSpent = await calculateDepartmentSpending(departmentId, month, year);
        const remainingBudget = department.allocatedBudget - totalSpent;
        const percentageUsed = (totalSpent / department.allocatedBudget) * 100;

        // Calculate previous month spending
        let prevMonth = month - 1;
        let prevYear = year;
        if (prevMonth === 0) {
            prevMonth = 12;
            prevYear -= 1;
        }
        const previousMonthSpent = await calculateDepartmentSpending(departmentId, prevMonth, prevYear);

        // Calculate month-over-month change
        const monthOverMonthChange = previousMonthSpent > 0
            ? ((totalSpent - previousMonthSpent) / previousMonthSpent) * 100
            : 0;

        // Get expense breakdown
        const expenseBreakdown = await getExpenseBreakdown(departmentId, month, year);

        // Prepare data for AI
        const departmentData = {
            departmentName: department.name,
            allocatedBudget: department.allocatedBudget,
            totalSpent,
            remainingBudget,
            percentageUsed,
            previousMonthSpent,
            monthOverMonthChange,
            month,
            year,
            expenseBreakdown,
        };

        // Generate AI analysis
        const aiResult = await generateFinancialAnalysis(departmentData);

        if (!aiResult.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to generate AI analysis',
                error: aiResult.error,
            });
        }

        // Create AI report
        const report = await AIReport.create({
            departmentId,
            month,
            year,
            summary: aiResult.data.summary,
            riskLevel: aiResult.data.riskLevel,
            recommendations: aiResult.data.recommendations,
            dataSnapshot: {
                allocatedBudget: department.allocatedBudget,
                totalSpent,
                remainingBudget,
                percentageUsed: parseFloat(percentageUsed.toFixed(2)),
                previousMonthSpent,
                monthOverMonthChange: parseFloat(monthOverMonthChange.toFixed(2)),
            },
            generatedBy: req.user.id,
        });

        await report.populate('departmentId', 'name');
        await report.populate('generatedBy', 'name email');

        res.status(201).json({
            success: true,
            message: 'AI report generated successfully',
            data: report,
        });
    } catch (error) {
        console.error('Generate Report Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
};

/**
 * @desc    Get all AI reports
 * @route   GET /api/ai-reports
 * @access  Private
 */
export const getAllReports = async (req, res) => {
    try {
        const { departmentId, month, year, type } = req.query;

        const filter = {};

        if (departmentId) {
            filter.departmentId = departmentId;
            filter.type = 'Department';
        } else {
            // Default to Global reports if no department specified
            filter.type = type || 'Global';
        }

        if (month) filter.month = parseInt(month);
        if (year) filter.year = parseInt(year);

        const reports = await AIReport.find(filter)
            .populate('departmentId', 'name allocatedBudget')
            .populate('generatedBy', 'name email')
            .sort({ year: -1, month: -1 });

        res.status(200).json({
            success: true,
            count: reports.length,
            data: reports,
        });
    } catch (error) {
        console.error('Get Reports Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
};

/**
 * @desc    Get single AI report
 * @route   GET /api/ai-reports/:id
 * @access  Private
 */
export const getReportById = async (req, res) => {
    try {
        const report = await AIReport.findById(req.params.id)
            .populate('departmentId', 'name allocatedBudget')
            .populate('generatedBy', 'name email');

        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Report not found',
            });
        }

        res.status(200).json({
            success: true,
            data: report,
        });
    } catch (error) {
        console.error('Get Report Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
};

/**
 * @desc    Delete AI report
 * @route   DELETE /api/ai-reports/:id
 * @access  Private/Admin
 */
export const deleteReport = async (req, res) => {
    try {
        const report = await AIReport.findById(req.params.id);

        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Report not found',
            });
        }

        await report.deleteOne();

        res.status(200).json({
            success: true,
            message: 'Report deleted successfully',
        });
    } catch (error) {
        console.error('Delete Report Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
};

/**
 * @desc    Generate Global AI Analysis
 * @route   POST /api/ai-reports/analyze
 * @access  Private/Admin
 */
export const generateGlobalAI = async (req, res) => {
    try {
        const { month, year } = req.body;

        if (!month || !year) {
            return res.status(400).json({
                success: false,
                message: 'Month and year are required'
            });
        }

        // 1. Calculate Totals
        const totalBudget = await calculateTotalBudget(month, year);
        const totalSpent = await calculateTotalSpent(month, year);
        const percentageUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

        // 2. Department Breakdown
        const departmentBreakdown = await getDepartmentBreakdown(month, year);

        // 3. Monthly Trends
        const monthlyTrend = await getMonthlyTrend(null, year, 6);

        // 4. Prepare Data for AI
        const globalData = {
            totalBudget,
            totalSpent,
            percentageUsed,
            departmentBreakdown,
            monthlyTrend,
            month,
            year
        };

        // 5. Call AI Service
        const aiResult = await generateGlobalAnalysis(globalData);

        if (!aiResult.success) {
            return res.status(500).json({
                success: false,
                message: 'Failed to generate AI analysis',
                error: aiResult.error
            });
        }

        res.status(200).json({
            success: true,
            data: aiResult.data
        });

    } catch (error) {
        console.error('Generate Global AI Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message
        });
    }
};

// Validation rules
export const reportValidation = [
    body('departmentId').notEmpty().withMessage('Department is required'),
    body('month').isInt({ min: 1, max: 12 }).withMessage('Month must be between 1 and 12'),
    body('year').isInt({ min: 2020, max: 2100 }).withMessage('Year must be between 2020 and 2100'),
];
