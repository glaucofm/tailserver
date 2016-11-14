/// <reference path="../typings/node.d.ts" />
/// <reference path="../typings/ssh2.d.ts" />
/// <reference path="../typings/es6-shim.d.ts" />
"use strict";
var ssh2_1 = require("ssh2");
var fs = require('fs');
var gracefulFs = require('graceful-fs');
gracefulFs.gracefulify(fs);
var Client = require('ssh2').Client;
var authentications = null;
var connections = new Map();
var Authentication = (function () {
    function Authentication(username, password) {
        this.username = username;
        this.password = password;
    }
    return Authentication;
}());
var Connection = (function () {
    function Connection() {
    }
    return Connection;
}());
var initAuth = function () {
    authentications = new Map();
    fs.readFile('./user_data/auth.txt', 'utf8', function (err, data) {
        if (err) {
            console.log(err);
            return;
        }
        data.split("\n").forEach(function (line) {
            // TODO: obfuscate passwords
            var m = new RegExp("^([^:]+) *: *([^]+) (.*)$").exec(line);
            if (m) {
                authentications.set(m[1], new Authentication(m[2], m[3]));
                console.log("Loaded auth for " + m[1]);
            }
        });
    });
    setInterval(function () {
        connections.forEach(function (connection, host, map) {
            if (!connection.lastUse)
                return;
            var lastUseAgeSecs = (new Date().getTime() - connection.lastUse.getTime()) / 1000;
            if (connection.lastUse && lastUseAgeSecs > 5 * 60) {
                connection.lastUse = null;
                console.log('closing connection to ' + host);
                connection.connection.end();
                connection.status = "CLOSED";
            }
        });
    }, 60000);
};
var getConnection = function (host, callback) {
    if (!authentications)
        initAuth();
    if (!authentications.has(host)) {
        callback("Missing username and password for host " + host);
        return;
    }
    if (connections.has(host) && connections.get(host).status == "READY") {
        callback(null, connections.get(host).connection, connections.get(host));
        return;
    }
    connections.set(host, new Connection());
    connections.get(host).connection = new ssh2_1.Client();
    connections.get(host).status = "CONNECTING";
    connections.get(host).connection
        .on('ready', function () {
        connections.get(host).status = "READY";
        callback(null, connections.get(host).connection, connections.get(host));
    }).on('error', function (error) {
        connections.delete(host);
        callback(error.toString());
    });
    connections.get(host).connection.connect({
        host: host,
        port: 22,
        username: authentications.get(host).username,
        password: authentications.get(host).password,
        readyTimeout: 30000,
        keepaliveInterval: 30000
    });
};
exports.execute = function (command, host, callback) {
    getConnection(host, function (error, connection, connectionInfo) {
        if (error) {
            callback(error);
            return;
        }
        connectionInfo.lastUse = new Date();
        connection.exec(command, function (error, connection) {
            if (error) {
                callback(error.toString());
                return;
            }
            connection.on('data', function (data) {
                callback(null, data.toString(), connection);
            }).on('close', function (data) {
                callback();
            }).stderr.on('data', function (data) {
                callback(data.toString());
            });
        });
    });
};
//# sourceMappingURL=ssh.js.map