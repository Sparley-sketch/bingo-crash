/**
 * RNG Statistical Testing Utilities
 * 
 * Implements statistical tests for RNG certification compliance.
 * Provides basic statistical tests and interfaces for external test suites.
 */

import { generateSecureRandom, generateSecureRandomArray } from './rng';
import { storeStatisticalTestResult } from './rngDatabase';

export interface StatisticalTestResult {
  testName: string;
  testVersion: string;
  testType: string;
  sampleSize: number;
  results: {
    pValue?: number;
    chiSquared?: number;
    criticalValue?: number;
    degreesOfFreedom?: number;
    zScore?: number;
    passed: boolean;
    details: any;
  };
  timestamp: number;
}

/**
 * Chi-Square Test for Uniform Distribution
 * Tests if random numbers are uniformly distributed across expected range
 */
export async function chiSquareUniformityTest(
  sampleSize: number = 10000,
  rangeMin: number = 1,
  rangeMax: number = 100
): Promise<StatisticalTestResult> {
  const samples = generateSecureRandomArray(sampleSize, rangeMin, rangeMax);
  const expectedFreq = sampleSize / (rangeMax - rangeMin + 1);
  
  // Count frequencies
  const frequencies: { [key: number]: number } = {};
  for (let i = rangeMin; i <= rangeMax; i++) {
    frequencies[i] = 0;
  }
  
  samples.forEach(value => {
    frequencies[value]++;
  });
  
  // Calculate chi-square statistic
  let chiSquared = 0;
  for (let i = rangeMin; i <= rangeMax; i++) {
    const observed = frequencies[i];
    const expected = expectedFreq;
    chiSquared += Math.pow(observed - expected, 2) / expected;
  }
  
  // Degrees of freedom
  const degreesOfFreedom = rangeMax - rangeMin;
  
  // Critical value for 95% confidence (approximate)
  const criticalValue = degreesOfFreedom + 1.96 * Math.sqrt(2 * degreesOfFreedom);
  
  const passed = chiSquared <= criticalValue;
  
  const result: StatisticalTestResult = {
    testName: 'Chi-Square Uniformity Test',
    testVersion: '1.0.0',
    testType: 'Uniformity',
    sampleSize,
    results: {
      chiSquared,
      criticalValue,
      degreesOfFreedom,
      passed,
      details: {
        rangeMin,
        rangeMax,
        expectedFrequency: expectedFreq,
        frequencies: frequencies
      }
    },
    timestamp: Date.now()
  };
  
  // Store result in database
  await storeStatisticalTestResult(
    result.testName,
    result.testVersion,
    result.testType,
    result.sampleSize,
    result.results,
    result.results.passed,
    result.timestamp
  );
  
  return result;
}

/**
 * Runs Test for Randomness
 * Tests if the sequence alternates between runs of increasing and decreasing values
 */
export async function runsTest(sampleSize: number = 1000): Promise<StatisticalTestResult> {
  const samples = generateSecureRandomArray(sampleSize, 1, 100);
  
  // Convert to runs (1 for increase, -1 for decrease, 0 for equal)
  const runs: number[] = [];
  for (let i = 1; i < samples.length; i++) {
    if (samples[i] > samples[i-1]) {
      runs.push(1);
    } else if (samples[i] < samples[i-1]) {
      runs.push(-1);
    } else {
      runs.push(0);
    }
  }
  
  // Count runs
  let runCount = 1;
  for (let i = 1; i < runs.length; i++) {
    if (runs[i] !== runs[i-1]) {
      runCount++;
    }
  }
  
  // Expected number of runs
  const expectedRuns = (2 * samples.length - 1) / 3;
  const variance = (16 * samples.length - 29) / 90;
  const standardDeviation = Math.sqrt(variance);
  
  // Z-score
  const zScore = (runCount - expectedRuns) / standardDeviation;
  
  // Two-tailed test at 95% confidence
  const passed = Math.abs(zScore) <= 1.96;
  
  const result: StatisticalTestResult = {
    testName: 'Runs Test',
    testVersion: '1.0.0',
    testType: 'Randomness',
    sampleSize,
    results: {
      passed,
      details: {
        runCount,
        expectedRuns,
        variance,
        standardDeviation,
        zScore,
        criticalValue: 1.96
      }
    },
    timestamp: Date.now()
  };
  
  await storeStatisticalTestResult(
    result.testName,
    result.testVersion,
    result.testType,
    result.sampleSize,
    result.results,
    result.results.passed,
    result.timestamp
  );
  
  return result;
}

/**
 * Frequency Test within a Block
 * Tests if frequencies of values within blocks are consistent
 */
