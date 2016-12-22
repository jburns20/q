var async = require('async');
var crypto = require('crypto');

var model = require("../model.js");

exports.get = function(req, res) {
    var toast = null;
    if (req.cookies.toast) {
        toast = req.cookies.toast;
        res.clearCookie("toast");
    }
    var entries = [];
    async.waterfall([
        function(callback) {
            model.Entry.findAll({
                where: {status: {lt: 2}},
                order: [['entry_time', 'ASC']]
            }).then(function(results) {
                entries = results;
                callback(null);
            });
        }
    ],
    function(error) {
        res.render("home", {
            title: "15-122 Office Hours Queue",
            session: req.session,
            entries: entries,
            toast: toast
        });
    });
};

function post_add(req, res) {
    var name = req.body.name;
    var user_id = req.body.user_id;
    async.waterfall([
        function(callback) {
            if (!user_id || user_id.length < 3 || user_id.length > 8 
                    || !user_id.match("[A-Za-z0-9]*")
                    || (req.session && req.session.authenticated && req.session.user_id != user_id)) {
                callback(new Error("Invalid Andrew ID"));
                return;
            }
            if (!name || name.length < 1) {
                callback(new Error("Invalid Name"));
                return;
            }
            callback(null);
        },
        function(callback) {
            model.Entry.findOne({
                where: {status: {lt: 2}, user_id: user_id},
            }).then(function(result) {
                if (result) {
                    callback(new Error("You are already on the queue"));
                } else {
                    callback(null);
                }
            });
        },
        function(callback) {
            if (!req.session || req.session.user_id != user_id) {
                var key = crypto.randomBytes(72).toString('base64');
                model.Session.create({
                    user_id: user_id,
                    session_key: key,
                    authenticated: false
                }).then(function(instance) {
                    req.session = instance;
                    res.cookie("auth", key);
                    callback(null);
                });
            } else {
                callback(null);
            }
        },
        function(callback) {
            model.Entry.create({
                user_id: user_id,
                name: name,
                entry_time: new Date(),
                status: 0,
                session_id: req.session.id
            }).then(function(instance) {
                res.cookie("toast", "Entered the queue");
                callback(null);
            });
        }
    ],
    function(error) {
        if (error) {
            res.cookie("toast", error.message);
        }
        res.redirect("/");
    });
}

function post_rem(req, res) {
    var id = req.body.entry_id;
    var entry = null
    async.waterfall([
        function(callback) {
            model.Entry.findById(id).then(function(instance) {
                if (!instance) {
                    callback(new Error("There is no entry with that ID"));
                } else {
                    entry = instance;
                    callback(null);
                }
            });
        },
        function(callback) {
            if (entry.status == 0 && req.session
                  && (req.session.id == entry.session_id
                      || (req.session.authenticated 
                            && req.session.user_id == entry.user_id))) {
                callback(null);
            } else {
                callback(new Error("You don't have permission to remove that entry"));
            }
        },
        function(callback) {
            entry.destroy().then(function() {
                res.cookie("toast", "Entry removed");
                callback(null);
            });
        }
    ],
    function(error) {
        if (error) {
            res.cookie("toast", error.message);
        }
        res.redirect("/");
    });
}

exports.post = function(req, res) {
    var action = req.body.action;
    if (action == "ADD") {
        post_add(req, res);
    } else if (action == "REM") {
        post_rem(req, res);
    } else {
        res.cookie("toast", "Invalid action: " + action);
        res.redirect("/");
    }
};   