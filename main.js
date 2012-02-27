var customerData = [
    { ssn: '444-44-4444', name: 'Bill', age: 35, email: 'bill@company.com' },
    { ssn: '333-33-3333', name: 'David', age: 65, email: 'david@company.com' },
    { ssn: '222-22-2222', name: 'Artur', age: 29, email: 'artur@company.com' },
    { ssn: '111-11-1111', name: 'Maria', age: 40, email: 'maria@company.com' },
    { ssn: '555-55-5555', name: 'Donna', age: 25, email: 'donna@home.org' }
];

var init = function(event) {

    if(this.containts('customers'))
        return;

    this.createStore('customers', { keyPath: 'ssn' })
        .createIndex('name', { unique: false })
        .createIndex('age', { unique: false })
        .createIndex('email', { unique: true })
        .complete(function(event) {
            console.info('store customers created', event);
        })
        .add(customerData)
        .error(errorHandler)
        .success(function(event) {
            console.info('add success', event);
        });

};
var errorHandler = function(event) { console.error('get error', event); };

var $db = new inDB({ name: 'testDatabase', version: 42 })
.error(errorHandler)
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

    console.info('db.name =', $db.name, '; db.version =', $db.version);

    var storeNames = [];
    $db.each(function(storeName){
        storeNames.push(storeName);
    });
    console.info('stores: ', storeNames.length > 0 ? storeNames.join(', ') : 'none');

    var $store = this.openStore('customers', this.readWrite);
    var tdd = { ssn: '000-00-0000', name: 'for tdd', age: 100, email: 'tdd@company.com' };
    var listenEvent = ['insert', 'insertd', 'update', 'updated', 'delete', 'deleted'];
    
    listenEvent.forEach(function(label, i){
        $store.eventListener.add(label, function(event){
            console.log(label, event);
        });
    });

    $store
        //get by key
        .get('444-44-4444')
        .error(errorHandler)
        .success(function(event) {
            var customer = this.result;

            $store.del('555-55-5555')
                .success(function(event){
                    console.log('customer Donna deleted', event);
                });

            //$db.close();
        });

    $store
        //get one by index
        .get('name', 'Artur')
        .error(errorHandler)
        .success(function(event) {
            console.info('found', this.result);
        });

    $store
        //get all. cursor way
        .get()
        //add filter, in future may be add support that - linq js
        .where(function(item){
            return item.age > 20 && item.email.substr(-8).toLowerCase() != 'home.org';
        })
        .error(errorHandler)
        //begin read
        .start(function(context) {
            console.time('get all');
            context.result = [];
        })
        //read ended
        .ended(function(context) {
            console.timeEnd('get all', context.result);
        })
        //read next, must be at the end in this case
        .success(function(event, context) {
            var customer = this.result.value;

            console.info('result ', customer.ssn, customer);

            context.result.push(customer);
        });

    $store
         // new transaction for update
        .cloneTran()
        //get all by IDBKeyRange. cursor way
        .get(function(query) {
             return query
                    //.lowerBound('name', 'Bill') // all name ≥ 'Bill'
                    .bound('age', 30, 60, true, true); // all age 30 > x && < 60
                    //only one predicate by design index db, please use where after get
        })
        .error(errorHandler)
        //begin read
        .start(function(context) {
            context.result = [];
            console.time('get all by IDBKeyRange');
        })
        //read ended
        .ended(function(context) {
            console.timeEnd('get all by IDBKeyRange', context.result);
        })
        //read next, must be at the end in this case
        .success(function(event, context) {
            var customer = this.result.value;

            console.info('getted by IDBKeyRange', customer.ssn, customer);

            if(customer.ssn == '111-11-1111') {

                ++customer.age;

                //only for cursor
                context.update(customer);
            }

            context.result.push(customer);
        });

    $store
        .cloneTran()
        .add(tdd)
        .success(function(event){
    
                // build new read only transaction
                var $reStore = $db.openStore('customers', this.read);

                $reStore.get(tdd.ssn)
                    .success(function(event){
                        console.log('added:', this.result.ssn, this.result);
                        $store.cloneTran().del(this.result.ssn);
                    });

                // build new transaction as old store transaction
                $store.cloneTran()
                    .get('111-11-1111')
                    .success(function(event){
                        console.log('updated:', this.result.ssn, this.result);
                    });

        });

    // WebKit, as of 2012-02-22, does not yet implement this. 
    $store.count()
        .success(function(event){
            console.info('count:', this.result);
        })
        .error(errorHandler);
});

setTimeout(function(){$db.remove(); console.log('removed all by timeout');}, 5000);
