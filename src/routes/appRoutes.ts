import { Router } from 'express';
import { getAppVersion, updateAppVersion } from '../controllers/appController';

const router = Router();

// Route publique pour vérifier la version
router.get('/version', getAppVersion);

// Route admin pour mettre à jour la version (TODO: ajouter middleware admin)
router.post('/version', updateAppVersion);

export default router;
