(function($){

var indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.msIndexedDB;
var idbTransaction = window.webkitIDBTransaction || window.IDBTransaction;

var factory = function() {
    return function(options){
        options = options || {};

        return this.__ctor(options);
    };
};

window.store = factory();

window.request = function(req){
    return this.__ctor(req);
};

window.inDB = factory();

var eventListener = factory();

eventListener.prototype = {
    add: function(name, event){
        if(!event){
            throw 'empty event';
        }
        var ents = this.events = this.events || {};
        var list = ents[name] = ents[name] || [];
        
        list.push(event);

        return this;
    },
    push: function(name, event, scope){
        var ents = this.events = this.events || {};
        var list = ents[name] = (ents[name] || []).slice();
        var len = list.length;
        var _this = this;

        for(var i = 0; i < len; ++i)
        {
            var action = list[i];

            action.call(scope || _this, event);
        }
        return this;
    },
    del: function(event){
        var ents = this.events = this.events || {};
        var list = ents[name] = ents[name] || [];
        list.remove(event);
        
        return this;
    },
    __ctor: function(){
        this.events = this.events || {};

        return this;
    }
},


window.store.prototype = {
    createIndex: function(name, options) {

        this.store.createIndex(name, name, options);

        return this;
    },
    add: function(val) {

        if(!(val instanceof Array))
            return new request(this.store.add.apply(this.store, arguments));

        var clone = val.slice();
        var len = clone.length;
        var result = new request();
        
        for(var i = 0; i < len; i++) {

            var req = this.store.add.call(this.store, clone[i]);

            result.add(req);
        }

        return result;
    },
    del: function() {
        return new request( this.store['delete'].apply(this.store, arguments) );
    },
    remove: function() {
        var idb = this.db.idb;

        return new request( idb.deleteObjectStore(this.store.name) );
    },
    get: function() {
        return new request(this.store.get.apply(this.store, arguments));
    },
    __ctor: function(options){

        for(var o in options) {
            this[o] = options[o];
        }

        return this;
    }
};

window.request.prototype = {
    error: function(error){
        this.eventListener.add('error', error);
        return this;
    },
    success: function(success){
        this.eventListener.add('success', success);
        return this;
    },
    add: function(req){
        var _this = this;

        each(['error', 'success'], function(i, label){

            //req.addEventListener does not work in FF
            req['on' + label] = function(event){
                _this._push(label, event, req);
            };

        });
        
        return this;
    },
    _push: function(label, event, scope){
        this.eventListener.push(label, event, scope)
    },
    __ctor: function(req){
        this.eventListener = new eventListener();
        this.requests = [];
        
        if(!req) {return this;}

        this.add(req);

        return this;
    }
};

window.inDB.prototype = {
    
    init: function(init) {
        this.eventListener.add('init', init);

        return this;
    },
    each: function(action){
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

        openRequest.onversionchange = function(event){_this._versionChange(event);};
        openRequest.onupgradeneeded = function(event){
            _this.idb = event.target.result;
            
            _this._upgradeNeeded(event);
        };
        
        return new request(openRequest)
            .error( function(event){_this.error(event);} )
            .success( function(event){
                var idb = _this.idb = this.result || event.result;

                if(idb.setVersion && idb.version !== _this.version) {

                    _this.setVersion(_this.version)
                        .success(function(event){_this._init(event);})
                        .error(function(event){_this.error(event);});
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

$.inDB = function(options){
    return new inDB(options);
};

var each = function (array, action, options) {
    if(!array || !array.length) return;
    var clone = array.slice();
    var len = clone.length;
    
    for(var i = 0; i < len; ++i)
    {
        action.call(clone[i], i, clone[i], options);
    }
}

})(window['jQuery']);