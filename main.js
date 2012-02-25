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
