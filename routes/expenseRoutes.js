import express from 'express';
import {
    createExpense,
    getAllExpenses,
    getExpenseById,
    updateExpense,
    deleteExpense,
    exportExpenses,
    expenseValidation,
} from '../controllers/expenseController.js';
import { verifyToken, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Export route (admin only)
router.get('/export/csv', isAdmin, exportExpenses);

// CRUD routes
router.post('/', expenseValidation, createExpense);
router.get('/', getAllExpenses);
router.get('/:id', getExpenseById);
router.put('/:id', updateExpense);
router.delete('/:id', deleteExpense);

export default router;
