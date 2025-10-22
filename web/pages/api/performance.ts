import type { NextApiRequest, NextApiResponse } from 'next';
import { getPerformanceMetrics, initializeTables } from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Initialize tables if needed
    await initializeTables();
    
    // Fetch latest performance metrics from database
    const metrics = await getPerformanceMetrics();
    
    if (!metrics) {
      // Return default/empty metrics if not found
      return res.status(200).json({
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
    
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(metrics);
  } catch (err) {
    console.error('Error fetching performance:', err);
    // Return default/empty metrics if error
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