export async function frequencyWithinBlockTest(
  sampleSize: number = 10000,
  blockSize: number = 100
): Promise<StatisticalTestResult> {
  const samples = generateSecureRandomArray(sampleSize, 0, 9); // 0-9 for simplicity
  const numberOfBlocks = Math.floor(sampleSize / blockSize);
  
  let chiSquared = 0;
  const expectedFreqPerBlock = blockSize / 10; // 10 possible values (0-9)
  
  for (let block = 0; block < numberOfBlocks; block++) {
    const blockStart = block * blockSize;
    const blockEnd = blockStart + blockSize;
    const blockData = samples.slice(blockStart, blockEnd);
    
    // Count frequencies in this block
    const frequencies: { [key: number]: number } = {};
    for (let i = 0; i < 10; i++) {
      frequencies[i] = 0;
    }
    
    blockData.forEach(value => {
      frequencies[value]++;
    });
    
    // Calculate chi-square for this block
    for (let i = 0; i < 10; i++) {
      const observed = frequencies[i];
      const expected = expectedFreqPerBlock;
      chiSquared += Math.pow(observed - expected, 2) / expected;
    }
  }
  
  const degreesOfFreedom = numberOfBlocks * 9; // 9 degrees of freedom per block
  const criticalValue = degreesOfFreedom + 1.96 * Math.sqrt(2 * degreesOfFreedom);
  const passed = chiSquared <= criticalValue;
  
  const result: StatisticalTestResult = {
    testName: 'Frequency Within Block Test',
    testVersion: '1.0.0',
    testType: 'Block Frequency',
    sampleSize,
    results: {
      chiSquared,
      criticalValue,
      degreesOfFreedom,
      passed,
      details: {
        blockSize,
        numberOfBlocks,
        expectedFreqPerBlock
      }
    },
    timestamp: Date.now()
  };
  
  await storeStatisticalTestResult(
    result.testName,
    result.testVersion,
    result.testType,
    result.sampleSize,
    result.results,
    result.results.passed,
    result.timestamp
  );
  
  return result;
}

/**
 * Longest Run of Ones Test
 * Tests for the longest run of consecutive ones in a binary sequence
 */
export async function longestRunOfOnesTest(sampleSize: number = 1000): Promise<StatisticalTestResult> {
  const samples = generateSecureRandomArray(sampleSize, 0, 1);
  
  let currentRun = 0;
  let longestRun = 0;
  
  samples.forEach(bit => {
    if (bit === 1) {
      currentRun++;
      longestRun = Math.max(longestRun, currentRun);
    } else {
      currentRun = 0;
    }
  });
  
  // Expected longest run (approximate formula)
  const expectedLongestRun = Math.log2(sampleSize) - 1;
  
  // Simple pass/fail based on reasonable bounds
  const passed = longestRun >= 1 && longestRun <= Math.log2(sampleSize) + 2;
  
  const result: StatisticalTestResult = {
    testName: 'Longest Run of Ones Test',
    testVersion: '1.0.0',
    testType: 'Run Length',
    sampleSize,
    results: {
      passed,
      details: {
        longestRun,
        expectedLongestRun,
        sampleSize
      }
    },
    timestamp: Date.now()
  };
  
  await storeStatisticalTestResult(
    result.testName,
    result.testVersion,
    result.testType,
    result.sampleSize,
    result.results,
    result.results.passed,
    result.timestamp
  );
  
  return result;
}

/**
 * Run a complete battery of statistical tests
 */
export async function runStatisticalTestBattery(): Promise<{
  results: StatisticalTestResult[];
  overallPassed: boolean;
  summary: any;
}> {
  console.log('[RNG-STATS] Starting statistical test battery...');
  
  const results: StatisticalTestResult[] = [];
  
  try {
    // Run all tests
    const chiSquareResult = await chiSquareUniformityTest(10000, 1, 100);
    results.push(chiSquareResult);
    
    const runsTestResult = await runsTest(1000);
    results.push(runsTestResult);
    
    const frequencyBlockResult = await frequencyWithinBlockTest(10000, 100);
    results.push(frequencyBlockResult);
    
    const longestRunResult = await longestRunOfOnesTest(1000);
    results.push(longestRunResult);
    
    // Calculate overall result
    const overallPassed = results.every(result => result.results.passed);
    
    const summary = {
      totalTests: results.length,
      passedTests: results.filter(r => r.results.passed).length,
      failedTests: results.filter(r => !r.results.passed).length,
      overallPassed,
      timestamp: Date.now()
    };
    
    console.log('[RNG-STATS] Statistical test battery completed:', summary);
    
    return {
      results,
      overallPassed,
      summary
    };
    
  } catch (error) {
    console.error('[RNG-STATS] Error running statistical test battery:', error);
    throw error;
  }
}

/**
 * Generate test data for external statistical test suites
 * (Dieharder, TestU01, NIST STS)
 */
export function generateTestDataForExternalSuite(
  sampleSize: number = 1000000,
  format: 'binary' | 'decimal' | 'hex' = 'binary'
): string {
  const samples = generateSecureRandomArray(sampleSize, 0, 255);
  
  switch (format) {
    case 'binary':
      return samples.map(num => num.toString(2).padStart(8, '0')).join('');
    
    case 'decimal':
      return samples.map(num => num.toString().padStart(3, '0')).join(' ');
    
    case 'hex':
      return samples.map(num => num.toString(16).padStart(2, '0')).join('');
    
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
}

/**
 * Export test data to file for external analysis
 */
export function exportTestDataForCertification(
  sampleSize: number = 10000000,
  filename: string = 'rng_test_data'
): { binary: string; decimal: string; hex: string } {
  console.log(`[RNG-STATS] Generating ${sampleSize} samples for certification testing...`);
  
  const samples = generateSecureRandomArray(sampleSize, 0, 255);
  
  const binary = samples.map(num => num.toString(2).padStart(8, '0')).join('');
  const decimal = samples.join(' ');
  const hex = samples.map(num => num.toString(16).padStart(2, '0')).join('');
  
  console.log(`[RNG-STATS] Test data generated successfully`);
  console.log(`[RNG-STATS] Binary length: ${binary.length} bits`);
  console.log(`[RNG-STATS] Decimal length: ${decimal.length} characters`);
  console.log(`[RNG-STATS] Hex length: ${hex.length} characters`);
  
  return { binary, decimal, hex };
}
