# Material Code Filter Reset Issue - FIXED

## 🐛 Problem
When the "Load Data" button was clicked, the material code filter was being cleared because `resetSearchFilters()` was incorrectly treating it as a search filter.

## 🔍 Root Cause
The `materialCodeFilter` was being cleared in the `RESET_SEARCH_FILTERS` action, but it should be treated as a **data loading parameter** (like `branchesEmit` and `selectedDestBranches`), not a search filter that operates on already loaded data.

## ✅ Solution
Removed `materialCodeFilter` from the `RESET_SEARCH_FILTERS` action so it's preserved during normal data loading.

### What was changed:
```javascript
// BEFORE (incorrect):
case 'RESET_SEARCH_FILTERS':
  newState.searchTerm = '';
  newState.materialCodeFilter = '';  // ❌ This was wrong!
  newState.transferFilter = 'all';
  break;

// AFTER (correct):
case 'RESET_SEARCH_FILTERS':
  newState.searchTerm = '';
  // materialCodeFilter is NOT reset here ✅
  newState.transferFilter = 'all';
  break;
```

## 🎯 Behavior Now

### When "Load Data" is clicked:
- ✅ `searchTerm` is cleared (correct - search operates on loaded data)
- ✅ `transferFilter` is reset to 'all' (correct - filter operates on loaded data)  
- ✅ `materialCodeFilter` is preserved (correct - parameter affects what data to load)

### When user explicitly resets:
- `resetAllFilters()` → ✅ Clears materialCodeFilter (correct)
- `resetData()` → ✅ Clears materialCodeFilter (correct)

## 🧪 Testing
Created `test-material-code-filter-reset.html` to verify the fix works correctly.

## 📋 Filter Classification

### Data Loading Parameters (preserved during data loading):
- `branchesEmit` 
- `selectedDestBranches`
- `materialCodeFilter` ✅
- `setConditionForNecesar`
- `setConditionForLimits`
- `fiscalYear`

### Search/UI Filters (reset during data loading):
- `searchTerm`
- `transferFilter` 
- `destinationFilter`
- `abcFilter`
- `blacklistedFilter`
- `lichidareFilter`
- `numberFilters`

## 🎉 Result
Users can now set a material code filter and it will be preserved when they click "Load Data", allowing them to load only the materials they're interested in from the database.
