var Sequelize = require('sequelize');
var config = require("./config.json");
var sequelize = new Sequelize(config.mysql_db, config.mysql_user, config.mysql_pass);
exports.sql = sequelize;

exports.Session = sequelize.define("user", {
    "email": Sequelize.STRING,
    "user_id": Sequelize.STRING,
    "session_key": Sequelize.STRING
});