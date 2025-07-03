## DATATABLE_FILTER_CACHE_FIX_DOCUMENTATION.md

### Problem Description

An intermittent bug was identified where the `data-table` component would occasionally display "0 items" after new data was loaded into the `replenishment-store`, even though the store contained the full dataset. This behavior was inconsistent, sometimes showing the correct data and other times showing none, indicating a state synchronization or caching issue.

### Root Cause Analysis

The root cause was traced to a flaw in the `_invalidateCache` method within `replenishment-store.js`. The cache key for filtered data is dynamically generated to include sort parameters (e.g., `filteredData_Cod_asc`). 

The invalidation logic was attempting to delete a static key named `filteredData`, which did not exist. It failed to remove the dynamically named cache entries (e.g., `filteredData_Cod_asc`, `filteredData_null_asc`). As a result, when data was updated, the old cached (and often empty) filtered result was being served to the `data-table`, leading to the display of "0 items".

### Solution

The `_invalidateCache` method was updated to correctly handle the invalidation of `filteredData`. The new logic iterates through all keys in the cache and removes any key that **starts with** the prefix `filteredData`. This ensures that all variations of the filtered data cache are cleared whenever the underlying data or filter criteria change.

**Original (Buggy) Code:**
```javascript
// ...
_invalidateCache(keys = null) {
  // ...
  const keysArray = Array.isArray(keys) ? keys : [keys];
  keysArray.forEach(key => this._cachedComputedValues.delete(key));
}
```

**Corrected Code:**
```javascript
// ...
_invalidateCache(keys = null) {
  if (keys === null) {
    this._cachedComputedValues.clear();
    return;
  }

  const keysArray = Array.isArray(keys) ? keys : [keys];
  keysArray.forEach(key => {
    if (key === 'filteredData') {
      // Invalidate all cache entries starting with 'filteredData'
      for (const cacheKey of this._cachedComputedValues.keys()) {
        if (cacheKey.startsWith('filteredData')) {
          this._cachedComputedValues.delete(cacheKey);
        }
      }
    } else {
      this._cachedComputedValues.delete(key);
    }
  });
}
```

### Verification

The fix was verified by running the `test-datatable-store-integration.html` test case multiple times. After the fix, the `data-table` now reliably and consistently displays the correct number of items after each data load, and the intermittent "0 items" issue has been resolved.
