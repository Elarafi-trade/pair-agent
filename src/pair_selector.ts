// Copilot: Randomly select market pairs from Drift Protocol for pair-trading analysis
import { hasTwapHistory } from './fetcher.js';
import { 
  fetchAllMarkets,
  getMarketIndexBySymbol as getIndexBySymbol,
  getMarketSymbolByIndex as getSymbolByIndex,
} from './market_cache.js';

/**
 * Interface for Drift market info (legacy compatibility)
 */
interface DriftMarket {
  marketIndex: number;
  symbol: string;
  baseAssetSymbol: string;
  marketType: 'perp' | 'spot';
}

/**
 * Fetch all available perpetual markets from Drift Protocol
 * Now uses dynamic API: https://data.api.drift.trade/stats/markets/prices
 * @returns Array of perpetual market information
 */
let cachedMarkets: DriftMarket[] | null = null;

async function fetchAvailablePerpMarkets(): Promise<DriftMarket[]> {
  // Use dynamic market cache from Data API
  const apiMarkets = await fetchAllMarkets();
  
  // Convert to legacy DriftMarket format for compatibility
  const perpMarkets: DriftMarket[] = apiMarkets.map(m => ({
    marketIndex: m.marketIndex,
    symbol: m.symbol,
    baseAssetSymbol: m.symbol.replace('-PERP', ''),
    marketType: 'perp' as const,
  }));
  
  console.log(`[PAIR_SELECTOR] Loaded ${perpMarkets.length} perpetual markets from API`);

  // Prefilter by TWAP availability once and cache
  if (!cachedMarkets) {
    const checks = await Promise.all(
      perpMarkets.map(async (m) => ({ m, ok: await hasTwapHistory(m.symbol, 50) }))
    );
    const valid = checks.filter((c) => c.ok).map((c) => c.m);
    const dropped = checks.filter((c) => !c.ok).map((c) => c.m.symbol);
    if (dropped.length) {
      console.warn(`[PAIR_SELECTOR] Excluding ${dropped.length} market(s) with insufficient TWAP data: ${dropped.join(', ')}`);
    }
    cachedMarkets = valid;
    console.log(`[PAIR_SELECTOR] ${cachedMarkets.length} market(s) available after validation`);
  }

  return cachedMarkets;
}

/**
 * Randomly select N unique markets from available perpetual markets
 * @param count - Number of markets to select
 * @returns Array of randomly selected markets
 */
async function selectRandomMarkets(count: number = 5): Promise<DriftMarket[]> {
  const allMarkets = await fetchAvailablePerpMarkets();

  // Shuffle and pick first N
  const shuffled = [...allMarkets].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Get market index for a given symbol (uses dynamic API cache)
 * @param symbol - Market symbol (e.g., 'SOL-PERP')
 * @returns Market index or undefined if not found
 */
export async function getMarketIndex(symbol: string): Promise<number | undefined> {
  return await getIndexBySymbol(symbol);
}

/**
 * Get symbol for a given market index (uses dynamic API cache)
 * @param marketIndex - Market index (e.g., 0 for SOL-PERP)
 * @returns Market symbol or undefined if not found
 */
export async function getMarketSymbol(marketIndex: number): Promise<string | undefined> {
  return await getSymbolByIndex(marketIndex);
}

/**
 * Generate random market pair combinations for pair trading
 * Picks 2*N random markets and pairs them for correlation analysis
 * @param pairCount - Number of pair combinations to generate
 * @returns Array of market pair combinations with indices and symbols
 */
export async function generateRandomPairCombinations(
  pairCount: number = 2
): Promise<Array<{
  marketIndexA: number;
  marketIndexB: number;
  symbolA: string;
  symbolB: string;
  description: string;
}>> {
  const selectedMarkets = await selectRandomMarkets(pairCount * 2);

  const pairs: Array<{
    marketIndexA: number;
    marketIndexB: number;
    symbolA: string;
    symbolB: string;
    description: string;
  }> = [];

  for (let i = 0; i < pairCount; i++) {
    const marketA = selectedMarkets[i * 2];
    const marketB = selectedMarkets[i * 2 + 1];

    if (marketA && marketB) {
      pairs.push({
        marketIndexA: marketA.marketIndex,
        marketIndexB: marketB.marketIndex,
        symbolA: marketA.symbol,
        symbolB: marketB.symbol,
        description: `Random pair: ${marketA.symbol}/${marketB.symbol}`,
      });
    }
  }

  console.log(`[PAIR_SELECTOR] Selected ${pairs.length} random market pairs for analysis`);
  pairs.forEach((p) => console.log(`  - ${p.symbolA} (${p.marketIndexA}) / ${p.symbolB} (${p.marketIndexB})`));

  return pairs;
}
