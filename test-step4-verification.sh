#!/bin/bash

echo "🚀 VERIFICARE STEP 4: REAL TRANSFER TO SOFTONE"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check if a file exists
check_file() {
    if [ -f "$1" ]; then
        echo -e "  ${GREEN}✅${NC} $1"
        return 0
    else
        echo -e "  ${RED}❌${NC} $1"
        return 1
    fi
}

# Function to check for specific content in files
check_content() {
    local file="$1"
    local pattern="$2"
    local description="$3"
    
    if grep -q "$pattern" "$file" 2>/dev/null; then
        echo -e "  ${GREEN}✅${NC} $description"
        return 0
    else
        echo -e "  ${RED}❌${NC} $description"
        return 1
    fi
}

# Function to check for method implementation
check_method() {
    local file="$1"
    local method="$2"
    local description="$3"
    
    if grep -A 5 "async $method" "$file" >/dev/null 2>&1; then
        echo -e "  ${GREEN}✅${NC} $description implementată"
        return 0
    else
        echo -e "  ${RED}❌${NC} $description NU este implementată"
        return 1
    fi
}

echo "📁 Verificare fișiere necesare pentru Step 4..."
check_file "public/components/branch-replenishment-container.js"
check_file "src/app.js"
check_file "test-step4-real-transfer.html"
check_file "test-save-to-s1-workflow.html"
check_file "test-save-to-s1-verification.sh"

echo ""
echo "🔧 Verificare implementare backend (src/app.js)..."
check_method "src/app.js" "setData" "Metoda setData"
check_content "src/app.js" "setData.*Added for SoftOne transfer orders" "Comentariu pentru setData"
check_content "src/app.js" "app.use.*s1.*new s1Service" "Serviciu s1 înregistrat"
check_content "src/app.js" "request-promise" "Request-promise importat"

echo ""
echo "🖥️ Verificare implementare frontend..."
check_method "public/components/branch-replenishment-container.js" "_sendSingleTransferOrder" "Metoda _sendSingleTransferOrder"
check_method "public/components/branch-replenishment-container.js" "_buildS1Payload" "Metoda _buildS1Payload"
check_method "public/components/branch-replenishment-container.js" "acquireS1Token" "Metoda acquireS1Token"
check_method "public/components/branch-replenishment-container.js" "makeAuthenticatedCall" "Metoda makeAuthenticatedCall"

echo ""
echo "🔍 Verificare caracteristici specifice Step 4..."

# Check for TEST MODE vs REAL MODE capability
if grep -q "TEST MODE" public/components/branch-replenishment-container.js; then
    echo -e "  ${YELLOW}⚠️${NC} TEST MODE detectat - ready for transition to REAL"
else
    echo -e "  ${GREEN}✅${NC} REAL MODE implementat"
fi

# Check for retry logic indicators
check_content "public/components/branch-replenishment-container.js" "retry\|Retry\|maxRetries" "Retry logic pregătit"

# Check for error handling
check_content "public/components/branch-replenishment-container.js" "catch.*error\|Error.*handling" "Error handling implementat"

# Check for authentication token management
check_content "public/components/branch-replenishment-container.js" "acquireS1Token\|clientID.*token" "Token management implementat"

echo ""
echo "📋 Verificare structură JSON payload..."

# Check for setData service structure
check_content "public/components/branch-replenishment-container.js" '"service": "setData"' "Service setData în payload"
check_content "public/components/branch-replenishment-container.js" '"appId": 2002\|appId.*2002' "AppId 2002 în payload"
check_content "public/components/branch-replenishment-container.js" '"OBJECT": "ITEDOC"' "OBJECT ITEDOC în payload"
check_content "public/components/branch-replenishment-container.js" '"FORM": "Mec - Comenzi sucursale"' "FORM Mec în payload"
check_content "public/components/branch-replenishment-container.js" 'ITELINES' "ITELINES în payload"

echo ""
echo "🔐 Verificare autentificare S1..."

