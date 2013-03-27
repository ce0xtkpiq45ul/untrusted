function CodeEditor(textAreaDomID, width, height) {
    var symbols = {
        'begin_line':'#BEGIN_EDITABLE#',
        'end_line':'#END_EDITABLE#',
        'begin_char':"#{#",
        'end_char': "#}#"
    };

    var charLimit = 80;

    var editableLines = [];
    var editableSections = {};

    function setEditableLinesAndSections(codeString) {
        editableLines = [];
        var lineArray = codeString.split("\n");

        var inEditableBlock = false;

        for (var i = 0; i < lineArray.length; i++) {
            var currentLine = lineArray[i];
            if (currentLine.indexOf(symbols.begin_line) === 0) {
                lineArray.splice(i,1); // be aware that this *mutates* the list
                i--;
                inEditableBlock = true;
            }
            else if (currentLine.indexOf(symbols.end_line) === 0) {
                lineArray.splice(i,1);
                i--;
                inEditableBlock = false;
            }
            else {
                if (inEditableBlock) {
                    editableLines.push(i);
                } else {
                    // check if there are any editable sections
                    var sections = [];
                    var startPoint = null;
                    for (var j = 0; j < currentLine.length - 2; j++) {
                        if (currentLine.slice(j,j+3) === symbols.begin_char) {
                            currentLine = currentLine.slice(0,j) + currentLine.slice(j+3, currentLine.length);
                            startPoint = j;
                        } else if (currentLine.slice(j,j+3) === symbols.end_char) {
                            currentLine = currentLine.slice(0,j) + currentLine.slice(j+3, currentLine.length);
                            sections.push([startPoint, j]);
                        }
                    }
                    if (sections.length > 0) {
                        lineArray[i] = currentLine;
                        editableSections[i] = sections;
                    }
                }
            }
        }

        return lineArray.join("\n");
    }

    /* begining of initialization code */

    this.internalEditor = CodeMirror.fromTextArea(document.getElementById(textAreaDomID), {
        theme: 'vibrant-ink',
        lineNumbers: true,
        dragDrop: false,
        extraKeys: {'Enter': function (instance) { //increments the line by one without inserting anything
            var cursorPos = instance.getCursor();
            cursorPos.line++;
            instance.setCursor(cursorPos);
        }}

    });

    // implements yellow box when changing focus
    this.internalEditor.on("focus", function(instance) {
        $('.CodeMirror').addClass('focus');
        $('#screen canvas').removeClass('focus');
    });
    this.internalEditor.setSize(width,height);

    // set bg color for uneditable lines
    this.internalEditor.on('update', function (instance) {
        // mark uneditable lines
        for (var i = 0; i < instance.lineCount(); i++) {
            if (editableLines.indexOf(i) == -1) {
                instance.addLineClass(i, 'wrap', 'disabled');
            }
        }
    });

    this.internalEditor.on('change', function (instance) {
        // mark editable sections within uneditable lines
        for (var line in editableSections) {
            if (editableSections.hasOwnProperty(line)) {
                var sections = editableSections[line];
                for (var i = 0; i < sections.length; i++) {
                    var section = sections[i];
                    var from = {'line': parseInt(line), 'ch': section[0]};
                    var to = {'line': parseInt(line), 'ch': section[1]};
                    instance.markText(from, to, {'className': 'editableSection'});
                }
            }
        }
    })

    /* end of initialization code */

    //this function enforces editing restrictions
    //when set to 'beforeChange' on the editor
    function enforceRestrictions(instance, change) {
        function inEditableArea(c) {
            var lineNum = c.to.line;
            if (editableLines.indexOf(lineNum) > -1) {
                // editable line?
                return true;
            } else if (editableSections[lineNum]) {
                // this line has editable sections - are we in one of them?
                var sections = editableSections[lineNum];
                for (var i = 0; i < sections.length; i++) {
                    var section = sections[i];
                    if (c.from.ch > section[0] && c.to.ch > section[0] &&
                        c.from.ch < section[1] && c.to.ch < section[1]) {
                        return true;
                    }
                }
                return false;
            }
        }

        if (!inEditableArea(change)) {
            change.cancel();
        }
        else if (change.to.line !== change.from.line) {
            // don't allow multi-line deletion
            change.cancel();
        }
        else {
            // don't allow multi-line paste - only paste first line
            if (change.text.length > 1) {
                change.text = [change.text[0]];
            }

            // enforce 80-char limit
            var lineLength = instance.getLine(change.to.line).length;
            if (lineLength + change.text[0].length > charLimit) {
                var allowedLength = Math.max(charLimit - lineLength, 0);
                change.text[0] = change.text[0].substr(0, allowedLength);
            }
        }
    }

    this.loadCode = function(codeString) {
        this.internalEditor.off('beforeChange',enforceRestrictions);

        /*
         * logic: before setting the value of the editor to the code string,
         * we run it through setEditableLines and setEditableSections, which
         * strip our notation from the string and as a side effect build up
         * a data structure of editable areas
         */
        codeString = setEditableLinesAndSections(codeString);

        this.internalEditor.setValue(codeString);
        this.internalEditor.on('beforeChange', enforceRestrictions);

        this.internalEditor.refresh();
    };

    // returns all contents
    this.getCode = function () {
        return this.internalEditor.getValue();
    }

    // returns only the code written in editable lines
    this.getPlayerCode = function () {
        var code = '';
        for (var i = 0; i < this.internalEditor.lineCount(); i++) {
            if (editableLines && editableLines.indexOf(i) > -1) {
                code += this.internalEditor.getLine(i) + ' \n';
            }
        }
        return code;
    };

    this.refresh = function () {
        this.internalEditor.refresh();
    }

    this.focus = function () {
        this.internalEditor.focus();
    }
}
