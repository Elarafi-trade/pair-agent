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

/**
 * Asset categories for intelligent pair grouping
 */
const ASSET_CATEGORIES = {
  MAJORS: ['BTC', 'ETH', 'SOL'],
  L1_L2: ['ARB', 'OP', 'MATIC', 'POL', 'AVAX', 'NEAR', 'FTM', 'ATOM', 'DOT', 'ADA'],
  DEFI: ['UNI', 'AAVE', 'SUSHI', 'COMP', 'CRV', 'MKR', 'SNX', 'LDO'],
  AI: ['RNDR', 'FET', 'AGIX', 'TAO', 'WLD'],
  MEME: ['DOGE', 'SHIB', 'WIF', 'BONK', 'PEPE', 'POPCAT', 'MEW'],
  GAMING: ['IMX', 'AXS', 'SAND', 'MANA', 'GALA'],
  ORACLE_DATA: ['LINK', 'GRT', 'API3', 'BAND'],
};

/**
 * Categorize a market symbol
 */
function categorizeAsset(symbol: string): string | null {
  const base = symbol.replace('-PERP', '');
  
  for (const [category, tokens] of Object.entries(ASSET_CATEGORIES)) {
    if (tokens.includes(base)) {
      return category;
    }
  }
  return null; // Uncategorized
}

/**
 * Calculate priority score for a market (lower = higher priority)
 */
function getMarketPriority(symbol: string): number {
  const base = symbol.replace('-PERP', '');
  
  if (ASSET_CATEGORIES.MAJORS.includes(base)) return 1;
  if (ASSET_CATEGORIES.L1_L2.includes(base)) return 2;
  if (ASSET_CATEGORIES.DEFI.includes(base)) return 3;
  if (ASSET_CATEGORIES.AI.includes(base)) return 4;
  if (ASSET_CATEGORIES.ORACLE_DATA.includes(base)) return 5;
  if (ASSET_CATEGORIES.MEME.includes(base)) return 6;
  if (ASSET_CATEGORIES.GAMING.includes(base)) return 7;
  
  return 10; // Unknown/low priority
}

/**
 * Generate smart pair combinations using sector-based grouping
 * Pairs assets within the same category for higher correlation probability
 * @param pairCount - Number of pair combinations to generate
 * @param excludedPairs - Set of already scanned pair keys (e.g., "ARB-PERP/OP-PERP") to avoid duplicates
 * @returns Array of intelligently paired market combinations
 */
