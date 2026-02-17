import express from 'express';
import {
    generateReport,
    getAllReports,
    getReportById,
    deleteReport,
    generateGlobalAI,
    reportValidation,
} from '../controllers/aiReportController.js';
import { verifyToken, isAdmin } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Global Analysis (admin only)
router.post('/analyze', isAdmin, generateGlobalAI);

// Generate report (admin only)
router.post('/generate', isAdmin, reportValidation, generateReport);

// Get reports (accessible to all authenticated users)
router.get('/', getAllReports);
router.get('/:id', getReportById);

// Delete report (admin only)
router.delete('/:id', isAdmin, deleteReport);

export default router;
