
var Tail = function(filenames) {
    var tabTitle = filenames[0].replace(/^.*[\\\/]/, '');
    if (filenames.length > 1)
        tabTitle += '...';
    var tooltipText = filenames[0];
    if (filenames.length > 1)
        tooltipText = filenames.join('\n');

    var tab = new Tab(tabTitle, tooltipText, "Loading...", function() { isEnabled = false });
    var id = Math.floor(Math.random() * 1000000000000000);
    var isEnabled = true;
    var files = [];

    init();

    function init() {
        filenames.forEach(function(filename) {
            files.push({
                filename: getActualFileName(filename),
                position: 0
            });
        });
        tailFiles(this);
    }

    function getActualFileName(filename) {
        var m = new RegExp("\{(date):(.*)\}").exec(filename);
        if (m && m[1] == 'date')
            filename = filename.replace(m[0], moment().format(m[2]));
        return filename;
    }

    function tailFiles() {
        tailNextFile(0);
    }

    function tailNextFile(index) {
        if (index < files.length) {
            tailFile(files[index], function() {
                index++;
                if (isEnabled)
                    tailNextFile(index);
            });
        } else {
            setTimeout(tailFiles, 1000);
        }
    }

    function tailFile(fileInfo, callback) {
        $.ajax({
            url : '/tail?filename=' + fileInfo.filename + '&position=' + fileInfo.position + '&maxload=' + Tail.prototype.maxInitialLoad,
            type : 'get',
            success : function(data) {
                try {
                    if (isEnabled)
                        appendContent(data, fileInfo);
                    callback();
                } catch (err) {
                    tab.appendText(err.toString());
                }
            },
            error : function(xhr) {
                tab.appendText(xhr.responseText);
            }
        });
    }

    function appendContent(data, fileInfo) {
        if (data.length == '000000000000'.length)
            return;
        var result = extractContentAndPosition(data);
        fileInfo.position = result.position;
        tab.appendText(result.content);
    }

    function extractContentAndPosition(data) {
        var template = '000000000000';
        var position = data.substr(data.length - template.length, template.length);
        if (!position.match(/^\d\d\d\d\d\d\d\d\d\d\d\d$/))
            throw "Invalid response: " + data;
        var content = data.substr(0, data.length - template.length);
        return {content: content, position: position}
    }

};

Tail.prototype.maxInitialLoad = 5000000;