import render from 'mustache-sql'
import init from 'msgpack5'

const msgpack = init()

let partials = {
  $eq   : '= {{value}}'
, $gt   : '> {{value}}'
, $gte  : '>= {{value}}'
, $lt   : '< {{value}}'
, $lte  : '<= {{value}}'
, $ne   : '!= {{value}}'
, $in   : 'IN ({{value}})'
, $nin  : 'NOT IN ({{value}})'
, $like : 'LIKE {{value}}'
, $nlike: 'NOT LIKE {{value}}'
}

partials.operators = Object.keys(partials).map(op => `{{#${op}}}{{>${op}}}{{/${op}}}`).join('')
const identity = (id) => { return id }

const map = (fn) => {
  return (list) => {
    return list.map(fn)
  }
}

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

// http://docs.mongodb.org/manual/reference/operator/query/
const rewrite = (table) => {
  return (obj) => {
    let conditions = []
    let previous
    Object.keys(obj).forEach((key) => {
      const value = obj[key]
      const push = (d) => {
        if (previous) { previous.next = d }
        conditions.push(d)
        previous = d
      }
      if (typeof value === 'object') {
        Object.keys(value).forEach((op) => {
          let o = { key, value: value[op] }
          o[op] = true
          push(o)
        })
      } else {
        push({ key, value, $eq: true })
      }
    })
    return { table, conditions }
  }
}

export default (db) => {
  let validate = {}
  let index = {}
  let table = ''
  let { encode, decode } = msgpack

  let accessor = (obj) => {
    return Promise
      .resolve(obj)
      .then(validate.write || identity)
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
      .then(validate.read || identity)
  }

  accessor.find = (obj) => {
    return Promise
      .resolve(obj)
      .then(rewrite(accessor.table()))
      .then(d => render(`SELECT * FROM {{{table}}} WHERE {{#conditions}}{{{key}}} {{>operators}}{{#next}} AND {{/next}}{{/conditions}}`, d, partials))
      .then(promisify(db, 'get'))
      .then(curry(unpack, accessor.decode()))
      .then(validate.read || identity)
  }

  accessor.findAll = (obj) => {
    return Promise
      .resolve(obj)
      .then(rewrite(accessor.table()))
      .then(d => render(`SELECT * FROM {{{table}}} WHERE {{#conditions}}{{{key}}} {{>operators}}{{#next}} AND {{/next}}{{/conditions}}`, d, partials))
      .then(promisify(db, 'all'))
      .then(map(curry(unpack, accessor.decode())))
      .then(map(validate.read || identity))
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
      validate[key] = transform ? promisify(value, 'validate') : value
      return accessor
    } else if (key) {
      return validate[key]
    } else {
      return accessor
    }
  }

  return accessor
}
