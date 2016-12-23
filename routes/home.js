var async = require('async');
var crypto = require('crypto');

var model = require("../model.js");
var entries_cache = null;

exports.get = function(req, res) {
    // If we need to display a toast on this request, it'll be in a cookie.
    // Store the message and clear the cookie so the user only sees it once.
    var toast = null;
    if (req.cookies.toast) {
        toast = req.cookies.toast;
        res.clearCookie("toast");
    }
    var entries = [];
    async.waterfall([
        function(callback) {
            //don't re-query the database if nothing has changed
            if (entries_cache) {
                entries = entries_cache;
                callback(null);
                return;
            }
            //our cache is out-of-date (or doesn't exist), query the database
            model.Entry.findAll({
                where: {status: {lt: 2}},
                include: [{model: model.TA, as: "TA"}],
                order: [['entry_time', 'ASC']]
            }).then(function(results) {
                entries = results;
                entries_cache = results;
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

function post_add(req, res) {
    var name = req.body.name;
    var user_id = req.body.user_id;
    async.waterfall([
        function(callback) {
            // A valid user ID is between 3 and 8 alphanumeric characters, and
            // if the user is logged in (and isn't a TA), then it must match
            // the account they're logged in with.
            if (!user_id || user_id.length < 3 || user_id.length > 8 
                    || !user_id.match("[A-Za-z0-9]*")
                    || (req.session && req.session.authenticated && !req.session.TA && req.session.user_id != user_id)) {
                callback(new Error("Error: Invalid Andrew ID"));
                return;
            }
            // A valid name is just any non-empty string.
            if (!name || name.length < 1) {
                callback(new Error("Error: Invalid Name"));
                return;
            }
            callback(null);
        },
        function(callback) {
            // Check to make sure the user isn't already on the queue
            model.Entry.findOne({
                where: {status: {lt: 2}, user_id: user_id},
            }).then(function(result) {
                if (result) {
                    callback(new Error("Error: You are already on the queue"));
                } else {
                    callback(null);
                }
            });
        },
        function(callback) {
            // Create an unauthenticated session if the user isn't logged in or
            // if their existing session's user ID doesn't match the current one
            if (!req.session || (!req.session.TA && req.session.user_id != user_id)) {
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
            // Finally, add the entry to the queue
            model.Entry.create({
                user_id: user_id,
                name: name,
                entry_time: new Date(),
                status: 0,
                session_id: req.session.TA ? null : req.session.id
            }).then(function(instance) {
                entries_cache = null;
                respond(req, res, "Entered the queue");
            });
        }
    ],
    function(error) {
        if (error) {
            respond(req, res, error.message);
        }
    });
}

function post_rem(req, res) {
    var id = req.body.entry_id;
    var entry = null;
    async.waterfall([
        function(callback) {
            // Find the entry that should be removed
            model.Entry.findById(id).then(function(instance) {
                if (!instance) {
                    callback(new Error("Error: There is no entry with that ID"));
                } else {
                    entry = instance;
                    callback(null);
                }
            });
        },
        function(callback) {
            // Only entries that have not yet been helped can be removed.
            // In order to remove an entry, you need to either be a TA or be
            // logged in as the student who matches the entry.
            if (entry.status == 0 && req.session
                  && (req.session.id == entry.session_id
                      || (req.session.authenticated 
                            && req.session.user_id == entry.user_id)
                      || req.session.TA)) {
                callback(null);
            } else {
                callback(new Error("Error: You don't have permission to remove that entry"));
            }
        },
        function(callback) {
            entry.destroy().then(function() {
                entries_cache = null;
                respond(req, res, "Entry removed");
            });
        }
    ],
    function(error) {
        if (error) {
            respond(req, res, error.message);
        }
    });
}

function post_help(req, res) {
    var id = req.body.entry_id;
    model.sql.transaction(function(t) {
        if (!req.session || !req.session.TA) {
            throw new Error("You don't have permission to help that student");
        }
        if (req.session.TA.helping_id) {
            throw new Error("You are already helping a student");
        }
        return model.Entry.findById(id, {
            transaction: t
        }).then(function(entry) {
            if (!entry) {
                throw new Error("The student you were trying to help is not on the queue");
            }
            if (entry.status != 0) {
                throw new Error("That student is already being helped");
            }
            return entry.update({
                status: 1,
                help_time: new Date(),
                ta_id: req.session.TA.id
            }, {transaction: t});
        }).then(function() {
            return req.session.TA.update({
                helping_id: id
            }, {transaction: t});
        })
    }).then(function(result) {
        entries_cache = null;
        respond(req, res, null);
    }).catch(function(error) {
        respond(req, res, "Error: " + error.message);
    });
}

function post_cancel(req, res) {
    var id = req.body.entry_id;
    model.sql.transaction(function(t) {
        if (!req.session || !req.session.TA) {
            throw new Error("You don't have permission to cancel helping that student");
        }
        var ta = null;
        return model.Entry.findById(id, {
            include: [{model: model.TA, as: "TA"}],
            transaction: t
        }).then(function(entry) {
            if (!entry || !entry.TA || entry.status != 1) {
                throw new Error("That student is not being helped");
            }
            ta = entry.TA;
            return entry.update({
                status: 0,
                help_time: null,
                ta_id: null
            }, {transaction: t});
        }).then(function(entry) {
            return ta.update({
                helping_id: null
            }, {transaction: t});
        })
    }).then(function(result) {
        entries_cache = null;
        respond(req, res, null);
    }).catch(function(error) {
        respond(req, res, "Error: " + error.message);
    });
}

function post_done(req, res) {
    var id = req.body.entry_id;
    var message = null;
    var duration;
    model.sql.transaction(function(t) {
        if (!req.session || !req.session.TA) {
            throw new Error("You don't have permission to finish helping that student");
        }
        var ta = null;
        return model.Entry.findById(id, {
            include: [{model: model.TA, as: "TA"}],
            transaction: t
        }).then(function(entry) {
            if (!entry || !entry.TA || entry.status != 1) {
                throw new Error("That student is not being helped");
            }
            if (entry.TA.id != req.session.TA.id) {
                throw new Error("You don't have permission to finish helping that student");
            }
            ta = entry.TA;
            var exit_time = new Date();
            duration = (exit_time - entry.help_time)/1000;
            var mins = Math.round(duration/60.0);
            message = "Student helped for " + mins + " minute";
            if (mins != 1) message += "s";
            return entry.update({
                status: 2,
                exit_time: exit_time
            }, {transaction: t});
        }).then(function(entry) {
            return ta.update({
                helping_id: null,
                num_helped: ta.num_helped + 1,
                time_helped: ta.time_helped + duration,
                num_today: ta.num_today + 1,
                time_today: ta.time_today + duration
            }, {transaction: t});
        })
    }).then(function(result) {
        entries_cache = null;
        respond(req, res, message);
    }).catch(function(error) {
        respond(req, res, "Error: " + error.message);
    });
}

exports.post = function(req, res) {
    var action = req.body.action;
    if (action == "ADD") {
        post_add(req, res);
    } else if (action == "REM") {
        post_rem(req, res);
    } else if (action == "HELP") {
        post_help(req, res);
    } else if (action == "CANCEL") {
        post_cancel(req, res);
    } else if (action == "DONE") {
        post_done(req, res);
    } else {
        respond(req, res, "Invalid action: " + action);
    }
};
