var sanitize = require('sanitize-html');

var notiftime = require("../notiftime.js");
var realtime = require("../realtime.js");
var waittimes = require("../waittimes.js");
var model = require("../model.js");
var p = require("../permissions.js");
var home = require("./home.js");
var config = require("../config.json");

var allowed_tags = "<a><b><blockquote><code><del><dd><dl><dt><em><h1><h2><h3><h4><h5><h6><i><img><kbd><li><ol><p><pre><s><sup><sub><strong><strike><small><ul><br><hr>";

var options_cache = {};
var protected_keys = ["current_semester", "slack_webhook", "ask_question_guide_link", "cooldown_time", "notif_time_threshold", "notif_time_interval"];

exports.get_string = function(key, default_value) {
    if (default_value === undefined) {
        default_value = "";
    }
    if (key in options_cache) {
        return Promise.resolve(options_cache[key]);
    }
    return model.sql.sync().then(function() {
        return model.Option.findOne({
            where: {key: key}
        });
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
    return model.sql.sync().then(function() {
        return exports.get_string(key, string_default);
    }).then(function(value) {
        return value == "1";
    });
};

exports.get_number = function(key, default_value) {
    if (default_value == undefined) {
        default_value = 0;
    }
    var string_default = default_value ? default_value.toString() : "0";
    return model.sql.sync().then(function() {
        return exports.get_string(key, string_default);
    }).then(function(value) {
        return parseFloat(value);
    });
}

exports.frozen = function() { return exports.get_bool("frozen", false); };
exports.message = function() { return exports.get_string("message", ""); };
exports.current_semester = function() {
    return exports.get_string("current_semester", "");
};
exports.slack_webhook = function() {
    return exports.get_string("slack_webhook", "");
};
exports.ask_question_guide_link = function() {
    return exports.get_string("ask_question_guide_link", "");
};
exports.cooldown_time = function() {
    return exports.get_number("cooldown_time", 0);
};
exports.notif_time_threshold = function() {
    return exports.get_number("notif_time_threshold", 0);
};
exports.notif_time_interval = function() {
    return exports.get_number("notif_time_interval", 0);
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
        exports.message().then(function(message) {
            res.send(message);
        });
    } else if (req.query.key == "current_semester") {
        exports.current_semester().then(function(sem) {
            res.send(sem);
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
        if (req.headers.referer) {
            res.redirect(req.headers.referer);
        } else {
            res.redirect("/");
        }
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
    } else if (key == "slack_webhook") {
        return value;
    } else if (key == "ask_question_guide_link") {
        return value;
    } else if (key == "cooldown_time" && parseFloat(value) >= 0) {
        return parseFloat(value).toString();
    } else if (key == "notif_time_threshold" && parseFloat(value) >= 0) {
        return parseFloat(value).toString();
    } else if (key == "notif_time_interval" && parseFloat(value) >= 0) {
        return parseFloat(value).toString();
    }
}

// Creates an update message for float option fields
function create_float_update_message(field_name, prev_value, value) {
    if (parseFloat(prev_value) > 0 && parseFloat(value) > 0) {
        return field_name + " time updated";
    } else if (parseFloat(prev_value) > 0) {
        return field_name + " removed";
    } else if (parseFloat(value) > 0) {
        return field_name + " set";
    }
}

function post_prop_update(req, key, prev_value, value) {
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
        if (prev_value == value) {
            return;
        }
        return model.sql.transaction(function(t) {
            return model.TA.findOne({
                where: {
                    semester: value,
                    admin: true
                }
            }).then(function(admin) {
                if (!admin && req.session.TA) {
                    return model.TA.create({
                        email: req.session.TA.email,
                        semester: value,
                        full_name: req.session.TA.full_name,
                        time_helped: 0,
                        num_helped: 0,
                        time_today: 0,
                        num_today: 0,
                        admin: true
                    });
                }
                return Promise.resolve(null);
            }).then(function() {
                return model.Session.destroy({
                    where: {ta_id: {[Sequelize.Op.gte]: 0}},
                    transaction: t
                })
            }).then(function() {
                return model.Entry.destroy({
                    where: {status: {[Sequelize.Op.lt]: 2}},
                    transaction: t
                });
            }).then(function() {
                return model.TA.update({
                    helping_id: null
                }, {
                    where: {id: {[Sequelize.Op.gte]: 0}},
                    transaction: t
                });
            })
        }).then(function() {
            home.clear_entries_cache();
            return "Current semester changed. The queue has been cleared and all TAs have been logged out.";
        });
    } else if (key == "slack_webhook") {
        waittimes.update_slack();
        return "Webhook URL updated";
    } else if (key == "ask_question_guide_link") {
        return "Fix Question URL updated";
    } else if (key == "cooldown_time") {
        return create_float_update_message("Cooldown warning", prev_value, value);
    } else if (key == "notif_time_threshold") {
        return create_float_update_message("TA help time notification", prev_value, value);
    } else if (key == "notif_time_interval") {
        return create_float_update_message("TA help time notification repeating interval", prev_value, value);
    }
}

exports.post = function(req, res) {
    if (!p.is_ta(req) && !p.is_admin(req)) {
        respond(req, res, "You don't have permission to do that.");
        return;
    }
    var is_protected = false;
    Object.keys(req.body).forEach(function(key) {
        if (protected_keys.indexOf(key) >= 0) {
            is_protected = true;
        }
    });
    if (is_protected && !p.is_admin(req)) {
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
            if (!is_protected) {
                realtime.option(key, value);
            }
            return post_prop_update(req, key, prev_value, value);
        });
        promises.push(p);
    });

    Promise.all(promises).then(function(results) {
        respond(req, res, results.filter(function(s) { return s != undefined }).join(', '));
    });
};
