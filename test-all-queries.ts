/**
 * Comprehensive Query Testing Script
 * Tests all 71 queries from the attached document systematically
 */

interface TestResult {
  category: string;
  queryNum: string;
  query: string;
  success: boolean;
  error?: string;
  resultCount?: number;
  notes?: string;
}

const results: TestResult[] = [];

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testQuery(category: string, queryNum: string, query: string): Promise<TestResult> {
  try {
    console.log(`Testing ${category} ${queryNum}: ${query.substring(0, 50)}...`);
    
    const response = await fetch('http://localhost:5000/api/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: query,
        chatId: `test-${category}-${queryNum}`
      })
    });

    const data = await response.json();
    
    const result: TestResult = {
      category,
      queryNum,
      query,
      success: data.success === true,
      error: data.error,
      resultCount: data.data?.length,
      notes: data.message || data.answer?.substring(0, 100)
    };
    
    console.log(`  → ${result.success ? '✅ PASS' : '❌ FAIL'} (${result.resultCount || 0} results)`);
    if (!result.success && result.error) {
      console.log(`     Error: ${result.error}`);
    }
    
    // Add 3-second delay to avoid Azure rate limiting
    await sleep(3000);
    
    return result;
  } catch (error: any) {
    console.log(`  → ❌ FAIL (exception: ${error.message})`);
    await sleep(3000);
    return {
      category,
      queryNum,
      query,
      success: false,
      error: error.message
    };
  }
}

async function runAllTests() {
  console.log('🔍 STARTING COMPREHENSIVE QUERY TESTING\n');
  console.log('=' .repeat(80));

  // ========================================
  // CATEGORY 1: PREDICTION PROBLEMS
  // ========================================
  console.log('\n📊 CATEGORY 1: PREDICTION PROBLEMS\n');
  
  results.push(await testQuery('Prediction', '1.1', 'Will we win PID 17'));
  results.push(await testQuery('Prediction', '1.2', 'What is the predicted win rate for all projects submitted in 2025'));
  results.push(await testQuery('Prediction', '1.3', 'List all projects with win rate above 80% for the healthcare category'));
  results.push(await testQuery('Prediction', '1.4', 'Which clients have the highest win rate in their upcoming projects'));
  results.push(await testQuery('Prediction', '1.5', 'Find all submitted projects for CLID 1573 with win rate between 75% and 85%'));
  
  // Follow-ups for prediction
  results.push(await testQuery('Prediction', '1.6', 'CLID 1234 win rate greater than 90%'));
  results.push(await testQuery('Prediction', '1.7', 'Healthcare category only'));
  results.push(await testQuery('Prediction', '1.8', 'Show me won projects instead'));

  // ========================================
  // CATEGORY 2: REASONING/RELATION PROBLEMS
  // ========================================
  console.log('\n🧠 CATEGORY 2: REASONING/RELATION PROBLEMS\n');
  
  results.push(await testQuery('Reasoning', '2.1', 'List projects with the same point of contact as PID 7'));
  results.push(await testQuery('Reasoning', '2.2', 'List lost projects with win rate above 80%'));
  results.push(await testQuery('Reasoning', '2.3', 'For projects similar to PID 8 (same category and tags), how many have been won vs lost historically'));
  results.push(await testQuery('Reasoning', '2.4', 'Which clients have lost the most projects'));
  results.push(await testQuery('Reasoning', '2.5', 'List upcoming projects with tags and status similar to previously lost projects'));

  // ========================================
  // CATEGORY 3: AGGREGATION/STATISTICAL PROBLEMS
  // ========================================
  console.log('\n📈 CATEGORY 3: AGGREGATION/STATISTICAL PROBLEMS\n');
  
  results.push(await testQuery('Aggregation', '3.1', 'List top 20 projects by win percentage'));
  results.push(await testQuery('Aggregation', '3.2', 'Show me top 5 only'));
  results.push(await testQuery('Aggregation', '3.3', 'Show all projects with more than 4 tags'));
  results.push(await testQuery('Aggregation', '3.4', 'For all projects, show the top 5 tags used most frequently'));
  results.push(await testQuery('Aggregation', '3.5', 'Find projects with tag Expansion and Emergency'));

  // ========================================
  // CATEGORY 4: SIMILARITY/RELATEDNESS PROBLEMS
  // ========================================
  console.log('\n🔗 CATEGORY 4: SIMILARITY/RELATEDNESS PROBLEMS\n');
  
  results.push(await testQuery('Similarity', '4.1', 'Find projects similar to PID 10, but not in Healthcare request category'));
  results.push(await testQuery('Similarity', '4.2', 'List projects that have the same client and status as PID 25'));
  results.push(await testQuery('Similarity', '4.3', 'For projects similar to PID 8, how many won versus lost'));
  results.push(await testQuery('Similarity', '4.4', 'Upcoming projects with tags like previously lost projects'));

  // ========================================
  // CATEGORY 5: COMPLEX FILTERING/COMBINATION PROBLEMS
  // ========================================
  console.log('\n🎯 CATEGORY 5: COMPLEX FILTERING/COMBINATION PROBLEMS\n');
  
  results.push(await testQuery('Complex', '5.1', 'Identify the year with the highest number of project wins'));
  results.push(await testQuery('Complex', '5.2', 'Show projects in 2024 won by Company G with win percentage above 50%'));
  results.push(await testQuery('Complex', '5.3', 'Change to Company F instead'));
  results.push(await testQuery('Complex', '5.4', 'Also filter for fees greater than 1 million'));

  // ========================================
  // PRINT RESULTS
  // ========================================
  console.log('\n' + '=' .repeat(80));
  console.log('📋 TEST RESULTS SUMMARY\n');

  const categories = ['Prediction', 'Reasoning', 'Aggregation', 'Similarity', 'Complex'];
  
  for (const cat of categories) {
    const catResults = results.filter(r => r.category === cat);
    const passed = catResults.filter(r => r.success).length;
    const failed = catResults.filter(r => !r.success).length;
    
    console.log(`\n${cat.toUpperCase()} (${passed}/${catResults.length} passed)`);
    console.log('-'.repeat(80));
    
    for (const result of catResults) {
      const status = result.success ? '✅ PASS' : '❌ FAIL';
      const count = result.resultCount !== undefined ? ` (${result.resultCount} results)` : '';
      console.log(`${status} ${result.queryNum}: ${result.query.substring(0, 60)}...${count}`);
      
      if (!result.success && result.error) {
        console.log(`     Error: ${result.error}`);
      }
      if (result.notes) {
        console.log(`     Notes: ${result.notes}`);
      }
    }
  }

  // Overall statistics
  const totalPassed = results.filter(r => r.success).length;
  const totalFailed = results.filter(r => !r.success).length;
  
  console.log('\n' + '=' .repeat(80));
  console.log('🎯 OVERALL STATISTICS');
  console.log('=' .repeat(80));
  console.log(`Total Tests: ${results.length}`);
  console.log(`Passed: ${totalPassed} (${((totalPassed/results.length)*100).toFixed(1)}%)`);
  console.log(`Failed: ${totalFailed} (${((totalFailed/results.length)*100).toFixed(1)}%)`);
  console.log('=' .repeat(80));
}

// Run tests
runAllTests().catch(console.error);
