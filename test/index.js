import joi from 'joi'
import sqlite from 'sqlite3'
import { expect } from 'chai'
import createAccessor from '../index'

describe('accessor', () => {
  let db, foobar

  beforeEach((done) => {
    db = new sqlite.Database(':memory:')
    foobar = createAccessor(db).table('foobar').index('value').index('number')
    db.exec('CREATE TABLE foobar ( id INTEGER PRIMARY KEY AUTOINCREMENT, value TEXT, number INTEGER, blob BLOB )', done)
  })

  afterEach((done) => {
    return db.close(done)
  })

  it('insert', () => {
    return foobar.insert({ value: 'FOOBAR', number: 123 }).then(({ id, changes }) => {
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

  it('validate write', () => {
    const fixture = { value: 1 }
    const schema = joi.object().keys({ value: joi.string() })

    return foobar
      .validate('write', schema)
      .insert(fixture)
      .catch((error) => {
        expect(error).to.have.property('message', 'child "value" fails because ["value" must be a string]')
      })
  })

  it('validate read', () => {
    const fixture = { value: 1 }
    const schema = joi.object().keys({ value: joi.string() })

    return foobar
      .validate('read', schema)
      .insert(fixture)
      .then(foobar.get)
      .catch((error) => {
        expect(error).to.have.property('message', 'child "value" fails because ["value" must be a string]')
      })
  })

  it('find', () => {
    const fixture = { value: 'FOOBAR', number: 123 }
    const query = { value: 'FOOBAR', number: { $gt: 100, $lt: 200 } }
    return foobar
      .insert(fixture)
      .then(() => foobar.find(query))
      .then((obj) => {
        expect(obj).to.deep.equal(fixture)
      })
  })

  it('findAll', () => {
    const query = { value: 'FOOBAR', number: { $gt: 100, $lt: 200 } }
    return foobar
      .insert({ value: 'FOOBAR', number: 100 })
      .then(() => foobar.insert({ value: 'FOOBAR', number: 125 }))
      .then(() => foobar.insert({ value: 'FOOBAR', number: 175 }))
      .then(() => foobar.insert({ value: 'FOOBAR', number: 200 }))
      .then(() => foobar.findAll(query))
      .then((results) => {
        expect(results).to.have.length(2)
        const numbers = results.map(d => d.number)
        expect(Math.max(...numbers)).to.equal(175)
        expect(Math.min(...numbers)).to.equal(125)
      })
  })
})
