var Sequelize = require('sequelize');
var model = require("../model.js");
var moment = require("moment");
var config = require("../config.json");

function count_where_clause(start, end) {
    if (!start && !end) {
        return "WHERE status = 2";
    }
    if (start && end) {
        return "WHERE status = 2 AND help_time >= ? && help_time < ?";
    }
    if (start) {
        return "WHERE status = 2 AND help_time >= ?";
    }
    if (end) {
        return "WHERE status = 2 AND help_time < ?";
    }
}

function count_query(period, granularity, start, end) {
    var formatStr = "";
    if (granularity == "week") formatStr += "%X w%V";
    if (granularity == "day" || granularity == "hour") formatStr += "%Y-%m-%d";
    if (period == "weekday") formatStr = "%W";
    if (granularity == "hour") formatStr += " %H:00:00";
    return "SELECT DATE_FORMAT(help_time, \"" + formatStr + "\") as time" +
        ", COUNT(id) as count, SEC_TO_TIME(SUM(" +
        "TIMESTAMPDIFF(SECOND, help_time, exit_time))) as total_time " +
        "FROM `entries` " + count_where_clause(start, end) + " GROUP BY time";
}

function parseDate(string, format) {
    var d = moment(string, format);
    if (d.isValid()) return d.toDate();
    else return null;
}

exports.get = function(req, res) {
    res.render("metrics", {
        title: config.title,
        session: req.session,
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
    var query = count_query(req.query.period, req.query.granularity, from, to);
    model.sql.query(query, {
        type: model.sql.QueryTypes.SELECT,
        replacements: [from, to],
    }).then(function(results) {
        res.send(results);
    });
}
