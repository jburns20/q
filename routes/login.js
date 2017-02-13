var async = require('async');
var crypto = require('crypto');
var google = require('googleapis');
var OAuth2 = google.auth.OAuth2;

var config = require("../config.json");
var model = require("../model.js");

var oauth2Client = new OAuth2(config.google_id, config.google_secret,
  "https://" + config.domain + "/oauth2/callback"
);
var auth_url = oauth2Client.generateAuthUrl({
  scope: ["profile", "email"],
  hd: "andrew.cmu.edu"
});
var auth_url_nodomaincheck = oauth2Client.generateAuthUrl({
  scope: ["profile", "email"]
});

exports.get_login = function(req, res) {
    if (req.session && req.session.authenticated) {
        res.redirect("/");
    } else if (req.query.domaincheck == 0) {
        res.redirect(auth_url_nodomaincheck);
    } else {
        res.redirect(auth_url);
    }
};

exports.get_callback = function(req, res) {
    var userinfo = null;
    var key = crypto.randomBytes(72).toString('base64');
    var ta = null;
    async.waterfall([
        function(callback) {
            oauth2Client.getToken(req.query.code, callback);
        },
        function(tokens, something, callback) {
            google.oauth2("v2").userinfo.get({
                access_token: tokens.access_token
            }, callback);
        },
        function(body, something, callback) {
            userinfo = body;
            model.sql.sync().then(function() {
                callback(null);
            });
        },
        function(callback) {
            model.TA.findOne({where: {email: userinfo.email}})
                    .then(function(result) {
                ta = result;
                callback(null);
            });
        },
        function(callback) {
            model.Session.create({
                "email": userinfo.email,
                "user_id": userinfo.email.substring(0,userinfo.email.indexOf("@")),
                "session_key": key,
                "authenticated": true,
                "ta_id": ta ? ta.id : null
            }).then(function() {
                callback(null);
            });
        },
        function(callback) {
            res.cookie("auth", key, {"maxAge": 30*24*60*60*1000});
            res.redirect("/");
        }
    ], function(error) {
        res.send("ERROR: " + error);
    });
};

exports.get_logout = function(req, res) {
    if (req.session) {
        req.session.destroy();
    }
    res.clearCookie("auth");
    res.redirect("/");
};
