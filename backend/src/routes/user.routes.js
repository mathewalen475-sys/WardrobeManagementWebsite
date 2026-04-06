import { Router } from 'express';

const router = Router();

router.get('/user/profile', (req, res) => {
  const username = req.user?.email || req.user?.user_metadata?.username || null;
  const name = req.user?.user_metadata?.name || null;

  return res.status(200).json({
    username,
    name,
  });
});

export default router;
