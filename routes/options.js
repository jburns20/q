var striptags = require("striptags");

var realtime = require("../realtime.js");
var model = require("../model.js");

var allowed_tags = "<a><b><blockquote><code><del><dd><dl><dt><em><h1><h2><h3><h4><h5><h6><i><img><kbd><li><ol><p><pre><s><sup><sub><strong><strike><small><ul><br><hr>";

var frozen_cache = null;

exports.frozen = function(callback) {
    if (frozen_cache === null) {
        return model.Option.findOne({
            where: {key: "frozen"}
        }).then(function(row) {
            if (row && row.value == "1") {
                frozen_cache = true;
                return callback(true);
            } else if (row && row.value == "0") {
                frozen_cache = false;
                return callback(false);
            } else {
                return model.Option.create({
                    key: "frozen",
                    value: "0"
                }).then(function() {
                    frozen_cache = false;
                    return callback(false);
                });
            }
        });
    } else {
        return callback(frozen_cache);
    }
};

var message_cache = null;

exports.message = function(callback) {
    if (message_cache === null) {
        return model.Option.findOne({
            where: {key: "message"}
        }).then(function(row) {
            if (row) {
                message_cache = row.value;
                return callback(row.value);
            } else {
                return model.Option.create({
                    key: "message",
                    value: ""
                }).then(function() {
                    message_cache = "";
                    return callback("");
                });
            }
        });
    } else {
        return callback(message_cache);
    }
};

exports.get = function(req, res) {
    if (req.query.key == "frozen") {
        exports.frozen(function(frozen) {
            if (frozen) {
                res.send("1");
            } else {
                res.send("0");
            }
        });
    } else if (req.query.key == "message") {
        exports.message(function(message) {
            res.send(message);
        });
    } else {
        res.sendStatus(404);
    }
};

function respond(req, res, message, data) {
    if (req.query.json) {
        res.json({message: message, data: data});
    } else {
        if (message) {
            res.cookie("toast", message);
        }
        res.redirect("/");
    }
}

exports.post = function(req, res) {
    if (!req.session || !req.session.TA) {
        respond(req, res, "You don't have permission to do that.");
        return;
    }
    var promises = [];
    
    if (req.body.frozen == "0" || req.body.frozen == "1") {
        var prev_frozen = null;
        var p = exports.frozen(function(result) {
            prev_frozen = result;
            return model.Option.upsert({
                key: "frozen",
                value: req.body.frozen
            });
        }).then(function(row) {
            frozen_cache = null;
            if (req.body.frozen == "1" && !prev_frozen) {
                realtime.frozen(true);
                return Promise.resolve("Queue frozen");
            } else if (req.body.frozen == "0" && prev_frozen) {
                realtime.frozen(false);
                return Promise.resolve("Queue unfrozen");
            } else {
                return Promise.resolve(null);
            }
        });
        promises.push(p);
    }
    
    if (req.body.message || req.body.message === "") {
        var message = striptags(req.body.message, allowed_tags);
        var p = model.Option.upsert({
            key: "message",
            value: message
        }).then(function(row) {
            message_cache = null;
            realtime.message(message);
            if (message == "") {
                return Promise.resolve("Message removed");
            } else {
                return Promise.resolve("Message updated");
            }
        });
        promises.push(p);
    }
    
    Promise.all(promises).then(function(results) {
        var message = "";
        results.forEach(function(result) {
            if (result != null) {
                if (message == "") {
                    message += "" + result;
                } else {
                    message += ", " + result;
                }
            }
        });
        respond(req, res, message);
    });
};