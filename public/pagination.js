import { paginationManager } from './paginationManager.js';

function paginate(direction) {
    paginationManager.paginate(direction);
}

// Export only the paginate function as the others are now handled by paginationManager
export { paginate };