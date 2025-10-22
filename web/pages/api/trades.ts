import type { NextApiRequest, NextApiResponse } from 'next';
import { getAllTrades, initializeTables } from '../../lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Initialize tables if needed
    await initializeTables();
    
    // Fetch all trades from database
    const trades = await getAllTrades();

    // Enrich records to avoid N/A in UI for legacy entries
    const enriched = trades.map((t: any) => {
      const isLong = t.action === 'long';
      const longPrice = t.longPrice ?? (isLong ? t.priceA : t.priceB);
      const shortPrice = t.shortPrice ?? (isLong ? t.priceB : t.priceA);
      const entryPriceA = t.entryPriceA ?? t.priceA;
      const entryPriceB = t.entryPriceB ?? t.priceB;
      const upnlPct = t.upnlPct ?? 0;
      const timeframe = t.timeframe ?? '1h';
      const engine = t.engine ?? 'SIM';
      const remarks = t.remarks ?? '-';
      const status = t.status ?? 'open';
      const correlation = t.correlation ?? 0;
      return { ...t, longPrice, shortPrice, entryPriceA, entryPriceB, upnlPct, timeframe, engine, remarks, status, correlation };
    });
    
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(enriched);
  } catch (err) {
    console.error('Error fetching trades:', err);
    res.status(200).json([]); // Return empty array if error
  }
}
