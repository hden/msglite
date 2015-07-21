import render from 'mustache-sql'
import init from 'msgpack5'

const msgpack = init()

const partials = {
  $eq   : '= {{value}}'
, $gt   : '> {{value}}'
, $gte  : '>= {{value}}'
, $lt   : '<'
, $lte  : '<='
, $ne   : '!= {{value}}'
, $in   : 'IN ({{value}})'
, $nin  : 'NOT IN ({{value}})'
, $like : 'LIKE {{value}}'
, $nlike: 'NOT LIKE {{value}}'
}

partials.operators = Object.keys(partials).map(op => `{{#${op}}}{{>${op}}}{{/${op}}}`).concat()

const noop = (id) => { return id }

const curry = (fn, ...fixed) => {
  return (...rest) => {
    return fn(...fixed, ...rest)
  }
}

const promisify = (obj, method) => {
  return (...args) => {
    return new Promise((resolve, reject) => {
      args.push((error, result) => {
        if (error) {
          reject(error)
        } else {
          resolve(result)
        }
      })
      obj[method](...args)
    })
  }
}

const run = (db) => {
  return (...args) => {
    return new Promise((resolve, reject) => {
      args.push(function handler(error) {
        if (error) {
          reject(error)
        } else {
          resolve({ id: this.lastID, changes: this.changes })
        }
      })
      db.run(...args)
    })
  }
}

const pack = (table, index, encode, obj) => {
  return {
    table
  , keys  : index.concat('blob')
  , values: index.map(k => obj[k]).concat(encode(obj))
  }
}

const unpack = (decode, obj = {}) => {
  return decode(obj.blob || obj)
}

export default (db) => {
  let validate = {}
  let index = {}
  let table = ''
  let { encode, decode } = msgpack

  let accessor = (obj) => {
    return Promise
      .resolve(obj)
      .then(validate.write || noop)
      .then(curry(pack, accessor.table(), accessor.index(), accessor.encode()))
      .then(curry(render, 'INSERT INTO {{{table}}} ({{{keys}}}) VALUES ({{values}})'))
      .then(run(db))
  }

  accessor.insert = accessor

  accessor.get = (id) => {
    return Promise
      .resolve({ table: accessor.table(), id: id.id || id })
      .then(curry(render, 'SELECT * FROM {{{table}}} WHERE id = {{id}}'))
      .then(promisify(db, 'get'))
      .then(curry(unpack, accessor.decode()))
  }

  accessor.table = (value) => {
    if (value) {
      table = value
      return accessor
    } else {
      return table
    }
  }

  accessor.encode = (value) => {
    if (value) {
      encode = value
      return accessor
    } else {
      return encode
    }
  }

  accessor.decode = (value) => {
    if (value) {
      decode = value
      return accessor
    } else {
      return decode
    }
  }

  accessor.index = (value) => {
    if (value) {
      index[value] = true
      return accessor
    } else {
      return Object.keys(index)
    }
  }

  accessor.validate = (key, value, transform = true) => {
    if (key && value) {
      validate[key] = transform ? promisify(value) : value
      return accessor
    } else if (key) {
      return validate[key]
    } else {
      return accessor
    }
  }

  return accessor
}
