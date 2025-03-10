import { shared } from './shared.js';
import { renderTable } from './renderTable.js';
import { getS1Data, getErrors, getMesagerieConvAuto, getMappings, getSchimbareStoc } from './dataFetching.js';

function paginate(direction) {
  shared.skip += direction * shared.htmlLimit;
  if (shared.skip < 0) {
    shared.skip = 0;
  }
  renderTable(shared.table, "#items", shared.skip);
}

function paginateErr(direction) {
  shared.skipErr += direction * shared.htmlLimit;
  if (shared.skipErr < 0) {
    shared.skipErr = 0;
  }
  getS1Data("Loading messages, please wait...", "#errors", getErrors);
}

function paginateConvAuto(direction) {
  shared.skipConvAuto += direction * shared.htmlLimit;
  if (shared.skipConvAuto < 0) {
    shared.skipConvAuto = 0;
  }
  getS1Data(
    "Loading mesagerie conversie automata, please wait...",
    "#convAuto",
    getMesagerieConvAuto
  );
}

function paginateMappings(direction) {
  shared.skipMappings += direction * shared.htmlLimit;
  if (shared.skipMappings < 0) {
    shared.skipMappings = 0;
  }
  getS1Data("Loading mappings, please wait...", "#mappings", getMappings);
}

function paginateStock(direction) {
  shared.skipStock += direction * shared.htmlLimit;
  if (shared.skipStock < 0) {
    shared.skipStock = 0;
  }
  getS1Data("Loading stock, please wait...", "#stockChanges", getSchimbareStoc);
}

export { paginate, paginateErr, paginateConvAuto, paginateMappings, paginateStock };