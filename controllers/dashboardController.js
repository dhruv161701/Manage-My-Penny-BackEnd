import {
    calculateTotalBudget,
    calculateTotalSpent,
    getDepartmentBreakdown,
    getMonthlyTrend,
    calculateDepartmentSpending,
} from '../services/analyticsService.js';
import Department from '../models/Department.js';
import AIReport from '../models/AIReport.js';

/**
 * @desc    Get admin dashboard data
 * @route   GET /api/dashboard/admin
 * @access  Private/Admin
 */
export const getAdminDashboard = async (req, res) => {
    try {
        const currentDate = new Date();
        const currentMonth = req.query.month ? parseInt(req.query.month) : currentDate.getMonth() + 1;
        const currentYear = req.query.year ? parseInt(req.query.year) : currentDate.getFullYear();

        // Calculate totals
        const totalBudget = await calculateTotalBudget(currentMonth, currentYear);
        const totalSpent = await calculateTotalSpent(currentMonth, currentYear);
        const remainingBudget = totalBudget - totalSpent;
        const percentageUsed = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

        // Get department breakdown
        const departmentBreakdown = await getDepartmentBreakdown(currentMonth, currentYear);

        // Get monthly trend (last 6 months)
        const monthlyTrend = await getMonthlyTrend(null, currentYear, 6);

        // Get risk summary
        const highRiskDepartments = departmentBreakdown.filter(dept => dept.percentageUsed > 90).length;
        const mediumRiskDepartments = departmentBreakdown.filter(dept => dept.percentageUsed > 75 && dept.percentageUsed <= 90).length;
        const lowRiskDepartments = departmentBreakdown.filter(dept => dept.percentageUsed <= 75).length;

        // Get recent AI reports
        const recentReports = await AIReport.find({ month: currentMonth, year: currentYear })
            .populate('departmentId', 'name')
            .sort({ createdAt: -1 })
            .limit(5);

        res.status(200).json({
            success: true,
            data: {
                summary: {
                    totalBudget,
                    totalSpent,
                    remainingBudget,
                    percentageUsed: parseFloat(percentageUsed.toFixed(2)),
                },
                riskSummary: {
                    high: highRiskDepartments,
                    medium: mediumRiskDepartments,
                    low: lowRiskDepartments,
                },
                departmentBreakdown,
                monthlyTrend,
                recentReports,
                period: {
                    month: currentMonth,
                    year: currentYear,
                },
            },
        });
    } catch (error) {
        console.error('Admin Dashboard Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
};

/**
 * @desc    Get department head dashboard data
 * @route   GET /api/dashboard/department
 * @access  Private/DepartmentHead
 */
export const getDepartmentDashboard = async (req, res) => {
    try {
        const departmentId = req.user.departmentId;

        if (!departmentId) {
            return res.status(400).json({
                success: false,
                message: 'Department not assigned to user',
            });
        }

        const currentDate = new Date();
        const currentMonth = req.query.month ? parseInt(req.query.month) : currentDate.getMonth() + 1;
        const currentYear = req.query.year ? parseInt(req.query.year) : currentDate.getFullYear();

        // Get department details - first try with month/year, then without
        let department = await Department.findOne({
            _id: departmentId,
            month: currentMonth,
            year: currentYear,
        });

        // If no period-specific department found, get the general department
        if (!department) {
            department = await Department.findById(departmentId);
        }

        if (!department) {
            return res.status(404).json({
                success: false,
                message: 'Department not found',
            });
        }

        // Calculate spending
        const totalSpent = await calculateDepartmentSpending(departmentId, currentMonth, currentYear);
        const remainingBudget = department.allocatedBudget - totalSpent;
        const percentageUsed = (totalSpent / department.allocatedBudget) * 100;

        // Get monthly trend (last 6 months)
        const monthlyTrend = await getMonthlyTrend(departmentId, currentYear, 6);

        // Get latest AI report
        const latestReport = await AIReport.findOne({
            departmentId,
            month: currentMonth,
            year: currentYear,
        }).sort({ createdAt: -1 });

        // Determine warning level
        let warningLevel = 'normal';
        if (percentageUsed > 100) {
            warningLevel = 'danger';
        } else if (percentageUsed > 90) {
            warningLevel = 'warning';
        }

        res.status(200).json({
            success: true,
            data: {
                department: {
                    id: department._id,
                    name: department.name,
                    allocatedBudget: department.allocatedBudget,
                    totalSpent,
                    remainingBudget,
                    percentageUsed: parseFloat(percentageUsed.toFixed(2)),
                    warningLevel,
                },
                monthlyTrend,
                latestReport,
                period: {
                    month: currentMonth,
                    year: currentYear,
                },
            },
        });
    } catch (error) {
        console.error('Department Dashboard Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error',
            error: error.message,
        });
    }
};
