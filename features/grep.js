/// <reference path="../typings/node.d.ts" />
/// <reference path="../typings/async.d.ts" />
/// <reference path="../typings/es6-shim.d.ts" />
"use strict";
exports.__esModule = true;
var async = require("async");
var fs = require("fs");
var readline = require("readline");
var zlib = require("zlib");
var Stream = require("stream");
var ssh = require("./ssh");
var files = require("./files");
var stopIds = new Set();
var GrepEventType;
(function (GrepEventType) {
    GrepEventType[GrepEventType["FILE"] = 0] = "FILE";
    GrepEventType[GrepEventType["MATCH"] = 1] = "MATCH";
})(GrepEventType = exports.GrepEventType || (exports.GrepEventType = {}));
var GrepEvent = (function () {
    function GrepEvent(fileStat, lineIndex, line) {
        var _this = this;
        this.toString = function () {
            return _this.type + ", " + _this.fileStat + ", " + _this.lineIndex + ", " + _this.line;
        };
        if (fileStat)
            this.type = GrepEventType.FILE;
        else
            this.type = GrepEventType.MATCH;
        this.fileStat = fileStat;
        this.lineIndex = lineIndex;
        this.line = line;
    }
    return GrepEvent;
}());
exports.GrepEvent = GrepEvent;
var splitBasename = function (basename) {
    var m = new RegExp("^(.*)[\\\\/](.+?)$").exec(basename);
    if (!m)
        return [null, null, "Invalid path: " + basename];
    var path = m[1];
    var filename = m[2];
    return [path, filename, null];
};
var searchFile = function (fileStat, expression, id, callbackEvent, callback) {
    console.log('Searching ' + fileStat.filename + '...');
    callbackEvent(new GrepEvent(fileStat));
    var pattern = new RegExp(expression);
    var grepFileStream = getFileStream(fileStat);
    var readLine = readline.createInterface({ input: grepFileStream.outputStream });
    if (fileStat.host)
        initSSHStream(fileStat, expression, grepFileStream, callback);
    var lineIdx = 0;
    readLine.on('line', function (line) {
        lineIdx++;
        if (fileStat.host) {
            var m = new RegExp("^([0-9]+):(.+?)$").exec(line);
            if (m)
                callbackEvent(new GrepEvent(null, Number(m[1]), m[2]));
        }
        else if (pattern.exec(line)) {
            callbackEvent(new GrepEvent(null, lineIdx, line));
        }
        if (stopIds.has(id)) {
            grepFileStream.destroy();
            callback(new Error("cancelled"));
        }
    }).on('close', function () {
        // console.log('Ended ' + fileStat.filename + '...');
        callback();
    });
};
var initSSHStream = function (fileStat, expression, grepFileStream, callback) {
    if (fileStat.filename.endsWith(".gz"))
        var command = "cat " + fileStat.filename + " | gunzip | grep -n '" + expression + "'";
    else
        var command = "cat " + fileStat.filename + " | grep -n '" + expression + "'";
    ssh.execute(command, fileStat.host, function (error, data, channel) {
        if (error) {
            callback(new Error(error));
            return;
        }
        if (data) {
            grepFileStream.passthroughStream.write(data);
        }
        else {
            grepFileStream.passthroughStream.end();
        }
        if (channel && !grepFileStream.destroy) {
            grepFileStream.destroy = function () {
                channel.destroy();
            };
        }
    });
};
var getFileStream = function (fileStat) {
    var grepFileStream = new GrepFileStream();
    if (!fileStat.host) {
        var fileStream = fs.createReadStream(fileStat.filename);
        if (fileStat.filename.endsWith(".gz"))
            grepFileStream.outputStream = fileStream.pipe(zlib.createGunzip());
        else
            grepFileStream.outputStream = fileStream;
        grepFileStream.destroy = function () {
            fileStream.destroy();
        };
    }
    else {
        grepFileStream.passthroughStream = new Stream.PassThrough();
        grepFileStream.outputStream = grepFileStream.passthroughStream;
    }
    return grepFileStream;
};
var GrepFileStream = (function () {
    function GrepFileStream() {
    }
    return GrepFileStream;
}());
exports.searchFiles = function (basename, expression, id, callbackEvent, callbackControl) {
    var _a = splitBasename(basename), path = _a[0], filename = _a[1], error = _a[2];
    if (error) {
        callbackControl(error);
        return;
    }
    async.waterfall([
        function (callback) {
            files.getFilesStatsByBasename(basename, callback);
        },
        function (fileStats, callback) {
            async.whilst(function () {
                return fileStats.length > 0 && !stopIds.has(id);
            }, function (callback) {
                searchFile(fileStats.splice(0, 1)[0], expression, id, callbackEvent, callback);
            }, callback);
        },
    ], function (error) {
        if (error && error.message == "cancelled") {
            callbackControl(error ? error.toString() : null, "Cancelled");
        }
        else {
            callbackControl(error ? error.toString() : null, "Done");
        }
    });
};
exports.stop = function (id) {
    stopIds.add(id);
};
exports.getLines = function (filename, lineStart, lineEnd, callback) {
    var m = new RegExp("^(.*?):(/.*)").exec(filename);
    if (m)
        exports.getLinesLinux(m[2], m[1], lineStart, lineEnd, callback);
    else
        exports.getLinesWindows(filename, lineStart, lineEnd, callback);
};
exports.getLinesLinux = function (filename, host, lineStart, lineEnd, callback) {
    var command = getFileLinesCommand
        .replace("_file_", filename)
        .replace("_linestart_", lineStart + "")
        .replace("_lineend_", lineEnd + "");
    var lines = "";
    var errorLines = null;
    ssh.execute(command, host, function (error, data) {
        if (error)
            errorLines = errorLines ? errorLines + error : error;
        else if (data)
            lines += data;
        else
            callback(errorLines, lines);
    });
};
exports.getLinesWindows = function (filename, lineStart, lineEnd, callback) {
    var lines = [];
    var fileStream = fs.createReadStream(filename);
    var unzipStream = null;
    if (filename.endsWith(".gz"))
        unzipStream = fileStream.pipe(zlib.createGunzip());
    var rl = readline.createInterface({ input: filename.endsWith(".gz") ? unzipStream : fileStream });
    var lineIdx = 0;
    rl.on('line', function (line) {
        lineIdx++;
        if (lineIdx >= lineStart && lineIdx <= lineEnd)
            lines.push("       ".substring(0, 7 - (lineIdx + "").length) + lineIdx + "\t" + line);
        if (lineIdx > lineEnd)
            rl.close();
    }).on('close', function () {
        callback(null, lines.join("\n"));
    });
};
var getFileLinesCommand = "\
python -c '\
import os, sys, gzip\n\
filename = \"_file_\"\n\
linestart = _linestart_\n\
lineend = _lineend_\n\
if filename.endswith(\"gz\"):\n\
    filezip = None\n\
    try:\n\
        filezip = gzip.open(filename, \"r\")\n\
        lines = filezip.readlines()\n\
    finally:\n\
        if filezip:\n\
            filezip.close()\n\
else:\n\
    f = None\n\
    try:\n\
        f = open(filename, \"r\")\n\
        lines = f.readlines()\n\
    finally:\n\
        if f:\n\
            f.close()\n\
lineidx = 1;\n\
for line in lines:\n\
    if lineidx > lineend:\n\
        break\n\
    if lineidx >= linestart:\n\
        sys.stdout.write(str(lineidx).rjust(7) + \"\t\" + line)\n\
    lineidx += 1\n\
'";
//# sourceMappingURL=grep.js.map