# Check authentication methods
check_content "public/components/branch-replenishment-container.js" "login.*authenticate" "Login și authenticate în workflow"
check_content "public/components/branch-replenishment-container.js" "ping.*login.*authenticate" "Secvență completă de autentificare"
check_content "public/components/branch-replenishment-container.js" 'BRANCHNAME.*HQ' "Detectare HQ branch pentru auth"

echo ""
echo "🧪 Verificare teste implementate..."
check_file "test-step4-real-transfer.html"

if [ -f "test-step4-real-transfer.html" ]; then
    check_content "test-step4-real-transfer.html" "testBackendSetData" "Test backend setData"
    check_content "test-step4-real-transfer.html" "testS1Authentication" "Test autentificare S1"
    check_content "test-step4-real-transfer.html" "generateTestPayload" "Test generare payload"
    check_content "test-step4-real-transfer.html" "performRealTransfer" "Test transfer real"
    check_content "test-step4-real-transfer.html" "testRetryLogic" "Test retry logic"
    check_content "test-step4-real-transfer.html" "testErrorHandling" "Test error handling"
fi

echo ""
echo "📊 STATISTICI IMPLEMENTARE STEP 4:"
echo "=================================="

# Count lines of code
if [ -f "public/components/branch-replenishment-container.js" ]; then
    total_lines=$(wc -l < public/components/branch-replenishment-container.js)
    echo "  • Total linii în container: $total_lines"
fi

# Count methods in container
if [ -f "public/components/branch-replenishment-container.js" ]; then
    method_count=$(grep -c "^[[:space:]]*async\|^[[:space:]]*[a-zA-Z_][a-zA-Z0-9_]*.*{" public/components/branch-replenishment-container.js || echo "0")
    echo "  • Total metode detectate: $method_count"
fi

# Count S1 related methods in backend
if [ -f "src/app.js" ]; then
    s1_methods=$(grep -c "async.*(" src/app.js || echo "0")
    echo "  • Metode S1 în backend: $s1_methods"
fi

echo ""
echo "🎯 URMĂTORII PAȘI PENTRU STEP 4:"
echo "================================"

echo -e "${BLUE}1. TESTARE ÎN BROWSER:${NC}"
echo "   • Deschide: file://$(pwd)/test-step4-real-transfer.html"
echo "   • Rulează testele pas cu pas"
echo "   • Verifică autentificarea S1"
echo "   • Testează generarea payload-ului"

echo ""
echo -e "${BLUE}2. MODIFICARE PENTRU PRODUCȚIE:${NC}"
echo "   • În _sendSingleTransferOrder, înlocuiește TEST MODE cu:"
echo "     - Apel real către client.service('s1').setData()"
echo "     - Retry logic pentru erorile de rețea"
echo "     - Error handling pentru răspunsurile SoftOne"

echo ""
echo -e "${BLUE}3. IMPLEMENTARE RETRY LOGIC:${NC}"
echo "   • Adaugă parametru maxRetries în _sendSingleTransferOrder"
echo "   • Implementează exponential backoff"
echo "   • Diferențiază erorile retryable vs non-retryable"

echo ""
echo -e "${BLUE}4. MONITORIZARE ȘI LOGGING:${NC}"
echo "   • Adaugă logging pentru fiecare transfer"
echo "   • Implementează metrici pentru succes/failure rate"
echo "   • Creează alerting pentru erorile critice"

echo ""
echo "🔄 Pentru a rula verificarea completă anterior:"
echo "   ./test-save-to-s1-verification.sh"

echo ""
echo "📁 Pentru testare manuală completă:"
echo "   file://$(pwd)/test-save-to-s1-workflow.html"

echo ""
if [ -f "test-step4-real-transfer.html" ]; then
    echo -e "${GREEN}✅ STEP 4 READY FOR TESTING!${NC}"
    echo "   Deschide test-step4-real-transfer.html pentru testare avansată"
else
    echo -e "${RED}❌ Test files for Step 4 missing${NC}"
fi
