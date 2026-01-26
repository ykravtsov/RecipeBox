const { setWorldConstructor, World } = require('@cucumber/cucumber');

class CustomWorld extends World {
    constructor(options) {
        super(options);
    }
}

setWorldConstructor(CustomWorld);