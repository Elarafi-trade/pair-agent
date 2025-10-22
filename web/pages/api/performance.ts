import type { NextApiRequest, NextApiResponse } from 'next';
import { readFile } from 'fs/promises';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Read performance.json from the backend root
    const performancePath = path.resolve(process.cwd(), '..', 'performance.json');
    const data = await readFile(performancePath, 'utf-8');
    const metrics = JSON.parse(data);
    
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(metrics);
  } catch (err) {
    // Return default/empty metrics if not found
    res.status(200).json({
      totalTrades: 0,
      winningTrades: 0,
      losingTrades: 0,
      winRate: 0,
      totalReturnWithLeverage: 0,
      totalReturnWithoutLeverage: 0,
      apy: 0,
      avgTradesPerDay: 0,
      avgReturnsPerDay: 0,
      profitFactor: 0,
      avgDuration: 0,
      startDate: Date.now(),
      lastUpdated: Date.now(),
    });
  }
}
