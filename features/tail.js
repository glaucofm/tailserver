/// <reference path="../typings/node.d.ts" />
/// <reference path="../typings/ssh2.d.ts" />
/// <reference path="../typings/es6-shim.d.ts" />
"use strict";
var fs = require('fs');
var gracefulFs = require('graceful-fs');
gracefulFs.gracefulify(fs);
var ssh = require('./ssh');
exports.tailFile = function (filename, position, maxLoad, callback) {
    var m = new RegExp("^(.*?):(/.*)").exec(filename);
    if (m)
        tailFileUnix(m[2], m[1], position, maxLoad, callback);
    else
        tailFileWindows(filename, position, maxLoad, callback);
};
var tailFileWindows = function (filename, position, maxLoad, callback) {
    fs.open(filename, 'r', function (error, fd) {
        if (error) {
            callback(error.toString());
            return;
        }
        fs.fstat(fd, function (error, stats) {
            if (error) {
                callback(error.toString());
                return;
            }
            if (position + maxLoad <= stats.size) {
                position = stats.size - maxLoad;
            }
            else {
                maxLoad = stats.size - position;
            }
            if (position >= stats.size) {
                var data = "000000000000".substring(0, "000000000000".length - (stats.size + "").length) + stats.size;
                callback(null, data);
            }
            else {
                var buffer = new Buffer(maxLoad);
                fs.read(fd, buffer, 0, maxLoad, position, function (error, bytesRead, buffer) {
                    if (error) {
                        callback(error.toString());
                        return;
                    }
                    var data = buffer.toString('utf8', 0, bytesRead) + "000000000000".substring(0, "000000000000".length - (stats.size + "").length) + stats.size;
                    callback(null, data);
                });
            }
        });
    });
};
var tailFileUnix = function (filename, host, position, maxLoad, callback) {
    var command = tailCommand
        .replace("_file_", filename)
        .replace("_position_", position + "")
        .replace("_maxload_", maxLoad + "");
    ssh.execute(command, host, callback);
};
var tailCommand = "\
python -c '\
import os, sys\n\
filename = \"_file_\"\n\
position = _position_\n\
maxLoad = _maxload_\n\
try:\n\
    f = open(filename, \"rb\");\n\
    fileContents = \"\"\n\
    statinfo = os.stat(filename)\n\
    if position > statinfo.st_size:\n\
        position = 0\n\
    if position == statinfo.st_size:\n\
        fileContents = \"\"\n\
    elif statinfo.st_size > position:\n\
        if statinfo.st_size - position > maxLoad:\n\
            position = statinfo.st_size - maxLoad\n\
        if position > 0:\n\
            f.seek(position)\n\
        try:\n\
            fileContents = f.read()\n\
        except IOError:\n\
            if str(sys.exc_info()[1]) != \"[Errno 22] Invalid argument\":\n\
                raise\n\
    f.close()\n\
finally:\n\
    f.close()\n\
sys.stdout.write(fileContents + str(statinfo.st_size).rjust(12, \"0\"))\n\
'";
//# sourceMappingURL=tail.js.map