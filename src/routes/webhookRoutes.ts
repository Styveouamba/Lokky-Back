import express from 'express';
import { handleNabooPayment } from '../controllers/webhookController';

const router = express.Router();

// Webhook route - no auth, signature verification instead
// Note: express.raw() middleware should be applied in app.ts for this route
router.post('/naboo-payment', handleNabooPayment);

export default router;
