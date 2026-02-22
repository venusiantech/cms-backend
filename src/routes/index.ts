import { Router } from 'express';
import authRoutes from '../auth/auth.routes';
import usersRoutes from '../users/users.routes';
import domainsRoutes from '../domains/domains.routes';
import websitesRoutes from '../websites/websites.routes';
import contentRoutes from '../content/content.routes';
import leadsRoutes from '../leads/leads.routes';
import aiPromptsRoutes from '../ai-prompts/ai-prompts.routes';
import publicRoutes from '../public/public.routes';
import adminRoutes from '../admin/index.routes';

const router = Router();

// Public routes (no authentication)
router.use('/public', publicRoutes);

// Authentication routes
router.use('/auth', authRoutes);

// Admin Portal routes (SUPER_ADMIN only) - all under /api/admin
router.use('/admin', adminRoutes);

// Protected routes (require authentication) - used by user portal
router.use('/users', usersRoutes);
router.use('/domains', domainsRoutes);
router.use('/websites', websitesRoutes);
router.use('/content-blocks', contentRoutes);
router.use('/leads', leadsRoutes);
router.use('/ai-prompts', aiPromptsRoutes);

export default router;
