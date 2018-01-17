var Sequelize = require("sequelize");
var moment = require("moment-timezone");
var validator = require('validator');

var model = require("../model.js");
var config = require("../config.json");
var options = require("./options.js");
var home = require("./home.js");

exports.get = function(req, res) {
    if (!req.session || !req.session.TA) {
        res.redirect("/login");
        return;
    }
    if (!req.session.TA.admin) {
        res.sendStatus(403);
        return;
    }
    // If we need to display a toast on this request, it'll be in a cookie.
    // Store the message and clear the cookie so the user only sees it once.
    var toast = null;
    if (req.cookies.toast) {
        toast = req.cookies.toast;
        res.clearCookie("toast");
    }
    var current_semester = null;
    options.current_semester().then(function(semester) {
        current_semester = semester;
        return Sequelize.Promise.props({
            webhook_url: options.slack_webhook(),
            topics: function() {
                return model.Topic.findAll({
                    where: {
                        semester: current_semester
                    },
                    order: [['due_date', 'ASC']]
                })
            }(),
            tas: function() {
                return model.TA.findAll({
                    where: {
                        semester: current_semester
                    },
                    order: [['email', 'ASC']]
                });
            }()
        });
    }).then(function(results) {
        results.tas.forEach(function(ta) {
            ta.is_self = (ta.id == req.session.TA.id);
        });
        return res.render("admin", {
            title: config.title,
            session: req.session,
            toast: toast,
            current_semester: current_semester,
            slack_webhook: results.webhook_url,
            topics: results.topics,
            tas: results.tas
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
        res.redirect("/admin");
    }
}

function post_add_topic(req, res) {
    var name = req.body.topic_name;
    var out_date = moment.tz(new Date(req.body.out_date), config.timezone).toDate();
    var due_date = moment.tz(new Date(req.body.due_date), config.timezone).toDate();
    if (!out_date.getTime() || !due_date.getTime() || !name) {
        respond(req, res, "Error: One of the fields was invalid.");
        return;
    }
    options.current_semester().then(function(semester) {
        return model.Topic.create({
            name: name,
            out_date: out_date,
            due_date: due_date,
            semester: semester
        })
    }).then(function() {
        home.clear_topics_cache();
        respond(req, res, "Topic added");
    });
}

function post_delete_topic(req, res) {
    var id = req.body.id;
    model.Topic.findById(id).then(function(instance) {
        if (!instance) {
            throw new Error("There is no topic with that ID");
        }
        return instance.destroy();
    }).then(function() {
        home.clear_topics_cache();
        home.clear_entries_cache();
        respond(req, res, "Topic deleted");
    }).catch(function(error) {
        respond(req, res, "Error: " + error);
    });
}

function post_update_topic(req, res) {
    var id = req.body.id;
    var name;
    var out_date;
    var due_date;
    model.Topic.findById(id).then(function(instance) {
        if (!instance) {
            throw new Error("There is no topic with that ID");
        }
        name = req.body.topic_name;
        out_date = moment.tz(new Date(req.body.out_date), config.timezone).toDate();
        due_date = moment.tz(new Date(req.body.due_date), config.timezone).toDate();
        if (!out_date.getTime() || !due_date.getTime() || !name) {
            throw new Error("One of the fields was invalid.");
        }
        return instance.update({
            name: name,
            out_date: out_date,
            due_date: due_date
        });
    }).then(function() {
        home.clear_topics_cache();
        home.clear_entries_cache();
        respond(req, res, "Topic updated");
    }).catch(function(error) {
        respond(req, res, "Error: " + error);
    });
}

function post_add_ta(req, res) {
    if (!req.body.name || !req.body.email) {
        respond(req, res, "Error: All fields are required.");
        return;
    }
    if (!validator.isEmail(req.body.email)) {
        respond(req, res, "Error: The provided email address is not valid.");
        return;
    }

    options.current_semester().then(function(semester) {
        return model.TA.create({
            full_name: req.body.name,
            email: req.body.email,
            semester: semester,
            time_helped: 0,
            num_helped: 0,
            time_today: 0,
            num_today: 0,
            admin: 0
        });
    }).then(function() {
        respond(req, res, "TA added");
    });
}

function post_delete_ta(req, res) {
    var id = req.body.id;
    if (id == req.session.TA.id) {
        respond(req, res, "Error: Cannot delete yourself");
        return;
    }
    model.TA.findById(id).then(function(instance) {
        if (!instance) {
            throw new Error("There is no topic with that ID");
        }
        if (instance.helping_id) {
            throw new Error("Cannot remove a TA while they are helping a student");
        }
        if (instance.admin) {
            throw new Error("Cannot delete an administrator");
        }
        return instance.destroy();
    }).then(function() {
        respond(req, res, "TA deleted");
    }).catch(function(error) {
        respond(req, res, "Error: " + error);
    });
}

function post_update_ta(req, res) {
    var id = req.body.id;
    var name;
    var email;
    model.TA.findById(id).then(function(instance) {
        if (!instance) {
            throw new Error("There is no topic with that ID");
        }
        name = req.body.name;
        email = req.body.email;
        if (!name) {
            throw new Error("TA name was missing or invalid.");
        }
        var updated_fields = {
            full_name: name
        }
        if (id != req.session.TA.id && !instance.admin) {
            if ( !email || !validator.isEmail(email)) {
                throw new Error("TA email was missing or invalid.");
            }
            updated_fields['email'] = email;
        }
        return instance.update(updated_fields);
    }).then(function() {
        respond(req, res, "TA updated");
    }).catch(function(error) {
        respond(req, res, "Error: " + error);
    });
}

exports.post = function(req, res) {
    if (!req.session || !req.session.TA) {
        res.redirect("/login");
        return;
    }
    if (!req.session.TA.admin) {
        res.sendStatus(403);
        return;
    }

    var action = req.body.action;
    if (action == "ADDTOPIC") {
        post_add_topic(req, res);
    } else if (action == "DELETETOPIC") {
        post_delete_topic(req, res);
    } else if (action == "UPDATETOPIC") {
        post_update_topic(req, res);
    } else if (action == "ADDTA") {
        post_add_ta(req, res);
    } else if (action == "UPDATETA") {
        post_update_ta(req, res);
    } else if (action == "DELETETA") {
        post_delete_ta(req, res);
    } else {
        respond(req, res, "Invalid action: " + action);
    }
};
