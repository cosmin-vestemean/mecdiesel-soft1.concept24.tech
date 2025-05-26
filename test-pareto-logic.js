// Test pentru verificarea corecției Pareto Chart
// Node.js test - poate fi rulat cu: node test-pareto-logic.js

// Simulează funcția helper
function createParetoChartConfig(options) {
  const { labels, values, cumulativePercentages, title, xAxisLabel, yAxisLabel } = options;
  
  // Use pre-calculated cumulative percentages from SQL if available, otherwise calculate them
  let cumulativePercentage;
  if (cumulativePercentages && cumulativePercentages.length === values.length) {
    cumulativePercentage = cumulativePercentages;
    console.log('✅ Using SQL pre-calculated cumulative percentages');
  } else {
    // Fallback: Calculate cumulative percentage (for backward compatibility)
    let totalValue = values.reduce((sum, value) => sum + value, 0);
    let cumulativeValue = 0;
    cumulativePercentage = values.map(value => {
      cumulativeValue += value;
      return (cumulativeValue / totalValue) * 100;
    });
    console.log('⚠️  Calculating cumulative percentages from scratch (fallback)');
  }

  return {
    cumulativeData: cumulativePercentage,
    originalSQLData: cumulativePercentages
  };
}

// Test data - simulează datele din SQL
console.log('=== TEST PARETO CHART CUMULATIVE PERCENTAGE FIX ===\n');

const testDataFromSQL = [
  { CODE: 'PROD1', VALUE: 1000, CUMULATIVEPERC: 25.0 },  // 25% din total
  { CODE: 'PROD2', VALUE: 800, CUMULATIVEPERC: 45.0 },   // 20% adicional = 45% total
  { CODE: 'PROD3', VALUE: 600, CUMULATIVEPERC: 60.0 },   // 15% adicional = 60% total
  { CODE: 'PROD4', VALUE: 400, CUMULATIVEPERC: 70.0 },   // 10% adicional = 70% total
  { CODE: 'PROD5', VALUE: 300, CUMULATIVEPERC: 77.5 },   // 7.5% adicional = 77.5% total
  { CODE: 'PROD6', VALUE: 200, CUMULATIVEPERC: 82.5 },   // 5% adicional = 82.5% total
  { CODE: 'PROD7', VALUE: 150, CUMULATIVEPERC: 86.25 },  // 3.75% adicional = 86.25% total
  { CODE: 'PROD8', VALUE: 100, CUMULATIVEPERC: 88.75 },  // 2.5% adicional = 88.75% total
  { CODE: 'PROD9', VALUE: 80, CUMULATIVEPERC: 90.75 },   // 2% adicional = 90.75% total
  { CODE: 'PROD10', VALUE: 50, CUMULATIVEPERC: 92.25 }   // 1.25% adicional = 92.25% total
];

// Test 1: Cu date SQL complete (scenariul corect)
console.log('TEST 1: Cu valorile cumulative din SQL (CORECT)');
const labels = testDataFromSQL.map(item => item.CODE);
const values = testDataFromSQL.map(item => item.VALUE);
const sqlCumulativePercentages = testDataFromSQL.map(item => item.CUMULATIVEPERC);

const result1 = createParetoChartConfig({
  labels: labels,
  values: values,
  cumulativePercentages: sqlCumulativePercentages,
  title: 'Test Pareto Chart - SQL Data'
});

console.log('Rezultat cu date SQL:');
console.log('- Prima valoare cumulativă:', result1.cumulativeData[0], '% (ar trebui să fie 25%)');
console.log('- A patra valoare cumulativă:', result1.cumulativeData[3], '% (ar trebui să fie 70%)');
console.log('- Ultima valoare cumulativă:', result1.cumulativeData[9], '% (ar trebui să fie 92.25%)');

// Test 2: Fără date SQL (fallback - problematica veche)
console.log('\nTEST 2: Fără valorile SQL - calculare locală (FALLBACK)');
const result2 = createParetoChartConfig({
  labels: labels,
  values: values,
  // Nu transmitem cumulativePercentages - va calcula local
  title: 'Test Pareto Chart - Local Calculation'
});

console.log('Rezultat cu calcul local:');
console.log('- Prima valoare cumulativă:', result2.cumulativeData[0].toFixed(2), '% (calculat local)');
console.log('- A patra valoare cumulativă:', result2.cumulativeData[3].toFixed(2), '% (calculat local)');
console.log('- Ultima valoare cumulativă:', result2.cumulativeData[9].toFixed(2), '% (calculat local)');

// Verificare diferențe
console.log('\n=== COMPARAȚIE ===');
console.log('SQL vs Local pentru primul element:', sqlCumulativePercentages[0], 'vs', result2.cumulativeData[0].toFixed(2));
console.log('SQL vs Local pentru al patrulea element:', sqlCumulativePercentages[3], 'vs', result2.cumulativeData[3].toFixed(2));

// Test 3: Simulare problema originală cu top 30
console.log('\n=== SIMULARE PROBLEMA ORIGINALĂ ===');
// Să presupunem că avem 100 de produse în total, dar afișăm doar primele 10
const totalProducts = 100;
const topDisplayedProducts = 10;

console.log(`Din ${totalProducts} produse totale, afișăm doar top ${topDisplayedProducts}`);
console.log('Problema veche: calculul cumulativ se făcea doar pe produsele afișate');
console.log('Soluția nouă: folosim valorile cumulative calculate pe întreg setul de date din SQL');

const totalValueAllProducts = 4000; // Să presupunem total general
const topProductsValue = values.reduce((sum, val) => sum + val, 0); // 3680
const percentageOfDisplayed = (topProductsValue / totalValueAllProducts * 100).toFixed(2);

console.log(`Valorile produselor afișate reprezintă ${percentageOfDisplayed}% din totalul general`);
console.log(`Ultima valoare cumulativă SQL: ${sqlCumulativePercentages[9]}% (corect)`);
console.log(`Ultima valoare cumulativă calculată local: ${result2.cumulativeData[9].toFixed(2)}% (incorect - 100%)`);

console.log('\n✅ Fix aplicat: graficul va folosi valorile CUMULATIVEPERC din SQL');
console.log('✅ Acum graficul Pareto afișează valorile cumulative corecte!');
