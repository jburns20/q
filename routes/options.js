var sanitize = require('sanitize-html');

var realtime = require("../realtime.js");
var model = require("../model.js");
var home = require("./home.js");

var allowed_tags = "<a><b><blockquote><code><del><dd><dl><dt><em><h1><h2><h3><h4><h5><h6><i><img><kbd><li><ol><p><pre><s><sup><sub><strong><strike><small><ul><br><hr>";

var options_cache = {};
var protected_keys = ["current_semester"];

exports.get_string = function(key, default_value) {
    if (default_value === undefined) {
        default_value = "";
    }
    if (key in options_cache) {
        return Promise.resolve(options_cache[key]);
    }
    return model.Option.findOne({
        where: {key: key}
    }).then(function(row) {
        if (row) {
            options_cache[key] = row.value;
            return row.value;
        }
        return model.Option.create({
            key: key,
            value: default_value
        }).then(function() {
            options_cache[key] = default_value;
            return default_value;
        });
    });
};

exports.get_bool = function(key, default_value) {
    if (default_value === undefined) {
        default_value = false;
    }
    var string_default = default_value ? "1" : "0";
    return exports.get_string(key, string_default).then(function(value) {
        return value == "1";
    });
};

exports.frozen = function() { return exports.get_bool("frozen", false); };
exports.message = function() { return exports.get_string("message", ""); };
exports.current_semester = function() {
    return exports.get_string("current_semester", "");
};

exports.get = function(req, res) {
    if (req.query.key == "frozen") {
        exports.frozen().then(function(frozen) {
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

function validate(key, value) {
    if (key == 'frozen' && (value == '0' || value == '1')) {
        return value;
    } else if (key == 'message') {
        return sanitize(value, {
            allowedTags: allowed_tags
        });
    } else if (key == "current_semester" && RegExp("^[SMNF][0-9][0-9]$").test(value)) {
        return value;
    }
}

function post_prop_update(key, prev_value, value) {
    if (key == "frozen") {
        if (prev_value == '0' && value == '1') {
            return Promise.resolve("Queue frozen");
        } else if (prev_value == "1" && value == "0") {
            return Promise.resolve("Queue unfrozen");
        }
    } else if (key == "message") {
        if (prev_value === "" && value !== "") {
            return Promise.resolve("Message added");
        } else if (prev_value !== "" && value === "") {
            return Promise.resolve("Message removed");
        } else if (prev_value != value) {
            return Promise.resolve("Message updated");
        }
    } else if (key == "current_semester") {
        return model.sql.transaction(function(t) {
            return model.Session.destroy({
                where: {ta_id: {$gte: 0}},
                transaction: t
            }).then(function() {
                return model.Entry.destroy({
                    where: {status: {$lt: 2}},
                    transaction: t
                });
            }).then(function() {
                return model.TA.update({
                    helping_id: null
                }, {
                    where: {id: {$gte: 0}},
                    transaction: t
                });
            })
        }).then(function() {
            home.clear_entries_cache();
            return "Current semester changed. Please log in again.";
        });
    }
}

exports.post = function(req, res) {
    if (!req.session || !req.session.TA) {
        respond(req, res, "You don't have permission to do that.");
        return;
    }
    var is_protected = false;
    Object.keys(req.body).forEach(function(key) {
        if (protected_keys.indexOf(key) >= 0) {
            is_protected = true;
        }
    });
    if (is_protected && !req.session.TA.admin) {
        respond(req, res, "You don't have permission to do that.");
        return;
    }
    var promises = [];

    Object.keys(req.body).forEach(function(key) {
        var value = validate(key, req.body[key]);
        if (value === undefined) {
            promises.push(Promise.resolve("Value for property '" + key + "' was not valid"));
            return;
        }
        var prev_value = null;
        var p = exports.get_string(key).then(function(prev) {
            prev_value = prev;
            return model.Option.upsert({
                key: key,
                value: value
            });
        }).then(function(row) {
            options_cache[key] = value;
            realtime.option(key, value);
            return post_prop_update(key, prev_value, value);
        });
        promises.push(p);
    });

    Promise.all(promises).then(function(results) {
        respond(req, res, results.filter(function(s) { return s != undefined }).join(', '));
    });
};
