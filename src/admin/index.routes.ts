import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import usersRoutes from './users/users.routes';
import aiPromptsRoutes from './ai-prompts/ai-prompts.routes';
import websitesRoutes from './websites/websites.routes';
import domainsRoutes from './domains/domains.routes';
import leadsRoutes from './leads/leads.routes';
import statsRoutes from './stats/stats.routes';

const router = Router();

// All admin routes require authentication + SUPER_ADMIN role
router.use(authenticate, authorize('SUPER_ADMIN'));

router.use('/stats', statsRoutes);
router.use('/users', usersRoutes);
router.use('/ai-prompts', aiPromptsRoutes);
router.use('/websites', websitesRoutes);
router.use('/domains', domainsRoutes);
router.use('/leads', leadsRoutes);

export default router;
