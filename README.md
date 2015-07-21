# msglite [![Build Status](https://travis-ci.org/hden/msglite.svg?branch=master)](https://travis-ci.org/hden/msglite)
embedded, indexed, schemaless, document store

## rationale

    +                                 +                                          +
    | index, constraints, foreign key |         encoded blob (schemaless)        |
    |                                 |                                          |
    +---------------------------------------------+-------------------------------------------------------+
    sqlite | id INTEGER PRIMARY KEY | name TEXT NOT NULL | number INT | blob BLOB                                |
    +-----------------------------------------------------------------------------------------------------+
    data   | 1                      | 'foobar'           | 100        | { name: 'foobar', number: 100, age: 10 } |
    +------------------------+--------------------+------------+------------------------------------------+

## usage

```js
import sqlite from 'sqlite3'
import create from './index'

let db = new sqlite.Database(':memory:')
let createTable = 'CREATE TABLE foobar ( id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, number INTEGER, blob BLOB )'
let accessor = create(db).table('foobar').index('name').index('number')
db.exec(createTable, () => {
  // read after write
  accessor
    .insert({ name: 'foobar', number: 100, age: 10 })
    .then(accessor.get)
    .then((result) => {
      console.log(result)
      // { name: 'foobar', number: 100, age: 10 }
    })

  // findAll
  accessor
    .insert({ name: 'foobar', number: 50, age: 10 })
    .then(() => accessor.insert({ name: 'baz', number: 50 }))
    .then(() => accessor.insert({ name: 'nyan', number: 150 }))
    // mongodb-like query language
    .then(() => accessor.findAll({ number: { $gt: 25, $lt: 125 } }))
    .then((results) => {
      console.log(results)
      // [ { name: 'foobar', number: 100, age: 10 }, { name: 'baz', number: 50 } ]
    })
})
```
