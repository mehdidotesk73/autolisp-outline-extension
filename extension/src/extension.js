const vscode = require('vscode');

/**
 * AutoLISP Outline Provider with Section Headers and Nested Functions
 */
function activate(context) {
    vscode.languages.registerDocumentSymbolProvider({ language: 'autolisp' }, {
        provideDocumentSymbols(document) {
            const symbols = [];

            const regexHeaderLine = /^;;\s*=+\s*$/;
            const regexHeaderName = /^;;\s*([^=][^\n]*)$/;
            const regexDefun = /\(defun\s+([^\s()]+)/;
            const regexCommand = /\(defun\s+c:([^\s()]+)/;

            let currentSection = null;
            const functionStack = [];

            for (let i = 0; i < document.lineCount; i++) {
                const line = document.lineAt(i);
                const text = line.text.trim();

                // Detect 3-line section header block: === / name / ===
                if (regexHeaderLine.test(text)) {
                    if (i + 2 < document.lineCount) {
                        const middle = document.lineAt(i + 1).text.trim();
                        const bottom = document.lineAt(i + 2).text.trim();

                        if (regexHeaderLine.test(bottom) && regexHeaderName.test(middle)) {
                            const headerName = middle.replace(/^;;\s*/, '').trim();

                            const range = new vscode.Range(i, 0, i + 2, document.lineAt(i + 2).text.length);
                            const sectionSymbol = new vscode.DocumentSymbol(
                                headerName,
                                'Section',
                                vscode.SymbolKind.Namespace,
                                range,
                                range
                            );
                            symbols.push(sectionSymbol);
                            currentSection = sectionSymbol;

                            i += 2;
                            continue;
                        }
                    }
                }

                // Match defun / c:defun
                const match = regexDefun.exec(text);
                if (match) {
                    const name = match[1];
                    const isCommand = regexCommand.test(text);
                    const kind = vscode.SymbolKind.Function;

                    const defunSymbol = new vscode.DocumentSymbol(
                        name,
                        isCommand ? 'Command' : 'Function',
                        kind,
                        line.range,
                        line.range
                    );

                    // Determine nesting
                    if (functionStack.length > 0) {
                        const parent = functionStack[functionStack.length - 1];
                        parent.children.push(defunSymbol);
                    } else if (currentSection) {
                        currentSection.children.push(defunSymbol);
                    } else {
                        symbols.push(defunSymbol);
                    }

                    functionStack.push(defunSymbol);
                }

                // Heuristic: end of a defun when we hit a line with only )
                if (text === ')' || (text.endsWith(')') && !text.includes('('))) {
                    if (functionStack.length > 0) {
                        const fn = functionStack.pop();
                        fn.range = new vscode.Range(fn.range.start, line.range.end);
                    }
                }
            }

            const lastLine = document.lineAt(document.lineCount - 1).range.end;
            while (functionStack.length > 0) {
                const fn = functionStack.pop();
                fn.range = new vscode.Range(fn.range.start, lastLine);
            }

            return symbols;
        }
    });
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
