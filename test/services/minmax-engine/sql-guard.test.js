// For more information about this file see https://dove.feathersjs.com/guides/cli/service.test.html
import assert from 'assert'
import { classifySql, WRITABLE_TABLES } from '../../../src/services/minmax-engine/sql-guard.js'

describe('minmax-engine sql-guard', () => {
  describe('read verbs', () => {
    it('allows a plain SELECT', () => {
      const result = classifySql('SELECT * FROM CCCMINMAXDET')
      assert.deepStrictEqual(result, { ok: true, verb: 'SELECT' })
    })

    it('allows a WITH (CTE) statement', () => {
      const result = classifySql('with cte as (select 1 as x) select * from cte')
      assert.strictEqual(result.ok, true)
      assert.strictEqual(result.verb, 'WITH')
    })

    it('allows a single trailing semicolon', () => {
      const result = classifySql('SELECT 1;')
      assert.strictEqual(result.ok, true)
    })

    it('blocks stacked (multi-statement) queries', () => {
      const result = classifySql('SELECT 1; SELECT 2')
      assert.strictEqual(result.ok, false)
      assert.match(result.reason, /stacked queries/i)
    })

    it('does not mistake a verb hidden inside a string literal for the leading verb', () => {
      const result = classifySql("SELECT 'DROP TABLE CCCMINMAXPARAMS' AS note")
      assert.deepStrictEqual(result, { ok: true, verb: 'SELECT' })
    })

    it('strips a leading line comment before classifying', () => {
      const result = classifySql('-- comment\nSELECT 1')
      assert.strictEqual(result.ok, true)
    })

    it('strips a leading block comment before classifying', () => {
      const result = classifySql('/* block comment */ SELECT 1')
      assert.strictEqual(result.ok, true)
    })
  })

  describe('always-blocked verbs', () => {
    it('blocks DROP regardless of write mode', () => {
      const result = classifySql('DROP TABLE CCCMINMAXPARAMS')
      assert.strictEqual(result.ok, false)
      assert.match(result.reason, /always blocked/i)
      assert.strictEqual(result.verb, 'DROP')
    })

    it('blocks EXEC', () => {
      const result = classifySql('EXEC sp_MinMaxEngine_FinishRun')
      assert.strictEqual(result.ok, false)
      assert.strictEqual(result.verb, 'EXEC')
    })

    it('blocks MERGE', () => {
      const result = classifySql('MERGE INTO CCCMINMAXPARAMS USING src ON 1=1 WHEN MATCHED THEN DELETE')
      assert.strictEqual(result.ok, false)
      assert.strictEqual(result.verb, 'MERGE')
    })

    it('blocks a leading SP_ prefixed call even though SP_ is not itself a verb in the list', () => {
      const result = classifySql("sp_help 'CCCMINMAXPARAMS'")
      assert.strictEqual(result.ok, false)
      assert.strictEqual(result.verb, 'SP_HELP')
    })

    it('blocks a leading XP_ prefixed call', () => {
      const result = classifySql("xp_cmdshell 'dir'")
      assert.strictEqual(result.ok, false)
      assert.strictEqual(result.verb, 'XP_CMDSHELL')
    })
  })

  describe('write verbs and the table whitelist', () => {
    it('allows INSERT into a whitelisted config table', () => {
      const result = classifySql('INSERT INTO CCCMINMAXPARAMS (PARAMKEY) VALUES (1)')
      assert.deepStrictEqual(result, { ok: true, table: 'CCCMINMAXPARAMS', verb: 'INSERT' })
    })

    it('blocks INSERT into a non-whitelisted (real ERP) table', () => {
      const result = classifySql("INSERT INTO MTRL (CODE) VALUES ('X')")
      assert.strictEqual(result.ok, false)
      assert.match(result.reason, /Table MTRL is not in the minmax-engine write whitelist/)
    })

    it('allows UPDATE on a whitelisted config table', () => {
      const result = classifySql("UPDATE CCCMINMAXCOV SET COV = 1 WHERE CLASA = 'AX'")
      assert.strictEqual(result.ok, true)
      assert.strictEqual(result.table, 'CCCMINMAXCOV')
    })

    it('blocks UPDATE on a non-whitelisted (real ERP) table', () => {
      const result = classifySql('UPDATE MTRBRNLIMITS SET MTRMINQTY1 = 0 WHERE MTRL = 1')
      assert.strictEqual(result.ok, false)
      assert.match(result.reason, /Table MTRBRNLIMITS is not in the minmax-engine write whitelist/)
    })

    it('allows DELETE on a whitelisted config table', () => {
      const result = classifySql('DELETE FROM CCCMINMAXBRANCH WHERE BRANCH = 1000')
      assert.strictEqual(result.ok, true)
      assert.strictEqual(result.table, 'CCCMINMAXBRANCH')
    })

    it('blocks DELETE on a non-whitelisted table', () => {
      const result = classifySql('DELETE FROM FINDOC WHERE FINDOC = 1')
      assert.strictEqual(result.ok, false)
      assert.match(result.reason, /Table FINDOC is not in the minmax-engine write whitelist/)
    })

    it('exposes the exact same five tables as WRITABLE_TABLES', () => {
      assert.deepStrictEqual(
        [...WRITABLE_TABLES].sort(),
        ['CCCMINMAXBRANCH', 'CCCMINMAXCOV', 'CCCMINMAXPARAMOVERRIDE', 'CCCMINMAXPARAMS', 'CCCMINMAXTEMPLATE']
      )
    })
  })

  describe('malformed input', () => {
    it('rejects an empty statement', () => {
      const result = classifySql('')
      assert.strictEqual(result.ok, false)
      assert.match(result.reason, /leading SQL verb/)
    })

    it('rejects a whitespace-only statement', () => {
      const result = classifySql('   ')
      assert.strictEqual(result.ok, false)
    })

    it('rejects a verb outside the read/write/blocked lists', () => {
      const result = classifySql('PRAGMA foreign_keys = ON')
      assert.strictEqual(result.ok, false)
      assert.match(result.reason, /not in the read or write whitelist/)
    })
  })
})
