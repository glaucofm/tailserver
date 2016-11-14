/// <reference path="../typings/node.d.ts" />
/// <reference path="../typings/ssh2.d.ts" />
/// <reference path="../typings/es6-shim.d.ts" />

import * as ssh2 from "ssh2";
import Timer = NodeJS.Timer;
import {Client} from "ssh2";

import fs = require('fs');
var gracefulFs = require('graceful-fs');
gracefulFs.gracefulify(fs);

var Client = require('ssh2').Client;

var authentications:Map<string, Authentication> = null;
var connections:Map<string, Connection> = new Map<string, Connection>();

class Authentication {
    username: string;
    password: string;
    constructor(username: string, password: string) {
        this.username = username;
        this.password = password;
    }
}

class Connection {
    connection: Client;
    status: string;
    lastUse: Date;
}

var initAuth = function() {
    authentications = new Map<string, Authentication>();

    fs.readFile('./user_data/auth.txt', 'utf8', function (err: NodeJS.ErrnoException, data: string) {
        if (err) { console.log(err); return; }
        data.split("\n").forEach(function(line: string) {
            // TODO: obfuscate passwords
            var m:RegExpExecArray = new RegExp("^([^:]+) *: *([^]+) (.*)$").exec(line);
            if (m) {
                authentications.set(m[1], new Authentication(m[2], m[3]));
                console.log("Loaded auth for " + m[1]);
            }
        });
    });

    setInterval(function() {
        connections.forEach(function(connection, host, map) {
            if (!connection.lastUse)
                return;
            var lastUseAgeSecs = (new Date().getTime() - connection.lastUse.getTime()) / 1000;
            if (connection.lastUse && lastUseAgeSecs > 5*60) {
                connection.lastUse = null;
                console.log('closing connection to ' + host);
                connection.connection.end();
                connection.status = "CLOSED";
            }
        });
    }, 60000);
};


var getConnection = function(host:string, callback: (error?: string, connection?: ssh2.Client, connectionInfo?: Connection) => any) {
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
    connections.get(host).connection = new Client();
    connections.get(host).status = "CONNECTING";

    connections.get(host).connection
        .on('ready', function() {
            connections.get(host).status = "READY";
            callback(null, connections.get(host).connection, connections.get(host));
        }).on('error', function(error: Error) {
            connections.delete(host);
            callback(error.toString());
        });

    connections.get(host).connection.connect({
        host: host,
        port: 22,
        username: authentications.get(host).username,
        password: authentications.get(host).password,
        readyTimeout : 30000,
        keepaliveInterval: 30000
    });
};

export var execute = function(command: string, host:string, callback: (error?: string, data?: string, connection?: ssh2.Channel) => any) {
    getConnection(host, function(error?: string, connection?: ssh2.Client, connectionInfo?: Connection) {
        if (error) { callback(error); return; }
        connectionInfo.lastUse = new Date();
        connection.exec(command, function(error?: Error, connection?: ssh2.Channel) {
            if (error) { callback(error.toString()); return; }
            connection.on('data', function(data) {
                callback(null, data.toString(), connection);
            }).on('close', function(data) {
                callback();
            }).stderr.on('data', function(data) {
                callback(data.toString());
            });
        });
    });
};


