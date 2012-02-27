(function($) {

var indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.msIndexedDB;
var idbTransaction = window.webkitIDBTransaction || window.IDBTransaction;
var idbKeyRange = window.webkitIDBKeyRange || window.IDBKeyRange;
var idbCursor = window.webkitIDBCursor || window.IDBCursor;

var factory = function() {
    return function(options) {
        options = options || {};

        return this.__ctor(options);
    };
};

window.store = factory();

window.request = function(req) {
    return this.__ctor(req);
};

window.inDB = factory();

var eventListener = factory();

eventListener.prototype = {
    add: function(name, event) {
        if(!event) {
            throw 'empty event';
        }
        var ents = this.events = this.events || {};
        var list = ents[name] = ents[name] || [];
        
        list.push(event);

        return this;
    },
    push: function(name, args, scope) {
        var ents = this.events = this.events || {};
        var list = ents[name] = (ents[name] || []).slice();
        var len = list.length;
        var _this = this;

        for(var i = 0; i < len; ++i)
        {
            var action = list[i];

            if(args instanceof Array)
                action.apply(scope || _this, args);
            else
                action.call(scope || _this, args);
        }
        return this;
    },
    del: function(name, event) {
        var ents = this.events = this.events || {};
        var list = ents[name] = ents[name] || [];
        var index = list.indexOf(event);
        
        if(index > -1)
            list.splice(index, 1);
            
        if(list.length <= 0)
            delete ents[name];
        
        return this;
    },
    __ctor: function() {
        this.events = this.events || {};

        return this;
    }
};

var query = function(options){
    return this.__ctor(options);
};
query.prototype = {
    lowerBound: function(name, lower, lowerOpen){
        this.cursor = this.store.index(name).openCursor(idbKeyRange.lowerBound(lower, lowerOpen));
        return this;
    },
    upperBound: function(name, upper, upperOpen){
        this.cursor = this.store.index(name).openCursor(idbKeyRange.upperBound(upper, upperOpen));
        return this;
    },
    only: function(name, value){
        this.cursor = this.store.index(name).openCursor(idbKeyRange.only(value));
        return this;
    },
    bound: function(name, lower, upper, lowerOpen, upperOpen){
        this.cursor = this.store.index(name).openCursor(idbKeyRange.bound(lower, upper, lowerOpen, upperOpen));
        return this;
    },
    __ctor: function(store){
        this.store = store;
    },
    toKeyRange: function(){
        return this.cursor || null;
    }
};

window.store.prototype = {
    createIndex: function(name, options) {

        this.store.createIndex(name, name, options);

        return this;
    },
    _add: function(val){
        var _this = this;

        this.eventListener.push('insert', {action: 'insert', val: val, store: this.store}, this);
        
        var req = this.store.add.apply(this.store, arguments);
        
        req.success = function(event) {
            _this.eventListener.push('inserted', event, _this);
        };
        
        return req;
    },
    clear: function(){
        this.eventListener.push('delete-all', {action: 'delete-all', store: this.store}, this);
        return new request(this.store.clear())
            .success(function(event){
                this.eventListener.push('deleted-all', event, this);
            });
    },
    count: function(){
        // WebKit, as of 2012-02-22, does not yet implement this. 
        return this.store['count']
            ? new request(this.store.count())
            : new requestError({error: 'count isn\'t implemented'});
    },
    add: function(val) {

        if(!(val instanceof Array)) {
            return new request(this._add(val));
        }

        var clone = val.slice();
        var len = clone.length;
        var result = new request();
        
        for(var i = 0; i < len; i++) {

            var req = this._add(clone[i]);

            result.add(req);
        }

        return result;
    },
    del: function(key) {
        var _this = this;
        
        this.eventListener.push('delete', {action: 'delete', key: key, store: this.store}, this);

        return new request( this.store['delete'].apply(this.store, arguments) )
            .success(function(event){
                _this.eventListener.push('deleted', event, _this);
            });
    },
    remove: function() {
        var idb = this.db.idb;

        return new request( idb.deleteObjectStore(this.store.name) );
    },
    put: function(val, key){
        var _this = this;
        var key = key || val[this.store.keyPath];
        this.eventListener.push('update', {action: 'update', 'newVersion': val, store: this.store}, this);

        return new request(this.store.put(val, key))
            .success(function(event){
                _this.eventListener.push('updated', event, _this);
            });
    },
    cursorFromQuery: function(apply){
        return apply(new query(this.store)).toKeyRange();
    },
    get: function() {
        var result;
        var len = arguments.length;
        var a = arguments;
        
        this.currentRequest = null;

        if(len == 1 && !isFunction(a[0]))
            result = new request(this.store.get(a[0]));

        if(len == 1 && isFunction(a[0]))
            result = new requestCursor(this.cursorFromQuery(a[0]) || this.store.openCursor(null, idbCursor.PREV));

        if(len == 2)
            result = new request(this.store.index(a[0]).get(a[1]));

        if(len <= 0) {
            result = new requestCursor(this.store.openCursor(null, idbCursor.PREV));
        }
        
        this.currentRequest = result;

        return result;
    },
    complete: function(action) {
        var _this = this;
        
        _this.eventListener.add('complete', action);

        return this;
    },
    abort: function(action) {
        var _this = this;
        
        _this.eventListener.add('abort', action);

        return this;
    },
    error: function(action) {

        var _this = this;
        
        _this.eventListener.add('error', action);

        return this;
    },
    cloneTran: function(){
        return new store({
            store: this.db.idb.transaction([this.store.name], this.store.transaction.mode).objectStore(this.store.name),
            db: this,
            eventListener: this.eventListener
        });
    },
    __ctor: function(options) {

        var _this = this;
        this.eventListener = new eventListener();
        
        for(var o in options) {
            this[o] = options[o];
        }

        this.store.transaction.oncomplete = function(event){
            _this.eventListener.push('complete', event, _this);

            if(_this.currentRequest) {
                _this.currentRequest.eventListener.push('end', event, _this.currentRequest);
            }
        };

        this.store.transaction.onabort = function(event){
            _this.eventListener.push('abort', event, _this);
        };

        this.store.transaction.onabort = function(event){
            _this.eventListener.push('error', event, _this);
        };

        return this;
    }
};

window.request.prototype = {
    error: function(error) {
        this.eventListener.add('error', error);
        return this;
    },
    where: function(predicate) {
        this.context.predicate = predicate;

        return this;
    },
    success: function(success) {
        this.eventListener.add('success', success);

        return this;
    },
    add: function(req) {
        var _this = this;
        
        each(['error', 'success'], function(label, i) {

            //req.addEventListener does not work in FF
            req['on' + label] = function(event) {
                _this._push(label, event, req);
            };

        });

        return this;
    },
    ended: function(action){
        var _this = this;
        var handler = function(){
            _this.eventListener.del('end', handler);

            action(_this.context);
        };

        this.eventListener.add('end', handler);

        return this;
    },
    start: function(action){
        action(this.context);
        
        return this;
    },
    _push: function(label, event, req) {
        this.eventListener.push(label, [event, this.context], req);
    },
    __ctor: function(req) {
        this.eventListener = new eventListener();
        this.context = {};
        
        if(!req) {return this;}

        this.add(req);

        return this;
    }
};

var requestCursor = function(req) {
    this.__ctor(req);

    this.context = new this._contextCtr(this);
    this.context.request = this;

    return this;
}; 

var requestError = function(error) {
    this.__ctor();
    var _this = this;
    setTimeout(function(){
        _this.eventListener.push('error', error, _this);
    }, 5);

    return this;
}; 

requestCursor.prototype = new request();
requestError.prototype = new request();

requestCursor.prototype._contextCtr = function(req){this.request = req};
requestCursor.prototype._contextCtr.prototype = {
    update: function(val){
        var _this = this;
        this.request.eventListener.push('update', {action: 'update', 'newVersion': val, store: this.request.store}, this.request);

        return new request(this.cursor.update(val))
            .success(function(event){
                _this.request.eventListener.push('updated', event, _this.request);
            });
    }
}
                
requestCursor.prototype.success = function(success) {
    var _this = this;
    var timer;

    this.eventListener.add('success', function(event) {
        var cursor = event.target.result;
        var store = event.target.source;

        if (cursor) {

            //var readyState = event.target.readyState;

            if(!_this.context || !_this.context.predicate || _this.context.predicate(cursor.value)) {
                _this.context.cursor = cursor;
                _this.context.prototype = _this.contextProto;

                success.call(this, event, _this.context);
            }
            
            //if(readyState == 2 /*DONE*/) // it does not work readyState always 2 (DONE)
            //    _this.eventListener.push('end');
            //});            

            cursor.continue();
        }
    });

    return this;
};


window.inDB.prototype = {
    
    init: function(init) {
        this.eventListener.add('init', init);

        return this;
    },
    each: function(action) {
        var idb = this.idb;
        var stores = idb.objectStoreNames;
        var len = stores.length;

        for (var i = 0; i < len; ++i) {
            action.call(this, stores[i]);
        }

        return this;
    },
    setVersion: function(version) {
        var _this = this;
        this.version = version;
        
        return new request(this.idb.setVersion(version));
    },
    remove: function() {
        indexedDB.deleteDatabase(this.name);
    },
    containts: function(name) {
        return this.idb.objectStoreNames.contains(name);
    },
    ready: function(ready) {
        this.eventListener.add('ready', ready);
        return this;
    },
    close: function() {
        this.idb.close();

        return this;
    },
    error: function(error) {
        this.eventListener.add('error', error);
        return this;
    },
    readWrite: 'READ_WRITE',
    read: 'READ_ONLY',
    _versionChange: function(event) {
        this.eventListener.push('versionChange', event, this);
    },
    versionChange: function(action) {
        this.eventListener.add('versionChange', action);
        
        return this;
    },
    openStore: function(name, type) {

        type = type || this.read;
        
        return new store({
            store: this.idb.transaction([name], idbTransaction[type]).objectStore(name),
            db: this
        });
    },
    createStore: function(name, options) {
        var objectStore = this.idb.createObjectStore(name, options);

        return new store({store: objectStore, db: this});
    },
    upgradeNeeded: function(action) {
        this.eventListener.add('upgradeNeeded', action);

        return this;
    },
    _upgradeNeeded: function(event) {
        this.eventListener.push('upgradeNeeded', event, this);
    },
    __ctor: function(options) {
        
        this.eventListener = new eventListener();
        
        var typeName = options.constructor.name;
        
        if(typeName.substr(0, 3) == 'IDB' && typeName.substr(-7) == 'Request') {
            return new request(options);
        }

        if(typeName == 'IDBObjectStore') {
            return new store(options);
        }

        if(typeName == 'IDBDatabase') {
            this.idb = options;
        }else{
            for(var o in options) {
                this[o] = options[o];
            }

            this._open();
        }

        this._init();
        
        return this;
    },
    _open: function() {
        var _this = this;

        var openRequest = indexedDB.open(this.name, this.version);

        openRequest.onversionchange = function(event) {_this._versionChange(event);};
        openRequest.onupgradeneeded = function(event) {
            _this.idb = event.target.result;
            
            _this._upgradeNeeded(event);
        };
        
        return new request(openRequest)
            .error( function(event) {_this.error(event);} )
            .success( function(event) {
                var idb = _this.idb = this.result || event.result;

                if(idb.setVersion && idb.version !== _this.version) {

                    _this.setVersion(_this.version)
                        .success(function(event) {_this._init(event);})
                        .error(function(event) {_this.error(event);});
                }else {
                    _this._init(event);
                }
            });
    },
    _init: function(event) {
        this.eventListener
            .push('init', event, this)
            .push('ready', event, this);
    }
};

$ = $ || {};

$.inDB = function(options) {
    return new inDB(options);
};

var each = function (array, action, options) {
    if(!array || !array.length) return;
    var clone = array.slice();
    var len = clone.length;
    
    for(var i = 0; i < len; ++i)
    {
        action.call(clone[i], clone[i], i, options);
    }
}

var isFunction = function (obj) {
    return obj && ({}).toString.call(obj) == '[object Function]';
}

})(window['jQuery']);