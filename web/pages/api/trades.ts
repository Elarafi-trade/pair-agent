import type { NextApiRequest, NextApiResponse } from 'next';
import { readFile } from 'fs/promises';
import path from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Read trades.json from the backend root
    const tradesPath = path.resolve(process.cwd(), '..', 'trades.json');
    const data = await readFile(tradesPath, 'utf-8');
    const parsed = JSON.parse(data);
    // Enrich records to avoid N/A in UI for legacy entries
    const enriched = Array.isArray(parsed)
      ? parsed.map((t: any) => {
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
        })
      : [];
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(enriched);
  } catch (err) {
    res.status(200).json([]); // Return empty array if not found
  }
}
