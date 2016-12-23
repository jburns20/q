var express = require('express');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var config = require("./config.json");
var model = require("./model.js");

var login = require("./routes/login.js");
var home = require("./routes/home.js");

var app = express();
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

app.listen(config.server_port);
