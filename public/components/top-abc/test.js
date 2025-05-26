import { client } from '../../socketConfig.js';

// Mock token for testing purpose
const token = sessionStorage.getItem('s1Token') || 'test-token';

// Default test parameters
const testParams = {
  dataReferinta: new Date().toISOString().slice(0, 10),
  nrSaptamani: 52,
  seriesL: '',
  branch: '',
  supplier: null,
  mtrl: null,
  cod: '',
  searchType: 1,
  modFiltrareBranch: 'AGENT',
  thresholdA: 80,
  thresholdB: 15
};

// Test function to call the API
async function testTopAbcAnalysis() {
  try {
    console.log('Starting TopAbcAnalysis API test...');
    
    // Create a copy of the parameters and ensure date is quoted for SQL
    const params = { ...testParams };
    if (params.dataReferinta) {
      params.dataReferinta = `'${params.dataReferinta}'`;
    }
    
    console.log('Using parameters:', params);
    
    const response = await client.service('top-abc').getTopAbcAnalysis({
      token: token,
      ...params
    });
    
    console.log('API Response:', response);
    
    if (response.success) {
      console.log('Test successful! Received', response.rows ? response.rows.length : 0, 'rows');
      displaySampleData(response.rows);
    } else {
      console.error('Test failed:', response.message || 'Unknown error');
    }
    
    return response;
  } catch (error) {
    console.error('Error testing API:', error);
    throw error;
  }
}

// Function to display sample data
function displaySampleData(rows) {
  if (!rows || rows.length === 0) {
    console.log('No data to display');
    return;
  }
  
  console.log('Sample data (first 5 rows):');
  const sample = rows.slice(0, 5);
  
  console.table(sample);
  
  // Display ABC distribution
  const abcCounts = rows.reduce((counts, item) => {
    const abc = item.ABC || 'Unknown';
    counts[abc] = (counts[abc] || 0) + 1;
    return counts;
  }, {});
  
  console.log('ABC Distribution:', abcCounts);
}

// Test function to simulate large dataset chunking
async function testChunkingSave() {
  try {
    console.log('Starting TOP ABC Analysis chunking save test...');
    
    // First get some real data
    const analysisResponse = await client.service('top-abc').getTopAbcAnalysis({
      token: token,
      ...testParams
    });
    
    if (!analysisResponse.success || !analysisResponse.rows || analysisResponse.rows.length === 0) {
      console.error('Cannot test chunking - no data available from analysis');
      return;
    }
    
    console.log(`Got ${analysisResponse.rows.length} rows from analysis`);
    
    // Create a large dataset by duplicating the data to simulate 3000+ items
    const originalData = analysisResponse.rows;
    let testData = [...originalData];
    
    // Duplicate data until we have > 2000 items (chunk threshold)
    while (testData.length < 2500) {
      testData = testData.concat(originalData.map((item, index) => ({
        ...item,
        MTRL: item.MTRL + (testData.length * 1000) + index, // Unique material ID
        COD: item.COD + '_' + testData.length + '_' + index, // Unique code
      })));
    }
    
    console.log(`Created test dataset with ${testData.length} items for chunking test`);
    
    // Mock summary data
    const testSummary = [
      { ABC: 'A', COUNT: Math.floor(testData.length * 0.2), PERCENTAGE: 20 },
      { ABC: 'B', COUNT: Math.floor(testData.length * 0.3), PERCENTAGE: 30 },
      { ABC: 'C', COUNT: Math.floor(testData.length * 0.5), PERCENTAGE: 50 }
    ];
    
    // Test the chunking save via the frontend component
    const container = document.querySelector('top-abc-container');
    if (!container) {
      console.error('Cannot find top-abc-container element for testing');
      return;
    }
    
    // Set up the container with test data
    container.data = testData;
    container.summary = testSummary;
    container.token = token;
    container.params = {
      ...testParams,
      branch: 'TEST_BRANCH' // Use a test branch
    };
    
    console.log('Testing chunked save...');
    await container.handleSaveData();
    
    console.log('Chunking test completed successfully!');
    
  } catch (error) {
    console.error('Error in chunking test:', error);
    throw error;
  }
}

