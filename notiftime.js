var Sequelize = require('sequelize');

var model = require("./model.js");
var realtime = require("./realtime.js");

const notif_time_interval = 10;
const notif_time_threshold = 0;

exports.init = function() {
    setInterval(() => {
        var now = new Date();
        var active_tas = [];
        return model.TA.findAll({
            where: {"helping_id": {[Sequelize.Op.not]: null}},
            include: [{model: model.Entry, as: "helping_entry"}]
        }).then(function(results) {
            active_tas = results;
            if (active_tas.length == 0) {
                throw new Error();
            }

            // Check each currently helping TA on their help time
            active_tas.forEach(function(ta) {
                var student_help_time = ta.helping_entry.help_time;
                var diff = now - student_help_time;
                var min_elapsed = Math.floor((diff/1000)/60);

                if (min_elapsed > notif_time_threshold && min_elapsed % notif_time_interval == 0) {
                    realtime.notifytime(ta.helping_entry.ta_id, min_elapsed);
                }
            });
        }).catch(function(err) {
            return;
        });
    }, 60 * 1000);
};
