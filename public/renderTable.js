import { shared } from './shared.js';
import { getItemsFromService } from './dataFetching.js';
import './dataTable.js';

export async function renderTable(dbtable, htmltable, skip = 0) {
    const options = {
        $limit: shared.htmlLimit,
        $skip: skip
    };
    
    // Add any table-specific options
    switch (dbtable) {
        case "mec_item":
            Object.assign(options, {
                Company_ID: 2,
                $sort: { Modify_date: -1 }
            });
            break;
        case "mec_item_producer_relation":
            Object.assign(options, {
                Company_ID: 2,
                $sort: { Modify_date: -1 }
            });
            break;
        case "site_product_changes_history":
            Object.assign(options, {
                $sort: { updated_at: -1 }
            });
            break;
        case "site_product_frequent_changes":
            Object.assign(options, {
                company_id: 2,
                $sort: { updated_at: -1 }
            });
            break;
        case "mec_item_altref":
            Object.assign(options, {
                $sort: { Item: 1 }
            });
            break;
        case "mec_ro_item_rel_supplier":
            Object.assign(options, {
                $sort: { mec_code: 1 }
            });
            break;
    }

    try {
        const data = await getItemsFromService(dbtable, htmltable, options);
        
        // Guard clause for empty or invalid data
        if (!Array.isArray(data)) {
            console.warn('Invalid data received:', data);
            return [];
        }

        const dataTable = document.querySelector(htmltable);
        if (dataTable) {
            dataTable.skipNr = skip; // Set skip before items
            dataTable.items = data;
            dataTable.setAttribute('data-count', data.length);
            if (typeof dataTable.requestUpdate === 'function') {
                dataTable.requestUpdate();
            }
        }
        return data;
    } catch (error) {
        console.error('Error rendering table:', error);
        // Set empty state in the table
        const dataTable = document.querySelector(htmltable);
        if (dataTable) {
            dataTable.items = [];
            dataTable.skipNr = 0;
            dataTable.setAttribute('data-count', '0');
            if (typeof dataTable.requestUpdate === 'function') {
                dataTable.requestUpdate();
            }
        }
        throw error;
    }
}

function renderData(items, htmlElementId, skip = 0) {
    // Guard against invalid input
    if (!items || !Array.isArray(items)) {
        console.warn('Invalid items passed to renderData:', items);
        items = [];
    }

    const dataTable = document.querySelector(htmlElementId);
    if (dataTable) {
        dataTable.skipNr = skip;
        dataTable.items = items;
        dataTable.setAttribute('data-count', items.length);
        if (typeof dataTable.requestUpdate === 'function') {
            dataTable.requestUpdate();
        }
    }
}

export { renderData };