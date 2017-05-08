var waittimes = require("../waittimes.js");

exports.get = function(req, res) {
    var times = waittimes.get();
    if (times.length == 0) {
        res.send("");
    } else {
        res.send("" + times[times.length-1]);
    }
}
