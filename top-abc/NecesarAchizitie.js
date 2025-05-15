/**
 * Necesar achizitie Module
 * =============================================
 * 
 * This module is executed within the Softone ERP environment to analyze and manage stock levels.
 * It provides functionality for ABC analysis and automated stock replenishment calculations.
 * 
 * API Endpoints:
 * -------------
 * - Article Search:    https://mecdiesel.oncloud.gr/s1services/JS/NecesarAchizitie/adaugaArticoleCfFiltre
 * - Replenishment:     https://mecdiesel.oncloud.gr/s1services/JS/NecesarAchizitie/adaugaArticole
 * - Single Item:       https://mecdiesel.oncloud.gr/s1services/JS/NecesarAchizitie/test_getSingleItemNeeds
 * - Test Endpoints:
 *   - Article Filter:  https://mecdiesel.oncloud.gr/s1services/JS/NecesarAchizitie/test_getArticoleCfFiltre
 *   - Needs Analysis: https://mecdiesel.oncloud.gr/s1services/JS/NecesarAchizitie/test_getCalculatedNeeds
 * 
 *TODO: Security
 * ---------
 * Access is restricted to web interface calls (X.SYS.USER === 104) for helper functions.
 */

/**
 * Returnează tipul de date al coloanei unei tabele.
 * @param {string} columnName - Numele coloanei.
 * @returns {string} Tipul de date al coloanei (text, varchar, int, etc.).
 */
function dbColumnType(columnName) {
    return X.GETSQLDATASET(
        "select b.name tableName, a.name columnName, c.name columnType from sys.columns a inner join sys.tables b on (a.object_id=b.object_id) " +
        "inner join sys.types c on (a.system_type_id=c.system_type_id) where b.name in ('mtrl') and a.name='" +
        columnName +
        "'",
        null
    ).columnType;
}

/**
 * Aplică filtre de tip string pentru căutare articole.
 * @param {string} filterColumnName - Numele coloanei pe care se aplică filtrul.
 * @param {string} txtVal - Valoarea pentru filtrare.
 * @param {number} signTxt - Tipul de filtrare (1: începe cu, 2: conține, 3: se termină cu).
 * @returns {string} Clauza SQL pentru filtrul text.
 */
