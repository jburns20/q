var crypto = require("crypto");
var model = require("./model.js");

var sio;
var ta_room = crypto.randomBytes(72).toString('base64');
var student_room = crypto.randomBytes(72).toString('base64');

exports.seq = 0;

exports.init = function(app) {
    sio = require("socket.io")(app);

    sio.on("connection", function(socket) {
        socket.join(student_room);

        socket.on("authenticate", function (auth) {
            if (!auth) {
                return;
            }
            model.Session.findOne({
                where: {session_key: String(auth)},
                include: [{model: model.TA, as: "TA"}]
            }).then(function(user) {
                if (user) {
                    socket.session = user;
                    if (user.TA || user.owner) {
                        socket.leave(student_room);
                        socket.join(ta_room);
                    }
                }
            });
        });
    });
};

exports.add = function(entry) {
    exports.seq = exports.seq + 1;
    if (!sio) {
        console.log("ERROR: Socket.io is not initialized yet");
        return;
    }
    sio.to(student_room).emit("add", {
        seq: exports.seq,
        id: entry.id,
        status: entry.status,
        ta_full_name: entry.TA ? entry.TA.full_name : null
    });
    sio.to(ta_room).emit("add", {
        seq: exports.seq,
        id: entry.id,
        data: {
            id: entry.id,
            status: entry.status,
            name: entry.name,
            user_id: entry.user_id,
            ta_id: entry.TA ? entry.TA.id : null,
            topic_name: entry.topic ? entry.topic.name : "other",
            ta_full_name: entry.TA ? entry.TA.full_name : null,
            question: entry.question,
            cooldown_override:entry.cooldown_override,
        }
    });
};

exports.remove = function(entry_id) {
    exports.seq = exports.seq + 1;
    if (!sio) {
        console.log("ERROR: Socket.io is not initialized yet");
        return;
    }
    sio.emit("remove", {
        seq: exports.seq,
        id: entry_id
    });
};

exports.help = function(entry_id, ta) {
    exports.seq = exports.seq + 1;
    if (!sio) {
        console.log("ERROR: Socket.io is not initialized yet");
        return;
    }
    sio.emit("help", {
        seq: exports.seq,
        id: entry_id,
        data: {
            ta_id: ta.id,
            ta_full_name: ta.full_name,
            ta_video_chat_url: ta.video_chat_url
        }
    });
};

exports.request_update = function(entry_id) {
    exports.seq = exports.seq + 1;
    if(!sio) {
        console.log("ERROR: Socket.io is not initialized yet");
        return;
    }
    sio.emit("request-update", {
        seq: exports.seq,
        id: entry_id
    });
};

exports.update = function(entry_id, updated_question) {
    exports.seq = exports.seq + 1;
    if(!sio) {
        console.log("ERROR: Socket.io is not initialized yet");
        return;
    }
    
    // Students: only need to update seq
    sio.to(student_room).emit("update-question", {
        seq: exports.seq
    });

    // TAs: need to pass the updated question
    sio.to(ta_room).emit("update-question", {
        seq: exports.seq,
        id: entry_id,
        updated_question: updated_question
    });
};

exports.cancel = function(entry_id, ta_id) {
    exports.seq = exports.seq + 1;
    if (!sio) {
        console.log("ERROR: Socket.io is not initialized yet");
        return;
    }
    sio.emit("cancel", {
        seq: exports.seq,
        id: entry_id,
        data: {
            ta_id: ta_id
        }
    });
};

exports.done = function(entry_id, ta_id) {
    exports.seq = exports.seq + 1;
    if (!sio) {
        console.log("ERROR: Socket.io is not initialized yet");
        return;
    }
    sio.emit("done", {
        seq: exports.seq,
        id: entry_id,
        data: {
            ta_id: ta_id
        }
    });
};

exports.option = function(key, value) {
    exports.seq = exports.seq + 1;
    if (!sio) {
        console.log("ERROR: Socket.io is not initialized yet");
        return;
    }
    sio.emit("option", {
        seq: exports.seq,
        key: key,
        value: value
    });
}

exports.waittimes = function(times) {
    exports.seq = exports.seq + 1;
    if (!sio) {
        console.log("ERROR: Socket.io is not initialized yet");
        return;
    }
    sio.emit("waittimes", {
        seq: exports.seq,
        times: times
    });
}

// Takes in a list of tas to notify about their help time
exports.notifytime = function(notif_tas) {
    if (!sio) {
        console.log("ERROR: Socket.io is not initialized yet");
        return;
    }
    sio.to(ta_room).emit("notifytime", {
        notif_tas: notif_tas
    });
}
