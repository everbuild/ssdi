(function () {
    "use strict";

    function assert(exp, msg) {
        if(!exp) {
            throw msg;
        }
    }

    function FactoryHolder(name) {
        this.name = name;
        this.defer = Q.defer();
        this.promise = this.defer.promise;
    }


    FactoryHolder.prototype.resolve = function (factory) {
        this.defer.resolve(factory);
        this.resolved = true;
    };


    function getDependenciesFromSignature(func) {
        // TODO
        return [];
    }


    function ObjectManager() {
        this.objects = {};
        this.factories = {};
        this.stack = []; // TODO track resolution stack to give better errors
    }


    /**
     * Maps object names to URLs. This default implementation just appends '.js' to the object name. Please override this to customize.
     * @param name object name
     * @returns {string} url
     */
    ObjectManager.prototype.resolveUrl = function (name) {
        return name + '.js';
    };


    /**
     * Define a new object
     * @param name optional name for the object; defaults to the name of the file from which this function is called
     * @param deps optional dependencies: array of object names as string
     * @param func required factory function that will be called once to create an instance (singleton)
     */
    ObjectManager.prototype.define = function () {
        var name, deps, func;
        if(arguments.length >= 3) {
            name = arguments[0];
            deps = arguments[1];
            func = arguments[2];
            if(arguments.length > 3) {
                console.warn('define has more than 3 arguments; they will be ignored!');
            }
            assert(typeof name === 'string', 'name should be a string');
            assert(Array.isArray(deps), 'dependencies should be an array of strings');
            assert(typeof func === 'function', 'factory function should be a function');
        } else if(arguments.length == 2) {
            name = arguments[0];
            func = arguments[1];
            assert(typeof name === 'string', 'name should be a string');
            assert(typeof func === 'function', 'factory function should be a function');
            deps = getDependenciesFromSignature(func);
        } else if(arguments.length == 1) {
            func = arguments[0];
            assert(typeof func === 'function', 'factory function should be a function');
            if(!this.expectedName) {
                throw "can't guess name";
            }
            name = this.expectedName;
            deps = getDependenciesFromSignature(func);
        } else {
            throw 'define should have 1 to 3 arguments';
        }
        this.defineInternal(name, deps, func);
    };


    ObjectManager.prototype.defineInternal = function (name, deps, func) {
        if(this.factories[name]) {
            console.warn('overriding factory "' + name + '"');
        }
        var factory = new ObjectFactory(name, deps, func);

        var holder = this.factories[name];
        if(!holder) {
            holder = this.factories[name] = new FactoryHolder(name);
        }
        holder.resolve(factory);
    };


    /**
     * Register an existing object instance
     * @param name
     * @param object
     */
    ObjectManager.prototype.put = function (name, object) {
        this.objects[name] = Q(object);
    };


    /**
     * Get an object instance
     * @param name
     * @returns {*}
     */
    ObjectManager.prototype.get = function (name) {
        var promise = this.objects[name];
        if(!promise) {
            var mgr = this;
            promise = this.objects[name] = this.getFactory(name)
                .then(function (fact) {
                    return fact.create(mgr);
                });
        }
        return promise;
    };


    ObjectManager.prototype.getFactory = function (name) {
        var holder = this.factories[name];
        if(holder) {
            return holder.promise;
        } else {
            return this.loadFactory(name);
        }
    };


    ObjectManager.prototype.loadFactory = function (name) {
        var mgr = this;
        var holder = this.factories[name] = new FactoryHolder(name);
        var url = mgr.resolveUrl(name);
        $.ajax({
            url: url,
            timeout: 5000,
            dataType: 'text',
            success: function (code) {
                mgr.expectedName = name;
                eval('(function () {"use strict";' + code + '})();');
                mgr.expectedName = undefined;
                if(!holder.resolved) {
                    console.error('No object "' + name + '" defined in "' + url + '"');
                }
            },
            error: function () {
                console.error('Can\'t load "' + url + '"');
                holder.defer.reject();
            }
        });
        return holder.promise;
    };


    function ObjectFactory(name, deps, func) {
        this.name = name;
        this.deps = deps;
        this.func = func;
    }


    ObjectFactory.prototype.create = function (mgr) {
        var func = this.func;
        var depObjsPromises = _(this.deps).map(function (name) {
            return mgr.get(name);
        });
        return Q.all(depObjsPromises).then(function (depObjs) {
            return func.apply(mgr, depObjs);
        });
    };

    window.objects = new ObjectManager();

})();