(function () {
    "use strict";

    objects.resolveUrl = function (name) {
        return 'js/' + name + '.js';
    };

    objects.get('MainClass').then(function (main) {
        main.run();
    });

})();