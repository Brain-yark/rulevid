import { Request, Response, NextFunction } from 'express';
import { billingService } from '../services/billingService';

export const checkBalance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user.userId;
    
    // Fetch balance from Lago (or mock)
    const wallet = await billingService.getWalletBalance(userId);
    
    // Minimum $5 required to start a session as per blueprint
    if (wallet.balance < 5) {
      return res.status(402).json({
        error: 'Insufficient balance',
        message: `Your wallet balance is $${wallet.balance.toFixed(2)}. Minimum $5.00 required to start a session.`,
        currentBalance: wallet.balance
      });
    }
    
    (req as any).walletBalance = wallet.balance;
    next();
  } catch (error) {
    console.error('Balance check middleware error:', error);
    // On error, we might want to allow it or block it. 
    // Usually safer to block or fail open depending on business logic.
    // For now, let's allow it but log the error.
    next();
  }
};
