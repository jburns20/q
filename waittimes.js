var model = require("./model.js");
var realtime = require("./realtime.js");

var last_updated = new Date(0);
var wait_times_cache = [];

exports.init = function() {
    exports.update().then(function(result) {
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
            $or: [
                {"helping_id": {not: null}},
                {"updated_at": {gt: limit}}
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
            where: {status: {lt: 2}},
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
                var seconds = ta_times[ta.id].getSeconds() + ta_averages[ta.id];
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
                var seconds = ta_times[min_id].getSeconds() + ta_averages[min_id];
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
        wait_times.push((min_time - now) / 1000);
        
        wait_times_cache = wait_times;
        last_updated = now;
        realtime.waittimes(wait_times);
        return Promise.resolve(wait_times);
    }).catch(function(err) {
        return Promise.resolve([]);
    });
};

exports.get = function() {
    return wait_times_cache;
};