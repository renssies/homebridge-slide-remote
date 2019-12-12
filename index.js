const SlidePlatform = require("./lib/SlidePlatform")

module.exports = function (homebridge) {
    homebridge.registerPlatform('homebridge-slide-remote', 'slide-remote', SlidePlatform)
}

