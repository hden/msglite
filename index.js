'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

var _mustacheSql = require('mustache-sql');

var _mustacheSql2 = _interopRequireDefault(_mustacheSql);

var _msgpack5 = require('msgpack5');

var _msgpack52 = _interopRequireDefault(_msgpack5);

var msgpack = (0, _msgpack52['default'])();

var partials = {
  $eq: '= {{value}}',
  $gt: '> {{value}}',
  $gte: '>= {{value}}',
  $lt: '< {{value}}',
  $lte: '<= {{value}}',
  $ne: '!= {{value}}',
  $in: 'IN ({{value}})',
  $nin: 'NOT IN ({{value}})',
  $like: 'LIKE {{value}}',
  $nlike: 'NOT LIKE {{value}}'
};

partials.operators = Object.keys(partials).map(function (op) {
  return '{{#' + op + '}}{{>' + op + '}}{{/' + op + '}}';
}).join('');
var identity = function identity(id) {
  return id;
};

var map = function map(fn) {
  return function (list) {
    return list.map(fn);
  };
};

var curry = function curry(fn) {
  for (var _len = arguments.length, fixed = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
    fixed[_key - 1] = arguments[_key];
  }

  return function () {
    for (var _len2 = arguments.length, rest = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
      rest[_key2] = arguments[_key2];
    }

    return fn.apply(undefined, fixed.concat(rest));
  };
};

var promisify = function promisify(obj, method) {
  return function () {
    for (var _len3 = arguments.length, args = Array(_len3), _key3 = 0; _key3 < _len3; _key3++) {
      args[_key3] = arguments[_key3];
    }

    return new Promise(function (resolve, reject) {
      args.push(function (error, result) {
        if (error) {
          reject(error);
        } else {
          resolve(result);
        }
      });
      obj[method].apply(obj, args);
    });
  };
};

var run = function run(db) {
  return function () {
    for (var _len4 = arguments.length, args = Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
      args[_key4] = arguments[_key4];
    }

    return new Promise(function (resolve, reject) {
      args.push(function handler(error) {
        if (error) {
          reject(error);
        } else {
          resolve({ id: this.lastID, changes: this.changes });
        }
      });
      db.run.apply(db, args);
    });
  };
};

var pack = function pack(table, index, encode, obj) {
  return {
    table: table,
    keys: index.concat('blob'),
    values: index.map(function (k) {
      return obj[k];
    }).concat(encode(obj))
  };
};

var unpack = function unpack(decode) {
  var obj = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  return decode(obj.blob || obj);
};

// http://docs.mongodb.org/manual/reference/operator/query/
var rewrite = function rewrite(table) {
  return function (obj) {
    var conditions = [];
    var previous = undefined;
    Object.keys(obj).forEach(function (key) {
      var value = obj[key];
      var push = function push(d) {
        if (previous) {
          previous.next = d;
        }
        conditions.push(d);
        previous = d;
      };
      if (typeof value === 'object') {
        Object.keys(value).forEach(function (op) {
          var o = { key: key, value: value[op] };
          o[op] = true;
          push(o);
        });
      } else {
        push({ key: key, value: value, $eq: true });
      }
    });
    return { table: table, conditions: conditions };
  };
};

exports['default'] = function (db) {
  var validate = {};
  var index = {};
  var table = '';
  var encode = msgpack.encode;
  var decode = msgpack.decode;

  var accessor = function accessor(obj) {
    return Promise.resolve(obj).then(validate.write || identity).then(curry(pack, accessor.table(), accessor.index(), accessor.encode())).then(curry(_mustacheSql2['default'], 'INSERT INTO {{{table}}} ({{{keys}}}) VALUES ({{values}})')).then(run(db));
  };

  accessor.insert = accessor;

  accessor.get = function (id) {
    return Promise.resolve({ table: accessor.table(), id: id.id || id }).then(curry(_mustacheSql2['default'], 'SELECT * FROM {{{table}}} WHERE id = {{id}}')).then(promisify(db, 'get')).then(curry(unpack, accessor.decode())).then(validate.read || identity);
  };

  accessor.find = function (obj) {
    return Promise.resolve(obj).then(rewrite(accessor.table())).then(function (d) {
      return (0, _mustacheSql2['default'])('SELECT * FROM {{{table}}} WHERE {{#conditions}}{{{key}}} {{>operators}}{{#next}} AND {{/next}}{{/conditions}}', d, partials);
    }).then(promisify(db, 'get')).then(curry(unpack, accessor.decode())).then(validate.read || identity);
  };

  accessor.findAll = function (obj) {
    return Promise.resolve(obj).then(rewrite(accessor.table())).then(function (d) {
      return (0, _mustacheSql2['default'])('SELECT * FROM {{{table}}} WHERE {{#conditions}}{{{key}}} {{>operators}}{{#next}} AND {{/next}}{{/conditions}}', d, partials);
    }).then(promisify(db, 'all')).then(map(curry(unpack, accessor.decode()))).then(map(validate.read || identity));
  };

  accessor.table = function (value) {
    if (value) {
      table = value;
      return accessor;
    } else {
      return table;
    }
  };

  accessor.encode = function (value) {
    if (value) {
      encode = value;
      return accessor;
    } else {
      return encode;
    }
  };

  accessor.decode = function (value) {
    if (value) {
      decode = value;
      return accessor;
    } else {
      return decode;
    }
  };

  accessor.index = function (value) {
    if (value) {
      index[value] = true;
      return accessor;
    } else {
      return Object.keys(index);
    }
  };

  accessor.validate = function (key, value) {
    var transform = arguments.length <= 2 || arguments[2] === undefined ? true : arguments[2];

    if (key && value) {
      validate[key] = transform ? promisify(value, 'validate') : value;
      return accessor;
    } else if (key) {
      return validate[key];
    } else {
      return accessor;
    }
  };

  return accessor;
};

module.exports = exports['default'];

