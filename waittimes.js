var SlackWebhook = require("slack-webhook");
var Sequelize = require('sequelize');

var config = require("./config.json");
var model = require("./model.js");
var realtime = require("./realtime.js");
var options = require("./routes/options.js");

var last_updated = new Date(0);
var wait_times_cache = [];

const extra_time = 1; //minutes (time TAs spend between helping students)
const wait_threshold = 30; //minutes (wait time that's considered "too long")
const time_threshold = 15; //minutes (how long the wait time must be that high to notify)
var earliest_exceeded = null;
var slack = null;

exports.init = function() {
    exports.update_slack().then(exports.update()).then(function(result) {
        setInterval(function() {
            var thirtysecsago = new Date();
            thirtysecsago.setSeconds(thirtysecsago.getSeconds()-30);
            if (last_updated < thirtysecsago) {
                exports.update();
            }
        }, 30*1000);
    });
};

exports.update = function() {
    var now = new Date();
    var limit = new Date();
    limit.setMinutes(limit.getMinutes()-2);
    var active_tas = [];
    var entries = [];
    return model.TA.findAll({
        where: {
            [Sequelize.Op.or]: [
                {"helping_id": {[Sequelize.Op.not]: null}},
                {"updated_at": {[Sequelize.Op.gt]: limit}}
            ]
        },
        include: [{model: model.Entry, as: "helping_entry"}]
    }).then(function(results) {
        active_tas = results;
        if (active_tas.length == 0) {
            wait_times_cache = [];
            last_updated = now;
            realtime.waittimes(wait_times_cache);
            throw new Error();
        }
        return model.Entry.findAll({
            where: {status: {[Sequelize.Op.lt]: 2}},
            order: [['entry_time', 'ASC']]
        });
    }).then(function(results) {
        entries = results;
        //compute TA times of next availability and average help times
        var ta_times = {};
        var ta_averages = {};
        active_tas.forEach(function(ta) {
            if (ta.num_helped > 0 && ta.num_today > 0) {
                var alltime = ta.time_helped / ta.num_helped;
                var today = ta.time_today / ta.num_today;
                ta_averages[ta.id] = (alltime + today) / 2;
            } else if (ta.num_helped > 0) {
                ta_averages[ta.id] = ta.time_helped / ta.num_helped;
            } else {
                ta_averages[ta.id] = 10*60; // default help time is 10 minutes
            }
            if (ta.helping_entry) {
                ta_times[ta.id] = ta.helping_entry.help_time;
                var seconds = ta_times[ta.id].getSeconds() + ta_averages[ta.id] + extra_time * 60;
                ta_times[ta.id].setSeconds(seconds);
                if (ta_times[ta.id] < now) {
                    ta_times[ta.id] = new Date(now.getTime());
                }
            } else {
                ta_times[ta.id] = new Date(now.getTime());
            }
        });

        //calculate wait times for entries on the queue
        var wait_times = [];
        entries.forEach(function(entry) {
            if (entry.ta_id) {
                wait_times.push(0);
            } else {
                var min_time = new Date(now.getTime() + 10000000000);
                var min_id = 0;
                for (var id in ta_times) {
                    if (ta_times[id] < min_time) {
                        min_time = ta_times[id];
                        min_id = id;
                    }
                }
                wait_times.push((min_time - now) / 1000);
                var seconds = ta_times[min_id].getSeconds() + ta_averages[min_id] + extra_time * 60;
                ta_times[min_id].setSeconds(seconds);
            }
        });

        //calculate wait time for another hypothetical entry
        var min_time = new Date(now.getTime() + 10000000000);
        var min_id = 0;
        for (var id in ta_times) {
            if (ta_times[id] < min_time) {
                min_time = ta_times[id];
                min_id = id;
            }
        }
        var last_wait = (min_time - now) / 1000;
        wait_times.push(last_wait);
        if (last_wait >= wait_threshold * 60 && earliest_exceeded == null) {
            earliest_exceeded = now;
        } else if (last_wait < wait_threshold * 60) {
            earliest_exceeded = null;
        }
        if (earliest_exceeded && now - earliest_exceeded >= time_threshold * 60 * 1000) {
            if (slack) {
                slack.send("<!channel> The wait time is *" + Math.ceil(last_wait / 60) + " minutes* right now. More TAs might be needed. (<" + config.protocol + "://" + config.domain + "/|view»>)");
            }
            earliest_exceeded = null;
        }

        wait_times_cache = wait_times;
        last_updated = now;
        realtime.waittimes(wait_times);
        return Promise.resolve(wait_times);
    }).catch(function(err) {
        return Promise.resolve([]);
    });
};

exports.update_slack = function() {
    return options.slack_webhook().then(function(webhook_url) {
        if (webhook_url && webhook_url != "") {
            slack = new SlackWebhook(webhook_url, {
                defaults: {
                    "username": "QueueBot",
                    "icon_url": config.protocol + "://" + config.domain + "/img/cmuq_small.png"
                }
            });
        } else {
            slack = null;
        }
    });
};

exports.get = function() {
    return wait_times_cache;
};
