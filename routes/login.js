var crypto = require('crypto');
var google = require('googleapis').google;

var config = require("../config.json");
var model = require("../model.js");
var options = require("./options.js");

function getOAuth2Client(host) {
    return new google.auth.OAuth2(
        config.google_id,
        config.google_secret,
        config.protocol + "://" + host + "/oauth2/callback"
    );
}

exports.get_login = function(req, res) {
    if (req.session && req.session.authenticated) {
        res.redirect("/");
    } else {
        const client = getOAuth2Client(req.host);
        var params = {
            scope: ["profile", "email"]
        };
        if (req.query.domaincheck !== '0') {
            params['hd'] = "andrew.cmu.edu";
        }
        res.redirect(client.generateAuthUrl(params));
    }
};

exports.get_callback = function(req, res) {
    var key = crypto.randomBytes(72).toString('base64');
    var semesterP = options.current_semester();
    var errorHandler = function(error) {
        if (error) {
            console.log("ERROR: " + JSON.stringify(error));
            res.send("ERROR: " + error);
        }
    };
    const client = getOAuth2Client(req.host);
    var emailP = client.getToken(req.query.code)
    .then(function(result) {
        return google.oauth2("v2").userinfo.get({
            access_token: result.tokens.access_token
        });
    }).then(function(userinfo) {
        return userinfo.data.email;
    }).catch(errorHandler);
    var taP = Promise.all([semesterP, emailP, model.sql.sync()])
    .then(function(results) {
        var semester = results[0];
        var email = results[1];
        return model.TA.findOne({
            where: {
                email: email,
                semester: semester
            }
        });
    }).catch(errorHandler);
    Promise.all([emailP, taP])
    .then(function(results) {
        var email = results[0];
        var ta = results[1];
        return model.Session.create({
            "email": email,
            "user_id": email.substring(0,email.indexOf("@")),
            "session_key": key,
            "authenticated": true,
            "ta_id": ta ? ta.id : null,
            "owner": email == config.owner_email
        });
    }).then(function() {
        res.cookie("auth", key, {"maxAge": 30*24*60*60*1000});
        res.redirect("/");
    }).catch(errorHandler);
};

exports.get_logout = function(req, res) {
    if (req.session) {
        req.session.destroy();
    }
    res.clearCookie("auth");
    res.redirect("/");
};
