
var menu = new Menu("data/collections.txt");
var highLighter = new HighLighter(Tab.prototype.reapplyStylesAllTabs);
var filterer = new Filterer(Tab.prototype.reapplyStylesAllTabs);
Tab.prototype.registerStyler(highLighter.applyHighLights);
Tab.prototype.registerStyler(filterer.applyFilters);
var greps = [];

function createNewTail(singleTab) {
    if (singleTab)
        new Tail(menu.getSelectedItems());
    else
        menu.getSelectedItems().forEach(function(filename) {
            new Tail([ filename ]);
        });
}

function createNewGrep(expression) {
    greps.push(new Grep(menu.getSelectedItems(), expression));
}

window.onload = function () {
    $(window).resize();

    $(document).keydown(function(event) {
        var event = event || window.event;
        var keyCode = event.keyCode || event.which;
        if (keyCode == 27) {
            greps.forEach(function(grep) {
                log('canceling');
                if (grep.isActiveTab()) {
                    log(grep);
                    grep.cancel();
                }
            });
        }
    });

    $('#input-search').on('keydown', function(e) {
        if (e.which == 13 || e.keyCode == 13) {
            createNewGrep($('#input-search').val());
        }
    });

    $('#btn-tail, #dd-tail-options').mouseenter(function() {
        $('#dd-tail-options').show();
    });

    $('#btn-tail, #dd-tail-options').mouseleave(function() {
        $('#dd-tail-options').hide();
    });
};

$(window).resize(function() {
    $('#div-search').width($(window).width() - 60 - $('#div-collections').width() - 20 - $('#div-highlight').width() - 20 - $('#div-filter').width() - 20);
    $('#div-tabs-content').width($(window).width() - 60);
});

function log(text) {
    console.log((new Date().format("HH:MM:ss.l - ")) + text);
}

