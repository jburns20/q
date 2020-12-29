/**
 * This class manages notifications to TAs after they have helped a student
 * for a given amount of time. This is to help with remote OH to ping TAs who
 * have stayed with students for long periods of time.
 * 
 * Active TAs are checked each minute after init() has been called to check 
 * whether they should receive a notification. Because of this, notifications
 * may be off by up to 1 minute (although, this should make little difference
 * from the perspective of the TA).
 * 
 * The proposed alternative was having a timer running for each TA once they
 * start helping, but that appeared to be more inefficient
 * 
 * TODO: enable/disable and modify constants through admin settings, cache 
 * active TAs so query doesn't need to be run every time
 */

var Sequelize = require('sequelize');

var model = require("./model.js");
var realtime = require("./realtime.js");

/** Setting notification times */
/** 
 * FIXME: Remove this comment upon completion
 * To test, change these values to smaller ones (i.e. 1 and 2) 
 */
const notif_time_threshold = 15; // Initial x minutes to pass before first notif
const notif_time_interval = 5; // Interval y minutes b/t future consecutive notifs

/** Number of milliseconds in a minute */
const one_min_ms = 60 * 1000;

exports.init = function() {
    // Set an interval to run every minute from the call to init()
    setInterval(() => {
        var now = new Date();
        var active_tas = [];

        // Find all actively helping TAs
        return model.TA.findAll({
            where: {"helping_id": {[Sequelize.Op.not]: null}},
            include: [{model: model.Entry, as: "helping_entry"}]
        }).then(function(results) {
            active_tas = results;
            if (active_tas.length == 0) throw new Error();

            // Check each currently helping TA on their help time
            active_tas.forEach(function(ta) {
                var student_help_time = ta.helping_entry.help_time;
                var diff = now - student_help_time;
                var min_elapsed = Math.floor((diff/1000)/60);
                var min_past_threshold = min_elapsed - notif_time_threshold;

                if (min_past_threshold >= 0 && min_past_threshold % notif_time_interval == 0) {
                    realtime.notifytime(ta.helping_entry.ta_id, min_elapsed); //TODO: pass a list instead? single call to realtime rather than many
                }
            });
        }).catch(function(err) {
            // Do nothing on errors
            return;
        });
    }, one_min_ms);
};
