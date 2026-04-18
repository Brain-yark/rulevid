import { Router } from 'express';
import { billingService } from '../services/billingService';
import { requireAuth } from '../middleware/authMiddleware';

const router = Router();

router.use(requireAuth);

router.get('/balance', async (req, res) => {
  try {
    const userId = (req as any).user.userId;
    const balance = await billingService.getWalletBalance(userId);
    res.json(balance);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

router.post('/topup', async (req, res) => {
  // Simplified for now, just a redirect to Stripe demo or success
  res.json({
    checkout_url: 'https://checkout.stripe.com/pay/demo_session',
    message: 'Stripe integration will be completed once credentials are provided'
  });
});

export default router;
