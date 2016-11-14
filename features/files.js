/// <reference path="../typings/node.d.ts" />
/// <reference path="../typings/async.d.ts" />
/// <reference path="../typings/es6-shim.d.ts" />
"use strict";
var async = require("async");
var fs = require('fs');
var zlib = require('zlib');
var moment = require('moment');
var Stream = require('stream');
var ssh = require('./ssh');
var FileStat = (function () {
    function FileStat(filename, host, mtime, size) {
        var _this = this;
        this.toString = function () {
            return _this.filename + ": " + _this.mtime;
        };
        this.filename = filename;
        this.host = host;
        this.mtime = mtime;
        this.size = size;
    }
    return FileStat;
}());
exports.FileStat = FileStat;
(function (GrepEventType) {
    GrepEventType[GrepEventType["FILE"] = 0] = "FILE";
    GrepEventType[GrepEventType["MATCH"] = 1] = "MATCH";
})(exports.GrepEventType || (exports.GrepEventType = {}));
var GrepEventType = exports.GrepEventType;
var listAndFilterFiles = function (path, expression, callback) {
    var m = new RegExp("^(..+):(.*)$").exec(path);
    if (m) {
        listAndFilterFilesUnix(m[1], m[2], expression, callback);
    }
    else {
        listAndFilterFilesWindows(path, expression, callback);
    }
};
var listAndFilterFilesWindows = function (path, expression, callback) {
    fs.readdir(path, function (error, files) {
        if (error) {
            callback(error.toString());
            return;
        }
        var filteredFiles = [];
        for (var _i = 0, files_1 = files; _i < files_1.length; _i++) {
            var file = files_1[_i];
            if (file.match(expression))
                filteredFiles.push(new FileStat(path + '/' + file, null, null, null));
        }
        callback(null, filteredFiles);
    });
};
var listAndFilterFilesUnix = function (host, path, expression, callback) {
    var command = "ls --full-time -l " + path + "/* | awk \'{ print $5,$6,$7,$9 }\'";
    ssh.execute(command, host, function (error, data) {
        if (error) {
            callback(error);
            return;
        }
        if (!data)
            return;
        var filteredFiles = [];
        var regexp = new RegExp("^([0-9]+) (.............................) ((.*)[\\\\/](.+?))$");
        var lines = data.split("\n");
        for (var _i = 0, lines_1 = lines; _i < lines_1.length; _i++) {
            var line = lines_1[_i];
            var m = regexp.exec(line);
            if (m && m[5].match(expression)) {
                filteredFiles.push(new FileStat(m[3], host, moment(m[2], "YYYY-MM-DD HH:mm:ss.SSSSSSSSS").toDate(), Number(m[1])));
            }
        }
        callback(null, filteredFiles);
    });
};
var getFilesStats = function (fileStats, callback) {
    async.eachSeries(fileStats, function (fileStat, callback) {
        if (!fileStat.mtime) {
            fs.stat(fileStat.filename, function (error, stats) {
                if (error) {
                    callback(error);
                    return;
                }
                fileStat.mtime = stats.mtime;
                fileStat.size = stats.size;
                callback();
            });
        }
        else {
            callback();
        }
    }, function (error) {
        if (error) {
            callback(error.toString());
            return;
        }
        fileStats.sort(function (a, b) {
            return a.mtime > b.mtime ? -1 : a.mtime < b.mtime ? 1 : 0;
        });
        callback(null, fileStats);
    });
};
var splitBasename = function (basename) {
    var m = new RegExp("^(.*)[\\\\/](.+?)$").exec(basename);
    if (!m)
        return [null, null, "Invalid path: " + basename];
    var path = m[1];
    var filename = m[2];
    return [path, filename, null];
};
exports.getFilesStatsByBasename = function (basename, callback) {
    var _a = splitBasename(basename), path = _a[0], filename = _a[1], error = _a[2];
    if (error) {
        callback(error);
        return;
    }
    async.waterfall([
        function (callback) {
            listAndFilterFiles(path, filename + ".*", callback);
        },
        function (files, callback) {
            getFilesStats(files, callback);
        },
    ], function (error, fileStats) {
        callback(error ? error.toString() : null, fileStats);
    });
};
exports.getFileContents = function (filename, callback) {
    var m = new RegExp("^(.*?):(/.*)").exec(filename);
    if (m)
        getContentLinux(m[2], m[1], callback);
    else
        getContentWindows(filename, callback);
};
var getContentWindows = function (filename, callback) {
    var lines = [];
    var fileStream = fs.createReadStream(filename);
    var unzipStream = null;
    if (filename.endsWith(".gz")) {
        unzipStream = fileStream.pipe(zlib.createGunzip());
        callback(null, unzipStream);
    }
    else {
        callback(null, fileStream);
    }
};
var getContentLinux = function (filename, host, callback) {
    if (filename.endsWith(".gz"))
        var command = "cat " + filename + " | gunzip";
    else
        var command = "cat " + filename;
    var stream = new Stream.Readable();
    stream._read = function noop() { };
    var errorLines = "";
    var isPiped;
    ssh.execute(command, host, function (error, data) {
        if (error) {
            errorLines = errorLines ? errorLines + error : error;
        }
        else if (data) {
            if (!isPiped) {
                callback(null, stream);
                isPiped = true;
            }
            stream.push(data);
        }
        else {
            stream.push(null);
        }
    });
};
//# sourceMappingURL=files.js.map