const fs = require('fs')
var https = require('https');
var http = require('http');
var bodyParser = require('body-parser')
var express = require('express')
var request = require('request')
var schedule = require('node-schedule')
var async = require('async')
var parseString = require('xml2js').parseString;
var pool_controller = require('./pool_controller')
var harmony = require('harmonyhubjs-client')
var logger = require('./log')
var app = express()
var host = '127.0.0.1'
var http_port = 8081
var https_port = 8082
var harmonyHub = 'harmonyhub.usner.net'
var tunerName = 'tuner.usner.net'
var tuner = require('./yamaha_controller')
tuner.connect(tunerName)
var key = "diV6_8ZybVoRS4Czv2JrkM"
const privateKey  = fs.readFileSync('musner-key.pem'); //Private Key for validation (server uses only)
const certificate = fs.readFileSync('musner-cert.pem'); //Certificate, to provide to connecting host.
const options = {
  key: privateKey,
  cert: certificate
};

//E8DE27067F01

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json());

app.get('/harmony/activities', function (req, res) {
    ret = ''
    harmony(harmonyHub).then(function(harmonyClient) {
            harmonyClient.getActivities().then(function(activities) {
            activities.some(function(activity) {
                console.log(activity.label)
                ret += activity.label + '<br/>'
            })
            res.send(ret)
        })
    })
})

app.get('/harmony/plex', function (req, res) {
    harmony(harmonyHub)
    .then(function(harmonyClient) {
        harmonyClient.getActivities()
        .then(function(activities) {
            activities.some(function(activity) {
                if (activity.label === 'Plex') {
                    console.log('Watch Plex...')
                    var id = activity.id;
                    //tuner.command('<YAMAHA_AV cmd="PUT"><Zone_2><Power_Control><Power>Standby</Power></Power_Control></Zone_2></YAMAHA_AV>')
                    harmonyClient.startActivity(id)
                    harmonyClient.end()
                    res.sendStatus(200)
                }
            });
        });
    });
})

app.get('/harmony/tv', function (req, res) {
    harmony(harmonyHub)
    .then(function(harmonyClient) {
        harmonyClient.getActivities()
        .then(function(activities) {
            activities.some(function(activity) {
                if (activity.label === 'Watch TV') {
                    console.log('Watch TV...')
                    var id = activity.id;
                    //tuner.command('<YAMAHA_AV cmd="PUT"><Zone_2><Power_Control><Power>Standby</Power></Power_Control></Zone_2></YAMAHA_AV>')
                    harmonyClient.startActivity(id)
                    harmonyClient.end()
                    res.sendStatus(200)
                }
            });
        });
    });
})


app.get('/harmony/off', function (req, res) {
    harmony(harmonyHub).then(function(harmonyClient) {
        console.log('Turning Harmony off...')
        harmonyClient.turnOff()
        harmonyClient.end()
        res.sendStatus(200)            
    })
})

function harmonyTransportAction(device, action, done) {
    harmony(harmonyHub).then(function(harmonyClient) {
        return harmonyClient.getAvailableCommands()
        .then(function (commands) {
            device = commands.device.filter(function(group) {return group.label.toLowerCase() === device}).pop()
            transport=device.controlGroup.filter(function (group) { return group.name.toLowerCase() === 'transportbasic' }).pop()
            action=transport["function"].filter(function(group) {return group.name.toLowerCase() === action}).pop()
            var encodedAction = action.action.replace(/\:/g, '::')
            return harmonyClient.send('holdAction', 'action=' + encodedAction + ':status=press')
        })
        .finally(function () {
            harmonyClient.end()
            done()
        })
    })
}

app.get('/harmony/tv/pause/' + key, function (req, res) {
    console.log("/harmony/tv/pause")
    //curl -v -s -k --key musner-key.pem -l https://192.168.1.2:8082/harmony
    harmonyTransportAction("tv", "pause", function(d) { res.status(200).send("Paused") });
})

app.get('/harmony/tv/play/' + key, function (req, res) {
    console.log("/harmony/tv/pause")
    harmonyTransportAction("tv", "play", function(d) { res.status(200).send("Paused") });
})


// Returns a JSON encoded body containing the status of all pool components
// Example:
// http://yoururl:8181/pool
//   {
//        "time":"14:40",
//        "spa":0,
//        "cleaner":0,
//        "blower":0,
//        "spaLight":0,
//        "poolLight":0,
//        "pool":1,
//        "waterFeature":0,
//        "spillway":0,
//        "aux7":0,
//        "waterTemp":85,
//        "airTemp":92
//    }

//app.get('/pool', function (req, res) {
//    logger.info("Getting pool status")
//    pool_controller.getPoolStatus(res)
//});
// Returns a JSON encoded body containing the pump status
// Note that this only supports one pump at the moment but could easily be expanded
app.get('/pump', function (req, res) {
    logger.info("Getting pump status")
    pool_controller.getPumpStatus(res)
});

// Turn a feature on or off
// Usage:
// Action: 
//  POST
// Headers: 
//  Content-Type: application/json
// Parameters:
//      feature=status
// Valid feature strings are: 
// "spa", "cleaner", "blower", "spaLight", "poolLight", "pool", "waterFeature", "spillway", "aux7"
// Example line to turn pool and lights on:
// {    
//      http://localhost:80901/pool?pool=on&poolLight=on&spaLight=on
// }
app.get('/pool', function (req, res) {
    console.log(req.query)
    params = []
    for (var param in req.query) {
        params.push(param)
    }
    pool_controller.setFeature(param, req.query[param], function(err, obj) {
        if (err) {
            res.status(500).send("Failed to set feature state", param, req.query[param])
        } else {
            res.status(200).send(obj)
        }
    })
 })

