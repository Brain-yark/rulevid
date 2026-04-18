import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoute';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/v1/auth', authRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`[Backend] Server listening on port ${PORT}`);
});