export async function generateSmartPairCombinations(
  pairCount: number = 2,
  excludedPairs?: Set<string>
): Promise<Array<{
  marketIndexA: number;
  marketIndexB: number;
  symbolA: string;
  symbolB: string;
  description: string;
}>> {
  const allMarkets = await fetchAvailablePerpMarkets();
  const excluded = excludedPairs || new Set<string>();
  
  // Sort by priority (majors first, then alts)
  const sortedMarkets = allMarkets
    .sort((a, b) => getMarketPriority(a.symbol) - getMarketPriority(b.symbol));

  // Group markets by category (including uncategorized)
  const categorizedMarkets = new Map<string, DriftMarket[]>();
  const uncategorizedMarkets: DriftMarket[] = [];
  
  for (const market of sortedMarkets) {
    const category = categorizeAsset(market.symbol);
    if (category) {
      if (!categorizedMarkets.has(category)) {
        categorizedMarkets.set(category, []);
      }
      categorizedMarkets.get(category)!.push(market);
    } else {
      uncategorizedMarkets.push(market);
    }
  }
  
  // Debug: Log market distribution
  if (excluded.size === 0) {
    console.log(`[PAIR_SELECTOR] Market distribution:`);
    for (const [category, markets] of categorizedMarkets.entries()) {
      console.log(`  - ${category}: ${markets.length} markets`);
    }
    if (uncategorizedMarkets.length > 0) {
      console.log(`  - UNCATEGORIZED: ${uncategorizedMarkets.length} markets`);
    }
  }

  const pairs: Array<{
    marketIndexA: number;
    marketIndexB: number;
    symbolA: string;
    symbolB: string;
    description: string;
  }> = [];

  // Helper function to check if pair is excluded
  const isPairExcluded = (symbolA: string, symbolB: string): boolean => {
    const pairKey = [symbolA, symbolB].sort().join('/');
    return excluded.has(pairKey);
  };

  // Strategy 1: Pair within same category (70% of pairs)
  const sameCategory = Math.ceil(pairCount * 0.7);
  
  // Generate all possible same-category combinations
  const sameCategoryCandidates: Array<{
    marketA: DriftMarket;
    marketB: DriftMarket;
    category: string;
  }> = [];
  
  for (const [category, markets] of categorizedMarkets.entries()) {
    // Generate all unique pairs within this category
    for (let i = 0; i < markets.length; i++) {
      for (let j = i + 1; j < markets.length; j++) {
        const marketA = markets[i];
        const marketB = markets[j];
        
        // Skip if already scanned
        if (!isPairExcluded(marketA.symbol, marketB.symbol)) {
          sameCategoryCandidates.push({ marketA, marketB, category });
        }
      }
    }
  }
  
  // Shuffle and pick from available same-category candidates
  const shuffledSameCategory = sameCategoryCandidates.sort(() => Math.random() - 0.5);
  
  for (let i = 0; i < Math.min(sameCategory, shuffledSameCategory.length); i++) {
    const { marketA, marketB, category } = shuffledSameCategory[i];
    
    pairs.push({
      marketIndexA: marketA.marketIndex,
      marketIndexB: marketB.marketIndex,
      symbolA: marketA.symbol,
      symbolB: marketB.symbol,
      description: `${category} pair: ${marketA.symbol}/${marketB.symbol}`,
    });
  }

  // Strategy 2: Cross-category pairs (remaining to reach pairCount)
  const majorMarkets = categorizedMarkets.get('MAJORS') || [];
  const otherCategories = Array.from(categorizedMarkets.entries())
    .filter(([cat]) => cat !== 'MAJORS')
    .flatMap(([_, markets]) => markets);
  
  // Generate all possible cross-category combinations
  const crossCategoryCandidates: Array<{
    marketA: DriftMarket;
    marketB: DriftMarket;
  }> = [];
  
  for (const majorMarket of majorMarkets) {
    for (const otherMarket of otherCategories) {
      if (!isPairExcluded(majorMarket.symbol, otherMarket.symbol)) {
        crossCategoryCandidates.push({
          marketA: majorMarket,
          marketB: otherMarket,
        });
      }
    }
  }
  
  // Strategy 3: If still need more pairs, pair ALL remaining uncategorized markets
  for (let i = 0; i < uncategorizedMarkets.length; i++) {
    for (let j = i + 1; j < uncategorizedMarkets.length; j++) {
      const marketA = uncategorizedMarkets[i];
      const marketB = uncategorizedMarkets[j];
      
      if (!isPairExcluded(marketA.symbol, marketB.symbol)) {
        crossCategoryCandidates.push({
          marketA,
          marketB,
        });
      }
    }
  }
  
  // Strategy 4: Cross-pair uncategorized with categorized markets
  const allCategorizedMarkets = Array.from(categorizedMarkets.values()).flat();
  for (const uncatMarket of uncategorizedMarkets) {
    for (const catMarket of allCategorizedMarkets) {
      if (!isPairExcluded(uncatMarket.symbol, catMarket.symbol)) {
        crossCategoryCandidates.push({
          marketA: uncatMarket,
          marketB: catMarket,
        });
      }
    }
  }
  
  // Shuffle and pick remaining needed pairs
  const shuffledCrossCategory = crossCategoryCandidates.sort(() => Math.random() - 0.5);
  const neededPairs = pairCount - pairs.length;
  
  for (let i = 0; i < Math.min(neededPairs, shuffledCrossCategory.length); i++) {
    const { marketA, marketB } = shuffledCrossCategory[i];
    
    pairs.push({
      marketIndexA: marketA.marketIndex,
      marketIndexB: marketB.marketIndex,
      symbolA: marketA.symbol,
      symbolB: marketB.symbol,
      description: `Cross-sector: ${marketA.symbol}/${marketB.symbol}`,
    });
  }

  if (excluded.size > 0 && pairs.length < pairCount) {
    const totalPossible = sameCategoryCandidates.length + crossCategoryCandidates.length;
    console.log(`[PAIR_SELECTOR] ⚠️ Could only find ${pairs.length}/${pairCount} unique pairs`);
    console.log(`[PAIR_SELECTOR] Stats: ${excluded.size} already scanned, ${totalPossible} total possible, ${allMarkets.length} markets available`);
  }
  
  console.log(`[PAIR_SELECTOR] 🎯 Selected ${pairs.length} smart market pairs for analysis`);
  pairs.forEach((p) => console.log(`  - ${p.description}`));

  return pairs;
}
