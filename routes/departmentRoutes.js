import express from 'express';
import {
    createDepartment,
    getAllDepartments,
    getDepartmentById,
    updateDepartment,
    deleteDepartment,
    addBudget,
    departmentValidation,
} from '../controllers/departmentController.js';
import { verifyToken, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// Public routes (no authentication required) - for registration page
router.get('/', getAllDepartments);
router.get('/:id', getDepartmentById);

// Admin-only routes (authentication + admin role required)
router.post('/', verifyToken, isAdmin, departmentValidation, createDepartment);
router.put('/:id', verifyToken, isAdmin, updateDepartment);
router.put('/:id/add-budget', verifyToken, isAdmin, addBudget);
router.delete('/:id', verifyToken, isAdmin, deleteDepartment);

export default router;
