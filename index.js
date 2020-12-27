var config = require("./config.json");
process.env.TZ = config.timezone;

var http = require('http');
var express = require('express');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var model = require("./model.js");
var realtime = require("./realtime.js");
var notiftime = require("./notiftime.js");
var waittimes = require("./waittimes.js");

var login = require("./routes/login.js");
var home = require("./routes/home.js");
var options = require("./routes/options.js");
var metrics = require("./routes/metrics.js");
var gettime = require("./routes/gettime.js");
var settings = require("./routes/settings.js");

var app = express();
var server = http.Server(app);
realtime.init(server);
notiftime.init();
waittimes.init();
app.set('view engine', 'ejs')
app.use(bodyParser.urlencoded({"extended": false}));
app.use(cookieParser());
app.use(express.static('static'));
app.use(function(req, res, next) {
    model.sql.sync().then(function() {
        if (!req.cookies.auth) {
            next();
            return;
        }
        model.Session.findOne({
            where: {session_key: req.cookies.auth},
            include: [{model: model.TA, as: "TA"}]
        }).then(function(user) {
            req.session = user;
            next();
        });
    });
});

app.get("/", home.get);
app.post("/", home.post);

app.get("/login", login.get_login);
app.get("/oauth2/callback", login.get_callback);
app.get("/logout", login.get_logout);

app.get("/options", options.get);
app.post("/options", options.post);

app.get("/waittime", gettime.get);

app.get("/metrics", metrics.get);
app.get("/metrics/counts.json", metrics.get_counts);

app.get("/settings", settings.get);
app.post("/settings", settings.post);

server.listen(config.server_port);
