// End-to-End Test for Period Parameters Fix
// This script tests the complete workflow: save analysis -> load analysis -> verify period parameters

console.log('🧪 Starting Period Parameters Fix E2E Test...');

async function testPeriodParametersFix() {
    try {
        // Test configuration
        const testParams = {
            dataReferinta: '2025-05-26',
            nrSaptamani: 12,
            seriesL: '',
            branch: '1200',
            supplier: null,
            mtrl: null,
            cod: '',
            searchType: 1,
            modFiltrareBranch: 'AGENT',
            thresholdA: 80,
            thresholdB: 15
        };

        const token = sessionStorage.getItem('s1Token') || 'test-token-12345';
        
        console.log('📋 Test Configuration:', testParams);
        
        // Step 1: Generate fresh analysis data
        console.log('\n🔄 Step 1: Generating fresh ABC analysis data...');
        const analysisResponse = await client.service('top-abc').getTopAbcAnalysis({
            token: token,
            ...testParams
        });

        if (!analysisResponse.success) {
            throw new Error(`Analysis generation failed: ${analysisResponse.message}`);
        }

        console.log(`✅ Generated ${analysisResponse.rows.length} analysis items`);
        
        // Step 2: Save the analysis data
        console.log('\n💾 Step 2: Saving analysis data...');
        const saveResponse = await client.service('top-abc').saveTopAbcAnalysis({
            token: token,
            dataReferinta: testParams.dataReferinta,
            nrSaptamani: testParams.nrSaptamani,
            seriesL: testParams.seriesL,
            branch: testParams.branch,
            supplier: testParams.supplier,
            mtrl: testParams.mtrl,
            cod: testParams.cod,
            searchType: testParams.searchType,
            modFiltrareBranch: testParams.modFiltrareBranch,
            thresholdA: testParams.thresholdA,
            thresholdB: testParams.thresholdB,
            data: analysisResponse.rows,
            summary: analysisResponse.summary || []
        });

        if (!saveResponse.success) {
            throw new Error(`Save operation failed: ${saveResponse.message}`);
        }

        console.log('✅ Analysis data saved successfully');
        
        // Step 3: Load the saved analysis and test period parameters
        console.log('\n📥 Step 3: Loading saved analysis and testing period parameters...');
        const loadResponse = await client.service('top-abc').loadSavedAnalysis({
            token: token,
            branch: testParams.branch
        });

        if (!loadResponse.success) {
            throw new Error(`Load operation failed: ${loadResponse.message}`);
        }

        console.log('✅ Saved analysis loaded successfully');
        
        // Step 4: Verify period parameters are included
        console.log('\n🔍 Step 4: Verifying period parameters...');
        
        // Check if period parameters are present in the response
        if (!loadResponse.params) {
            throw new Error('❌ FAILED: No params object in load response');
        }

        if (!loadResponse.params.dataReferinta) {
            throw new Error('❌ FAILED: dataReferinta missing from loaded params');
        }

        if (!loadResponse.params.nrSaptamani) {
            throw new Error('❌ FAILED: nrSaptamani missing from loaded params');
        }

        // Verify the period parameters match what we saved
        const expectedDate = testParams.dataReferinta;
        const expectedWeeks = testParams.nrSaptamani;
        const actualDate = loadResponse.params.dataReferinta;
        const actualWeeks = loadResponse.params.nrSaptamani;

        if (actualDate !== expectedDate) {
            throw new Error(`❌ FAILED: Date mismatch. Expected: ${expectedDate}, Got: ${actualDate}`);
        }

        if (actualWeeks !== expectedWeeks) {
            throw new Error(`❌ FAILED: Weeks mismatch. Expected: ${expectedWeeks}, Got: ${actualWeeks}`);
        }

        console.log('✅ Period parameters verified:', {
            dataReferinta: actualDate,
            nrSaptamani: actualWeeks,
            perioada: loadResponse.params.perioada,
            modFiltrareBranch: loadResponse.params.modFiltrareBranch,
            seriesL: loadResponse.params.seriesL
        });

        // Step 5: Test UI period display
        console.log('\n🖥️ Step 5: Testing UI period display...');
        
        // Simulate UI container with loaded parameters
        const mockContainer = {
            params: {
                dataReferinta: loadResponse.params.dataReferinta,
                nrSaptamani: loadResponse.params.nrSaptamani
            },
            getAnalysisPeriod() {
                if (!this.params.dataReferinta || !this.params.nrSaptamani) {
                    return 'Parametrii de perioadă nu sunt disponibili.';
                }

                const referenceDate = new Date(this.params.dataReferinta);
                const weeksAgo = this.params.nrSaptamani;
                
                const startDate = new Date(referenceDate);
                startDate.setDate(startDate.getDate() - (weeksAgo * 7));
                
                const formatDate = (date) => {
                    return date.toLocaleDateString('ro-RO', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit'
                    });
                };

                const startDateStr = formatDate(startDate);
                const endDateStr = formatDate(referenceDate);
                
                return `${startDateStr} - ${endDateStr} (${weeksAgo} săptămâni)`;
            }
        };

        const periodText = mockContainer.getAnalysisPeriod();
        
        if (periodText === 'Parametrii de perioadă nu sunt disponibili.') {
            throw new Error('❌ FAILED: UI still shows "Parametrii de perioadă nu sunt disponibili."');
        }

        console.log(`✅ UI period display working: "${periodText}"`);

        // Step 6: Final verification
        console.log('\n🎉 Step 6: Final verification...');
        
        const testResults = {
            success: true,
            message: 'Period parameters fix verified successfully',
            details: {
                analysisGenerated: analysisResponse.rows.length,
                dataSaved: saveResponse.success,
                dataLoaded: loadResponse.success,
                periodParametersPresent: true,
                dataReferinta: loadResponse.params.dataReferinta,
                nrSaptamani: loadResponse.params.nrSaptamani,
                uiDisplayWorking: true,
                periodDisplay: periodText
            }
        };

        console.log('\n✅ TEST PASSED - Period Parameters Fix Working!');
        console.log('📊 Test Results:', testResults);
        
        return testResults;

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.message);
        return {
            success: false,
            error: error.message,
            message: 'Period parameters fix test failed'
        };
    }
}

// Export test function for browser use
if (typeof window !== 'undefined') {
    window.testPeriodParametersFix = testPeriodParametersFix;
    console.log('💡 Call testPeriodParametersFix() to run the test');
}

// Export for Node.js use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { testPeriodParametersFix };
}
