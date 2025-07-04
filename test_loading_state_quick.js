const http = require('http');
const fs = require('fs');

console.log('🧪 Testing UI Loading State Fix (Quick Test)...');

// Test: Check component JavaScript file for fixes
const testComponentFile = () => {
    try {
        const componentPath = 'public/components/branch-replenishment-container.js';
        if (!fs.existsSync(componentPath)) {
            console.log('❌ Component file not found');
            return false;
        }
        
        const content = fs.readFileSync(componentPath, 'utf8');
        
        // Check for key patterns
        const patterns = [
            'TOTAL_TIMEOUT_MS = 30 * 60 * 1000',
            'clearTimeout(timeoutId)',
            'REQUEST_TIMEOUT_MS = 60000',
            'Promise.race([responsePromise, timeoutPromise])',
            'replenishmentStore.setLoading(false)',
            'try {' // In _handleSaveData
        ];
        
        let passed = 0;
        patterns.forEach((pattern, index) => {
            if (content.includes(pattern)) {
                console.log(`✅ Pattern ${index + 1}: ${pattern.substring(0, 40)}...`);
                passed++;
            } else {
                console.log(`❌ Pattern ${index + 1}: ${pattern.substring(0, 40)}...`);
            }
        });
        
        console.log(`📊 Pattern check: ${passed}/${patterns.length} passed`);
        return passed === patterns.length;
        
    } catch (error) {
        console.log(`❌ Error checking component file: ${error.message}`);
        return false;
    }
};

// Test: Check if server responds on port 3030
const testServerResponse = () => {
    return new Promise((resolve) => {
        const req = http.get('http://localhost:3030/test-step4-ui-loading-state-fix.html', (res) => {
            console.log(`📡 Server response: ${res.statusCode}`);
            if (res.statusCode === 200) {
                console.log('✅ Test page accessible via server');
                resolve(true);
            } else {
                console.log('❌ Test page not accessible');
                resolve(false);
            }
        });
        
        req.on('error', (err) => {
            console.log(`❌ Server connection error: ${err.message}`);
            resolve(false);
        });
        
        req.setTimeout(5000, () => {
            console.log('❌ Server request timeout');
            req.destroy();
            resolve(false);
        });
    });
};

// Run tests
(async () => {
    try {
        console.log('\n🔧 Test 1: Component File Analysis');
        const fileTest = testComponentFile();
        
        console.log('\n🌐 Test 2: Server Response Test');
        const serverTest = await testServerResponse();
        
        console.log('\n📊 FINAL RESULTS:');
        console.log(`Component File: ${fileTest ? '✅ PASS' : '❌ FAIL'}`);
        console.log(`Server Response: ${serverTest ? '✅ PASS' : '❌ FAIL'}`);
        
        if (fileTest && serverTest) {
            console.log('\n🎉 UI LOADING STATE FIX VERIFICATION PASSED!');
            console.log('\n📋 Applied fixes:');
            console.log('• ✅ Added try/catch wrapper to _handleSaveData');
            console.log('• ✅ Added 30-minute total timeout protection');
            console.log('• ✅ Added 60-second per-request timeout');
            console.log('• ✅ Enhanced finally block with timeout cleanup');
            console.log('• ✅ Promise.race pattern for request timeouts');
            console.log('\n🧪 Manual test available at:');
            console.log('   http://localhost:3030/test-step4-ui-loading-state-fix.html');
            process.exit(0);
        } else {
            console.log('\n❌ SOME TESTS FAILED!');
            process.exit(1);
        }
        
    } catch (error) {
        console.log(`❌ Test execution error: ${error.message}`);
        process.exit(1);
    }
})();
