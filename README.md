#### This plugin is still work in progress. See the todos and known issues below. Development of this plugin might be slow due to some personal issues. 

# Homebridge Slide Remote
A homebridge plugin to use the [Slide](https://slide.store) curtain motor in HomeKit using Homebridge.

The name is "Slide Remote" on purpose, this version uses the [open cloud API](https://documenter.getpostman.com/view/6223391/S1Lu2pSf) (V1.0) that is provided by Innovation in Motion. 

Once the local API or module API (for the header pins) becomes available I will likely abandon development of this version of the plugin and instead use the local API because of privacy, reliability and responsiveness. 

# Installation

Currently the plugin is not registered in the NPM registry because the plugin is till too much WIP. Therefor manual installation is required. The following command can be used to install the plugin:

```bash
npm install -g https://github.com/renssies/homebridge-slide-remote.git
```

After that you will need to enter the following details into the ~/.homebridge/config.json:

```JSON
{
  "platforms":[
         {
             "platform": "slide-remote",
             "username": "EMAIL",
             "password": "PASSWORD"
         }
     ]
 }
```
Now start of restart homebridge and all slides connected to your account should appear in the HomeKit app. 

# Known Issues
- [ ] Opening/closing the curtains using the Slide app or other plugins does not currently reflect the state correctly in HomeKit. 
- [ ] The expiration of the access token isn't currently handled. This means the homekit accessory will stop working a month after the launch of Homebridge. Restarting homebridge will fix this issue. 
- [ ] HomeKit apps will sometimes incorrectly report that the curtain is still moving, while it is already done opening. 
- [ ] The code is far from perfect or optimized, my knowledge of NodeJS isn't the best.

# Todo
- [ ] Handle expiration of the access token.
- [ ] Save the access token (and expiration date) somewhere in homebridge instead of requesting it every restart. 
- [ ] Correctly report errors by marking the accessory as "Not responding" in the Home app.
- [ ] Move to the new OAuth method when available.
