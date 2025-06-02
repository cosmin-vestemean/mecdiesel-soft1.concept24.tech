// Boolean filter logic test for Romanian values
console.log('Testing Boolean Filter Logic for Romanian Values');

// Sample test data with Romanian boolean values
const testData = [
    { id: 1, Blacklisted: 'Da', InLichidare: 'Nu' },      // Yes, No
    { id: 2, Blacklisted: 'Nu', InLichidare: 'Da' },      // No, Yes  
    { id: 3, Blacklisted: '-', InLichidare: '-' },        // Dash (No)
    { id: 4, Blacklisted: true, InLichidare: false },     // Boolean
    { id: 5, Blacklisted: 'Yes', InLichidare: 'No' },     // English
    { id: 6, Blacklisted: null, InLichidare: null },      // Null
    { id: 7, Blacklisted: '', InLichidare: '' },          // Empty
    { id: 8, Blacklisted: 1, InLichidare: 0 },            // Numeric
];

// Test function that mimics the filter logic from data-table.js
function testBooleanFilter(data, filterType, filterValue) {
    return data.filter(item => {
        const fieldValue = item[filterType];
        
        if (filterValue === 'all') return true;
        
        if (filterValue === 'yes') {
            // Handle multiple formats: true, 1, '1', 'true', 'Da', 'Yes'
            return fieldValue === true || 
                   fieldValue === 1 || 
                   fieldValue === '1' || 
                   fieldValue === 'true' ||
                   (typeof fieldValue === 'string' && 
                    (fieldValue.toLowerCase() === 'da' || fieldValue.toLowerCase() === 'yes'));
        } else if (filterValue === 'no') {
            // Handle multiple formats: false, 0, '0', 'false', 'Nu', 'No', '-'
            return fieldValue === false || 
                   fieldValue === 0 || 
                   fieldValue === '0' || 
                   fieldValue === 'false' ||
                   (typeof fieldValue === 'string' && 
                    (fieldValue.toLowerCase() === 'nu' || 
                     fieldValue.toLowerCase() === 'no' || 
                     fieldValue === '-'));
        } else if (filterValue === 'none') {
            return fieldValue === null || fieldValue === undefined || fieldValue === '';
        }
        
        return true;
    });
}

console.log('Original data:', testData);

console.log('\n--- Testing Blacklisted Filter ---');
console.log('Filter "yes":', testBooleanFilter(testData, 'Blacklisted', 'yes'));
console.log('Filter "no":', testBooleanFilter(testData, 'Blacklisted', 'no'));
console.log('Filter "none":', testBooleanFilter(testData, 'Blacklisted', 'none'));

console.log('\n--- Testing InLichidare Filter ---');
console.log('Filter "yes":', testBooleanFilter(testData, 'InLichidare', 'yes'));
console.log('Filter "no":', testBooleanFilter(testData, 'InLichidare', 'no'));
console.log('Filter "none":', testBooleanFilter(testData, 'InLichidare', 'none'));

console.log('\n✅ Boolean filter logic test completed!');