var callback = 'http://192.168.1.10:39500/';
var x = 1
var state = {}
setInterval(function() {
    pool_controller.getPoolStatus(function(obj) {
        //obj.waterTemp = x
        //obj.airTemp = x+5
        //x += 1
        
        // if the time is valid and there's been a state change
        
        if (state.waterTemp != obj.waterTemp ||        
                state.waterTemp != obj.waterTemp ||
                state.airTemp != obj.airTemp ||
                state.pool != obj.pool ||
                state.spa != obj.spa ||
                state.blower != obj.blower ||
                state.poolLight != obj.poolLight ||
                state.spaLight != obj.spaLight ||
                state.cleaner != obj.cleaner ||
                state.spillway != obj.spillway ||
                state.waterFeature  != obj.waterFeature) {
            state = obj
            logger.info("Sending status")
            logger.info(obj)
            request.post({
                localAddress: '192.168.1.2',
                url: callback,
                json: obj
            }, function (error, resp) {
                if (error != null) {
                    console.log('response', error, resp);
                }
            })
        }
    })
}, 10000)
   
app.get('/pool/lights/on', function (req, res) {
    pool_controller.setLights('on', res)
})
 
 app.get('/pool/lights/off', function (req, res) {
    pool_controller.setLights('off', res)
})

 app.get('/pool/status', function (req, res) {
    pool_controller.getPoolStatus(function(obj) {
            logger.info(obj)
            res.status(200).send(obj)
    })
 })
 
 app.get('/tuner/patio/pandora', function (req, res) {
     console.log('Patio tuner on: Pandora')
     error = ""
     logger.info("Tuner power on")     
     tuner.command('<YAMAHA_AV cmd="PUT"><Zone_2><Power_Control><Power>On</Power></Power_Control></Zone_2></YAMAHA_AV>', function(result) {
         if (!result) error += "Failed to power on"
     })
     logger.info("Tuner input Pandora")
     tuner.command('<YAMAHA_AV cmd="PUT"><Zone_2><Input><Input_Sel>Pandora</Input_Sel></Input></Zone_2></YAMAHA_AV>', function(result) {
        if (!result) error += 'Failed to set to Pandora'
     })
     logger.info("Tuner volume -28")
     tuner.command('<YAMAHA_AV cmd="PUT"><Zone_2><Volume><Lvl><Val>-28</Val><Exp>1</Exp><Unit>dB</Unit></Lvl></Volume></Zone_2></YAMAHA_AV>', function(result) {
         if (!result) error += 'Failed to set volume level to -28'
     })
     logger.info("Tuner sleep 120")
     tuner.command('<YAMAHA_AV cmd="PUT"><Zone_2><Power_Control><Sleep>120 min</Sleep></Power_Control></Zone_2></YAMAHA_AV>', function(result) {
         if (!result) error += 'Failed to set sleep timer'
     })
     if (error != '') {
         logger.error("Failed to turn on patio")
         res.status(500).send(error)
     } else {
        res.status(200).send("Patio tuner on: Pandora")
     }
 })
  
app.get('/tuner/patio/off', function (req, res) {
    console.log('Patio tuner off')
    tuner.command('<YAMAHA_AV cmd="PUT"><Zone_2><Power_Control><Power>Standby</Power></Power_Control></Zone_2></YAMAHA_AV>', function(result) {
        if (result) {
            res.status(200).send("Patio tuner off")
        } else {
            res.status(500).send("Failed to turn patio tuner off")
        }
    })
})

app.get('/tuner/pandora/thumbup', function (req, res) {
    console.log('Pandora thumb dup')
    tuner.command('<YAMAHA_AV cmd="PUT"><Pandora><Play_Control><Feedback>Thumb Up</Feedback></Play_Control></Pandora></YAMAHA_AV>', function(result) {
        if (result) {
            res.status(200).send("Pandora thumb up")
        } else {
            res.status(500).send("Failed to Pandora thumb up")
        }
    })
})

app.get('/tuner/pandora/thumbdown', function (req, res) {
    console.log('Pandora thumb dup')
    tuner.command('<YAMAHA_AV cmd="PUT"><Pandora><Play_Control><Feedback>Thumb Down</Feedback></Play_Control></Pandora></YAMAHA_AV>', function(result) {
        if (result) {
            res.status(200).send("Pandora thumb down")
        } else {
            res.status(500).send("Failed to Pandora thumb down")
        }
    })
})

app.get('/tuner/pandora/next', function (req, res) {
    console.log('Pandora next')
    tuner.command('<YAMAHA_AV cmd="PUT"><Pandora><List_Control><Cursor>Sel</Cursor></List_Control></Pandora></YAMAHA_AV>', function(result) {
        if (result) {
            res.status(200).send("Pandora next")
        } else {
            res.status(500).send("Failed to Pandora next")
        }
    })
})

app.get('/patio/off', function(req, res) {
    pool_controller.setAll('off', res)
})

// the server entry point
//var server = app.listen(port, function () {
//    var host = '127.0.0.1'
//    var port = server.address().port
//    logger.info("Home-Device-Controller listening at http://%s:%s", host, port)
//})

app.listen = function() {
  var server = http.createServer(this);
  return server.listen.apply(server, arguments);
}

http.createServer(app).listen(http_port)
logger.info("Home-Device-Controller listening at http://%s:%s", host, http_port)
https.createServer(options, app).listen(https_port)
logger.info("Home-Device-Controller listening at http://%s:%s", host, https_port)