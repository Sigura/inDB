var customerData = [
    { ssn: '444-44-4444', name: 'Bill', age: 35, email: 'bill@company.com' },
    { ssn: '333-33-3333', name: 'David', age: 65, email: 'david@company.com' },
    { ssn: '222-22-2222', name: 'Artur', age: 29, email: 'artur@company.com' },
    { ssn: '111-11-1111', name: 'Maria', age: 40, email: 'maria@company.com' },
    { ssn: '555-55-5555', name: 'Donna', age: 25, email: 'donna@home.org' }
];

var init = function(event) {

    //console.log(event);

    if(this.containts('customers'))
        return;

    this.createStore('customers', { keyPath: 'ssn' })
        .createIndex('name', { unique: false })
        .createIndex('age', { unique: false })
        .createIndex('email', { unique: true })
        .add(customerData)
        .error(function(event) {
            console.log('add error', event);
        })
        .success(function(event) {
            console.log('add success', event);
        });

};

var $db = new inDB({ name: 'testDatabase', version: 42 })
.error(function(event) {

    console.log('db error', event);
})
//before ready
.init(init)
.versionChange( function(event) {
    console.log('version changed, timeStamp:', event.timeStamp, ', new version:', this.version);
})
// WebKit, as of 2012-02-22, does not yet implement this. 
.upgradeNeeded(function(event) {

    console.log('onupgradeneeded, newVersion:', event.newVersion, ', oldVersion:', event.oldVersion, ', timeStamp:', event.timeStamp, event);
    
    init.call(this, event);
})
.ready(function(event) {

    console.log('db.name =', $db.name, '; db.version =', $db.version);

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
        //get by key
        .get('444-44-4444')
        .error(function(event) {
            console.log('get error', event);
        })
        .success(function(event) {
            console.log('444-44-4444 getted', this.result);

            $store.del('555-55-5555')
                .success(function(event){
                    console.log('object deleted', event);
                });

            //$db.close();
        });

    $store
        //get one by index
        .get('name', 'Artur')
        .error(function(event) {
            console.log('get error', event);
        })
        .success(function(event) {
            console.log('found', this.result);
        });

    $store
        //get all
        .get()
        //add filter, in future may be add support that - linq js
        .where(function(item){
            return item.age > 20 && item.email.substr(-8).toLowerCase() != 'home.org';
        })
        .error(function(event) {
            console.log('get error', event);
        })
        //begin read
        .start(function(context) {
            console.log('read begin');
            context.result = [];
        })
        //read ended
        .ended(function(context) {
            console.log('read ended', context.result);
        })
        //read next, must be at the end in this case
        .success(function(event, context) {
            console.log('result ', this.result.value);

            context.result.push(this.result.value);
        });

    $store
        //get all by IDBKeyRange
        .get(function(query) {
             return query
                    //.lowerBound('name', 'Bill') // all name ≥ 'Bill'
                    .bound('age', 30, 60, true, true); // all age 30 > x && < 60
        })
        .error(function(event) {
            console.log('get error', event);
        })
        //begin read
        .start(function(context) {
            context.result = [];
        })
        //read ended
        .ended(function(context) {
            console.log(context.result);
        })
        //read next, must be at the end in this case
        .success(function(event, context) {
            console.log('getted by IDBKeyRange', this.result.value);
            
            context.result.push(this.result.value);
        });


});

//setTimeout(function(e){console.log('init by timeout');$db._init(e);}, 2500);
setTimeout(function(){$db.remove(); console.log('removed all by timeout');}, 10000);
