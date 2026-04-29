import { Router, Request, Response } from 'express';
export const router = Router();
const myHandler = async (req: Request, res: Response) => {
    return res.json({ ok: true });
};
router.post('/test', myHandler);
