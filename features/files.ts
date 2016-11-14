/// <reference path="../typings/node.d.ts" />
/// <reference path="../typings/async.d.ts" />
/// <reference path="../typings/es6-shim.d.ts" />

import async = require("async");
import fs = require('fs');
import {Stats} from "fs";
import readline = require('readline');
import zlib = require('zlib');
import moment = require('moment');
import Stream = require('stream');
import * as ssh2 from "ssh2";
import * as ssh from './ssh';

export class FileStat {
    filename: string;
    host: string;
    mtime: Date;
    size: number;
    constructor(filename: string, host: string, mtime: Date, size: number) {
        this.filename = filename;
        this.host = host;
        this.mtime = mtime;
        this.size = size;
    }
    public toString = () : string => {
        return this.filename + ": " + this.mtime;
    }
}

export enum GrepEventType {
    FILE, MATCH
}

var listAndFilterFiles = function(path: string, expression: string, callback: (error: string, files?: FileStat[]) => void) {
    var m:RegExpExecArray = new RegExp("^(..+):(.*)$").exec(path);
    if (m) {
        listAndFilterFilesUnix(m[1], m[2], expression, callback);
    } else {
        listAndFilterFilesWindows(path, expression, callback);
    }
};

var listAndFilterFilesWindows = function(path: string, expression: string, callback: (error: string, files?: FileStat[]) => void) {
    fs.readdir(path, function(error: NodeJS.ErrnoException, files: string[]) {
        if (error) { callback(error.toString()); return; }
        let filteredFiles:FileStat[] = [];
        for (const file of files)
            if (file.match(expression))
                filteredFiles.push(new FileStat(path + '/' + file, null, null, null));
        callback(null, filteredFiles);
    });
};

var listAndFilterFilesUnix = function(host: string, path: string, expression: string, callback: (error: string, files?: FileStat[]) => void) {
    var command:string = "ls --full-time -l " + path + "/* | awk \'{ print $5,$6,$7,$9 }\'";
    ssh.execute(command, host,  function(error: string, data?: string) {
        if (error) { callback(error); return; }
        if (!data)
            return;
        let filteredFiles:FileStat[] = [];
        let regexp:RegExp = new RegExp("^([0-9]+) (.............................) ((.*)[\\\\/](.+?))$");
        let lines:string[] = data.split("\n");
        for (var line of lines) {
            let m = regexp.exec(line);
            if (m && m[5].match(expression)) {
                filteredFiles.push(new FileStat(m[3], host, moment(m[2], "YYYY-MM-DD HH:mm:ss.SSSSSSSSS").toDate(), Number(m[1])));
            }
        }
        callback(null, filteredFiles);
    });
};

var getFilesStats = function(fileStats: FileStat[], callback: (error: string, fileStats?: FileStat[]) => void) {
    async.eachSeries(fileStats, function(fileStat: FileStat, callback: ErrorCallback) {
        if (!fileStat.mtime) {
            fs.stat(fileStat.filename, function (error: NodeJS.ErrnoException, stats: Stats) {
                if (error) { callback(error); return; }
                fileStat.mtime = stats.mtime;
                fileStat.size = stats.size;
                callback();
            });
        } else {
            callback();
        }
    }, function(error?: Error) {
        if (error) { callback(error.toString()); return; }
        fileStats.sort(function(a: FileStat, b: FileStat) {
            return a.mtime > b.mtime ? -1 : a.mtime < b.mtime ? 1 : 0;
        });
        callback(null, fileStats);
    });
};

var splitBasename = function(basename: string) {
    var m:RegExpExecArray = new RegExp("^(.*)[\\\\/](.+?)$").exec(basename);
    if (!m)
        return [ null, null, "Invalid path: " + basename ];
    var path:string = m[1];
    var filename:string = m[2];
    return [ path, filename, null ];
};

export var getFilesStatsByBasename = function(basename: string, callback: (error: string, fileStats?: FileStat[]) => void) {
    var [ path, filename, error ] = splitBasename(basename);
    if (error) {
        callback(error);
        return;
    }
    async.waterfall([
        function(callback) {
            listAndFilterFiles(path, filename + ".*", callback);
        },
        function(files: FileStat[], callback) {
            getFilesStats(files, callback);
        },
    ], function (error?: Error, fileStats?: FileStat[]) {
        callback(error ? error.toString() : null, fileStats);
    });
};

export var getFileContents = function(filename: string, callback: (error: string, readStream?: fs.ReadStream) => void) {
    let m = new RegExp("^(.*?):(/.*)").exec(filename);
    if (m)
        getContentLinux(m[2], m[1], callback);
    else
        getContentWindows(filename, callback);
};

var getContentWindows = function(filename: string, callback: (error?: string, readStream?: NodeJS.ReadableStream) => void) {
    let lines:string[] = [];
    let fileStream:fs.ReadStream = fs.createReadStream(filename);
    let unzipStream:NodeJS.ReadableStream = null;
    if (filename.endsWith(".gz")) {
        unzipStream = fileStream.pipe(zlib.createGunzip());
        callback(null, unzipStream);
    } else {
        callback(null, fileStream);
    }
};

var getContentLinux = function(filename: string, host: string, callback: (error?: string, readStream?: NodeJS.ReadableStream) => void) {
    if (filename.endsWith(".gz"))
        var command = "cat " + filename + " | gunzip";
    else
        var command = "cat " + filename;

    var stream = new Stream.Readable();
    stream._read = function noop() {};

    var errorLines = "";
    var isPiped;
    ssh.execute(command, host,  function(error?: string, data?: string) {
        if (error) {
            errorLines = errorLines ? errorLines + error : error;
        } else if (data) {
            if (!isPiped) {
                callback(null, stream);
                isPiped = true;
            }
            stream.push(data);
        } else {
            stream.push(null);
        }
    });
};
