function browse(filename, tab, lineStart) {
    if (!lineStart)
        lineStart = 1;
    if (!tab)
        var tab = new Tab(filename, filename, "Loading...");
    $.ajax({
        url: '/getlines?filename=' + filename + '&linestart=' + String(lineStart) + '&lineend=' + String(lineStart + 499),
        type: 'get',
        success: function(data) {
            if (!data)
                return;
            tab.appendText(data);
            if (data.split("\n").length >= 500) {
                var buttonNext = $('<button class="btn btn-xs btn-success">Load more 500 lines</button>');
                tab.appendElements([ $('<div class="div-browse-more" style="padding-left: 48px"></div>').append(buttonNext) ], true);
                buttonNext.click(function() {
                    buttonNext.click(function() {});
                    browse(filename, tab, lineStart + 500);
                });
            }
        },
        error: function(xhr) {
            alert(xhr.responseText);
        }
    });
}

function listFiles() {
    var tab = new Tab("Files", "Files", "Loading...");

    $.ajax({
        url : '/listFiles?filename=' + menu.getSelectedItems()[0],
        type : 'get',
        success : function(data) {
            var filesInfo = JSON.parse(data);
            var table = $('<table class="table table-condensed table-list-files"><tr><th>Filename</th><th>Modified Date</th><th>Size</th><th></th><th></th></tr></th></tr></table>');
            filesInfo.forEach(function(fileInfo) {
                var date = moment(fileInfo.modifiedDate, "YYYY-MM-DD'T'HH:mm:ss.SSS'Z'");
                date = date.format('YYYY-MM-DD HH:mm:ss.SSS Z');
                var row = $('<tr>' +
                    '   <td class="col-left">' + fileInfo.name + '</td>' +
                    '   <td class="col-left">' + date + '</td>' +
                    '   <td class="col-left">' + humanFileSize(fileInfo.size) + '</td>' +
                    '   <td class="col-left action"><button type="button" class="btn btn-link btn-xs" filename="' + fileInfo.name + '">Browse</button></td>' +
                    '   <td class="action"><a href="/downloadFile?filename=' + fileInfo.name +'" class="btn btn-xs">Download</a></td>' +
                    '</tr>');

                row.find('button').click(function() {
                    browse($(this).attr("filename"));
                });

                table.append(row);
            });
            tab.appendElements([ table ]);
        },
        error : function(xhr) {
            tab.appendText(xhr.responseText);
        }
    });
}

function humanFileSize(bytes) {
    var thresh = 1024;
    if(Math.abs(bytes) < thresh) {
        return bytes + ' B';
    }
    var units = ['kB','MB','GB','TB','PB','EB','ZB','YB'];
    var u = -1;
    do {
        bytes /= thresh;
        ++u;
    } while (Math.abs(bytes) >= thresh && u < units.length - 1);
    return bytes.toFixed(1) + ' ' + units[u];
}