// Test individual chunking service methods
async function testChunkingServices() {
  try {
    console.log('Testing individual chunking service methods...');
    
    // Test reset service
    console.log('Testing reset service...');
    const resetResponse = await client.service('top-abc').resetTopAbcAnalysis({
      token: token,
      dataReferinta: testParams.dataReferinta,
      branch: 'TEST_BRANCH'
    });
    
    console.log('Reset response:', resetResponse);
    
    // Test chunk save service with minimal data
    console.log('Testing chunk save service...');
    const chunkResponse = await client.service('top-abc').saveTopAbcAnalysisChunk({
      token: token,
      ...testParams,
      branch: 'TEST_BRANCH',
      data: [
        { MTRL: 999999, COD: 'TEST001', BRANCH: 'TEST_BRANCH', SALESPERC: 50.5, ABC: 'A' },
        { MTRL: 999998, COD: 'TEST002', BRANCH: 'TEST_BRANCH', SALESPERC: 30.2, ABC: 'B' }
      ],
      summary: [
        { ABC: 'A', COUNT: 1, PERCENTAGE: 50 },
        { ABC: 'B', COUNT: 1, PERCENTAGE: 50 }
      ],
      isChunk: true,
      chunkNumber: 1,
      totalChunks: 1
    });
    
    console.log('Chunk save response:', chunkResponse);
    
    if (resetResponse.success && chunkResponse.success) {
      console.log('✓ All chunking services working correctly');
    } else {
      console.error('✗ Some chunking services failed');
    }
    
  } catch (error) {
    console.error('Error testing chunking services:', error);
    throw error;
  }
}

// Test progress indicator functionality
async function testProgressIndicators() {
  try {
    console.log('Testing progress indicator functionality...');
    
    // Get the container element
    const container = document.querySelector('top-abc-container');
    if (!container) {
      console.error('Cannot find top-abc-container element for testing');
      return;
    }
    
    console.log('✓ Container found, testing progress stages...');
    
    // Test reset stage
    container._showProgress('reset', 'Testing reset stage...', 1, 3);
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test chunks stage
    container._showProgress('chunks', 'Testing chunk processing stage...', 0, 5);
    
    // Simulate chunk processing
    for (let i = 1; i <= 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 800));
      container._updateProgress(i, 5, `Processing chunk ${i}/5...`);
    }
    
    // Test completion stage
    container._showProgress('complete', 'Testing completion stage...', 5, 5);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Hide progress
    container._hideProgress();
    
    console.log('✓ Progress indicator test completed successfully!');
    
  } catch (error) {
    console.error('Error testing progress indicators:', error);
    throw error;
  }
}

// Test chunking with visual progress for large dataset
async function testChunkingWithProgress() {
  try {
    console.log('Testing chunking with progress indicators...');
    
    // First get some real data or create mock data
    const container = document.querySelector('top-abc-container');
    if (!container) {
      console.error('Cannot find top-abc-container element for testing');
      return;
    }
    
    // Create a large mock dataset to test chunking
    const mockData = [];
    for (let i = 1; i <= 3500; i++) {
      mockData.push({
        MTRL: 1000000 + i,
        COD: `TEST${i.toString().padStart(4, '0')}`,
        DESCRIPTION: `Test Product ${i}`,
        BRANCH: 'TEST_BRANCH',
        SALESPERC: Math.random() * 100,
        ABC: i <= 700 ? 'A' : i <= 2100 ? 'B' : 'C'
      });
    }
    
    // Mock summary data
    const mockSummary = [
      { ABC: 'A', ITEMCOUNT: 700, CLASSTOTAL: 150000, ITEMSPERC: 20, VALUEPERC: 80 },
      { ABC: 'B', ITEMCOUNT: 1400, CLASSTOTAL: 30000, ITEMSPERC: 40, VALUEPERC: 15 },
      { ABC: 'C', ITEMCOUNT: 1400, CLASSTOTAL: 10000, ITEMSPERC: 40, VALUEPERC: 5 }
    ];
    
    // Set up the container
    container.data = mockData;
    container.summary = mockSummary;
    container.token = token;
    container.params = {
      ...testParams,
      branch: 'TEST_BRANCH'
    };
    
    console.log(`✓ Created mock dataset with ${mockData.length} items (triggers chunking)`);
    console.log('✓ Starting chunked save with progress indicators...');
    
    // Start the chunked save - this will show the progress indicators
    await container.handleSaveData();
    
    console.log('✓ Chunking with progress test completed!');
    
  } catch (error) {
    console.error('Error in chunking with progress test:', error);
    throw error;
  }
}

// Run test when script is loaded
console.log('Top ABC Analysis Test Script loaded');
console.log('Call testTopAbcAnalysis() to run the test');

// Export test functions
window.testTopAbcAnalysis = testTopAbcAnalysis;
window.testChunkingSave = testChunkingSave;
window.testChunkingServices = testChunkingServices;
window.testProgressIndicators = testProgressIndicators;
window.testChunkingWithProgress = testChunkingWithProgress;

console.log('Chunking test functions loaded:');
console.log('- testChunkingSave() - Test full chunking workflow with large dataset');
console.log('- testChunkingServices() - Test individual chunking service methods');
console.log('Progress indicator test functions loaded:');
console.log('- testProgressIndicators() - Test progress bar stages and animations');
console.log('- testChunkingWithProgress() - Test full chunking workflow with visual progress');
