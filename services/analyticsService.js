import Department from '../models/Department.js';
import Expense from '../models/Expense.js';

/**
 * Calculate total budget allocated across all departments
 */
export const calculateTotalBudget = async (month, year) => {
    // First try to find departments with specific month/year
    let departments = await Department.find({ month, year });

    // If no period-specific departments found, get all departments
    if (departments.length === 0) {
        departments = await Department.find({});
    }

    return departments.reduce((sum, dept) => sum + dept.allocatedBudget, 0);
};

/**
 * Calculate total spent across all departments
 */
export const calculateTotalSpent = async (month, year) => {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const expenses = await Expense.find({
        date: { $gte: startDate, $lte: endDate },
    });

    return expenses.reduce((sum, expense) => sum + expense.amount, 0);
};

/**
 * Calculate spending for a specific department
 */
export const calculateDepartmentSpending = async (departmentId, month, year) => {
    const filter = { departmentId };

    if (month && year) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);
        filter.date = { $gte: startDate, $lte: endDate };
    }

    const expenses = await Expense.find(filter);

    return expenses.reduce((sum, expense) => sum + expense.amount, 0);
};

/**
 * Get expense breakdown by category
 */
export const getExpenseBreakdown = async (departmentId, month, year) => {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const breakdown = await Expense.aggregate([
        {
            $match: {
                departmentId,
                date: { $gte: startDate, $lte: endDate },
            },
        },
        {
            $group: {
                _id: '$category',
                total: { $sum: '$amount' },
                count: { $sum: 1 },
            },
        },
        {
            $project: {
                category: '$_id',
                total: 1,
                count: 1,
                _id: 0,
            },
        },
        {
            $sort: { total: -1 },
        },
    ]);

    return breakdown;
};

/**
 * Get department-wise spending breakdown
 */
export const getDepartmentBreakdown = async (month, year) => {
    // First try to find departments with specific month/year
    let departments = await Department.find({ month, year }).populate('createdBy', 'name email');

    // If no period-specific departments found, get all departments
    if (departments.length === 0) {
        departments = await Department.find({}).populate('createdBy', 'name email');
    }

    const breakdown = await Promise.all(
        departments.map(async (dept) => {
            const totalSpent = await calculateDepartmentSpending(dept._id, month, year);
            const remaining = dept.allocatedBudget - totalSpent;
            const percentageUsed = dept.allocatedBudget > 0 ? (totalSpent / dept.allocatedBudget) * 100 : 0;

            return {
                departmentId: dept._id,
                departmentName: dept.name,
                allocatedBudget: dept.allocatedBudget,
                totalSpent,
                remaining,
                percentageUsed,
            };
        })
    );

    return breakdown;
};

/**
 * Get monthly spending trend
 */
export const getMonthlyTrend = async (departmentId, year, numberOfMonths = 6) => {
    const trends = [];
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;

    for (let i = numberOfMonths - 1; i >= 0; i--) {
        let month = currentMonth - i;
        let yearAdjusted = year;

        if (month <= 0) {
            month += 12;
            yearAdjusted -= 1;
        }

        const spent = departmentId
            ? await calculateDepartmentSpending(departmentId, month, yearAdjusted)
            : await calculateTotalSpent(month, yearAdjusted);

        trends.push({
            month,
            year: yearAdjusted,
            monthName: new Date(yearAdjusted, month - 1).toLocaleString('default', { month: 'short' }),
            spent,
        });
    }

    return trends;
};
