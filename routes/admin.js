var Sequelize = require('sequelize');

var config = require("../config.json");
var options = require("./options.js");

exports.get = function(req, res) {
    if (!req.session || !req.session.TA) {
        res.redirect("/login");
        return;
    }
    if (!req.session.TA.admin) {
        res.sendStatus(403);
    }
    // If we need to display a toast on this request, it'll be in a cookie.
    // Store the message and clear the cookie so the user only sees it once.
    var toast = null;
    if (req.cookies.toast) {
        toast = req.cookies.toast;
        res.clearCookie("toast");
    }
    Sequelize.Promise.props({
        semester: options.current_semester(),
        webhook_url: options.slack_webhook()
    }).then(function(results) {
        return res.render("admin", {
            title: config.title,
            session: req.session,
            toast: toast,
            current_semester: results.semester,
            slack_webhook: results.webhook_url
        });
    });
};
