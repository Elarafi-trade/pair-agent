// Copilot: Randomly select market pairs from Drift Protocol for pair-trading analysis
import { hasTwapHistory } from './fetcher.js';

/**
 * Interface for Drift market info
 */
interface DriftMarket {
  marketIndex: number;
  symbol: string;
  baseAssetSymbol: string;
  marketType: 'perp' | 'spot';
}

/**
 * Fetch all available perpetual markets from Drift Protocol
 * Uses a hardcoded list of common perp markets since Drift doesn't expose a markets list endpoint
 * @returns Array of perpetual market information
 */
let cachedMarkets: DriftMarket[] | null = null;

async function fetchAvailablePerpMarkets(): Promise<DriftMarket[]> {
  // Drift Protocol doesn't have a /markets endpoint in their REST API
  // Use a curated list of active perpetual markets
  // Based on https://app.drift.trade and SDK constants
  const perpMarkets: DriftMarket[] = [
    { marketIndex: 0, symbol: 'SOL-PERP', baseAssetSymbol: 'SOL', marketType: 'perp' },
    { marketIndex: 1, symbol: 'BTC-PERP', baseAssetSymbol: 'BTC', marketType: 'perp' },
    { marketIndex: 2, symbol: 'ETH-PERP', baseAssetSymbol: 'ETH', marketType: 'perp' },
    { marketIndex: 3, symbol: '1MPEPE-PERP', baseAssetSymbol: '1MPEPE', marketType: 'perp' },
    { marketIndex: 4, symbol: 'MATIC-PERP', baseAssetSymbol: 'MATIC', marketType: 'perp' },
    { marketIndex: 5, symbol: 'ARB-PERP', baseAssetSymbol: 'ARB', marketType: 'perp' },
    { marketIndex: 6, symbol: 'DOGE-PERP', baseAssetSymbol: 'DOGE', marketType: 'perp' },
    { marketIndex: 7, symbol: 'BNB-PERP', baseAssetSymbol: 'BNB', marketType: 'perp' },
    { marketIndex: 8, symbol: 'SUI-PERP', baseAssetSymbol: 'SUI', marketType: 'perp' },
    { marketIndex: 9, symbol: 'OP-PERP', baseAssetSymbol: 'OP', marketType: 'perp' },
    { marketIndex: 10, symbol: 'APT-PERP', baseAssetSymbol: 'APT', marketType: 'perp' },
    { marketIndex: 11, symbol: 'LDO-PERP', baseAssetSymbol: 'LDO', marketType: 'perp' },
    { marketIndex: 12, symbol: 'BLUR-PERP', baseAssetSymbol: 'BLUR', marketType: 'perp' },
    { marketIndex: 13, symbol: 'XRP-PERP', baseAssetSymbol: 'XRP', marketType: 'perp' },
    { marketIndex: 14, symbol: 'JTO-PERP', baseAssetSymbol: 'JTO', marketType: 'perp' },
    { marketIndex: 15, symbol: 'SEI-PERP', baseAssetSymbol: 'SEI', marketType: 'perp' },
    { marketIndex: 16, symbol: 'PYTH-PERP', baseAssetSymbol: 'PYTH', marketType: 'perp' },
    { marketIndex: 17, symbol: 'TIA-PERP', baseAssetSymbol: 'TIA', marketType: 'perp' },
    { marketIndex: 18, symbol: 'JUP-PERP', baseAssetSymbol: 'JUP', marketType: 'perp' },
    { marketIndex: 19, symbol: 'DYM-PERP', baseAssetSymbol: 'DYM', marketType: 'perp' },
    { marketIndex: 20, symbol: 'STRK-PERP', baseAssetSymbol: 'STRK', marketType: 'perp' },
    { marketIndex: 21, symbol: 'W-PERP', baseAssetSymbol: 'W', marketType: 'perp' },
    { marketIndex: 22, symbol: 'WIF-PERP', baseAssetSymbol: 'WIF', marketType: 'perp' },
    { marketIndex: 23, symbol: 'TNSR-PERP', baseAssetSymbol: 'TNSR', marketType: 'perp' },
    { marketIndex: 24, symbol: 'AEVO-PERP', baseAssetSymbol: 'AEVO', marketType: 'perp' },
  ];

  // Prefilter by TWAP availability once and cache
  if (!cachedMarkets) {
    console.log(`[PAIR_SELECTOR] Loaded ${perpMarkets.length} perpetual markets for Drift Protocol`);
    console.log(`[PAIR_SELECTOR] Validating TWAP availability for markets...`);
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
 * Symbol-to-market-index lookup table
 */
const SYMBOL_TO_INDEX: Record<string, number> = {
  'SOL-PERP': 0,
  'BTC-PERP': 1,
  'ETH-PERP': 2,
  '1MPEPE-PERP': 3,
  'MATIC-PERP': 4,
  'ARB-PERP': 5,
  'DOGE-PERP': 6,
  'BNB-PERP': 7,
  'SUI-PERP': 8,
  'OP-PERP': 9,
  'APT-PERP': 10,
  'LDO-PERP': 11,
  'BLUR-PERP': 12,
  'XRP-PERP': 13,
  'JTO-PERP': 14,
  'SEI-PERP': 15,
  'PYTH-PERP': 16,
  'TIA-PERP': 17,
  'JUP-PERP': 18,
  'DYM-PERP': 19,
  'STRK-PERP': 20,
  'W-PERP': 21,
  'WIF-PERP': 22,
  'TNSR-PERP': 23,
  'AEVO-PERP': 24,
};

/**
 * Get market index for a given symbol
 * @param symbol - Market symbol (e.g., 'SOL-PERP')
 * @returns Market index or undefined if not found
 */
export function getMarketIndex(symbol: string): number | undefined {
  return SYMBOL_TO_INDEX[symbol];
}

/**
 * Get symbol for a given market index (reverse lookup)
 * @param marketIndex - Market index (e.g., 0 for SOL-PERP)
 * @returns Market symbol or undefined if not found
 */
export function getMarketSymbol(marketIndex: number): string | undefined {
  const INDEX_TO_SYMBOL: Record<number, string> = {
    0: 'SOL-PERP',
    1: 'BTC-PERP',
    2: 'ETH-PERP',
    3: '1MPEPE-PERP',
    4: 'MATIC-PERP',
    5: 'ARB-PERP',
    6: 'DOGE-PERP',
    7: 'BNB-PERP',
    8: 'SUI-PERP',
    9: 'OP-PERP',
    10: 'APT-PERP',
    11: 'LDO-PERP',
    12: 'BLUR-PERP',
    13: 'XRP-PERP',
    14: 'JTO-PERP',
    15: 'SEI-PERP',
    16: 'PYTH-PERP',
    17: 'TIA-PERP',
    18: 'JUP-PERP',
    19: 'INJ-PERP',
    20: 'RNDR-PERP',
    21: 'W-PERP',
    22: 'WIF-PERP',
    23: 'TNSR-PERP',
    24: 'AEVO-PERP',
  };
  return INDEX_TO_SYMBOL[marketIndex];
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
