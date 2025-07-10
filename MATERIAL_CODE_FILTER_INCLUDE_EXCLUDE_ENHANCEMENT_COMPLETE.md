# Material Code Filter Include/Exclude Enhancement - Complete Implementation

## Overview
Successfully implemented the enhancement to the branch replenishment system to allow users to filter materials by code using both "LIKE" (include) and "NOT LIKE" (exclude) SQL patterns. Users can now toggle between including or excluding materials that start with the specified code through a UI switch.

## Implementation Details

### 1. Database Layer (SQL)
**File:** `reumplere/sp_GetMtrlsDat.sql`

#### Changes Made:
- Added new parameter: `@materialCodeFilterExclude BIT = 0`
- Updated WHERE clause to support both include and exclude logic:
```sql
AND (@materialCodeFilter IS NULL OR (
    (@materialCodeFilterExclude = 0 AND m.Code LIKE @materialCodeFilter + '%') OR
    (@materialCodeFilterExclude = 1 AND m.Code NOT LIKE @materialCodeFilter + '%')
))
```

#### Logic:
- When `@materialCodeFilterExclude = 0` (Include mode): Uses `LIKE` pattern
- When `@materialCodeFilterExclude = 1` (Exclude mode): Uses `NOT LIKE` pattern
- Filter is applied at the database level for optimal performance

### 2. Backend Layer (ERP Service)
**File:** `reumplere/ReumplereSucursale.js`

#### Changes Made:
- Added parameter extraction: `var materialCodeFilterExclude = apiObj.hasOwnProperty('materialCodeFilterExclude') ? apiObj.materialCodeFilterExclude : false;`
- Updated stored procedure call to include the new parameter:
```javascript
", @materialCodeFilterExclude = " + (materialCodeFilterExclude ? "1" : "0");
```

#### Logic:
- Safely extracts the exclude flag from the API request
- Defaults to `false` (include mode) if not provided
- Passes the parameter to the stored procedure

### 3. API Layer (Express Service)
**File:** `src/app.js`

#### Changes Made:
- Added parameter to the API payload in `getAnalyticsForBranchReplenishment`:
```javascript
materialCodeFilterExclude: data.materialCodeFilterExclude !== undefined ? data.materialCodeFilterExclude : false
```

#### Logic:
- Extracts the exclude flag from the request data
- Ensures backward compatibility by defaulting to `false`
- Passes the parameter to the backend service

### 4. Store Layer (State Management)
**File:** `public/stores/replenishment-store.js`

#### Changes Made:
- Added state property: `materialCodeFilterExclude: false`
- Added action handler: `SET_MATERIAL_CODE_FILTER_EXCLUDE`
- Added method: `setMaterialCodeFilterExclude(exclude)`
- Updated filter cache keys to include the exclude flag
- Updated reset actions to include the exclude flag

#### Logic:
- Manages the exclude flag state centrally
- Invalidates filter cache when exclude mode changes
- Ensures the exclude flag is reset with other filters

### 5. UI Layer (Query Panel)
**File:** `public/components/query-panel.js`

#### Changes Made:
- Added property: `materialCodeFilterExclude: { type: Boolean }`
- Added toggle switch with dynamic labeling:
```html
<div class="form-check form-switch">
    <input class="form-check-input" type="checkbox" role="switch" id="materialCodeFilterExclude"
           .checked=${this.materialCodeFilterExclude}
           @change=${e => this._dispatchUpdate('materialCodeFilterExclude', e.target.checked)}
           ?disabled=${this.loading || !this.materialCodeFilter}>
    <label class="form-check-label small" for="materialCodeFilterExclude">
        ${this.materialCodeFilterExclude ? 'Exclude' : 'Include'}
    </label>
</div>
```
- Added dynamic help text showing current mode

#### Logic:
- Toggle is disabled when no material code filter is entered
- Label and help text dynamically update based on mode
- Integrates with the store for state management

### 6. Container Layer (Data Loading)
**File:** `public/components/branch-replenishment-container.js`

#### Changes Made:
- Added parameter to data loading call:
```javascript
materialCodeFilterExclude: currentState.materialCodeFilterExclude !== undefined ? currentState.materialCodeFilterExclude : false
```

#### Logic:
- Passes the exclude flag to the API when loading data
- Ensures backward compatibility with default value

## User Experience

### UI Features:
1. **Toggle Switch**: Bootstrap switch component that clearly shows Include/Exclude mode
2. **Dynamic Labels**: The switch label changes between "Include" and "Exclude"
3. **Smart Disabling**: The toggle is disabled when no material code filter is entered
4. **Contextual Help**: Dynamic help text explains what materials will be included/excluded
5. **Visual Feedback**: Different styling for include vs exclude mode

### Usage Flow:
1. User enters a material code filter (e.g., "AB")
2. Toggle becomes enabled
3. User can switch between "Include" and "Exclude" modes
4. Help text updates to show "Include/Exclude materials starting with 'AB'"
5. Data is loaded with the appropriate filter applied at the database level

## Testing

### Test File Created:
- `test-material-code-filter-exclude.html`: Interactive test page to verify the implementation

### Test Cases:
1. **Include Mode (Default)**: Filter shows only materials starting with the specified code
2. **Exclude Mode**: Filter shows all materials except those starting with the specified code
3. **Toggle Disabled**: When no filter is entered, toggle is disabled
4. **Dynamic Labels**: Labels update correctly based on mode
5. **API Parameters**: Correct parameters are sent to the backend

## Performance Considerations

### Database Performance:
- Filter is applied at the SQL level, reducing data transfer
- Uses indexed columns for optimal query performance
- Leverages existing infrastructure for consistent performance

### Frontend Performance:
- Filter state is managed centrally in the store
- Cache invalidation ensures UI stays synchronized
- Minimal re-renders through efficient state management

## Backward Compatibility

### Maintained Compatibility:
- All existing functionality remains unchanged
- Default behavior is "Include" mode (exclude = false)
- API endpoints maintain backward compatibility
- No breaking changes to existing code

## Error Handling

### Robust Error Handling:
- Safe parameter extraction with default values
- Graceful handling of missing parameters
- Proper boolean conversion in all layers
- No impact on existing error handling mechanisms

## Summary

The implementation successfully adds the requested "NOT LIKE" (exclude) functionality to the material code filter while maintaining:
- **Performance**: Database-level filtering
- **Usability**: Intuitive UI with clear visual feedback
- **Reliability**: Robust error handling and backward compatibility
- **Maintainability**: Clean separation of concerns across all layers

The enhancement is now fully functional and ready for use in the branch replenishment system.