function applyStringFilters(filterColumnName, txtVal, signTxt) {
    if (!txtVal) return "";

    // Escapare caractere speciale SQL
    var escapedTxtVal = txtVal.replace(/'/g, "''");
    escapedTxtVal = escapedTxtVal.replace(/%/g, "[%]");
    escapedTxtVal = escapedTxtVal.replace(/_/g, "[_]");
    escapedTxtVal = escapedTxtVal.replace(/!/g, "[!]");
    escapedTxtVal = escapedTxtVal.replace(/\[/g, "[[]");
    escapedTxtVal = escapedTxtVal.replace(/\]/g, "[]]");
    escapedTxtVal = escapedTxtVal.replace(/\^/g, "[^]");
    escapedTxtVal = escapedTxtVal.replace(/#/g, "[#]");
    escapedTxtVal = escapedTxtVal.replace(/&/g, "[&]");
    escapedTxtVal = escapedTxtVal.replace(/\$/g, "[$]");
    escapedTxtVal = escapedTxtVal.replace(/"/g, '["]');

    if (signTxt == 1) { // Începe cu
        return " AND " + filterColumnName + " LIKE '" + escapedTxtVal + "%'";
    } else if (signTxt == 2) { // Conține
        return " AND " + filterColumnName + " LIKE '%" + escapedTxtVal + "%'";
    } else if (signTxt == 3) { // Se termină cu
        return " AND " + filterColumnName + " LIKE '%" + escapedTxtVal + "'";
    }
    return "";
}

/**
 * Aplică filtre numerice pentru căutare articole.
 * @param {string} filterColumnName - Numele coloanei pe care se aplică filtrul.
 * @param {number} signVal - Tipul de filtru (1: egal, 2: între).
 * @param {number} val1 - Prima valoare.
 * @param {number} val2 - A doua valoare (pentru interval).
 * @returns {string} Clauza SQL pentru filtrul numeric.
 */
function applyNumbersFilter(filterColumnName, signVal, val1, val2) {
    if (signVal == 1) {
        return " AND " + filterColumnName + " = " + val1;
    } else if (signVal == 2) {
        return " AND " + filterColumnName + " BETWEEN " + val1 + " AND " + val2;
    }
    return "";
}

/**
 * Returnează condiții de filtrare SQL pentru articole cu limitări de stoc.
 * @returns {string} Clauza SQL pentru filtrare.
 */
function conditiiFlitrare() {
    return (
        "AND (isnull(m.REMAINLIMMIN, 0) > 0 " +
        "OR isnull(m.REMAINLIMMAX, 0) > 0 " +
        "OR isnull(m.CCCMINAUTOCOMP, 0) > 0 " +
        "OR isnull(m.CCCMAXAUTOCOMP, 0) > 0 " +
        "OR isnull(l.REMAINLIMMIN, 0) > 0 " +
        "OR isnull(l.REMAINLIMMAX, 0) > 0 " +
        "OR isnull(l.CCCMINAUTO, 0) > 0 " +
        "OR isnull(l.CCCMAXAUTO, 0) > 0) "
    );
}

/**
 * Caută articole în baza de date pe baza filtrelor.
 * @param {object} config - Obiect de configurare.
 * @param {string} config.filterColumnName - Numele coloanei pentru filtrare.
 * @param {string} [config.sucursalaSqlInCondition] - Lista de ID-uri de sucursale (ex: "1,2,3").
 * @param {string} [config.selectedSuppliersSqlClause] - Clauza SQL pentru furnizori selectați.
 * @param {boolean} [config.doarStocZero=false] - Filtru pentru stoc zero.
 * @param {boolean} [config.doarDeblocate=false] - Filtru pentru articole deblocate.
 * @param {string} [config.valTxt] - Valoarea pentru filtrul text.
 * @param {number} [config.signTxt] - Tipul de filtrare text.
 * @param {number} [config.signVal] - Tipul de filtrare numeric.
 * @param {number} [config.val1] - Prima valoare pentru filtrul numeric.
 * @param {number} [config.val2] - A doua valoare pentru filtrul numeric.
 * @returns {object} { success: boolean, messages: string[], items: Array }
 */
function adaugaArticoleCfFiltre(config) {
    var result = { success: false, messages: [], items: [] };

    if (!config) {
        result.messages.push("Configurație invalidă.");
        return result;
    }

    // În original: CCCFILTRENECESARMINMAX.CONFIRMARE = 0;

    // Verificare duplicate în mtrbrnlimits
    var dsDuplicateCheck = X.GETSQLDATASET(
        "SELECT b.code, a.mtrl, a.branch, count(*) FROM mtrbrnlimits a " +
        "INNER JOIN mtrl b ON (a.MTRL = b.MTRl) " +
        "GROUP BY a.mtrl, a.BRANCH, b.code " +
        "HAVING count(*) > 1",
        null
    );

    if (dsDuplicateCheck && dsDuplicateCheck.RECORDCOUNT > 0) {
        var msg = 'Următoarele coduri au nevoie de atentie in tab-ul "Niveluri stoc filiale:"\n';
        dsDuplicateCheck.FIRST;
        while (!dsDuplicateCheck.EOF) {
            msg += dsDuplicateCheck.code + "\n";
            dsDuplicateCheck.NEXT;
        }
        result.messages.push(msg);
        return result;
    }

    var columnType = config.filterColumnName ? dbColumnType(config.filterColumnName) : null;

    var selBranches1 = config.sucursalaSqlInCondition
        ? " AND l.branch IN (" + config.sucursalaSqlInCondition + ") "
        : "";

    var selSupps = config.selectedSuppliersSqlClause || "";

    var whereStocZeroSuc = (config.doarStocZero && config.sucursalaSqlInCondition)
        ? " AND c.cccbranch IN (" + config.sucursalaSqlInCondition + ") "
        : "";

    var whereStocZero = config.doarStocZero
        ? " AND (SELECT coalesce(sum(coalesce(impqty1, 0)) - sum(coalesce(expqty1, 0)), 0) FROM mtrbalsheet b" +
        " INNER JOIN whouse c ON (b.whouse=c.whouse AND b.company=c.company) WHERE b.mtrl=m.mtrl" +
        whereStocZeroSuc +
        " AND b.fiscprd=year(getdate()))=0 "
        : "";

    var whereDeblocate = config.doarDeblocate ? " AND isnull(m.CCCBLOCKPUR, 0)=0 " : "";

    var baseQuery =
        "SELECT DISTINCT m.mtrl, m.code, m.name FROM mtrl m " +
        "INNER JOIN MTRBRNLIMITS l ON (m.mtrl = l.mtrl AND m.company = l.company) " +
        "WHERE m.company = " + X.SYS.COMPANY + " " +
        conditiiFlitrare() +
        whereStocZero +
        whereDeblocate +
        " AND m.isactive=1 AND m.sodtype=51 AND m.mtracn=101 " +
        selSupps +
        selBranches1;

    var filterQuery = "";
    if (columnType) {
        if (columnType == "text" || columnType == "varchar") {
            filterQuery = applyStringFilters(config.filterColumnName, config.valTxt, config.signTxt);
        } else {
            filterQuery = applyNumbersFilter(config.filterColumnName, config.signVal, config.val1, config.val2);
        }
    }

    var finalQuery = baseQuery + filterQuery;
    var dsItems = X.GETSQLDATASET(finalQuery, null);

    if (dsItems && dsItems.RECORDCOUNT > 0) {
        dsItems.FIRST;
        while (!dsItems.EOF) {
            result.items.push({
                MTRL: dsItems.mtrl,
                CODE: dsItems.code,
                NAME: dsItems.name
            });
            dsItems.NEXT;
        }
        result.messages.push("S-au găsit " + dsItems.RECORDCOUNT + " articole.");
        result.success = true;
    } else {
        result.messages.push("Nu exista articole pentru filtrele selectate.");
        result.success = false;
    }

    //adauga si parametrii de configurare
    result.config = {
        filterColumnName: config.filterColumnName,
        sucursalaSqlInCondition: config.sucursalaSqlInCondition,
        selectedSuppliersSqlClause: config.selectedSuppliersSqlClause,
        doarStocZero: config.doarStocZero,
        doarDeblocate: config.doarDeblocate,
        valTxt: config.valTxt,
        signTxt: config.signTxt,
        signVal: config.signVal,
        val1: config.val1,
        val2: config.val2
    };


    return result;
}

/**
 * Returnează vânzările pe ultimele N luni pentru un material.
 * @param {number} mtrl - ID-ul materialului.
 * @param {number} lastNMonths - Numărul de luni.
 * @param {string} [sucursalaSqlInCondition] - Lista de ID-uri de sucursale separate prin virgulă (ex: "10,20").
 * @returns {number} Cantitatea vândută.
 */
function getLastNMonthSales(mtrl, lastNMonths, sucursalaSqlInCondition) {
    var branchQry = sucursalaSqlInCondition
        ? " AND whouse IN (" + sucursalaSqlInCondition + ") "
        : "";

    var currentYear = new Date().getFullYear();
    var startDate = new Date();
    startDate.setMonth(startDate.getMonth() - (lastNMonths - 1));
    var startYear = startDate.getFullYear();
    var startMonth = startDate.getMonth() + 1;

    var q =
        "SELECT isnull(SUM(isnull(SALQTY, 0)), 0) AS cant FROM MTRBALSHEET " +
        "WHERE MTRL=" + mtrl +
        " AND COMPANY=" + X.SYS.COMPANY +
        " AND PERIOD != 0" +
        " AND (FISCPRD > " + startYear + " OR (FISCPRD = " + startYear + " AND PERIOD >= " + startMonth + "))" +
        branchQry;

    var ds = X.GETSQLDATASET(q, null);
    if (ds && ds.RECORDCOUNT > 0 && ds.cant !== null) {
        return ds.cant;
    }
    return 0;
}

/**
 * Returnează cantitățile de materiale în așteptare/rezervate.
 * @param {number} restCateg - Categoria stării (1: așteptat, 2: rezervat).
 * @param {number} mtrl - ID-ul materialului.
 * @param {boolean} sumResult - True pentru a returna suma totală.
 * @param {string} [sucursalaSqlInCondition] - Lista de ID-uri de sucursale separate prin virgulă (ex: "10,20").
 * @returns {number|object} Cantitatea sau un dataset.
 */
function getPending(restCateg, mtrl, sumResult, sucursalaSqlInCondition) {
    var branchQry = sucursalaSqlInCondition
        ? " WHERE fil IN (" + sucursalaSqlInCondition + ") "
        : "";

    var strPendingQuery = sumResult ? "SELECT sum(cant) AS cant FROM (" : "";
    strPendingQuery +=
        "SELECT mtrl, fil, sum(qty1) AS cant " +
        "FROM ( " +
        "SELECT mtrl, CASE isnull(salesman, 0) WHEN 0 THEN fil_doc ELSE fil_repr END AS fil, restmode, restcateg, qty1 " +
        "FROM ( " +
        "SELECT a.mtrl, e.cccbranch AS fil_doc, d.BRANCH AS fil_repr, a.SALESMAN, A.RESTMODE, C.RESTCATEG, " +
        "SUM(dbo.FNSOGETLINEPEND(A.FINDOC, A.MTRLINES)) AS QTY1 " +
        "FROM MTRLINES A " +
        "INNER JOIN FINDOC B ON (a.FINDOC = b.FINDOC AND a.SOSOURCE = b.SOSOURCE AND a.COMPANY = b.COMPANY) " +
        "INNER JOIN RESTMODE C ON (a.RESTMODE = c.RESTMODE AND a.COMPANY = C.COMPANY) " +
        "LEFT JOIN prsn d ON (B.salesman = d.prsn AND a.company = d.company) " +
        "INNER JOIN WHOUSE e ON (e.whouse = a.whouse AND a.company = e.company) " +
        "WHERE A.COMPANY = " + X.SYS.COMPANY + " AND A.MTRL = " + mtrl + " AND A.PENDING = 1 " +
        "AND B.TRNDATE <= cast(getdate() AS DATE) AND B.ISCANCEL = 0 AND C.RESTCATEG = " + restCateg + " " +
        "GROUP BY A.COMPANY, A.MTRL, A.PENDING, e.cccbranch, d.BRANCH, a.SALESMAN, A.RESTMODE, C.RESTCATEG " +
        ") x " +
        ") y " +
        branchQry +
        "GROUP BY mtrl, fil, restmode, restcateg";
    strPendingQuery += sumResult ? ") t1" : "";

    var ds = X.GETSQLDATASET(strPendingQuery, null);
    if (sumResult) {
        if (ds && ds.RECORDCOUNT > 0 && ds.cant !== null) {
            return ds.cant;
        }
        return 0;
    }
    return ds;
}

/**
 * Returnează prețul și moneda pentru furnizorul implicit al unui material.
 * @param {number} mtrl - ID-ul materialului.
 * @returns {{price: number, currency: number}} Informații despre preț.
 */
function getDefaultSuppPrice(mtrl) {
    var q =
        "SELECT isnull(PRICE, 0) AS PRICE, isnull(SOCURRENCY, 0) AS SOCURRENCY FROM CCCMTRLSUPPRCS " +
        "WHERE MTRL = " + mtrl +
        " AND TRDR = (SELECT mtrsup FROM mtrl WHERE mtrl = " + mtrl + " AND company = " + X.SYS.COMPANY + ")";

    var ds = X.GETSQLDATASET(q, null);
    if (ds && ds.RECORDCOUNT > 0) {
        return { price: ds.PRICE, currency: ds.SOCURRENCY };
    }
    return { price: 0, currency: 0 };
}

/**
 * Generează query-ul pentru stoc
 * @param {string} [sucursalaSqlInCondition] - Lista de ID-uri de sucursale separate prin virgulă (ex: "10,20").
 * @returns {string} Fragment SQL.
 */
function stoc_sql(sucursalaSqlInCondition) {
    var selBranches1 = sucursalaSqlInCondition
        ? " AND b.cccbranch IN (" + sucursalaSqlInCondition + ") "
        : "";

    return (
        "SELECT isnull(sum(cant), 0) cant " +
        "FROM ( " +
        "  SELECT mtrl, fil, sum(qty1) cant " +
        "  FROM ( " +
        "    SELECT a.mtrl, b.cccbranch fil, a.qty1 " +
        "    FROM mtrfindata a " +
        "    INNER JOIN whouse b ON (a.whouse = b.whouse AND a.company = b.company " +
        "      AND b.CCCBRANCH IS NOT NULL AND b.whouse <> 9999) " +
        "    WHERE mtrl = m.mtrl " +
        "    AND a.company = " + X.SYS.COMPANY + " " +
        "    AND a.fiscprd = year(getdate()) " +
        selBranches1 +
        "  ) t1 " +
        "  GROUP BY mtrl, fil " +
        ") t2"
    );
}

/**
 * Generează query-ul pentru transferuri
 * @param {boolean} isComp - True pentru nivel companie, false pentru nivel sucursală.
 * @param {string} [sucursalaSqlInCondition] - Lista de ID-uri de sucursale separate prin virgulă (ex: "10,20").
 * @returns {string} Fragment SQL.
 */
function inTransfer_sql(isComp, sucursalaSqlInCondition) {
    var branchFilterClause = (!isComp && sucursalaSqlInCondition)
        ? " AND B.BRANCHSEC IN (" + sucursalaSqlInCondition + ") "
        : "";

    return (
        "SELECT isnull(sum(isnull(cant, 0)), 0) cant FROM (SELECT isnull(sum(c.qty1), 0) cant " +
        "FROM FINDOC A INNER JOIN MTRDOC B ON A.FINDOC = B.FINDOC AND A.COMPANY = B.COMPANY " +
        "INNER JOIN MTRLINES C ON (A.SOSOURCE=C.SOSOURCE AND A.FINDOC=C.FINDOC AND A.COMPANY=C.COMPANY) " +
        "WHERE A.COMPANY = " + X.SYS.COMPANY + " AND A.SOSOURCE = 1151 AND A.FPRMS = 3153 " +
        "AND A.FULLYTRANSF = 0 AND C.MTRL = M.MTRL AND B.WHOUSESEC = 9999 " +
        branchFilterClause + " AND A.FISCPRD = YEAR(GETDATE()) " +
        "GROUP BY A.COMPANY, B.BRANCHSEC, B.WHOUSESEC, C.MTRL) t1"
    );
}

/**
 * Generează query-ul pentru rezervări
 * @param {string} [sucursalaSqlInCondition] - Lista de ID-uri de sucursale separate prin virgulă (ex: "10,20").
 * @returns {string} Fragment SQL.
 */
function rezervat_sql(sucursalaSqlInCondition) {
    var selBranches2 = sucursalaSqlInCondition
        ? "AND (e.cccbranch IN (" + sucursalaSqlInCondition + ") OR d.BRANCH IN (" + sucursalaSqlInCondition + ")) "
        : "";

    return (
        "SELECT isnull(sum(cant), 0) cant " +
        "FROM ( " +
        "  SELECT mtrl, fil, sum(qty1) cant " +
        "  FROM ( " +
        "    SELECT mtrl, " +
        "    CASE isnull(salesman, 0) WHEN 0 THEN fil_doc ELSE fil_repr END AS fil, " +
        "    restmode, restcateg, qty1 " +
        "    FROM ( " +
        "      SELECT a.mtrl, e.cccbranch fil_doc, d.BRANCH fil_repr, " +
        "      a.SALESMAN, A.RESTMODE, C.RESTCATEG, SUM(dbo.FNSOGETLINEPEND(A.FINDOC, A.MTRLINES)) AS QTY1 " +
        "      FROM MTRLINES A INNER JOIN FINDOC B ON (a.FINDOC = b.FINDOC AND a.SOSOURCE = b.SOSOURCE AND a.COMPANY = b.COMPANY) " +
        "      INNER JOIN RESTMODE C ON (a.RESTMODE = c.RESTMODE AND a.COMPANY = C.COMPANY) " +
        "      LEFT JOIN prsn d ON (B.salesman = d.prsn AND a.company = d.company) " +
        "      INNER JOIN WHOUSE e ON (e.whouse = a.whouse AND a.company = e.company) " +
        "      WHERE A.COMPANY = " + X.SYS.COMPANY + " AND A.MTRL = m.mtrl AND A.PENDING = 1 " +
        "      AND B.TRNDATE <= cast(getdate() AS DATE) AND B.ISCANCEL = 0 AND C.RESTCATEG = 2 " +
        selBranches2 +
        "      GROUP BY A.COMPANY, A.MTRL, A.PENDING, e.cccbranch, d.BRANCH, a.SALESMAN, A.RESTMODE, C.RESTCATEG " +
        "    ) x " +
        "  ) y " +
        "  GROUP BY mtrl, fil, restmode, restcateg " +
        ") t1"
    );
}

/**
 * Generează query-ul pentru minim sucursale selectate
 * @param {string} [sucursalaSqlInCondition] - Lista de ID-uri de sucursale separate prin virgulă (ex: "10,20").
 * @returns {string} Fragment SQL.
 */
function minSucSel_sql(sucursalaSqlInCondition) {
    var selBranches1 = sucursalaSqlInCondition
        ? " AND a.branch IN (" + sucursalaSqlInCondition + ") "
        : "";

    return (
        "SELECT sum(maxx) FROM (SELECT (SELECT CASE WHEN (" + nivMinSucSel_sql() + ") > (" +
        minAutoSucSel_sql() + ") THEN (" + nivMinSucSel_sql() + ") ELSE (" +
        minAutoSucSel_sql() + ") END) AS maxx FROM branch a WHERE company = " +
        X.SYS.COMPANY + selBranches1 + ") aa"
    );
}

/**
 * Generează query-ul pentru maxim sucursale selectate
 * @param {string} [sucursalaSqlInCondition] - Lista de ID-uri de sucursale separate prin virgulă (ex: "10,20").
 * @returns {string} Fragment SQL.
 */
function maxSucSel_sql(sucursalaSqlInCondition) {
    var selBranches1 = sucursalaSqlInCondition
        ? " AND a.branch IN (" + sucursalaSqlInCondition + ") "
        : "";

    return (
        "SELECT sum(maxx) FROM (SELECT (SELECT CASE WHEN (" + nivMaxSucSel_sql() + ") > (" +
        maxAutoSucSel_sql() + ") THEN (" + nivMaxSucSel_sql() + ") ELSE (" +
        maxAutoSucSel_sql() + ") END) AS maxx FROM branch a WHERE company = " +
        X.SYS.COMPANY + selBranches1 + ") aa"
    );
}

// --- FUNCȚII SQL SNIPPET ---
// Acestea returnează doar fragmente de SQL care sunt utilizate în query-ul principal
// și depind de aliasurile 'm' și 'a' definite acolo.

function minCo_sql() {
    return "SELECT CASE WHEN isnull(m.REMAINLIMMIN, 0) > isnull(m.CCCMINAUTOCOMP, 0) THEN isnull(m.REMAINLIMMIN, 0) ELSE isnull(m.CCCMINAUTOCOMP, 0) END";
}

function maxCo_sql() {
    return "SELECT CASE WHEN isnull(m.REMAINLIMMAX, 0) > isnull(m.CCCMAXAUTOCOMP, 0) THEN isnull(m.REMAINLIMMAX, 0) ELSE isnull(m.CCCMAXAUTOCOMP, 0) END";
}

function nivMinSucSel_sql() {
    return "SELECT isnull(remainlimmin, 0) remainlimmin FROM mtrbrnlimits WHERE mtrl = m.mtrl AND branch = a.branch";
}

function nivMaxSucSel_sql() {
    return "SELECT isnull(remainlimmax, 0) remainlimmax FROM mtrbrnlimits WHERE mtrl = m.mtrl AND branch = a.branch";
}

function minAutoSucSel_sql() {
    return "SELECT isnull(cccminauto, 0) cccminauto FROM mtrbrnlimits WHERE mtrl = m.mtrl AND branch = a.branch";
}

function maxAutoSucSel_sql() {
    return "SELECT isnull(cccmaxauto, 0) cccmaxauto FROM mtrbrnlimits WHERE mtrl = m.mtrl AND branch = a.branch";
}

/**
 * Adaugă articole cu necesar calculat într-un buffer de output.
 * @param {boolean} isSingle - True pentru a procesa un singur material.
 * @param {number|string} mtrlInput - ID-ul materialului sau string cu ID-uri separate prin virgulă.
 * @param {object} config - Configurație.
 * @param {number} [config.overstockBehavior=0] - Comportament overstock (0: compensare, 1: fără compensare).
 * @param {number} config.salesHistoryMonths - Numărul de luni pentru istoricul vânzărilor.
 * @param {boolean} [config.adjustOrderWithPending=false] - Flag pentru ajustarea comenzii cu cantitatea în așteptare.
 * @param {Date} config.currentDate - Data curentă.
 * @param {string} [config.sucursalaSqlInCondition] - Lista de ID-uri de sucursale separate prin virgulă (ex: "10,20").
 * @param {string} [config.supplierFilterSql] - Clauză SQL pentru filtrare furnizori.
 * @returns {object} Statusul operației: { success: boolean, messages: Array, linesAdded: number, processedLinesData: Array }
 */
function adaugaArticole(data) {
    var isSingle = data.isSingle || false;
    var mtrlInput = data.mtrlInput || null;
    var config = data.config || {};

    var result = { success: false, messages: [], items: [] };

    if (typeof config !== 'object' || config === null) {
        result.messages.push("Configurație invalidă. Parametrul 'config' trebuie să fie un obiect.");
        // Include a snapshot of what was passed as config for debugging.
        // Be cautious if config could contain sensitive data not intended for logging or exposure.
        result.config = {
            isSingle: isSingle,
            mtrlInput: mtrlInput,
            config: config // Keep original config for context
        };
        return result;
    }

    //set defaults for non mandatory params
    if (Object.prototype.hasOwnProperty.call(config, "overstockBehavior") && config.overstockBehavior === undefined) {
        config.overstockBehavior = 0;
    }

    if (Object.prototype.hasOwnProperty.call(config, "adjustOrderWithPending") && config.adjustOrderWithPending === undefined) {
        config.adjustOrderWithPending = false;
    }

    // Verificare tip de date pentru mtrlInput
    if (isSingle && (typeof mtrlInput !== "number" && typeof mtrlInput !== "string")) {
        result.messages.push("ID material invalid pentru procesare individuală.");
        result.config = { isSingle: isSingle, mtrlInput: mtrlInput, config: { overstockBehavior: config.overstockBehavior, salesHistoryMonths: config.salesHistoryMonths, currentDate: config.currentDate, sucursalaSqlInCondition: config.sucursalaSqlInCondition, supplierFilterSql: config.supplierFilterSql, adjustOrderWithPending: config.adjustOrderWithPending } };
        return result;
    }

    // Verificare tip de date pentru mtrlInput (listă)
    if (!isSingle && (typeof mtrlInput !== "string" || !String(mtrlInput).length)) {
        result.messages.push("Lista de ID-uri materiale invalidă pentru procesare în masă.");
        result.config = { isSingle: isSingle, mtrlInput: mtrlInput, config: { overstockBehavior: config.overstockBehavior, salesHistoryMonths: config.salesHistoryMonths, currentDate: config.currentDate, sucursalaSqlInCondition: config.sucursalaSqlInCondition, supplierFilterSql: config.supplierFilterSql, adjustOrderWithPending: config.adjustOrderWithPending } };
        return result;
    }

    // Validări
    if (!config || config.salesHistoryMonths === undefined || !config.currentDate) {
        result.messages.push("Configurație invalidă. Parametrii 'salesHistoryMonths' și 'currentDate' sunt necesari.");
        result.config = { isSingle: isSingle, mtrlInput: mtrlInput, config: { overstockBehavior: config.overstockBehavior, salesHistoryMonths: config.salesHistoryMonths, currentDate: config.currentDate, sucursalaSqlInCondition: config.sucursalaSqlInCondition, supplierFilterSql: config.supplierFilterSql, adjustOrderWithPending: config.adjustOrderWithPending } };
        return result;
    }

    // Construcție clauză WHERE pentru mtrl
    var strMtrl = "";
    if (isSingle) {
        if (!mtrlInput) {
            result.messages.push("ID material lipsă pentru procesare individuală.");
            result.config = { isSingle: isSingle, mtrlInput: mtrlInput, config: { overstockBehavior: config.overstockBehavior, salesHistoryMonths: config.salesHistoryMonths, currentDate: config.currentDate, sucursalaSqlInCondition: config.sucursalaSqlInCondition, supplierFilterSql: config.supplierFilterSql, adjustOrderWithPending: config.adjustOrderWithPending } };
            return result;
        }
        strMtrl = " AND m.mtrl = " + mtrlInput;
    } else if (mtrlInput && String(mtrlInput).length) {
        // Verificare validitate pentru o listă de ID-uri
        var mtrlArray = String(mtrlInput).split(',');
        for (var i = 0; i < mtrlArray.length; i++) {
            if (isNaN(parseInt(mtrlArray[i].trim(), 10))) {
                result.messages.push("Lista de materiale conține valori non-numerice.");
                result.config = { isSingle: isSingle, mtrlInput: mtrlInput, config: { overstockBehavior: config.overstockBehavior, salesHistoryMonths: config.salesHistoryMonths, currentDate: config.currentDate, sucursalaSqlInCondition: config.sucursalaSqlInCondition, supplierFilterSql: config.supplierFilterSql, adjustOrderWithPending: config.adjustOrderWithPending } };
                return result;
            }
        }
        strMtrl = " AND m.mtrl IN (" + mtrlInput + ")";
    } else {
        result.messages.push("Niciun material specificat pentru procesare.");
        result.config = { isSingle: isSingle, mtrlInput: mtrlInput, config: { overstockBehavior: config.overstockBehavior, salesHistoryMonths: config.salesHistoryMonths, currentDate: config.currentDate, sucursalaSqlInCondition: config.sucursalaSqlInCondition, supplierFilterSql: config.supplierFilterSql, adjustOrderWithPending: config.adjustOrderWithPending } };
        return result;
    }

    // Pregătire clauze SQL
    var overstockBehavior = config.overstockBehavior !== undefined ? config.overstockBehavior : 0;
    var sucursalaSqlInCondition = config.sucursalaSqlInCondition || "";
    var selTrdrs = config.supplierFilterSql || "";

    // Construcție formule pentru necesar
    var disponibilCo = " isnull((isnull(stocCo, 0) + isnull(transferCo, 0) - isnull(rezCo, 0)), 0) ";
    var disponibilSucSel = " isnull((isnull(stocSucSel, 0) + isnull(transferSucSel, 0) - isnull(rezSucSel, 0)), 0) ";

    var necMinCo = overstockBehavior ?
        " isnull(minCo, 0) - " + disponibilCo :
        "CASE WHEN " + disponibilCo + " < isnull(minCo, 0) THEN isnull(minCo, 0) - " + disponibilCo + " ELSE 0 END ";

    var necMinSucSel = overstockBehavior ?
        " isnull(minSucSel, 0) - " + disponibilSucSel :
        "CASE WHEN " + disponibilSucSel + " < isnull(minSucSel, 0) THEN isnull(minSucSel, 0) - " + disponibilSucSel + " ELSE 0 END ";

    var necMaxCo = overstockBehavior ?
        " isnull(maxCo, 0) - " + disponibilCo :
        "CASE WHEN " + disponibilCo + " < isnull(maxCo, 0) THEN isnull(maxCo, 0) - " + disponibilCo + " ELSE 0 END ";

    var necMaxSucSel = overstockBehavior ?
        " isnull(maxSucSel, 0) - " + disponibilSucSel :
        "CASE WHEN " + disponibilSucSel + " < isnull(maxSucSel, 0) THEN isnull(maxSucSel, 0) - " + disponibilSucSel + " ELSE 0 END ";

    // Construcție SQL principal
    var mainQuery =
        "SELECT DISTINCT d.*, m.code, CONCAT(LEFT(m.name, 20), '...') name, m.CCCBLOCKPUR Blocat, m.CCCEXSTAT Exclus, b.name numeFurnizor FROM (SELECT * " +
        "FROM ( " +
        "SELECT DISTINCT mtrl " +
        '	,NecesarMinCo = ' + necMinCo +
        '	,NecesarMinSucSel = ' + necMinSucSel +
        '	,NecesarMaxCo = ' + necMaxCo +
        '	,NecesarMaxSucSel = ' + necMaxSucSel +
        "	,isnull(minCo, 0) AS minCo " +
        "	,isnull(maxCo, 0) AS maxCo " +
        "	,isnull(minSucSel, 0) AS minSucSel " +
        "	,isnull(maxSucSel, 0) AS maxSucSel " +
        "	,isnull(stocCo, 0) AS stocCo " +
        "	,isnull(stocSucSel, 0) AS stocSucSel " +
        "	,isnull(transferCo, 0) AS transferCo " +
        "	,isnull(transferSucSel, 0) AS transferSucSel " +
        "	,isnull(rezCo, 0) AS rezCo " +
        "	,isnull(rezSucSel, 0) AS rezSucSel " +
        "	,a.trdr " +
        "	,a.company " +
        "FROM ( " +
        "	SELECT DISTINCT m.company, m.mtrsup AS trdr, m.mtrl " +
        "		,(" + minCo_sql() + ") AS minCo " +
        "		,(" + maxCo_sql() + ") AS maxCo " +
        "		,(" + minSucSel_sql(sucursalaSqlInCondition) + ") AS minSucSel " +
        "		,(" + maxSucSel_sql(sucursalaSqlInCondition) + ") AS maxSucSel " +
        "		,(" + inTransfer_sql(false, sucursalaSqlInCondition) + ") AS transferSucSel " +
        "		,(" + inTransfer_sql(true, null) + ") AS transferCo " +
        "		,(" + stoc_sql("") + ") AS stocCo " +
        "		,(" + stoc_sql(sucursalaSqlInCondition) + ") AS stocSucSel " +
        "		,(" + rezervat_sql("") + ") AS rezCo " +
        "		,(" + rezervat_sql(sucursalaSqlInCondition) + ") AS rezSucSel " +
        "	FROM mtrl m " +
        "	INNER JOIN MTRBRNLIMITS l ON (m.mtrl = l.mtrl AND m.company = l.company) " +
        "	WHERE m.sodtype = 51 AND m.isactive = 1 AND m.company = " + X.SYS.COMPANY +
        " " + selTrdrs + " AND isnull(m.cccexstat, 0) = 0 " + strMtrl +
        (sucursalaSqlInCondition ? " AND l.branch IN (" + sucursalaSqlInCondition + ") " : "") +
        conditiiFlitrare() +
        "	) a" +
        ") c WHERE (NecesarMinCo > 0 OR NecesarMaxCo > 0 OR NecesarMinSucSel > 0 OR NecesarMaxSucSel > 0)" +
        ") d " +
        "LEFT JOIN trdr b ON (d.trdr = b.trdr AND d.company = b.company AND b.isactive = 1 AND b.sodtype = 12) " +
        "LEFT JOIN mtrl m ON (d.mtrl = m.mtrl)";

    var dsItems = X.GETSQLDATASET(mainQuery, null);

    // Procesare rezultate
    var nLuniVanzari = config.salesHistoryMonths;
    if (dsItems && dsItems.RECORDCOUNT > 0) {
        var currentLineNum = 1;

        dsItems.FIRST;
        while (!dsItems.EOF) {
            var newItem = {
                MTRL: dsItems.mtrl,
                Cod: dsItems.code,
                Denumire: dsItems.name,
                Blocat: dsItems.Blocat,
                Exclus: dsItems.Exclus,
                TRDR: dsItems.trdr,
                Furnizor: dsItems.numeFurnizor,
                Rezervat: dsItems.rezSucSel || 0,
                Asteptat: getPending(1, dsItems.mtrl, true, sucursalaSqlInCondition) || 0,
                Stoc: dsItems.stocSucSel || 0,
                InTransf: dsItems.transferSucSel || 0,
                NecMinSuc: dsItems.NecesarMinSucSel || 0,
                NecMaxSuc: dsItems.NecesarMaxSucSel || 0,
                NecMinCo: dsItems.NecesarMinCo || 0,
                NecMaxCo: dsItems.NecesarMaxCo || 0
            };

            // Obține vânzările
            newItem.Vanzari = getLastNMonthSales(newItem.MTRL, nLuniVanzari, sucursalaSqlInCondition) || 0;

            // Calcul acoperire lunară
            if (newItem.Vanzari > 0 && nLuniVanzari > 0) {
                var acoperireLunara = (newItem.Asteptat + newItem.Stoc + newItem.InTransf) / (newItem.Vanzari / nLuniVanzari);
                newItem.AcopLun = parseFloat(acoperireLunara.toFixed(2));
            } else {
                newItem.AcopLun = 0;
            }

            // Calcul necesar minim și maxim
            newItem.NecMin = Math.max(dsItems.NecesarMinCo || 0, dsItems.NecesarMinSucSel || 0);
            newItem.NecMax = Math.max(dsItems.NecesarMaxCo || 0, dsItems.NecesarMaxSucSel || 0);

            // Calcul cantitate de comandat
            var adjustOrder = config.adjustOrderWithPending === true;
            if (adjustOrder) {
                newItem.OrderMin = newItem.NecMin;
                newItem.OrderMax = newItem.NecMax;
            } else {
                var orderMin = newItem.NecMin - newItem.Asteptat;
                newItem.OrderMin = orderMin > 0 ? orderMin : 0;

                var orderMax = newItem.NecMax - newItem.Asteptat;
                newItem.OrderMax = orderMax > 0 ? orderMax : 0;
            }

            // Obținere preț furnizor
            var priceInfo = getDefaultSuppPrice(newItem.MTRL);
            newItem.Pret = priceInfo.price || 0;
            newItem.Moneda = priceInfo.currency || 0;

            result.items.push(newItem);
            currentLineNum++;
            dsItems.NEXT;
        }

        result.messages.push("S-au calculat necesarul pentru " + dsItems.RECORDCOUNT + " articole.");
        result.success = true;
    } else {
        if (!dsItems) {
            result.messages.push("Eroare la interogarea necesarului de articole.");
        } else {
            result.messages.push("Nu s-au găsit articole cu necesar calculat pentru criteriile date.");
        }
        result.success = false;
    }

    // Adaugă parametrii de configurare
    result.config = {
        overstockBehavior: config.overstockBehavior,
        salesHistoryMonths: config.salesHistoryMonths,
        adjustOrderWithPending: config.adjustOrderWithPending,
        currentDate: config.currentDate,
        sucursalaSqlInCondition: sucursalaSqlInCondition,
        supplierFilterSql: selTrdrs
    };
    result.total = dsItems ? dsItems.RECORDCOUNT : 0;

    return result;
}

// Example usage functions returning JSON endpoints
function test_getArticoleCfFiltre() {
    var config = {
        filterColumnName: "CODE",
        doarStocZero: false,
        doarDeblocate: true,
        valTxt: "IVP1905",
        signTxt: 1,
        sucursalaSqlInCondition: "1300",
    };

    return adaugaArticoleCfFiltre(config);
}

function test_getCalculatedNeeds() {
    // Step 1: Get filtered articles
    var resultArticoleCfFiltre = adaugaArticoleCfFiltre({
        filterColumnName: "CODE",
        doarStocZero: false,
        doarDeblocate: true,
        valTxt: "IVP1905",
        signTxt: 1
    });

    if (!resultArticoleCfFiltre.success) {
        return resultArticoleCfFiltre;
    }

    // Step 2: Build mtrl input string 
    var mtrlInput = '';
    for (var i = 0; i < resultArticoleCfFiltre.items.length; i++) {
        mtrlInput += resultArticoleCfFiltre.items[i].MTRL;
        if (i < resultArticoleCfFiltre.items.length - 1) {
            mtrlInput += ',';
        }
    }

    // Step 3: Get calculated needs
    var configArticole = {
        overstockBehavior: 0,
        salesHistoryMonths: 6,
        adjustOrderWithPending: false,
        currentDate: new Date()
    };

    return adaugaArticole(false, mtrlInput, configArticole);
}

function getSingleItemNeeds(mtrlId) {
    var config = {
        overstockBehavior: 0,
        salesHistoryMonths: 6,
        adjustOrderWithPending: false,
        currentDate: new Date()
    };

    return adaugaArticole(true, mtrlId, config);
}

function getSuppliers() {
    var q = "SELECT trdr, code, name FROM trdr WHERE isactive = 1 AND sodtype = 12 AND company = " + X.SYS.COMPANY;
    var ds = X.GETSQLDATASET(q, null);
    var suppliers = [];

    if (ds && ds.RECORDCOUNT > 0) {
        ds.FIRST;
        while (!ds.EOF) {
            suppliers.push({
                TRDR: ds.trdr,
                CODE: ds.code,
                NAME: ds.name
            });
            ds.NEXT;
        }
    }

    return suppliers;
}

/**
 * Returns sales history data for a given material
 * @param {Object} params - Parameters for the request
 * @param {string} params.clientID - The authentication token
 * @param {number} params.mtrl - The material ID
 * @param {number} params.lastNMonths - Number of months to retrieve (default: 12)
 * @param {string} params.sucursalaSqlInCondition - Optional SQL IN clause for branches
 * @returns {Array} Array of sales data by month
 */
function getSalesHistory(params) {
    // Security validation to ensure only authorized calls
    if (X.SYS.USER !== 104) { // Web interface
        return {
            success: false,
            messages: ["This function can only be called through the web interface"]
        };
    }

    var mtrl = params.mtrl;
    var lastNMonths = params.lastNMonths || 12;
    var sucursalaSqlInCondition = params.sucursalaSqlInCondition || "";

    if (!mtrl) {
        return {
            success: false,
            messages: ["Material ID is required"]
        };
    }

    try {
        // Set up the date range for the query
        var currentYear = new Date().getFullYear();
        var startDate = new Date();
        startDate.setMonth(startDate.getMonth() - (lastNMonths - 1));
        var startYear = startDate.getFullYear();
        var startMonth = startDate.getMonth() + 1;

        // Branch filter condition
        var branchQry = sucursalaSqlInCondition
            ? " AND whouse IN (" + sucursalaSqlInCondition + ") "
            : "";

        // Query to get monthly sales data
        var q =
            "SELECT FISCPRD, PERIOD, WHOUSE AS BRANCH, SUM(ISNULL(SALQTY, 0)) AS SALQTY, " +
            "CONCAT(CASE PERIOD " +
            "WHEN 1 THEN 'Jan' " +
            "WHEN 2 THEN 'Feb' " +
            "WHEN 3 THEN 'Mar' " +
            "WHEN 4 THEN 'Apr' " +
            "WHEN 5 THEN 'May' " +
            "WHEN 6 THEN 'Jun' " +
            "WHEN 7 THEN 'Jul' " +
            "WHEN 8 THEN 'Aug' " +
            "WHEN 9 THEN 'Sep' " +
            "WHEN 10 THEN 'Oct' " +
            "WHEN 11 THEN 'Nov' " +
            "WHEN 12 THEN 'Dec' " +
            "END, ' ', FISCPRD) AS MONTH_LABEL " +
            "FROM MTRBALSHEET " +
            "WHERE MTRL=" + mtrl +
            " AND COMPANY=" + X.SYS.COMPANY +
            " AND PERIOD != 0" +
            " AND (FISCPRD > " + startYear + " OR (FISCPRD = " + startYear + " AND PERIOD >= " + startMonth + "))" +
            branchQry +
            " GROUP BY FISCPRD, PERIOD, WHOUSE " +
            "ORDER BY FISCPRD, PERIOD, WHOUSE"

        var salesData = X.GETSQLDATASET(q, null);

        // Format the result
        var result = [];
        salesData.FIRST
        while (!salesData.EOF) {
            result.push({
                FISCPRD: salesData.FISCPRD,
                PERIOD: salesData.PERIOD,
                SALQTY: salesData.SALQTY,
                MONTH_LABEL: salesData.MONTH_LABEL,
                BRANCH: salesData.BRANCH
            });
            salesData.NEXT
        }

        // Also get the material details
        var materialQ =
            "SELECT m.CODE, m.NAME " +
            "FROM MTRL m " +
            "WHERE m.MTRL=" + mtrl;

        var materialData = X.GETSQLDATASET(materialQ, null);
        var materialInfo = null;

        if (materialData.RECORDCOUNT > 0) {
            materialData.FIRST;
            materialInfo = {
                CODE: materialData.CODE,
                NAME: materialData.NAME
            };
        }

        return {
            success: true,
            items: result,
            material: materialInfo
        };
    } catch (ex) {
        X.WARNING(ex.message);
        return {
            success: false,
            messages: ["Error retrieving sales history: " + ex.message]
        };
    }
}