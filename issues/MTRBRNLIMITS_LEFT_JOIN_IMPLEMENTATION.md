# MTRBRNLIMITS LEFT JOIN Implementation TODOs

## 📋 Context
Schimbarea INNER JOIN → LEFT JOIN în `sp_GetMtrlsDat.sql` pentru a permite vizualizarea materialelor fără limite configurate.

## 🎯 Implementation Tasks

### SQL Changes
- [x] Modificare JOIN 1: MTRBRNLIMITS pentru Blacklisted (Linia 414)
  ```sql
  -- ✅ COMPLETED: Changed from INNER to LEFT JOIN
  LEFT JOIN MTRBRNLIMITS ml ON (...)
  ```
- [x] Modificare JOIN 2: BranchLimits pentru limite destinație (Linia 420)
  ```sql
  -- ✅ COMPLETED: Changed from INNER to LEFT JOIN
  LEFT JOIN #BranchLimits bl_dest ON (...)
  ```
- [x] Modificare JOIN 3: BranchLimits pentru limite emițător (Linia 262)
  ```sql
  -- ✅ COMPLETED: Changed from INNER to LEFT JOIN per client request
  LEFT JOIN #BranchLimits bl ON (...)
  -- ✅ Added ISNULL for MinE and MaxE (Linii 249-250)
  ISNULL(bl.MaxLimit, 0) MaxE,
  ISNULL(bl.MinLimit, 0) MinE
  ```
- [x] Tratare valori NULL în SELECT pentru destinație
  ```sql
  -- ✅ COMPLETED: Add ISNULL handling
  ISNULL(bl_dest.MinLimit, 0) AS min_dest,
  ISNULL(bl_dest.MaxLimit, 0) AS max_dest
  ```
- [x] Update Blacklisted column display
  ```sql
  -- ✅ COMPLETED: Handle NULL values for Blacklisted
  CASE WHEN ISNULL(ml.cccisblacklisted, 0) = 0 THEN 'Nu' ELSE 'Da' END AS Blacklisted
  ```
- [x] Update comentarii SQL pentru a reflecta decizia de business
  ```sql
  -- ✅ COMPLETED: Added clear comments explaining LEFT JOIN logic
  -- LEFT JOIN: Emit branches can have materials without limits configured
  -- Available quantity = Stock - ISNULL(MinMax, 0) - Reservations
  ```

### Testing
- [ ] Test Case 1: Comportament Default
  - [ ] Load cu `setConditionForLimits = true`
  - [ ] Verificare că rezultatele sunt identice cu versiunea actuală
  - [ ] Verificare performance baseline

- [ ] Test Case 2: Materiale Fără Limite
  - [ ] Load cu `setConditionForLimits = false`
  - [ ] Verificare că apar materiale noi
  - [ ] Verificare că limitele sunt 0 pentru materiale noi
  - [ ] Test filtre pe materiale fără limite

- [ ] Test Case 3: Diagnostic Feature
  - [ ] Verificare SCENARIO 2 (No limits for emit)
  - [ ] Verificare SCENARIO 3 (No limits for dest)
  - [ ] Verificare că diagnosticul arată corect materialele fără limite

- [ ] Test Case 4: UI/UX Flow
  - [ ] Verificare filtre UI pe toate tipurile de materiale
  - [ ] Test sortare după limite (inclusiv 0)
  - [ ] Verificare loading state și error handling

- [ ] Test Case 5: Performance
  - [ ] Măsurare timp execuție pentru diferite volume
  - [ ] Verificare memory usage
  - [ ] Optimizare dacă este necesar

### Documentation
- [ ] Update SQL Comments
  - [ ] Adăugare explicații pentru LEFT JOIN
  - [ ] Documentare tratare NULL

- [ ] Create Migration Guide
  - [ ] Explicare schimbări pentru echipă
  - [ ] Highlight backward compatibility
  - [ ] Document known edge cases

### Validation
- [ ] Code Review
  - [ ] SQL optimization check
  - [ ] NULL handling verification
  - [ ] Performance impact analysis

- [ ] Business Validation
  - [ ] Verificare cu end users
  - [ ] Confirmare că materialele noi sunt vizibile corect
  - [ ] Validare că diagnosticul ajută la troubleshooting

## 🎯 Post-Implementation Tasks

### Monitoring
- [ ] Setup monitoring pentru:
  - [ ] Execution time
  - [ ] Number of rows returned
  - [ ] Memory usage
  - [ ] Error rates

### Training
- [ ] Pregătire documentație pentru utilizatori
  - [ ] Explicare behavior nou
  - [ ] Cum să folosească diagnostic
  - [ ] Common troubleshooting

### Rollback Plan
```sql
-- Keep backup of original INNER JOIN version
-- Rollback if needed:
INNER JOIN MTRBRNLIMITS ml ON (...)
INNER JOIN #BranchLimits bl_dest ON (...)
```

## 📅 Timeline
- Day 1: SQL Changes & Initial Testing
- Day 2: Comprehensive Testing
- Day 3: Documentation & Training
- Day 4: Monitoring Setup & Go-Live

## 👥 Team
- SQL Developer
- Backend Developer
- UI/UX Tester
- Business Validator

## ⚠️ Known Risks
1. Performance impact cu volume mari
2. Edge cases cu NULL în coloane critice
3. UI rendering pentru multe rows

## 🎯 Success Criteria
1. Zero breaking changes
2. Materiale fără limite vizibile când `setConditionForLimits = false`
3. Diagnostic clar pentru troubleshooting
4. Performance acceptabilă
5. User feedback pozitiv