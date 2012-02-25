var dbName = 'TestDatabase';

var version = 42;

var customerData = [
    { ssn: '444-44-4444', name: 'Bill', age: 35, email: 'bill@company.com' },
    { ssn: '333-33-3333', name: 'David', age: 30, email: 'david@company.com' },
    { ssn: '555-55-5555', name: 'Donna', age: 32, email: 'donna@home.org' }
];

var init = function(event){

    //console.log(event);

    if(this.containts('customers'))
        return;

    this.createStore('customers', { keyPath: 'ssn' })
        .createIndex('name', { unique: false })
        .createIndex('email', { unique: true })
        .add(customerData)
        .error(function(event){
            console.log('add error', event);
        })
        .success(function(event){
            console.log('add success', event);
        });

};

var $db = new inDB({ name: dbName, version: version })
.error(function(event){

    console.log('db error', event);
})
.init(init)
.versionChange( function(event) {
    console.log('version changed, timeStamp:', event.timeStamp, ', new version:', this.version);
})
.upgradeNeeded(function(event){

    console.log('onupgradeneeded, newVersion:', event.newVersion, ', oldVersion:', event.oldVersion, ', timeStamp:', event.timeStamp, event);
    
    init.call(this, event);
})
.ready(function(event){

    console.log('db.name =', $db.name, '; db.version =', version);

    var storeNames = [];
    $db.each(function(storeName){
        storeNames.push(storeName);
    });
    console.log('stores: ', storeNames.length > 0 ? storeNames.join(', ') : 'none');

    var $store = this.openStore('customers', this.readWrite);
    
    // var removeAll = function(){

        // console.log('remove all');
        
        // $store.remove();

        // $db.remove();
    // };
    
    $store
        .get('444-44-4444')
        .error(function(event){
            console.log('get error', event);
        })
        .success(function(event){
            console.log('getted', this.result);

            $store.del('555-55-5555')
                .success(function(event){
                    console.log('object deleted', event);
                });

            $db.close();
        });
    
    

});

//setTimeout(function(e){console.log('init by timeout');$db._init(e);}, 2500);
setTimeout(function(){$db.remove(); console.log('removed all by timeout');}, 10000);

/*


var indexedDB = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.msIndexedDB;
var idbTransaction = window.webkitIDBTransaction || window.IDBTransaction;

console.log('init db', dbName, '...');

var request = indexedDB.open(dbName, version);

console.log('inited db', request);

request.onerror = function(event) {
    console.log('db error', event);
};

request.onsuccess = function(event) {

    console.log('db success', event);
    
    var db = request.result || event.result;
    
    var build = function(event) {

        dbInfo(db);

        //indexedDB.deleteDatabase(dbName);
        
        init(db, getting, event);
    };
    
    if(db.setVersion && version != db.version) {
        var setVerReq = db.setVersion(version);
        
        setVerReq.onsuccess = function(event){build(event);};
    }else
        build(event);
};

request.onversionchange = function(event) {
    console.log('version changed, newVersion:', event.newVersion, ', oldVersion:', event.oldVersion, ', timeStamp:', event.timeStamp);
};

// WebKit, as of 2012-02-22, does not yet implement this.
request.onupgradeneeded = function(event) {
    // Update object stores and indices
    console.log('onupgradeneeded, newVersion:', event.newVersion, ', oldVersion:', event.oldVersion, ', timeStamp:', event.timeStamp, event);

    var db = event.target.result;
    
    if(db.objectStoreNames.contains('customers')) {
        db.deleteObjectStore('customers');
    }
    
    init(db, getting, event);
};

function init(db, getting, event)
{
    if(db.objectStoreNames.contains('customers'))
        return getting(db);

    console.log(event);
        
    var objectStore = db.createObjectStore('customers', { keyPath: 'ssn' });

    // Create an index to search customers by name. We may have duplicates
    // so we can't use a unique index.
    objectStore.createIndex('name', 'name', { unique: false });

    // Create an index to search customers by email. We want to ensure that
    // no two customers have the same email, so use a unique index.
    objectStore.createIndex('email', 'email', { unique: true });

    for (var i in customerData) {
        var request = objectStore.add(customerData[i]);
        
        request.onsuccess = function(event) {
            // event.target.result == customerData[i].ssn
            console.log('add success', event);
        };
    }
    
    getting(db, objectStore);
}

function getting(db, objectStore){
    if(!db.objectStoreNames.contains('customers'))
        throw 'customers not yet created';
        
    objectStore = (objectStore || db.transaction(['customers'], idbTransaction.READ_WRITE)
        .objectStore('customers'));

    var request = objectStore.get('444-44-4444');

    console.log(objectStore);
        
    request.onerror = function(event) {
        // Handle errors!
        console.log('get error', event);
    };
    request.onsuccess = function(event) {
        // Do something with the request.result!
        console.log('Name for SSN 444-44-4444 is ' + request.result.name);

        objectStore.get('555-55-5555')
            .onsuccess = function(){
                objectStore.delete('555-55-5555');
            };

        //indexedDB.deleteDatabase(dbName);
    };
}

function dbInfo(idb) {

    if (!idb)
        return;

    var sName = idb.name;
    var dVersion = idb.version;
    var dTableNames = idb.objectStoreNames;
    var strNames = 'IndexedDB name: ' + sName + '; version: ' + dVersion + '; object stores: ';

    for (var i = 0; i < dTableNames.length; i++) {
        strNames = strNames + dTableNames[i] + ', ';
    }
    
    if(!dTableNames.length)
        strNames += 'none';
    
    console.log(strNames);
}
*/