# 15-122 Office Hours Queue

## Gather Necessary Information

In order to install the Queue application, you'll need to create a MySQL database and user, and obtain Google OAuth credentials. After installing MySQL (directions for Ubuntu can be found [here](https://www.digitalocean.com/community/tutorials/how-to-install-mysql-on-ubuntu-16-04). Other platforms: Google it), you can run the following sequence of commands to create a database and a user that has permission to access it:

1. `$ mysql -u root -p` (and enter the MySQL root password which you created during installation)
2. `mysql> CREATE DATABASE queue;`
3. `mysql> CREATE USER 'your_username'@'localhost' IDENTIFIED BY 'your_password';` (make sure to choose a strong password)
4. `mysql> GRANT ALL PRIVILEGES ON queue.* TO 'your_username'@'localhost';`

To get Google OAuth credentials, you can follow the instructions at [https://developers.google.com/adwords/api/docs/guides/authentication#webapp](https://developers.google.com/adwords/api/docs/guides/authentication#webapp). Leave the "Authorized JavaScript origins" field blank, and use `https://<YOUR_DOMAIN>/oauth2/callback` for the Authorized Redirect URI. (if you're not using HTTPS, replace `https` with `http`).

If you have a Slack team set up for your course, you can set up a Slack Incoming Webhook [here](https://my.slack.com/services/new/incoming-webhook/). Otherwise, you may leave the `slack_webhook` field empty in the config file.

## Install

1. Install [Node.js](https://nodejs.org)
2. Clone this repository
3. In the root directory, create the file `config.json` with the following structure:
   ```
   {
       "title": "15-122 Office Hours Queue",
       "protocol": "http",
       "domain": "q.15122.tk",
       "timezone": "America/New_York",
       "server_port": 80,

       "mysql_db": "<Your MySQL database>",
       "mysql_user": "<MySQL user that has access to the database>",
       "mysql_pass": "<Password for the MySQL user>",

       "google_id": "<Google Client ID from https://console.developers.google.com>",
       "google_secret": "<Google Client Secret from https://console.developers.google.com>",

       "owner_email": "<Google/Andrew account email address for this site's Owner (super-user)>"
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

## Add your information

In a web browser, go to the domain you specified in the configuration. If everything was set up correctly, you should see a splash page that says the installation was successful.

Log into the account with the email address you specified as the `owner_email` in the configuration to finish the setup. You'll be taken to the admin page, where you should set the current semester and add admins, TAs and topics. If you're planning to help students, you must add yourself to the list as an admin (being the owner is not enough).
