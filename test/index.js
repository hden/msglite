import sqlite from 'sqlite3'
import { expect } from 'chai'
import createAccessor from '../src/index'
describe('accessor', () => {
  let db, foobar

  beforeEach((done) => {
    db = new sqlite.Database(':memory:')
    db.exec('CREATE TABLE foobar ( id INTEGER PRIMARY KEY AUTOINCREMENT, value TEXT, blob BLOB )', done)
    foobar = createAccessor(db).table('foobar').index('value')
  })

  afterEach((done) => {
    return db.close(done)
  })

  it('insert', () => {
    return foobar.insert({ value: 'FOOBAR', number: 3.14 }).then(({ id, changes }) => {
      expect(id).to.equal(1)
      expect(changes).to.equal(1)
    })
  })

  it('get', () => {
    const fixture = { value: 'FOOBAR', number: 123 }
    return foobar
      .insert(fixture)
      .then(foobar.get)
      .then((obj) => {
        expect(obj).to.deep.equal(fixture)
      })
  })
})
