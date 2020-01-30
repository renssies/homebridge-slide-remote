const request = require('request')
const SlideAccessoryModule = require("./SlideAccessory")
const SlideAccessory = SlideAccessoryModule.SlideAccessory
const packageJSON = require('../package.json')

module.exports = SlidePlatform

function SlidePlatform(log, config, homebridge) {
    log.info("Starting Slide platform")
    this.configJSON = config
    this.packageJSON = packageJSON
    this.log = log
    this.api = homebridge
    this.accessoryList = []

    SlideAccessoryModule.setHomebridge(homebridge)

    this.getSlides().then((slides) => {
        this.log.info("Found " + slides.length + " slides")
    }).catch((error) => {
        this.log.error(error)
    })

    if (!this.configJSON["username"] || !this.configJSON["password"]) {
        this.log.error("Username and/or password missing from Homebridge config")
    }
}

SlidePlatform.prototype.accessories = function(callback) {
    this.log.debug("Getting accessories")
    if (this.accessoryList.length <= 0) {
        this.log.debug("Getting slides")
        this.getSlides().then((slides) => {
            this.accessoryList = slides
            callback(this.accessoryList)
        }).catch((error) => {
            callback(error)
        })
    } else {
        this.log.debug("Returning accessoires")
        callback(this.accessoryList)
    }
    
}

SlidePlatform.prototype.identify = function(callback) {
    this.log.info("Identifying slide platform")
    callback()
}

SlidePlatform.prototype.getAccessToken = function() {
    var promise = new Promise((resolve, reject) => {
        if (this.accessToken) {
            this.log.debug("Already found access token")
            return resolve(this.accessToken)
        } else {
            this.log.debug("Needs access token to continue, returning login")
            this.login().then((accessToken) => {
                resolve(accessToken)
            }).catch((error) => {
                reject(error)
            })
        }
    })
    return promise
}

SlidePlatform.prototype.login = function() {
    if (this.loginPromise) {
        this.log.debug("Already logging in, returning existing promise")
        return this.loginPromise
    }
    var parameters = {
        email: this.configJSON["email"] || this.configJSON["username"],
        password: this.configJSON["password"]
    }
    var promise = new Promise((resolve, reject) => {
        this.request("POST", "auth/login", parameters).then((response) => {
            this.loginPromise = null
            if (!response.access_token) {
                return reject(Error("Invalid response"))
            }        
            this.accessToken = response.access_token
            return resolve(response.access_token)
        }).catch((error) => {
            this.loginPromise = null
            return reject(error)
        })
    })
    this.loginPromise = promise
    return promise
}

SlidePlatform.prototype.getSlides = function() {
    if (this.slidesPromise) {
        this.log("Already getting slides, returning existing promise")
        return this.slidesPromise
    }
    var promise = new Promise((resolve, reject) => {
        this.getAccessToken().then((accessToken) => {
            this.request("GET", "slides/overview", null, this.accessToken).then((response) => {
                let slides = response.slides
                if (slides) {
                    var accessories = []
                    slides.forEach(slideInfo => {
                        let accessory = new SlideAccessory(this, slideInfo)
                        accessories.push(accessory)
                    });
                    this.slidesPromise = null
                    return resolve(accessories)
                } else {
                    this.slidesPromise = null
                    return reject(Error("Invalid response"))
                }
            }).catch((error) => {
                this.slidesPromise = null
                reject(error)
            })
        }).catch((error) => {
            this.slidesPromise = null
            reject(error)
        })
    })
    this.slidesPromise = promise
    return promise
}

SlidePlatform.prototype.request = function(method, endpoint, parameters, accessToken, bypassCache = false) {
    let baseURL = "https://api.goslide.io/api"
    if (endpoint.length > 0 && endpoint.charAt(0) !== "/") {
        endpoint = "/" + endpoint
    }
    var requestInfo = {
        uri: baseURL + endpoint,
        method: method, 
        timeout: 6000,
        headers: {
            "User-Agent": "homebridge-slide-remote" + packageJSON.version
        },
        json: true
    }
    if (accessToken) {
        requestInfo.auth = {
            bearer: accessToken,
            sendImmediately: true
        }

    }
    if (bypassCache) {
        requestInfo.headers["IIM-Bypass-Cache"] = "true"
    }
    if (method == "POST") {
        requestInfo.body = parameters
    }
    var promise = new Promise((resolve, reject) => {
        request(requestInfo, (error, response, responseBody) => {
            if (error) {
                this.log.error(error)
                return reject(error)
            }
            if (response.statusCode < 200 || response.statusCode >= 300) {
                error = Error("Invalid response received: " + response.statusCode)
                this.log.error(error)
                return reject(error)
            }
            return resolve(responseBody)
         })
    })
    return promise
}