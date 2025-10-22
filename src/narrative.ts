// Copilot: Generate a natural-language summary explaining the pair-trading signal using metrics

import { AnalysisResult } from './pair_analysis.js';

/**
 * Generate a human-readable narrative explaining the analysis results
 * This simulates LLM output - in production, integrate with Eliza's llm.complete()
 * 
 * @param symbolA - First trading symbol
 * @param symbolB - Second trading symbol
 * @param result - Analysis results
 * @returns Natural language summary (1-2 sentences)
 */
export function generateNarrative(
  symbolA: string,
  symbolB: string,
  result: AnalysisResult
): string {
  const { corr, zScore, signalType, mean, std } = result;
  
  // Format numbers for readability
  const corrFormatted = corr.toFixed(2);
  const zScoreFormatted = zScore.toFixed(1);
  const meanFormatted = mean.toFixed(2);
  const stdFormatted = std.toFixed(2);
  
  // Build narrative based on signal type
  let narrative = `${symbolA}/${symbolB} spread is ${zScoreFormatted}σ ${
    zScore > 0 ? 'above' : 'below'
  } mean (${meanFormatted} ± ${stdFormatted}), correlation ${corrFormatted}.`;
  
  // Add trade recommendation
  if (signalType === 'short') {
    narrative += ` Spread elevated — possible short ${symbolA}, long ${symbolB} reversion trade.`;
  } else if (signalType === 'long') {
    narrative += ` Spread depressed — possible long ${symbolA}, short ${symbolB} reversion trade.`;
  } else {
    narrative += ` No strong signal — spread within normal range.`;
  }
  
  // Add correlation warning if weak
  if (Math.abs(corr) < 0.7) {
    narrative += ` ⚠️ Low correlation may indicate unstable relationship.`;
  }
  
  return narrative;
}

/**
 * Generate a detailed analysis prompt for LLM integration
 * Use this with Eliza's llm.complete(prompt) in production
 * 
 * @param symbolA - First trading symbol
 * @param symbolB - Second trading symbol
 * @param result - Analysis results
 * @returns Formatted prompt for LLM
 */
export function buildLLMPrompt(
  symbolA: string,
  symbolB: string,
  result: AnalysisResult
): string {
  return `Analyze ${symbolA}/${symbolB} pair:
Correlation: ${result.corr.toFixed(3)}
Z-Score: ${result.zScore.toFixed(2)}
Mean Spread: ${result.mean.toFixed(2)}
Std Spread: ${result.std.toFixed(2)}
Beta: ${result.beta.toFixed(3)}
Signal: ${result.signalType}

Provide a concise 1-2 sentence trading insight.`;
}

/**
 * Example integration with Eliza LLM (mock)
 * In production, replace with actual Eliza agent.respond() or llm.complete()
 * 
 * @param symbolA - First trading symbol
 * @param symbolB - Second trading symbol
 * @param result - Analysis results
 * @returns LLM-generated narrative
 */
export async function generateLLMNarrative(
  symbolA: string,
  symbolB: string,
  result: AnalysisResult
): Promise<string> {
  // Mock implementation - replace with actual Eliza integration
  // Example: const insight = await llm.complete(buildLLMPrompt(...));
  
  const prompt = buildLLMPrompt(symbolA, symbolB, result);
  
  // For now, return the rule-based narrative
  // TODO: Integrate with Eliza OS llm.complete(prompt)
  console.log(`[LLM Prompt]\n${prompt}\n`);
  
  return generateNarrative(symbolA, symbolB, result);
}

/**
 * Format analysis results as a structured report
 * Useful for logging or displaying results
 * 
 * @param symbolA - First trading symbol
 * @param symbolB - Second trading symbol
 * @param result - Analysis results
 * @returns Formatted report string
 */
export function formatAnalysisReport(
  symbolA: string,
  symbolB: string,
  result: AnalysisResult,
  opts?: { currentPriceA?: number; currentPriceB?: number; timeframe?: string }
): string {
  // Build explicit signal string with legs
  let signalDetail = 'NEUTRAL';
  if (result.signalType === 'short') {
    signalDetail = `SHORT ${symbolA}, LONG ${symbolB}`;
  } else if (result.signalType === 'long') {
    signalDetail = `LONG ${symbolA}, SHORT ${symbolB}`;
  }

  const currentPricesLine =
    opts?.currentPriceA !== undefined && opts?.currentPriceB !== undefined
      ? `Current Px:  ${symbolA}: $${opts.currentPriceA.toFixed(2)}  ${symbolB}: $${opts.currentPriceB.toFixed(2)}\n`
      : '';

  const report = `
═══════════════════════════════════════════
  PAIR ANALYSIS REPORT
═══════════════════════════════════════════
Pair:         ${symbolA} / ${symbolB}
Correlation:  ${result.corr.toFixed(3)}
Beta:         ${result.beta.toFixed(3)}
Timeframe:    ${opts?.timeframe ?? 'n/a'}
─────────────────────────────────────────────
Spread Stats:
  Mean:       ${result.mean.toFixed(2)}
  Std Dev:    ${result.std.toFixed(2)}
  Current:    ${result.spread.toFixed(2)}
  Z-Score:    ${result.zScore.toFixed(2)}
─────────────────────────────────────────────
Signal:       ${signalDetail}
Legs:         ${signalDetail}
${currentPricesLine}─────────────────────────────────────────────
Narrative:
${generateNarrative(symbolA, symbolB, result)}
═══════════════════════════════════════════
`;
  return report;
}
