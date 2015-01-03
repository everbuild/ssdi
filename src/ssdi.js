(function () {
    "use strict";

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
        var m = /function(\s+\w+)?\s*\((\s*\w+\s*(,\s*\w+\s*)*)\)/i.exec(func.toString());
        if(m && m[2]) {
            return m[2].split(',').map(function (name) {
                return name.trim();
            });
        } else {
            return [];
        }
    }


    function ObjectManager() {
        this.objects = {};
        this.factories = {};
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

        try {
            if(arguments.length >= 3) {
                name = arguments[0];
                deps = arguments[1];
                func = arguments[2];
                if(arguments.length > 3) {
                    console.warn('define has more than 3 arguments; they will be ignored!');
                }
                checkName();
                checkDeps();
                checkFunc();
            } else if(arguments.length == 2) {
                name = arguments[0];
                func = arguments[1];
                checkName();
                checkFunc();
                deps = getDependenciesFromSignature(func);
            } else if(arguments.length == 1) {
                func = arguments[0];
                checkFunc();
                if(!this.expectedName) {
                    throw "can't guess name";
                }
                name = this.expectedName;
                deps = getDependenciesFromSignature(func);
            } else {
                throw 'define should have 1 to 3 arguments';
            }

            this.defineInternal(name, deps, func);

            return true;
        } catch (msg) {
            console.error(msg + " - url: " + (this.currentUrl || 'unknown'));
            return false;
        }

        function checkName() {
            if(typeof name !== 'string') {
                throw 'name should be a string';
            }
        }

        function checkDeps() {
            var msg = 'dependencies should be an array of strings';
            if(!Array.isArray(deps)) {
                throw msg;
            }
            deps.each(function (dep) {
                if(typeof dep !== 'string') {
                    throw msg;
                }
            });
        }

        function checkFunc() {
            if(typeof func !== 'function') {
                throw 'factory function should be a function';
            }
        }
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
        ajaxGet(url)
            .then(function (code) {
                mgr.expectedName = name;
                mgr.currentUrl = url;
                eval('(function () {"use strict";' + code + '})();');
                mgr.expectedName = undefined;
                mgr.currentUrl = undefined;
                if(!holder.resolved) {
                    console.error('No object "' + name + '" defined in "' + url + '"');
                    holder.defer.reject();
                }
            })
            .catch(function () {
                console.error('Can\'t load "' + url + '"');
                holder.defer.reject();
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
        var depObjsPromises = this.deps.map(function (name) {
            return mgr.get(name);
        });
        return Q.all(depObjsPromises).then(function (depObjs) {
            return func.apply(mgr, depObjs);
        });
    };

    /**
     * Perform an ajax GET request to fetch text.
     * This is a stripped version of Zepto's ajax function
     * @param url
     * @return {promise}
     */
    function ajaxGet(url){
        var def = Q.defer();
        var protocol = /^([\w-]+:)\/\//.test(url) ? RegExp.$1 : window.location.protocol;
        var xhr = new window.XMLHttpRequest();

        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4) {
                xhr.onreadystatechange = null;
                clearTimeout(abortTimeout);
                if ((xhr.status >= 200 && xhr.status < 300) || xhr.status == 304 || (xhr.status === 0 && protocol == 'file:')) {
                    def.resolve(xhr.responseText);
                } else {
                    def.reject(xhr.statusText || 'abort');
                }
            }
        };

        xhr.open('GET', url);

        xhr.setRequestHeader('Accept', 'text/plain');

        var abortTimeout = setTimeout(function () {
            xhr.onreadystatechange = null;
            xhr.abort();
            def.reject('timeout');
        }, 5000);

        xhr.send();

        return def.promise;
    }

    window.objects = new ObjectManager();

})();