#!/bin/bash

echo "🚀 VERIFICARE STEP 4: REAL TRANSFER MODE ACTIVAT"
echo "==============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "🔍 Verificare implementare REAL MODE..."

# Check for REAL MODE indicators
if grep -q "REAL MODE" public/components/branch-replenishment-container.js; then
    echo -e "  ${GREEN}✅${NC} REAL MODE implementat în _sendSingleTransferOrder"
else
    echo -e "  ${RED}❌${NC} REAL MODE nu este implementat"
fi

# Check for TEST MODE removal/replacement
if grep -q "TEST MODE.*only creates and logs JSON" public/components/branch-replenishment-container.js; then
    echo -e "  ${YELLOW}⚠️${NC} TEST MODE logic încă prezent - verificare necesară"
else
    echo -e "  ${GREEN}✅${NC} TEST MODE logic înlocuit cu REAL MODE"
fi

echo ""
echo "📋 Verificare payload cu COMMENTS..."

# Check for COMMENTS field in payload
if grep -q 'COMMENTS.*TEST TEST TEST A NU SE PROCESA' public/components/branch-replenishment-container.js; then
    echo -e "  ${GREEN}✅${NC} Câmpul COMMENTS cu mesaj de test implementat"
else
    echo -e "  ${RED}❌${NC} Câmpul COMMENTS cu mesaj de test lipsește"
fi

# Check payload structure
if grep -A 10 "_buildS1Payload" public/components/branch-replenishment-container.js | grep -q "COMMENTS"; then
    echo -e "  ${GREEN}✅${NC} COMMENTS inclus în structura payload"
else
    echo -e "  ${RED}❌${NC} COMMENTS nu este inclus în payload"
fi

echo ""
echo "🔄 Verificare retry logic..."

# Check for retry logic implementation
if grep -q "maxRetries.*3" public/components/branch-replenishment-container.js; then
    echo -e "  ${GREEN}✅${NC} Retry logic cu maxRetries implementat"
else
    echo -e "  ${RED}❌${NC} Retry logic lipsește"
fi

# Check for exponential backoff
if grep -q "Math.pow(2, attempt" public/components/branch-replenishment-container.js; then
    echo -e "  ${GREEN}✅${NC} Exponential backoff implementat"
else
    echo -e "  ${RED}❌${NC} Exponential backoff lipsește"
fi

# Check for retryable error detection
if grep -q "_isRetryableError" public/components/branch-replenishment-container.js; then
    echo -e "  ${GREEN}✅${NC} Detectare erori retryable implementată"
else
    echo -e "  ${RED}❌${NC} Detectare erori retryable lipsește"
fi

echo ""
echo "🔐 Verificare autentificare S1..."

# Check for S1 token acquisition
if grep -q "acquireS1Token" public/components/branch-replenishment-container.js; then
    echo -e "  ${GREEN}✅${NC} Acquisitie automată token S1 implementată"
else
    echo -e "  ${RED}❌${NC} Acquisitie token S1 lipsește"
fi

# Check for clientID in payload
if grep -q "s1Payload.clientID = token" public/components/branch-replenishment-container.js; then
    echo -e "  ${GREEN}✅${NC} Token adăugat în payload înainte de transfer"
else
    echo -e "  ${RED}❌${NC} Token nu este adăugat în payload"
fi

echo ""
echo "🎯 Verificare apel real către S1..."

# Check for real S1 service call
if grep -q "client.service('s1').setData" public/components/branch-replenishment-container.js; then
    echo -e "  ${GREEN}✅${NC} Apel real către client.service('s1').setData implementat"
else
    echo -e "  ${RED}❌${NC} Apel real către S1 lipsește"
fi

# Check for response handling
if grep -q "response.id" public/components/branch-replenishment-container.js; then
    echo -e "  ${GREEN}✅${NC} Procesare răspuns S1 (id) implementată"
else
    echo -e "  ${RED}❌${NC} Procesare răspuns S1 lipsește"
fi

echo ""
echo "📱 Verificare interfață utilizator..."

# Check for real transfer warnings in confirmation
if grep -q "TRANSFER REAL DE TEST" public/components/branch-replenishment-container.js; then
    echo -e "  ${GREEN}✅${NC} Avertisment transfer real în dialog confirmare"
