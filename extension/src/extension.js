const vscode = require('vscode');

/**
 * AutoLISP Outline Provider with Robust Recursive Parsing
 */
function activate(context) {
    vscode.languages.registerDocumentSymbolProvider({ language: 'autolisp' }, {
        provideDocumentSymbols(document) {
            const symbols = [];

            const regexHeaderLine = /^;;\s*=+\s*$/;
            const regexHeaderName = /^;;\s*([^=][^\n]*)$/;
            const regexDefun = /\(defun\s+([^\s()]+)/;
            const regexCommand = /\(defun\s+c:([^\s()]+)/;

            const sections = [];
            let i = 0;

            // First pass: identify section ranges
            while (i < document.lineCount) {
                const text = document.lineAt(i).text.trim();
                if (regexHeaderLine.test(text) && i + 2 < document.lineCount) {
                    const middle = document.lineAt(i + 1).text.trim();
                    const bottom = document.lineAt(i + 2).text.trim();
                    if (regexHeaderLine.test(bottom) && regexHeaderName.test(middle)) {
                        const name = middle.replace(/^;;\s*/, '').trim();
                        const start = i;
                        i += 3;
                        let end = document.lineCount;
                        for (let j = i; j < document.lineCount; j++) {
                            const line = document.lineAt(j).text.trim();
                            if (regexHeaderLine.test(line) && j + 2 < document.lineCount) {
                                const m2 = document.lineAt(j + 1).text.trim();
                                const b2 = document.lineAt(j + 2).text.trim();
                                if (regexHeaderLine.test(b2) && regexHeaderName.test(m2)) {
                                    end = j;
                                    break;
                                }
                            }
                        }
                        sections.push({ name, start, end });
                        i = end;
                        continue;
                    }
                }
                i++;
            }

            // Recursive parse of functions with nesting
            function parseFunctions(startLine, endLine) {
                const result = [];

                for (let i = startLine; i < endLine; i++) {
                    const line = document.lineAt(i);
                    const text = line.text.trim();
                    const match = regexDefun.exec(text);
                    if (match) {
                        const name = match[1];
                        const isCommand = regexCommand.test(text);
                        const start = i;

                        // Find matching close paren
                        let depth = 0;
                        let end = i;
                        for (let j = i; j < endLine; j++) {
                            const t = document.lineAt(j).text;
                            depth += (t.match(/\(/g) || []).length;
                            depth -= (t.match(/\)/g) || []).length;
                            if (depth <= 0) {
                                end = j;
                                break;
                            }
                        }

                        const range = new vscode.Range(start, 0, end, document.lineAt(end).text.length);
                        const defunSymbol = new vscode.DocumentSymbol(
                            name,
                            isCommand ? 'Command' : 'Function',
                            vscode.SymbolKind.Function,
                            range,
                            range
                        );

                        // Recursively parse children
                        const children = parseFunctions(start + 1, end);
                        defunSymbol.children.push(...children);
                        result.push(defunSymbol);

                        i = end;
                    }
                }

                return result;
            }

            // If any top-level functions before the first section
            const sectionStarts = sections.length > 0 ? sections[0].start : document.lineCount;
            const preSectionFuncs = parseFunctions(0, sectionStarts);
            symbols.push(...preSectionFuncs);

            // Parse each section separately
            for (const section of sections) {
                const range = new vscode.Range(section.start, 0, section.end - 1, document.lineAt(section.end - 1).text.length);
                const sectionSymbol = new vscode.DocumentSymbol(
                    section.name,
                    'Section',
                    vscode.SymbolKind.Namespace,
                    range,
                    range
                );
                sectionSymbol.children.push(...parseFunctions(section.start + 3, section.end));
                symbols.push(sectionSymbol);
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
