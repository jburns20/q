var Sequelize = require('sequelize');
var config = require("./config.json");
var sequelize = new Sequelize(
    config.mysql_db, config.mysql_user, config.mysql_pass, {
    dialect: 'mysql',
    logging: false,
    underscored: true,
    timezone: config.timezone
});

exports.sql = sequelize;


// Tables

exports.Session = sequelize.define("session", {
    "name": Sequelize.STRING,
    "email": Sequelize.STRING,
    "user_id": Sequelize.STRING,
    "session_key": {type: Sequelize.STRING, unique: true},
    "authenticated": Sequelize.BOOLEAN,
    "owner": Sequelize.BOOLEAN
}, {
    underscored: true
});

exports.TA = sequelize.define("tas", {
    "email": Sequelize.STRING,
    "full_name": Sequelize.STRING,
    "video_chat_url": Sequelize.STRING,
    "semester": Sequelize.STRING,
    "time_helped": Sequelize.INTEGER,
    "num_helped": Sequelize.INTEGER,
    "time_today": Sequelize.INTEGER,
    "num_today": Sequelize.INTEGER,
    "admin": Sequelize.BOOLEAN
}, {
    tableName: 'tas',
    underscored: true
});

exports.Entry = sequelize.define("entry", {
    "user_id": Sequelize.STRING,
    "name": Sequelize.STRING,
    "semester": Sequelize.STRING,
    "entry_time": Sequelize.DATE,
    "help_time": Sequelize.DATE,
    "exit_time": Sequelize.DATE,
    "wait_estimate": Sequelize.INTEGER,
    "status": Sequelize.INTEGER,  //0: on queue, 1: being helped, 2: helped
    "question": Sequelize.STRING,
    "cooldown_override": Sequelize.BOOLEAN,
    "update_requested": Sequelize.BOOLEAN
}, {
    timestamps: false,
    underscored: true
});

exports.Topic = sequelize.define("topic", {
    "name": Sequelize.STRING,
    "out_date": Sequelize.DATE,
    "due_date": Sequelize.DATE,
    "semester": Sequelize.STRING
}, {
    underscored: true
});

exports.Option = sequelize.define("option", {
    "key": {type: Sequelize.STRING, unique: true},
    "value": Sequelize.STRING
}, {
    underscored: true
});

// Relationships

exports.Entry.belongsTo(exports.Session, {
    foreignKey: "session_id"
});
exports.Entry.belongsTo(exports.Topic, {
    foreignKey: "topic_id"
});
exports.Topic.hasMany(exports.Entry);
exports.Entry.belongsTo(exports.TA, {
    as: "TA",
    foreignKey: "ta_id"
});
exports.Session.belongsTo(exports.TA, {
    as: "TA",
    foreignKey: "ta_id"
});
exports.TA.belongsTo(exports.Entry, {
    as: 'helping_entry',
    foreignKey: 'helping_id',
    constraints: false
});
