# 15-122 Office Hours Queue

## Install

1. Install [Node.js](https://nodejs.org)
2. Clone this repository
3. In the root directory, create the file `config.json` with the following structure:
   ```
   {
       "title": "15-122 Office Hours Queue",
       "timezone": "America/New_York",
       "server_port": 80,
   
       "mysql_db": "<Your MySQL database>",
       "mysql_user": "<MySQL user that has access to the database>",
       "mysql_pass": "<Password for the MySQL user>",
   
       "google_id": "<Google Client ID from https://console.developers.google.com>",
       "google_secret": "<Google Client Secret from https://console.developers.google.com>",
       
       "slack_webhook": "<URL of the Slack Incoming Webhook to send notifications>"
   }
   ```
4. Run this command in your terminal:

   ```
   npm install
   ```

## Set up and run

This part is up to you. If port 80 is already being used (for another web server, for example), you can [set up Nginx as a reverse proxy](https://www.nginx.com/resources/admin-guide/reverse-proxy/) and use a different port in `config.json`. Once you have properly configured your environment, use the following command to run the server:
```
node index.js
```
You can also use [pm2](http://pm2.keymetrics.io/) to manage the server process to ensure that it's always running.
