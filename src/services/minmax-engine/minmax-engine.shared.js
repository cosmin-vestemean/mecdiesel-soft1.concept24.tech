// For more information about this file see https://dove.feathersjs.com/guides/cli/service.shared.html

export const minmaxEnginePath = 'minmax-engine'

export const minmaxEngineMethods = [
  'results', // CCCMINMAXDET, filtered/sorted/paginated (contract §5)
  'history', // CCCMINMAXRUN, most recent sessions first
  'groupAbc', // CCCMINMAXGRP, ABC/XYZ per MTRGROUP x BRANCH
  'params', // CCCMINMAXPARAMS + CCCMINMAXCOV + CCCMINMAXBRANCH
  'explain', // drill-down for one (RUNID, BRANCH, MTRL) — persisted state only
  'saveParams' // only write path — atomic via execSql `statements`
]
