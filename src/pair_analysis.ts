// Copilot: Compute correlation and z-score between two price arrays

import { mean, std } from 'mathjs';

/**
 * Interface for pair analysis results
 */
export interface AnalysisResult {
  corr: number;         // Correlation coefficient
  beta: number;         // Beta (slope of linear regression)
  zScore: number;       // Current z-score of the spread
  mean: number;         // Mean of the spread
  std: number;          // Standard deviation of the spread
  spread: number;       // Current spread value
  signalType: 'long' | 'short' | 'neutral';  // Trade signal
}

/**
 * Calculate returns (percentage change) from price array
 * @param prices - Array of prices
 * @returns Array of returns
 */
function calculateReturns(prices: number[]): number[] {
  const returns: number[] = [];
  for (let i = 1; i < prices.length; i++) {
    const ret = (prices[i] - prices[i - 1]) / prices[i - 1];
    returns.push(ret);
  }
  return returns;
}

/**
 * Calculate Pearson correlation coefficient between two arrays
 * @param x - First array
 * @param y - Second array
 * @returns Correlation coefficient (-1 to 1)
 */
function correlation(x: number[], y: number[]): number {
  if (x.length !== y.length || x.length === 0) {
    throw new Error('Arrays must have the same non-zero length');
  }

  const n = x.length;
  const meanX = Number(mean(x));
  const meanY = Number(mean(y));
  
  let numerator = 0;
  let denomX = 0;
  let denomY = 0;
  
  for (let i = 0; i < n; i++) {
    const diffX = x[i] - meanX;
    const diffY = y[i] - meanY;
    numerator += diffX * diffY;
    denomX += diffX * diffX;
    denomY += diffY * diffY;
  }
  
  if (denomX === 0 || denomY === 0) {
    return 0;
  }
  
  return numerator / Math.sqrt(denomX * denomY);
}

/**
 * Calculate beta (slope) using linear regression
 * Beta represents how much priceA moves relative to priceB
 * @param pricesA - Independent variable (X)
 * @param pricesB - Dependent variable (Y)
 * @returns Beta coefficient
 */
function calculateBeta(pricesA: number[], pricesB: number[]): number {
  if (pricesA.length !== pricesB.length || pricesA.length === 0) {
    throw new Error('Arrays must have the same non-zero length');
  }

  const returnsA = calculateReturns(pricesA);
  const returnsB = calculateReturns(pricesB);
  
  const meanA = Number(mean(returnsA));
  const meanB = Number(mean(returnsB));
  
  let covariance = 0;
  let varianceA = 0;
  
  for (let i = 0; i < returnsA.length; i++) {
    const diffA = returnsA[i] - meanA;
    const diffB = returnsB[i] - meanB;
    covariance += diffA * diffB;
    varianceA += diffA * diffA;
  }
  
  if (varianceA === 0) {
    return 0;
  }
  
  return covariance / varianceA;
}

/**
 * Calculate the spread between two price series
 * Spread = PriceA - β × PriceB
 * @param pricesA - First price series
 * @param pricesB - Second price series
 * @param beta - Beta coefficient
 * @returns Array of spread values
 */
function calculateSpread(
  pricesA: number[],
  pricesB: number[],
  beta: number
): number[] {
  return pricesA.map((priceA, i) => priceA - beta * pricesB[i]);
}

/**
 * Analyze a pair of trading symbols for mean-reversion opportunities
 * @param pricesA - Price array for first symbol
 * @param pricesB - Price array for second symbol
 * @returns Analysis results with correlation, beta, z-score, and signal
 */
export function analyzePair(
  pricesA: number[],
  pricesB: number[]
): AnalysisResult {
  // Validate inputs
  if (pricesA.length !== pricesB.length) {
    throw new Error('Price arrays must have the same length');
  }
  if (pricesA.length < 2) {
    throw new Error('Need at least 2 data points for analysis');
  }

  // Calculate returns for correlation
  const returnsA = calculateReturns(pricesA);
  const returnsB = calculateReturns(pricesB);
  
  // Compute correlation coefficient
  const corr = correlation(returnsA, returnsB);
  
  // Compute beta (hedge ratio)
  const beta = calculateBeta(pricesA, pricesB);
  
  // Calculate spread: PriceA - β × PriceB
  const spreadArray = calculateSpread(pricesA, pricesB, beta);
  
  // Calculate spread statistics
  const spreadMean = Number(mean(spreadArray));
  const spreadStd = Number(std(spreadArray, 'unbiased'));
  
  // Current spread and z-score
  const currentSpread = spreadArray[spreadArray.length - 1];
  const zScore = (currentSpread - spreadMean) / spreadStd;
  
  // Generate signal based on z-score
  let signalType: 'long' | 'short' | 'neutral' = 'neutral';
  if (zScore > 2) {
    signalType = 'short'; // Spread too high, expect mean reversion downward
  } else if (zScore < -2) {
    signalType = 'long'; // Spread too low, expect mean reversion upward
  }
  
  return {
    corr,
    beta,
    zScore,
    mean: spreadMean,
    std: spreadStd,
    spread: currentSpread,
    signalType,
  };
}

/**
 * Check if a pair meets trading criteria
 * @param result - Analysis result
 * @param zScoreThreshold - Minimum absolute z-score (default: 2.0)
 * @param corrThreshold - Minimum correlation (default: 0.8)
 * @returns True if pair qualifies for trading signal
 */
export function meetsTradeSignalCriteria(
  result: AnalysisResult,
  zScoreThreshold: number = 2.0,
  corrThreshold: number = 0.8
): boolean {
  return (
    Math.abs(result.zScore) >= zScoreThreshold &&
    Math.abs(result.corr) >= corrThreshold
  );
}
