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

// Run test when script is loaded
console.log('Top ABC Analysis Test Script loaded');
console.log('Call testTopAbcAnalysis() to run the test');

// Export test function to be callable from the console
window.testTopAbcAnalysis = testTopAbcAnalysis;
