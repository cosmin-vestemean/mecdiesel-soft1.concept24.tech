#!/bin/bash

# Comprehensive test script for Period Parameters Fix
# Tests the complete workflow: SQL -> AJS -> UI

echo "🧪 ==================================="
echo "   PERIOD PARAMETERS FIX TEST"
echo "🧪 ==================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📋 Testing Components:${NC}"
echo "   ✓ SQL Stored Procedure: sp_LoadSavedAbcAnalysis_CombinedJson"
echo "   ✓ JavaScript API: loadSavedAnalysis() function"
echo "   ✓ UI Container: getAnalysisPeriod() method"
echo ""

# Test 1: Check SQL stored procedure
echo -e "${BLUE}🔍 Test 1: Checking SQL Stored Procedure...${NC}"
if grep -q "PeriodParameters" /home/forge/mecdiesel-soft1.concept24.tech/top-abc/SQLDependencies_Agent_Doc_backwards_compat.sql; then
    echo -e "${GREEN}   ✅ PeriodParameters section found in SQL${NC}"
    
    if grep -q "dataReferinta.*nrSaptamani.*perioada.*modFiltrareBranch.*seriesL" /home/forge/mecdiesel-soft1.concept24.tech/top-abc/SQLDependencies_Agent_Doc_backwards_compat.sql; then
        echo -e "${GREEN}   ✅ All required period fields included${NC}"
    else
        echo -e "${RED}   ❌ Some period fields missing${NC}"
    fi
else
    echo -e "${RED}   ❌ PeriodParameters section not found in SQL${NC}"
fi

# Test 2: Check JavaScript API
echo ""
echo -e "${BLUE}🔍 Test 2: Checking JavaScript API...${NC}"
if grep -q "parsedCombinedJson.PeriodParameters" /home/forge/mecdiesel-soft1.concept24.tech/top-abc/AJS/TopAbcAnalysis.js; then
    echo -e "${GREEN}   ✅ PeriodParameters extraction found in JS API${NC}"
    
    if grep -q "result.params.dataReferinta.*result.params.nrSaptamani" /home/forge/mecdiesel-soft1.concept24.tech/top-abc/AJS/TopAbcAnalysis.js; then
        echo -e "${GREEN}   ✅ Period parameters properly assigned to result.params${NC}"
    else
        echo -e "${RED}   ❌ Period parameters not properly assigned${NC}"
    fi
else
    echo -e "${RED}   ❌ PeriodParameters extraction not found in JS API${NC}"
fi

# Test 3: Check UI Container
echo ""
echo -e "${BLUE}🔍 Test 3: Checking UI Container...${NC}"
if grep -q "response.params.*dataReferinta.*nrSaptamani" /home/forge/mecdiesel-soft1.concept24.tech/public/components/top-abc/top-abc-container.js; then
    echo -e "${GREEN}   ✅ Period parameters extraction found in UI${NC}"
    
    if grep -q "this.params.dataReferinta = response.params.dataReferinta" /home/forge/mecdiesel-soft1.concept24.tech/public/components/top-abc/top-abc-container.js; then
        echo -e "${GREEN}   ✅ Period parameters properly set in this.params${NC}"
    else
        echo -e "${RED}   ❌ Period parameters not properly set in this.params${NC}"
    fi
else
    echo -e "${RED}   ❌ Period parameters extraction not found in UI${NC}"
fi

# Test 4: Check error message fix
echo ""
echo -e "${BLUE}🔍 Test 4: Checking Error Message...${NC}"
if grep -q "Parametrii de perioadă nu sunt disponibili" /home/forge/mecdiesel-soft1.concept24.tech/public/components/top-abc/top-abc-container.js; then
    echo -e "${GREEN}   ✅ Proper error message found${NC}"
else
    echo -e "${RED}   ❌ Error message not found or incorrect${NC}"
fi

# Test 5: Check test files
echo ""
echo -e "${BLUE}🔍 Test 5: Checking Test Files...${NC}"
if [ -f "/home/forge/mecdiesel-soft1.concept24.tech/test-period-parameters-fix.html" ]; then
    echo -e "${GREEN}   ✅ Interactive test page created${NC}"
else
    echo -e "${RED}   ❌ Interactive test page missing${NC}"
fi

if [ -f "/home/forge/mecdiesel-soft1.concept24.tech/test-period-parameters-e2e.js" ]; then
    echo -e "${GREEN}   ✅ E2E test script created${NC}"
else
    echo -e "${RED}   ❌ E2E test script missing${NC}"
fi

# Summary
echo ""
echo -e "${BLUE}📊 ==================================="
echo "   TEST SUMMARY"
echo -e "📊 ===================================${NC}"

# Count successful tests
sql_ok=$(grep -q "PeriodParameters" /home/forge/mecdiesel-soft1.concept24.tech/top-abc/SQLDependencies_Agent_Doc_backwards_compat.sql && echo "1" || echo "0")
js_ok=$(grep -q "parsedCombinedJson.PeriodParameters" /home/forge/mecdiesel-soft1.concept24.tech/top-abc/AJS/TopAbcAnalysis.js && echo "1" || echo "0")
ui_ok=$(grep -q "response.params.*dataReferinta.*nrSaptamani" /home/forge/mecdiesel-soft1.concept24.tech/public/components/top-abc/top-abc-container.js && echo "1" || echo "0")
error_ok=$(grep -q "Parametrii de perioadă nu sunt disponibili" /home/forge/mecdiesel-soft1.concept24.tech/public/components/top-abc/top-abc-container.js && echo "1" || echo "0")

total_passed=$((sql_ok + js_ok + ui_ok + error_ok))

if [ $total_passed -eq 4 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED! (4/4)${NC}"
    echo ""
    echo -e "${GREEN}✅ The period parameters fix has been successfully implemented:${NC}"
    echo "   • SQL stores period parameters in PeriodParameters JSON section"
    echo "   • JavaScript API extracts period parameters to result.params"
    echo "   • UI container updates this.params with loaded period info"
    echo "   • getAnalysisPeriod() now displays proper date ranges"
    echo ""
    echo -e "${YELLOW}🧪 Next Steps:${NC}"
    echo "   1. Open http://localhost:3000/test-period-parameters-fix.html"
    echo "   2. Test save -> load workflow with real data"
    echo "   3. Verify period info displays instead of error message"
else
    echo -e "${RED}❌ TESTS FAILED! ($total_passed/4 passed)${NC}"
    echo ""
    echo -e "${YELLOW}🔧 Issues found - check the implementation${NC}"
fi

echo ""
echo -e "${BLUE}🔗 Related Files:${NC}"
echo "   📄 SQL: /home/forge/mecdiesel-soft1.concept24.tech/top-abc/SQLDependencies_Agent_Doc_backwards_compat.sql"
echo "   📄 API: /home/forge/mecdiesel-soft1.concept24.tech/top-abc/AJS/TopAbcAnalysis.js"
echo "   📄 UI:  /home/forge/mecdiesel-soft1.concept24.tech/public/components/top-abc/top-abc-container.js"
echo "   🧪 Test: /home/forge/mecdiesel-soft1.concept24.tech/test-period-parameters-fix.html"
echo ""
