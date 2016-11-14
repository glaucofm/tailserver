
var Menu = function (dataUrl) {
    var selectedItems = [];
    var items = [];
    var menuAnchorDisabled = false;
    var ddCollectionsTimeout = false;
    var dropDownCollections = $('#dd-collections');
    var buttonCollections = $('#btn-collections');

    init(this);

    this.getSelectedItems = function() { return selectedItems };

    function init(menu) {
        var lines = $.ajax({ type: "GET", url: dataUrl, async: false }).responseText;
        var topLevelItem = { name: '', childItems: [] };
        parseMenuItems(lines.split('\n'), 0, topLevelItem, '');
        render(topLevelItem);
    }

    function parseMenuItems(lines, idx, parent, parentIndent) {
        var menuItem;
        while (idx < lines.length) {
            lines[idx] = lines[idx].replace(/#.*$/, '');
            if (lines[idx].trim().length == 0) {
                idx++;
                continue;
            }
            var currIndent = (/^(0*)/).exec(lines[idx].replace(/[\t]/g, '0000').replace(/[ ]/g, '0'))[1];
            if (currIndent.length < parentIndent.length) {
                return idx;
            } else if (currIndent.length == parentIndent.length) {
                menuItem = { name: lines[idx].trim(), childItems: [] };
                parent.childItems.push(menuItem);
                idx++;
            } else if (currIndent.length > parentIndent.length) {
                idx = parseMenuItems(lines, idx, menuItem, currIndent)
            }
        }
    }

    function render(topLevelItem) {
        renderMenuItems(topLevelItem.childItems, '');
        dropDownCollections.hide();
        dropDownCollections.mouseenter(showMenu);
        buttonCollections.mouseenter(showMenu);
        dropDownCollections.mouseleave(hideMenu);
        buttonCollections.mouseleave(hideMenu);
    }

    function renderMenuItems(menuItems, level, parent) {
        menuItems.forEach(function(menuItem) {
            var item = { openCloseTimeout: false, isOpen: false };

            item.li =
                $('<li class="collection-item">' +
                  '   <a>' +
                  '       ' + level +
                  '       <label class="menu-checkbox">' +
                  '           <input type="checkbox"/>' +
                  '           <span>&nbsp;</span>' +
                  '       </label>&nbsp;' +
                  '       <span class="item-name">' + menuItem.name + '</span>' +
                  '   </a>' +
                  '</li>');

            dropDownCollections.append(item.li);
            item.checkbox = item.li.find('input');
            item.spanFilename = item.li.find('span.item-name');
            item.a = item.li.find('a');
            item.parent = parent;
            item.children = [];
            items.push(item);

            if (parent) {
                item.li.hide();
                parent.children.push(item);
            }

            item.checkbox.change    (function(e) { toggleItemChecked(item, e);          });
            item.a.click            (function(e) { toggleItemOpenClosedByClick(item);   });
            item.li.mouseenter      (function(e) { autoOpen(item);                      });
            item.li.mouseleave      (function(e) { cancelAutoOpen(item);                });

            if (menuItem.childItems) {
                renderMenuItems(menuItem.childItems, level + '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;', item);
            }
        });
    }

    function toggleItemChecked(item, e) {
        menuAnchorDisabled = true;
        toggleBranchChecked(item, item.checkbox.prop('checked'));
        setSelectedItems();
        setTimeout(function() { menuAnchorDisabled = false }, 50);
    }

    function toggleBranchChecked(item, checked) {
        item.checkbox.prop('checked', checked);
        item.children.forEach(function(child) {
            toggleBranchChecked(child, checked);
        });
    }

    function setSelectedItems() {
        selectedItems = [];
        items.forEach(function(item) {
            if (item.checkbox.prop('checked')) {
                if (item.spanFilename.text().indexOf('.') >= 0)
                    selectedItems.push(item.spanFilename.text());
            }
        });
        var selectedFilesHint = ' [' + selectedItems.length + ']';
        if (selectedItems.length == 0)
            selectedFilesHint = '';
        buttonCollections.text('Select Files' + selectedFilesHint);
        buttonCollections.append(' <span class="caret"></span>');
    }

    function toggleItemOpenClosedByClick(item) {
        if (menuAnchorDisabled)
            return;
        if (item.openCloseTimeout) {
            clearTimeout(item.openCloseTimeout);
            item.openCloseTimeout = false;
        }
        toggleItemOpenClosed(item);
    }

    function toggleItemOpenClosed(item) {
        item.isOpen = !item.isOpen;
        if (item.isOpen) {
            showItems(item.children);
        } else {
            hideBranch(item);
        }
    }

    function autoOpen(item) {
        if (item.isOpen)
            return;
        item.openCloseTimeout = setTimeout(function() {
            menuAnchorDisabled = true;
            toggleItemOpenClosed(item);
            setTimeout(function() { menuAnchorDisabled = false }, 100);
        }, 500);
    }

    function cancelAutoOpen(item) {
        if (item.openCloseTimeout) {
            clearTimeout(item.openCloseTimeout);
            item.openCloseTimeout = false;
        }
    }

    function showMenu() {
        dropDownCollections.show();
        if (ddCollectionsTimeout) {
            clearTimeout(ddCollectionsTimeout);
            ddCollectionsTimeout = false;
        }
    }

    function hideMenu() {
        ddCollectionsTimeout = setTimeout(function () {
            dropDownCollections.hide();
        }, 500);
    }

    function showItems(items) {
        items.forEach(function(item) {
            item.li.show();
        });
    }

    function hideBranch(item) {
        item.children.forEach(function(child) {
            child.li.hide();
            child.isOpen = false;
            hideBranch(child);
        });
    }

};