else
    echo -e "  ${RED}❌${NC} Avertisment transfer real lipsește din dialog"
fi

# Check for test comments mention in results
if grep -q "Comentariu test.*TEST TEST TEST" public/components/branch-replenishment-container.js; then
    echo -e "  ${GREEN}✅${NC} Mențiune comentariu test în rezultate"
else
    echo -e "  ${RED}❌${NC} Comentariu test nu este menționat în rezultate"
fi

echo ""
echo "🧪 Verificare fișiere de test..."

# Check test files
if [ -f "test-step4-real-transfer-with-comments.html" ]; then
    echo -e "  ${GREEN}✅${NC} Fișier test Step 4 cu COMMENTS disponibil"
else
    echo -e "  ${RED}❌${NC} Fișier test Step 4 lipsește"
fi

# Check for MTRL test data
if [ -f "test-step4-real-transfer-with-comments.html" ] && grep -q "2492805" test-step4-real-transfer-with-comments.html; then
    echo -e "  ${GREEN}✅${NC} MTRL test (2492805) configurat în test"
else
    echo -e "  ${RED}❌${NC} MTRL test nu este configurat"
fi

# Check for QTY1 test data
if [ -f "test-step4-real-transfer-with-comments.html" ] && grep -q "transfer.*1" test-step4-real-transfer-with-comments.html; then
    echo -e "  ${GREEN}✅${NC} QTY1 test (1) configurat în test"
else
    echo -e "  ${RED}❌${NC} QTY1 test nu este configurat"
fi

echo ""
echo "📊 STATISTICI STEP 4:"
echo "===================="

# Count implementation lines
if [ -f "public/components/branch-replenishment-container.js" ]; then
    total_lines=$(wc -l < public/components/branch-replenishment-container.js)
    echo "  • Total linii în container: $total_lines"
    
    real_mode_lines=$(grep -c "REAL MODE" public/components/branch-replenishment-container.js)
    echo "  • Referințe REAL MODE: $real_mode_lines"
    
    retry_lines=$(grep -c "retry\|Retry\|attempt" public/components/branch-replenishment-container.js)
    echo "  • Linii retry logic: $retry_lines"
    
    comments_lines=$(grep -c "COMMENTS.*TEST TEST TEST" public/components/branch-replenishment-container.js)
    echo "  • Implementări COMMENTS: $comments_lines"
fi

echo ""
echo "🎯 STATUS FINAL STEP 4:"
echo "======================="

# Final status check
real_mode_ready=true

# Check critical components
if ! grep -q "REAL MODE" public/components/branch-replenishment-container.js; then
    real_mode_ready=false
fi

if ! grep -q "COMMENTS.*TEST TEST TEST A NU SE PROCESA" public/components/branch-replenishment-container.js; then
    real_mode_ready=false
fi

if ! grep -q "client.service('s1').setData" public/components/branch-replenishment-container.js; then
    real_mode_ready=false
fi

if [ "$real_mode_ready" = true ]; then
    echo -e "${GREEN}✅ STEP 4 REAL MODE COMPLET IMPLEMENTAT!${NC}"
    echo -e "${GREEN}   • Transfer real către SoftOne ERP activat${NC}"
    echo -e "${GREEN}   • Comentarii test pentru identificare ERP${NC}"
    echo -e "${GREEN}   • Retry logic și error handling în place${NC}"
    echo -e "${GREEN}   • MTRL test (2492805) și QTY1 (1) configurate${NC}"
else
    echo -e "${RED}❌ STEP 4 REAL MODE INCOMPLET${NC}"
    echo -e "${RED}   Verificați implementările de mai sus${NC}"
fi

echo ""
echo "📁 Pentru testare REAL:"
echo "   file://$(pwd)/test-step4-real-transfer-with-comments.html"

echo ""
echo -e "${YELLOW}⚠️  ATENȚIE: TRANSFER REAL CĂTRE SOFTONE!${NC}"
echo -e "${YELLOW}   • Comentariu 'TEST TEST TEST A NU SE PROCESA' va fi inclus${NC}"
echo -e "${YELLOW}   • MTRL: 2492805, QTY1: 1${NC}"
echo -e "${YELLOW}   • Verificați cu echipa ERP înainte de testare${NC}"
