var http = require('http');
var express = require('express');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var config = require("./config.json");
var model = require("./model.js");
var realtime = require("./realtime.js");
var waittimes = require("./waittimes.js");

var login = require("./routes/login.js");
var home = require("./routes/home.js");
var options = require("./routes/options.js");

var app = express();
var server = http.Server(app);
realtime.init(server);
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

server.listen(config.server_port);
