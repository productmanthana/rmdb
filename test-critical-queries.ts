/**
 * Critical Query Testing - Representative samples from each category
 * Tests the most important query patterns without hitting rate limits
 */

interface TestResult {
  category: string;
  query: string;
  success: boolean;
  error?: string;
  resultCount?: number;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testQuery(category: string, query: string): Promise<TestResult> {
  try {
    console.log(`\nTesting: ${query}`);
    
    const response = await fetch('http://localhost:5000/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: query,
        chatId: `critical-test-${Date.now()}`
      })
    });

    const data = await response.json();
    
    const result: TestResult = {
      category,
      query,
      success: data.success === true,
      error: data.error,
      resultCount: data.data?.length
    };
    
    console.log(`  ${result.success ? '✅ PASS' : '❌ FAIL'} - ${result.resultCount || 0} results`);
    if (!result.success) console.log(`  Error: ${result.error || data.message}`);
    
    await sleep(4000); // 4 sec delay to avoid rate limit
    return result;
  } catch (error: any) {
    console.log(`  ❌ FAIL - ${error.message}`);
    await sleep(4000);
    return { category, query, success: false, error: error.message };
  }
}

async function runTests() {
  console.log('🧪 CRITICAL QUERY PATTERN TESTING\n' + '='.repeat(80));
  
  const results: TestResult[] = [];

  // PREDICTION - Test win rate filtering  
  console.log('\n📊 CATEGORY 1: WIN RATE / "PREDICTION" QUERIES');
  results.push(await testQuery('Win Rate', 'Healthcare projects with win rate above 80%'));
  results.push(await testQuery('Win Rate', 'CLID 1573 with win rate between 75 and 85 percent'));
  results.push(await testQuery('Win Rate', 'Which clients have highest win rate'));
  
  // REASONING - Test relational queries
  console.log('\n🧠 CATEGORY 2: REASONING/RELATION QUERIES');
  results.push(await testQuery('Reasoning', 'Show me PID 7'));
  results.push(await testQuery('Reasoning', 'List lost projects with win rate above 80%'));
  results.push(await testQuery('Reasoning', 'Which clients lost most projects'));
  
  // AGGREGATION - Test grouping/counting/stats
  console.log('\n📈 CATEGORY 3: AGGREGATION/STATISTICAL QUERIES');
  results.push(await testQuery('Aggregation', 'Show top 5 tags used most frequently'));
  results.push(await testQuery('Aggregation', 'List top 20 projects by win percentage'));
  results.push(await testQuery('Aggregation', 'Projects with tags Expansion and Emergency'));
  
  // SIMILARITY - Test finding similar projects
  console.log('\n🔗 CATEGORY 4: SIMILARITY QUERIES');
  results.push(await testQuery('Similarity', 'Show me PID 10'));
  results.push(await testQuery('Similarity', 'Healthcare projects like PID 10'));
  
  // COMPLEX - Test multi-condition filtering
  console.log('\n🎯 CATEGORY 5: COMPLEX MULTI-FILTER QUERIES');
  results.push(await testQuery('Complex', 'Projects in 2024 won by Company G with win rate above 50%'));
  results.push(await testQuery('Complex', 'Healthcare category, submitted status, California, fees over 1 million'));

  // Print summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 RESULTS SUMMARY\n');
  
  const byCategory = results.reduce((acc, r) => {
    if (!acc[r.category]) acc[r.category] = { passed: 0, failed: 0 };
    r.success ? acc[r.category].passed++ : acc[r.category].failed++;
    return acc;
  }, {} as Record<string, {passed: number, failed: number}>);

  for (const [cat, stats] of Object.entries(byCategory)) {
    const total = stats.passed + stats.failed;
    const pct = ((stats.passed / total) * 100).toFixed(0);
    console.log(`${cat}: ${stats.passed}/${total} passed (${pct}%)`);
  }

  const totalPass = results.filter(r => r.success).length;
  const totalFail = results.filter(r => !r.success).length;
  console.log(`\nOVERALL: ${totalPass}/${results.length} passed (${((totalPass/results.length)*100).toFixed(0)}%)`);
  console.log('='.repeat(80));
}

runTests().catch(console.error);
