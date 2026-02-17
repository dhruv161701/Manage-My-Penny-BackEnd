import express from 'express';
import { getAdminDashboard, getDepartmentDashboard } from '../controllers/dashboardController.js';
import { verifyToken, isAdmin, isDepartmentHead } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Admin dashboard
router.get('/admin', isAdmin, getAdminDashboard);

// Department head dashboard
router.get('/department', isDepartmentHead, getDepartmentDashboard);

export default router;
