var express = require('express');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var request = require('request');
var async = require('async');
var google = require('googleapis');
var OAuth2 = google.auth.OAuth2;

var config = require("./config.json");
var model = require("./model.js");

var app = express();
app.use(bodyParser.urlencoded({"extended": false}));
app.use(cookieParser());

var oauth2Client = new OAuth2(config.google_id, config.google_secret,
  "http://q.15122.tk/oauth2/callback"
);
var auth_url = oauth2Client.generateAuthUrl({
  scope: ["profile", "email"],
  hd: "andrew.cmu.edu"
});

app.get("/login", function(req,res) {
    res.redirect(auth_url);
});

app.get("/oauth2/callback", function(req,res) {
    async.waterfall([
        function(callback) {
            oauth2Client.getToken(req.query.code, callback);
        },
        function(tokens, something, callback) {
            google.oauth2("v2").userinfo.get({
                access_token: tokens.access_token
            }, callback);
        }, function(body, callback) {
            res.send(body);
        }
    ], function(error) {
        res.send("ERROR: " + error);
    });
});

app.listen(config.server_port);
