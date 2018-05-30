var Sequelize = require('sequelize');
var model = require("../model.js");
var moment = require("moment");
var config = require("../config.json");
var p = require("../permissions.js");
var options = require("./options.js");

function count_where_clause(start, end) {
    if (!start && !end) {
        return "";
    }
    if (start && end) {
        return " AND help_time >= ? && help_time < ?";
    }
    if (start) {
        return " AND help_time >= ?";
    }
    if (end) {
        return " AND help_time < ?";
    }
}

function count_query(period, granularity, semester, start, end) {
    var formatStr = "";
    if (granularity == "week") formatStr += "%X w%V";
    if (granularity == "day" || granularity == "hour") formatStr += "%Y-%m-%d";
    if (period == "weekday") formatStr = "%W";
    if (granularity == "hour") formatStr += " %H:00:00";
    return "SELECT DATE_FORMAT(help_time, \"" + formatStr + "\") as time" +
        ", COUNT(id) as count, SEC_TO_TIME(SUM(" +
        "TIMESTAMPDIFF(SECOND, help_time, exit_time))) as total_time " +
        "FROM `entries` WHERE status=2" + (semester ? " AND semester=?" : "") +
        count_where_clause(start, end) + " GROUP BY time";
}

function summary_query(semester) {
    return "SELECT COUNT(*) as num_students, " +
        "AVG(TIMESTAMPDIFF(SECOND, entry_time, help_time)) as avg_wait_time, " +
        "SUM(TIMESTAMPDIFF(SECOND, help_time, exit_time)) as total_help_duration, " +
        "AVG(TIMESTAMPDIFF(SECOND, help_time, exit_time)) as avg_help_duration " +
        "FROM `entries` WHERE status=2" + (semester ? " AND semester=?" : "");
}

function ta_query() {
    return "SELECT COUNT(*) as num_students, " +
        "SUM(TIMESTAMPDIFF(SECOND, help_time, exit_time)) as total_help_duration, " +
        "AVG(TIMESTAMPDIFF(SECOND, help_time, exit_time)) as avg_help_duration " +
        "FROM `entries` WHERE status=2 AND ta_id=? AND semester=?";
}

function admin_query() {
    return "SELECT tas.full_name, COUNT(*) as num_students, " +
        "SUM(TIMESTAMPDIFF(SECOND, entries.help_time, entries.exit_time)) as total_help_duration, " +
        "AVG(TIMESTAMPDIFF(SECOND, entries.help_time, entries.exit_time)) as avg_help_duration " +
        "FROM `entries`, `tas` WHERE status=2 AND tas.id=entries.ta_id AND entries.semester=? GROUP BY ta_id";
}

function laststudents_query() {
    return "SELECT entries.*, topics.name as topic_name, TIMESTAMPDIFF(SECOND, entries.help_time, entries.exit_time) as help_duration FROM `entries` LEFT JOIN `topics` ON topics.id=entries.topic_id WHERE entries.status=2 AND entries.semester=? AND entries.ta_id=? AND entries.help_time >= ? ORDER BY entries.help_time DESC";
}

function parseDate(string, format) {
    var d = moment(string, format);
    if (d.isValid()) return d.toDate();
    else return null;
}

exports.get = function(req, res) {
    if (!p.is_logged_in(req)) {
        res.redirect("/login");
        return;
    } else if (!p.is_ta(req) && !p.is_admin(req)) {
        res.sendStatus(403);
        return;
    }
    var current_semester = null;
    var summary = null;
    var individual = null;
    var laststudents = null;
    options.current_semester().then(function(sem) {
        current_semester = sem;
        var query = summary_query(current_semester)
        return model.sql.query(query, {
            type: model.sql.QueryTypes.SELECT,
            replacements: [current_semester]
        });
    }).then(function(results) {
        summary = results[0];
        if (p.is_ta(req)) {
            return model.sql.query(ta_query(), {
                type: model.sql.QueryTypes.SELECT,
                replacements: [req.session.TA.id, current_semester]
            });
        }
        return Promise.resolve([null]);
    }).then(function(results) {
        individual = results[0];
        if (p.is_ta(req)) {
            var begintime = new Date();
            begintime.setDate(begintime.getDate()-6);
            return model.sql.query(laststudents_query(), {
                type: model.sql.QueryTypes.SELECT,
                replacements: [current_semester, req.session.TA.id, begintime]
            });
        }
        return Promise.resolve(null);
    }).then(function(results) {
        laststudents = results;
        if (p.is_admin(req)) {
            return model.sql.query(admin_query(), {
                type: model.sql.QueryTypes.SELECT,
                replacements: [current_semester]
            });
        }
        return Promise.resolve(null);
    }).then(function(results) {
        res.render("metrics", {
            title: config.title,
            session: req.session,
            current_semester: current_semester,
            summary: summary,
            individual: individual,
            laststudents: laststudents,
            admin: results
        });
    });
}

exports.get_counts = function(req, res) {
    var p = req.query.period;
    var g = req.query.granularity;
    if (p && p != "weekday"
        || g != "week" && g != "day" && g != "hour") {
        res.send(400);
        return;
    }
    var from = parseDate(req.query.from, "YYYY-MM-DD");
    var to = parseDate(req.query.to, "YYYY-MM-DD");
    options.current_semester().then(function(semester) {
        var query = count_query(req.query.period, req.query.granularity, semester, from, to);
        return model.sql.query(query, {
            type: model.sql.QueryTypes.SELECT,
            replacements: [semester, from, to],
        })
    }).then(function(results) {
        res.send(results);
    });
}
