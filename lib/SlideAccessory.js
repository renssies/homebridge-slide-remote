const poll = require('poll').default;

module.exports = {
    setHomebridge: setHomebridge,
    SlideAccessory: SlideAccessory
  }

let Service
let Characteristic
let Accessory

// The slide API uses 1.0 for fully closed, homekit uses 0 for fully closed.
// The slide API uses 0 for fully open and HomeKit uses 100 for fully open.
// This function converts the HomeKit position to a Slide API allowed position.
function HomekitPositionToSlideAPI(position) {
    var newPosition = 100 - position
    newPosition = newPosition / 100
    return Math.min(Math.max(newPosition, 0), 1)
}

// The slide API uses 1.0 for fully closed, homekit uses 0 for fully closed.
// The slide API uses 0 for fully open and HomeKit uses 100 for fully open.
// This function converts the slide API position to a HomeKit allowed position.
function SlideAPIPositionToHomekit(position) {
    var newPosition = position * 100
    newPosition = 100 - newPosition
    return Math.min(Math.max(newPosition, 0), 100)
}

function CalculateDifference(first, second) {
    var difference = first - second
    if (difference < 0) {
        difference = difference * -1
    }
    return difference
}

function setHomebridge (homebridge) {
    Service = homebridge.hap.Service
    Characteristic = homebridge.hap.Characteristic
    Accessory = homebridge.hap.Accessory
  }

function SlideAccessory(platform, data) {
    this.log = platform.log
    this.platform = platform
    this.name = data.device_name || data.device_id
    this.base_uuid = data.device_id
    this.identifier = data.id
    this.category = Accessory.Categories.WINDOW_COVERING

    this.infoService = new Service.AccessoryInformation()
    this.infoService.updateCharacteristic(Characteristic.Manufacturer, "Innovation in Motion")
    this.infoService.updateCharacteristic(Characteristic.Model, "Slide")
    this.infoService.updateCharacteristic(Characteristic.SerialNumber, data.id)
    this.infoService.updateCharacteristic(Characteristic.FirmwareRevision, this.platform.packageJSON)

    this.maxDifference = 5 // In percentage

    this.windowCoveringService = new Service.WindowCovering(this.name)
    if (data.device_info.pos) {
        var position = SlideAPIPositionToHomekit(data.device_info.pos)
        if (CalculateDifference(position, 100) <= this.maxDifference) {
            position = 100
        } else if (CalculateDifference(position, 0) <= this.maxDifference) {
            position = 0
        }
        this.log.debug("Setting initial position: " + position)
        this.windowCoveringService.getCharacteristic(Characteristic.CurrentPosition).updateValue(position)
        this.windowCoveringService.getCharacteristic(Characteristic.TargetPosition).updateValue(position)
    }

    this.windowCoveringService.getCharacteristic(Characteristic.TargetPosition).on('set', this.setTargetPosition.bind(this))
    this.windowCoveringService.getCharacteristic(Characteristic.CurrentPosition).on('get', this.getCurrentPosition.bind(this))

    let pollInterval = platform.configJSON["poll_interval"] || 45 
    poll(this.updateSlideInfo.bind(this), pollInterval * 1000)
}

/* (Periodic) update functions */

SlideAccessory.prototype.updateSlideInfo = function() {
    this.log.debug("Starting to update slide info from poll")
    this.getSlideInfo().then((device_info) => {
        if (!device_info.data) {
            callback(Error("Invalid response"))
            return
        }
        let targetPosition = this.windowCoveringService.getCharacteristic(Characteristic.TargetPosition).value
        var position = SlideAPIPositionToHomekit(device_info.data.pos)

        var difference = CalculateDifference(targetPosition, position)
        this.log.debug("Difference between position and target position: " + difference)
        this.log.debug("Current target position: " + targetPosition)
        this.log.debug("Position from API: " + position)
        
        if (difference <= this.maxDifference) {
            position = targetPosition
        }

        this.windowCoveringService.getCharacteristic(Characteristic.CurrentPosition).updateValue(position)

        if (targetPosition == position) {
            this.windowCoveringService.getCharacteristic(Characteristic.PositionState).updateValue(Characteristic.PositionState.STOPPED)
        } else if (targetPosition < position) {
            this.windowCoveringService.getCharacteristic(Characteristic.PositionState).updateValue(Characteristic.PositionState.DECREASING)
        } else {
            this.windowCoveringService.getCharacteristic(Characteristic.PositionState).updateValue(Characteristic.PositionState.INCREASING)
        }
    }).catch((error) => {
        this.log.error(error)
    })
}

/* Slide API Calls */

SlideAccessory.prototype.getSlideInfo = function() {
    return this.platform.request("GET", "slide/" + this.identifier + "/info", null, this.platform.accessToken)
}

/* Homebridge functions */

SlideAccessory.prototype.getServices = function() {
    return [this.infoService, this.windowCoveringService]
}

SlideAccessory.prototype.getCurrentPosition = function(callback) {
    this.getSlideInfo().then((device_info) => {
        if (!device_info.data) {
            callback(Error("Invalid response"))
            return
        }
        var position = SlideAPIPositionToHomekit(device_info.data.pos)
        let targetPosition = this.windowCoveringService.getCharacteristic(Characteristic.TargetPosition).value

        var difference = CalculateDifference(targetPosition, position)
        if (difference <= this.maxDifference) {
            position = targetPosition
        }
        this.windowCoveringService.getCharacteristic(Characteristic.CurrentPosition).updateValue(position)
        callback(null, position)
    }).catch((error) => {
        callback(error)
    })
}

SlideAccessory.prototype.setTargetPosition = function(targetPosition, callback) {
    let parameters = { pos: HomekitPositionToSlideAPI(targetPosition) }
    this.log.debug("Sending request: " + "slide/" + this.identifier + "/position")
    this.log.debug("Access token " + this.platform.accessToken)
    this.platform.request("POST", "slide/" + this.identifier + "/position", parameters, this.platform.accessToken).then((response) => {
        let currentPosition = this.windowCoveringService.getCharacteristic(Characteristic.CurrentPosition).value
        if (targetPosition == currentPosition) {
            this.windowCoveringService.getCharacteristic(Characteristic.PositionState).updateValue(Characteristic.PositionState.STOPPED)
        } else if (targetPosition < currentPosition) {
            this.windowCoveringService.getCharacteristic(Characteristic.PositionState).updateValue(Characteristic.PositionState.DECREASING)
        } else {
            this.windowCoveringService.getCharacteristic(Characteristic.PositionState).updateValue(Characteristic.PositionState.INCREASING)
        }
        this.windowCoveringService.getCharacteristic(Characteristic.TargetPosition).updateValue(targetPosition)
        callback(null, targetPosition)
    }).catch((error) => {
        this.log.error(error)
        callback(error)
    })
}