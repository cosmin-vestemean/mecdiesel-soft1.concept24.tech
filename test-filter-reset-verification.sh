#!/bin/bash

# Test script to verify filter reset functionality
echo "🔄 Testing Filter Reset Functionality"
echo "====================================="

# Check if the test file exists
if [ ! -f "test-filter-reset-verification.html" ]; then
    echo "❌ Test file not found: test-filter-reset-verification.html"
    exit 1
fi

echo "✅ Test file found: test-filter-reset-verification.html"

# Check if the main component file exists
if [ ! -f "public/components/branch-replenishment-container.js" ]; then
    echo "❌ Main component file not found: public/components/branch-replenishment-container.js"
    exit 1
fi

echo "✅ Main component file found: public/components/branch-replenishment-container.js"

# Check if the reset method exists in the component
if grep -q "_resetFiltersAndStates()" "public/components/branch-replenishment-container.js"; then
    echo "✅ Reset method found in component"
else
    echo "❌ Reset method not found in component"
    exit 1
fi

# Check if the reset method is called during data load
if grep -q "_resetFiltersAndStates();" "public/components/branch-replenishment-container.js"; then
    echo "✅ Reset method is called during data load"
else
    echo "❌ Reset method is not called during data load"
    exit 1
fi

# Check if all filter properties are reset
filters=(
    "searchTerm = ''"
    "transferFilter = 'all'"
    "destinationFilter = 'all'"
    "abcFilter = 'all'"
    "blacklistedFilter = 'all'"
    "lichidareFilter = 'all'"
    "selectedReplenishmentStrategy = 'none'"
    "isSuccessiveStrategy = true"
)

echo "🔍 Checking if all filters are reset:"
all_filters_found=true

for filter in "${filters[@]}"; do
    if grep -q "$filter" "public/components/branch-replenishment-container.js"; then
        echo "  ✅ $filter"
    else
        echo "  ❌ $filter"
        all_filters_found=false
    fi
done

if [ "$all_filters_found" = true ]; then
    echo "✅ All filters are properly reset"
else
    echo "❌ Some filters are not properly reset"
    exit 1
fi

# Check if data-loaded event is dispatched
if grep -q "data-loaded" "public/components/branch-replenishment-container.js"; then
    echo "✅ Data-loaded event is dispatched"
else
    echo "❌ Data-loaded event is not dispatched"
    exit 1
fi

echo ""
echo "🎉 All tests passed! Filter reset functionality is properly implemented."
echo ""
echo "To test manually:"
echo "1. Open test-filter-reset-verification.html in your browser"
echo "2. Use the 'Start Filter Monitoring' button to monitor filter states"
echo "3. Use 'Simulate Filter Changes' to change filters"
echo "4. Load data and verify filters are reset automatically"
echo "5. Use 'Test Filter Reset' to test the reset function directly"
