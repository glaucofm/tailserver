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
import * as files from './files';

var stopIds:Set<string> = new Set<string>();

export enum GrepEventType {
    FILE, MATCH
}

export class GrepEvent {
    type: GrepEventType;
    fileStat: files.FileStat;
    lineIndex: number;
    line: string;
    constructor(fileStat?: files.FileStat, lineIndex?: number, line?: string) {
        if (fileStat)
            this.type = GrepEventType.FILE;
        else
            this.type = GrepEventType.MATCH;
        this.fileStat = fileStat;
        this.lineIndex = lineIndex;
        this.line = line;
    }
    public toString = () : string => {
        return this.type + ", " + this.fileStat + ", " + this.lineIndex + ", " + this.line;
    }
}

var splitBasename = function(basename: string) {
    var m:RegExpExecArray = new RegExp("^(.*)[\\\\/](.+?)$").exec(basename);
    if (!m)
        return [ null, null, "Invalid path: " + basename ];
    var path:string = m[1];
    var filename:string = m[2];
    return [ path, filename, null ];
};

var searchFile = function(fileStat: files.FileStat, expression:string, id:string, callbackEvent: (event: GrepEvent) => void, callback: ErrorCallback) {
    console.log('Searching ' + fileStat.filename + '...');
    callbackEvent(new GrepEvent(fileStat));
    let pattern:RegExp = new RegExp(expression);

    var grepFileStream:GrepFileStream = getFileStream(fileStat);

    const readLine = readline.createInterface({ input: grepFileStream.outputStream });

    if (fileStat.host)
        initSSHStream(fileStat, expression, grepFileStream, callback);

    var lineIdx = 0;

    readLine.on('line', (line) => {
        lineIdx++;
        if (fileStat.host) {
            var m:RegExpExecArray = new RegExp("^([0-9]+):(.+?)$").exec(line);
            if (m)
                callbackEvent(new GrepEvent(null, Number(m[1]), m[2]));
        } else if (pattern.exec(line)) {
            callbackEvent(new GrepEvent(null, lineIdx, line));
        }
        if (stopIds.has(id)) {
            grepFileStream.destroy();
            callback(new Error("cancelled"));
        }
    }).on('close', () => {
        // console.log('Ended ' + fileStat.filename + '...');
        callback();
    });
};

var initSSHStream = function(fileStat: files.FileStat, expression:string, grepFileStream: GrepFileStream, callback: ErrorCallback) {
    if (fileStat.filename.endsWith(".gz"))
        var command = "cat " + fileStat.filename + " | gunzip | grep -n '" + expression + "'";
    else
        var command = "cat " + fileStat.filename + " | grep -n '" + expression + "'";

    ssh.execute(command, fileStat.host, function (error: string, data?: string, channel?: ssh2.Channel) {
        if (error) {
            callback(new Error(error));
            return;
        }
        if (data) {
            grepFileStream.passthroughStream.write(data);
        } else {
            grepFileStream.passthroughStream.end();
        }
        if (channel && !grepFileStream.destroy) {
            grepFileStream.destroy = function() {
                channel.destroy();
            }
        }
    });
};

var getFileStream = function(fileStat: files.FileStat) {
    var grepFileStream:GrepFileStream = new GrepFileStream();
    if (!fileStat.host) {
        var fileStream:fs.ReadStream = fs.createReadStream(fileStat.filename);
        if (fileStat.filename.endsWith(".gz"))
            grepFileStream.outputStream = fileStream.pipe(zlib.createGunzip());
        else
            grepFileStream.outputStream = fileStream;
        grepFileStream.destroy = function() {
            fileStream.destroy();
        }
    } else {
        grepFileStream.passthroughStream = new Stream.PassThrough();
        grepFileStream.outputStream = grepFileStream.passthroughStream;
    }
    return grepFileStream;
};

class GrepFileStream {
    outputStream: NodeJS.ReadableStream;
    passthroughStream:Stream.PassThrough;
    destroy: Function;
}

export var searchFiles = function(basename: string, expression: string, id: string, callbackEvent: (event: GrepEvent) => void, callbackControl: (error: string, status?: string) => void) {
    var [ path, filename, error ] = splitBasename(basename);
    if (error) {
        callbackControl(error);
        return;
    }
    async.waterfall([
        function(callback) {
            files.getFilesStatsByBasename(basename, callback);
        },
        function(fileStats: files.FileStat[], callback) {
            async.whilst(function() {
                return fileStats.length > 0 && !stopIds.has(id)
            }, function(callback: ErrorCallback) {
                searchFile(fileStats.splice(0, 1)[0], expression, id, callbackEvent, callback);
            }, callback);
        },
    ], function (error?: Error) {
        if (error && error.message == "cancelled") {
            callbackControl(error ? error.toString() : null, "Cancelled");
        } else {
            callbackControl(error? error.toString() : null, "Done");
        }
    });
};

export var stop = function(id:string) {
    stopIds.add(id);
};

export var getLines = function(filename: string, lineStart: number, lineEnd: number, callback: (error?: string, lines?: string) => void) {
    let m = new RegExp("^(.*?):(/.*)").exec(filename);
    if (m)
        getLinesLinux(m[2], m[1], lineStart, lineEnd, callback);
    else
        getLinesWindows(filename, lineStart, lineEnd, callback);
};

export var getLinesLinux = function(filename: string, host: string, lineStart: number, lineEnd: number, callback: (error?: string, lines?: string) => void) {
    var command = getFileLinesCommand
        .replace("_file_", filename)
        .replace("_linestart_", lineStart + "")
        .replace("_lineend_", lineEnd + "");

    var lines = "";
    var errorLines = null;
    ssh.execute(command, host,  function(error?: string, data?: string) {
        if (error)
            errorLines = errorLines? errorLines + error : error;
        else if (data)
            lines += data;
        else
            callback(errorLines, lines);
    });
};

export var getLinesWindows = function(filename: string, lineStart: number, lineEnd: number, callback: (error?: string, lines?: string) => void) {
    let lines:string[] = [];
    let fileStream:fs.ReadStream = fs.createReadStream(filename);
    let unzipStream:NodeJS.ReadableStream = null;
    if (filename.endsWith(".gz"))
        unzipStream = fileStream.pipe(zlib.createGunzip());
    const rl = readline.createInterface({ input: filename.endsWith(".gz")? unzipStream : fileStream });
    var lineIdx = 0;
    rl.on('line', (line) => {
        lineIdx++;
        if (lineIdx >= lineStart && lineIdx <= lineEnd)
            lines.push("       ".substring(0, 7 - (lineIdx + "").length) + lineIdx + "\t" + line);
        if (lineIdx > lineEnd)
            rl.close();
    }).on('close', () => {
        callback(null, lines.join("\n"));
    });
};

var getFileLinesCommand:string = "\
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
