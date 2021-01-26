var Sequelize = require("sequelize");
var moment = require("moment-timezone");
var validator = require('validator');

var model = require("../model.js");
var p = require("../permissions.js");
var config = require("../config.json");
var options = require("./options.js");
var home = require("./home.js");

exports.get = function(req, res) {
    if (!p.is_logged_in(req)) {
        res.redirect("/login");
        return;
    }
    if (!p.is_ta(req) && !p.is_owner(req)) {
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
            ask_question_guide_link: options.ask_question_guide_link(),
            cooldown_time: options.cooldown_time(),
            notif_time_threshold: options.notif_time_threshold(),
            notif_time_interval: options.notif_time_interval(),
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
            ta.is_self = (req.session.TA && ta.id == req.session.TA.id);
        });
        return res.render("settings", {
            title: config.title,
            session: req.session,
            toast: toast,
            video_chat_url: (req.session.TA ? req.session.TA.video_chat_url : undefined),
            current_semester: current_semester,
            slack_webhook: results.webhook_url,
            ask_question_guide_link: results.ask_question_guide_link,
            cooldown_time: results.cooldown_time,
            notif_time_threshold: results.notif_time_threshold,
            notif_time_interval: results.notif_time_interval,
            topics: results.topics,
            tas: results.tas,
            owner_email: config.owner_email,
            is_admin: p.is_admin(req),
            is_ta: p.is_ta(req)
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
        res.redirect("/settings");
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
    model.Topic.findByPk(id).then(function(instance) {
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
    model.Topic.findByPk(id).then(function(instance) {
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

    var added;
    options.current_semester().then(function(semester) {
        return model.TA.findOrCreate({
            where: {
                email: req.body.email,
                semester: semester,
            },
            defaults: {
                full_name: req.body.name,
                time_helped: 0,
                num_helped: 0,
                time_today: 0,
                num_today: 0,
                admin: req.body.admin == "true" || req.body.email == config.owner_email
            }
        });
    }).then(function(result) {
        var instance = result[0];
        added = result[1];
        if (instance.email == req.session.email && !req.session.TA) {
            return req.session.update({
                ta_id: instance.id
            });
        } else {
            return Promise.resolve(req.session);
        }
    }).then(function() {
        if (added) {
            respond(req, res, "TA added");
        } else {
            respond(req, res, "Error: TA already exists.")
        }
    });
}

function post_delete_ta(req, res) {
    var id = req.body.id;
    if (req.session.TA && id == req.session.TA.id) {
        respond(req, res, "Error: Cannot delete yourself");
        return;
    }
    model.TA.findByPk(id).then(function(instance) {
        if (!instance) {
            throw new Error("There is no topic with that ID");
        }
        if (instance.helping_id) {
            throw new Error("Cannot remove a TA while they are helping a student");
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
    var instance;
    var updated_fields;
    model.TA.findByPk(id).then(function(inst) {
        if (!inst) {
            throw new Error("There is no TA with that ID");
        }
        instance = inst;
        name = req.body.name;
        email = req.body.email;
        admin = req.body.admin == "true";
        if (!name) {
            throw new Error("TA name was missing or invalid.");
        }
        updated_fields = {
            full_name: name,
            admin: admin
        }
        if (req.session.TA && id == req.session.TA.id) {
            if (!admin) {
                throw new Error("You cannot demote yourself to a regular TA.")
            }
        } else {
            if (!email || !validator.isEmail(email)) {
                throw new Error("TA email was missing or invalid.");
            }
            updated_fields['email'] = email;
            updated_fields['admin'] = admin || email == config.owner_email;
        }
        return options.current_semester();
    }).then(function(semester) {
        return model.TA.findOne({
            where: {
                semester: semester,
                email: email
            }
        });
    }).then(function(result) {
        if (result && result.id != instance.id) {
            throw new Error("A TA with that email address already exists.");
        }
        return instance.update(updated_fields);
    }).then(function() {
        respond(req, res, "TA updated");
    }).catch(function(error) {
        respond(req, res, error.toString());
    });
}

function post_update_url(req, res) {
    req.session.TA.update({
        video_chat_url: req.body.video_chat_url
    }).then(function(result) {
        home.clear_entries_cache();
        respond(req, res, "Video Chat URL updated");
    });
}

exports.post = function(req, res) {
    if (!p.is_logged_in(req)) {
        res.redirect("/login");
        return;
    }

    var action = req.body.action;
    var handled = false;
    if (p.is_ta(req)) {
        if (action == "UPDATEURL") {
            post_update_url(req, res);
            handled = true;
        }
    }
    if (p.is_admin(req)) {
        if (action == "ADDTOPIC") {
            post_add_topic(req, res);
            handled = true;
        } else if (action == "DELETETOPIC") {
            post_delete_topic(req, res);
            handled = true;
        } else if (action == "UPDATETOPIC") {
            post_update_topic(req, res);
            handled = true;
        } else if (action == "ADDTA") {
            post_add_ta(req, res);
            handled = true;
        } else if (action == "UPDATETA") {
            post_update_ta(req, res);
            handled = true;
        } else if (action == "DELETETA") {
            post_delete_ta(req, res);
            handled = true;
        }
    }
    if (!handled) {
        res.sendStatus(403);
        return;
    }
};
