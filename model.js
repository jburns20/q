var Sequelize = require('sequelize');
var config = require("./config.json");
var sequelize = new Sequelize(
    config.mysql_db, config.mysql_user, config.mysql_pass, {
    logging: false,
    underscored: true
});

exports.sql = sequelize;

exports.Session = sequelize.define("session", {
    "email": Sequelize.STRING,
    "user_id": Sequelize.STRING,
    "session_key": Sequelize.STRING,
    "authenticated": Sequelize.BOOLEAN
}, {
    underscored: true
});

exports.TA = sequelize.define("tas", {
    "email": Sequelize.STRING,
    "first_name": Sequelize.STRING,
    "full_name": Sequelize.STRING,
    "time_helped": Sequelize.INTEGER,
    "num_helped": Sequelize.INTEGER,
    "time_today": Sequelize.INTEGER,
    "num_today": Sequelize.INTEGER
}, {
    tableName: 'tas',
    underscored: true
});

exports.Entry = sequelize.define("entry", {
    "user_id": Sequelize.STRING,
    "name": Sequelize.STRING,
    "entry_time": Sequelize.DATE,
    "help_time": Sequelize.DATE,
    "exit_time": Sequelize.DATE,
    "status": Sequelize.INTEGER  //0: on queue, 1: being helped, 2: helped
}, {
    timestamps: false,
    underscored: true
});

exports.Topic = sequelize.define("topic", {
    "name": Sequelize.STRING,
    "out_date": Sequelize.DATE,
    "due_date": Sequelize.DATE
}, {
    underscored: true
});

exports.Session.hasMany(exports.Entry);
exports.Topic.hasMany(exports.Entry);
exports.TA.hasMany(exports.Entry);
exports.TA.hasMany(exports.Session);
