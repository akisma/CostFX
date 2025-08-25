import express from 'express';

const router = express.Router();

// Placeholder routes - implement these based on your needs
router.get('/', (req, res) => {
  res.json({ message: 'Ingredients endpoint' });
});

router.post('/', (req, res) => {
  res.json({ message: 'Create ingredient' });
});

router.get('/:id', (req, res) => {
  res.json({ message: `Get ingredient ${req.params.id}` });
});

export default router;