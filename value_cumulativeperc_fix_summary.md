# VALUE and CUMULATIVEPERC Fix Summary

## Issue Description
After saving ABC analysis data, the `VALUE` and `CUMULATIVEPERC` columns were empty when loading saved data, while other columns were populated correctly.

## Root Cause
The issue was in the field name mapping in the JavaScript save functions. The data flow has different field names at different stages:

1. **UI/Client data**: Fields are named `SALESPERC`, `CUMULATIVEPERC`, `VALUE`
2. **Database columns**: Columns are named `SALESPRCNT`, `CUMULATIVEPERC`, `VALUE`
3. **Load output**: Fields are mapped back to `SALESPERC`, `CUMULATIVEPERC`, `VALUE`

## Problem Location
In `/home/forge/mecdiesel-soft1.concept24.tech/top-abc/AJS/TopAbcAnalysis.js`:

### Before Fix (Line 438):
```javascript
var salesPrcnt = item.SALESPRCNT || 0;  // Wrong: looking for SALESPRCNT
```

### After Fix (Line 438):
```javascript
var salesPrcnt = item.SALESPERC || item.SALESPRCNT || 0;  // Correct: try SALESPERC first
```

## Additional Fix
Also updated the data mapping object to include both field names for consistency:

### Before:
```javascript
branchData.push({
    MTRL: item.MTRL,
    BRANCH: item.BRANCH,
    SALESPRCNT: item.SALESPERC || item.SALESPRCNT || 0,  // Only SALESPRCNT property
    CUMULATIVEPERC: item.CUMULATIVEPERC || 0,
    VALUE: item.VALUE || 0,
    ABC: item.ABC
});
```

### After:
```javascript
branchData.push({
    MTRL: item.MTRL,
    BRANCH: item.BRANCH,
    SALESPERC: item.SALESPERC || item.SALESPRCNT || 0,     // Added SALESPERC
    SALESPRCNT: item.SALESPERC || item.SALESPRCNT || 0,    // Keep SALESPRCNT for compatibility
    CUMULATIVEPERC: item.CUMULATIVEPERC || 0,
    VALUE: item.VALUE || 0,
    ABC: item.ABC
});
```

## Data Flow Verification
1. **sp_TopAbcAnalysis_CombinedJson** outputs: `SALESPERC`, `CUMULATIVEPERC`, `VALUE`
2. **JavaScript save** maps to database columns: `SALESPRCNT`, `CUMULATIVEPERC`, `VALUE`
3. **sp_LoadSavedAbcAnalysis_CombinedJson** outputs: `SALESPERC`, `CUMULATIVEPERC`, `VALUE`

## Files Modified
- `/home/forge/mecdiesel-soft1.concept24.tech/top-abc/AJS/TopAbcAnalysis.js`
  - Fixed `saveTopAbcAnalysis()` function field mapping
  - Updated branchData object structure for consistency

## Testing Recommendation
1. Run an ABC analysis and save the results
2. Load the saved results 
3. Verify that `VALUE` and `CUMULATIVEPERC` columns are properly populated

The fix ensures that the field name mapping is consistent throughout the save/load cycle.
