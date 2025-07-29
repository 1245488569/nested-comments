import * as vscode from 'vscode';

// 支持的文件类型
const SUPPORTED_LANGUAGES = ['vue', 'javascript', 'javascriptreact', 'typescript', 'typescriptreact', 'html', 'css', 'scss', 'less', 'json', 'jsonc', 'markdown', 'xml', 'php', 'python', 'java', 'c', 'cpp', 'csharp', 'go', 'rust', 'ruby'];

// 不同语言的注释标记 - 优化后的更简洁样式
const COMMENT_MARKERS = {
  // HTML风格注释 (Vue, HTML, JSX, XML)
  html: {
    start: '<!-- ',
    end: ' -->',
    nestedStart: '/* ',
    nestedEnd: ' */',
    blockStart: '<!--\n',
    blockEnd: '\n-->',
  },
  // JS/TS风格注释
  js: {
    start: '// ',
    end: '',
    nestedStart: '/* ',
    nestedEnd: ' */',
    blockStart: '/*\n',
    blockEnd: '\n */',
  },
  // Python风格注释
  python: {
    start: '# ',
    end: '',
    nestedStart: '""" ',
    nestedEnd: ' """',
    blockStart: '"""\n',
    blockEnd: '\n"""',
  },
  // Ruby风格注释
  ruby: {
    start: '# ',
    end: '',
    nestedStart: '=begin\n',
    nestedEnd: '\n=end',
    blockStart: '=begin\n',
    blockEnd: '\n=end',
  },
  // CSS风格注释
  css: {
    start: '/* ',
    end: ' */',
    nestedStart: '/* ! ',
    nestedEnd: ' ! */',
    blockStart: '/*\n',
    blockEnd: '\n */',
  },
};

/**
 * 获取当前文档的语言类型对应的注释标记
 */
function getCommentMarkers(document: vscode.TextDocument): any {
  const languageId = document.languageId;
  
  if (['vue', 'html', 'javascriptreact', 'typescriptreact', 'xml'].includes(languageId)) {
    return COMMENT_MARKERS.html;
  } else if (['javascript', 'typescript', 'json', 'jsonc', 'c', 'cpp', 'csharp', 'java', 'go', 'rust'].includes(languageId)) {
    return COMMENT_MARKERS.js;
  } else if (['css', 'scss', 'less'].includes(languageId)) {
    return COMMENT_MARKERS.css;
  } else if (['python', 'markdown'].includes(languageId)) {
    return COMMENT_MARKERS.python;
  } else if (['ruby'].includes(languageId)) {
    return COMMENT_MARKERS.ruby;
  }
  
  return COMMENT_MARKERS.js; // 默认使用JS风格注释
}

/**
 * 检测行的注释状态
 * 返回: 
 * - isCommented: 是否已注释
 * - type: 注释类型
 * - level: 注释嵌套层级
 */
function getLineCommentStatus(line: string): { isCommented: boolean, type: string, level: number } {
  const trimmedLine = line.trim();
  
  // 检查HTML风格注释中的嵌套JS注释
  if (trimmedLine.startsWith('<!-- /* ') && trimmedLine.endsWith(' */ -->')) {
    return { isCommented: true, type: 'html-nested', level: 2 };
  }
  
  // 检查JS单行注释中的嵌套块注释
  if (trimmedLine.startsWith('// /* ') && trimmedLine.endsWith(' */')) {
    return { isCommented: true, type: 'js-nested', level: 2 };
  }
  
  // 检查JS块注释中的嵌套单行注释
  if (trimmedLine.startsWith('/* // ') && trimmedLine.endsWith(' */')) {
    return { isCommented: true, type: 'jsBlock-nested', level: 2 };
  }
  
  // 检查HTML风格注释
  if (trimmedLine.startsWith('<!--') && trimmedLine.endsWith('-->')) {
    return { isCommented: true, type: 'html', level: 1 };
  }
  
  // 检查JS单行注释
  if (trimmedLine.startsWith('//')) {
    return { isCommented: true, type: 'js', level: 1 };
  }
  
  // 检查JS块注释
  if (trimmedLine.startsWith('/*') && trimmedLine.endsWith('*/')) {
    return { isCommented: true, type: 'jsBlock', level: 1 };
  }
  
  // 检查Python注释
  if (trimmedLine.startsWith('#')) {
    return { isCommented: true, type: 'python', level: 1 };
  }
  
  // 检查Python块注释
  if (trimmedLine.startsWith('"""') && trimmedLine.endsWith('"""')) {
    return { isCommented: true, type: 'pythonBlock', level: 1 };
  }
  
  return { isCommented: false, type: '', level: 0 };
}

/**
 * 检查选择是否跨越多行
 */
function isMultiLineSelection(selection: vscode.Selection): boolean {
  return selection.start.line !== selection.end.line;
}

/**
 * 检查选择是否包含整行
 */
function isFullLineSelection(document: vscode.TextDocument, selection: vscode.Selection): boolean {
  const startLine = document.lineAt(selection.start.line);
  const endLine = document.lineAt(selection.end.line);
  
  return selection.start.character === 0 && 
         (selection.end.character === 0 && selection.end.line > selection.start.line || 
          selection.end.character === endLine.text.length);
}

/**
 * 检查文本是否被块注释包围
 */
function isWrappedInBlockComment(text: string, document: vscode.TextDocument): { isWrapped: boolean, commentType: string } {
  const lines = text.split('\n');
  
  if (lines.length === 0) {
    return { isWrapped: false, commentType: '' };
  }
  
  const firstLine = lines[0].trim();
  const lastLine = lines[lines.length - 1].trim();
  
  // 检查HTML风格块注释 <!-- ... -->
  if (firstLine.startsWith('<!--') && lastLine.endsWith('-->')) {
    return { isWrapped: true, commentType: 'html' };
  }
  
  // 检查JS风格块注释 /* ... */
  if (firstLine.startsWith('/*') && lastLine.endsWith('*/')) {
    return { isWrapped: true, commentType: 'js' };
  }
  
  // 检查Python风格块注释 """ ... """
  if (firstLine.startsWith('"""') && lastLine.endsWith('"""')) {
    return { isWrapped: true, commentType: 'python' };
  }
  
  // 检查Ruby风格块注释 =begin ... =end
  if (firstLine.startsWith('=begin') && lastLine.endsWith('=end')) {
    return { isWrapped: true, commentType: 'ruby' };
  }
  
  return { isWrapped: false, commentType: '' };
}

/**
 * 应用单行注释 - 保留原始格式和嵌套结构
 */
function applySingleLineComment(editor: vscode.TextEditor, selection: vscode.Selection, document: vscode.TextDocument): void {
  const commentMarkers = getCommentMarkers(document);
  
  editor.edit(editBuilder => {
    // 获取选中的行范围
    const startLine = selection.start.line;
    const endLine = selection.end.line;
    
    // 检查所有选中行是否都已被注释
    let allLinesCommented = true;
    let hasAnyComment = false;
    
    for (let i = startLine; i <= endLine; i++) {
      const line = document.lineAt(i);
      const status = getLineCommentStatus(line.text);
      if (status.level === 0 && line.text.trim() !== '') {
        allLinesCommented = false;
      }
      if (status.level > 0) {
        hasAnyComment = true;
      }
    }
    
    // 处理每一行
    for (let i = startLine; i <= endLine; i++) {
      const line = document.lineAt(i);
      const lineText = line.text;
      const status = getLineCommentStatus(lineText);
      
      let newLine = lineText;
      
      if (allLinesCommented && hasAnyComment) {
        // 如果所有行都已注释，则移除最外层注释
        if (status.level > 0) {
          newLine = removeOutermostComment(lineText, status);
        }
      } else {
        // 如果有未注释的行，则为所有行添加注释
        if (lineText.trim() !== '') { // 只处理非空行
          newLine = addCommentToLine(lineText, commentMarkers, document.languageId);
        }
      }
      
      if (newLine !== lineText) {
        editBuilder.replace(line.range, newLine);
      }
    }
  });
}

/**
 * 移除行的最外层注释
 */
function removeOutermostComment(lineText: string, status: any): string {
  if (status.type === 'html') {
    // 移除 <!-- 内容 -->
    return lineText.replace(/^(\s*)<!--\s*(.*?)\s*-->\s*$/, '$1$2');
  } else if (status.type === 'js') {
    // 移除 // 内容
    return lineText.replace(/^(\s*)\/\/\s*(.*?)$/, '$1$2');
  } else if (status.type === 'jsBlock') {
    // 移除 /* 内容 */
    return lineText.replace(/^(\s*)\/\*\s*(.*?)\s*\*\/\s*$/, '$1$2');
  } else if (status.type === 'python') {
    // 移除 # 内容
    return lineText.replace(/^(\s*)#\s*(.*?)$/, '$1$2');
  } else if (status.type === 'pythonBlock') {
    // 移除 """ 内容 """
    return lineText.replace(/^(\s*)"""\s*(.*?)\s*"""\s*$/, '$1$2');
  } else if (status.type === 'html-nested') {
    // 移除 <!-- /* 内容 */ -->
    return lineText.replace(/^(\s*)<!--\s*\/\*\s*(.*?)\s*\*\/\s*-->\s*$/, '$1$2');
  } else if (status.type === 'js-nested') {
    // 移除 // /* 内容 */
    return lineText.replace(/^(\s*)\/\/\s*\/\*\s*(.*?)\s*\*\/\s*$/, '$1$2');
  } else if (status.type === 'jsBlock-nested') {
    // 移除 /* // 内容 */
    return lineText.replace(/^(\s*)\/\*\s*\/\/\s*(.*?)\s*\*\/\s*$/, '$1$2');
  }
  
  return lineText;
}

/**
 * 为行添加注释，保留原有的注释结构
 */
function addCommentToLine(lineText: string, commentMarkers: any, languageId: string): string {
  const indentation = lineText.match(/^\s*/)?.[0] || '';
  const content = lineText.substring(indentation.length);
  
  // 根据语言类型选择合适的注释方式
  if (languageId === 'html' || languageId === 'vue' || 
      languageId === 'javascriptreact' || languageId === 'typescriptreact' || 
      languageId === 'xml') {
    return `${indentation}<!-- ${content} -->`;
  } else if (languageId === 'javascript' || languageId === 'typescript' || 
            languageId === 'json' || languageId === 'jsonc' || 
            languageId === 'c' || languageId === 'cpp' || 
            languageId === 'csharp' || languageId === 'java' || 
            languageId === 'go' || languageId === 'rust') {
    return `${indentation}// ${content}`;
  } else if (languageId === 'css' || languageId === 'scss' || 
            languageId === 'less') {
    return `${indentation}/* ${content} */`;
  } else if (languageId === 'python' || languageId === 'markdown') {
    return `${indentation}# ${content}`;
  } else if (languageId === 'ruby') {
    return `${indentation}# ${content}`;
  } else {
    // 默认使用双斜杠注释
    return `${indentation}// ${content}`;
  }
}

/**
 * 检查文本是否包含嵌套注释（HTML包含JS注释）
 */
function hasNestedComment(text: string): boolean {
  const lines = text.split('\n');
  if (lines.length < 2) return false;
  
  const firstLine = lines[0].trim();
  const lastLine = lines[lines.length - 1].trim();
  
  // 检查是否是 <!-- /* ... */ --> 的格式
  return firstLine.startsWith('<!-- /*') && lastLine.endsWith('*/ -->');
}

/**
 * 将内部HTML注释转换为JS注释
 */
function convertInternalHtmlCommentsToJs(text: string): string {
  const lines = text.split('\n');
  const convertedLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // 处理单行HTML注释
    if (line.includes('<!--') && line.includes('-->')) {
      line = line.replace(/<!--\s*(.*?)\s*-->/g, '/* $1 */');
    }
    // 处理多行HTML注释的开始
    else if (line.includes('<!--') && !line.includes('-->')) {
      line = line.replace(/<!--\s*(.*)/, '/* $1');
    }
    // 处理多行HTML注释的结束
    else if (line.includes('-->') && !line.includes('<!--')) {
      line = line.replace(/(.*?)\s*-->/, '$1 */');
    }
    
    convertedLines.push(line);
  }
  
  return convertedLines.join('\n');
}

/**
 * 将内部JS注释转换回HTML注释
 */
function convertInternalJsCommentsToHtml(text: string): string {
  const lines = text.split('\n');
  const convertedLines = [];
  
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];
    
    // 处理单行JS注释
    if (line.includes('/*') && line.includes('*/')) {
      line = line.replace(/\/\*\s*(.*?)\s*\*\//g, '<!-- $1 -->');
    }
    // 处理多行JS注释的开始
    else if (line.includes('/*') && !line.includes('*/')) {
      line = line.replace(/\/\*\s*(.*)/, '<!-- $1');
    }
    // 处理多行JS注释的结束
    else if (line.includes('*/') && !line.includes('/*')) {
      line = line.replace(/(.*?)\s*\*\//, '$1 -->');
    }
    
    convertedLines.push(line);
  }
  
  return convertedLines.join('\n');
}

/**
 * 应用块注释 - 保留原始格式和嵌套结构
 */
function applyBlockComment(editor: vscode.TextEditor, selection: vscode.Selection): void {
  const document = editor.document;
  
  // 创建一个新的选择区域，确保选择完整的行
  const startPos = new vscode.Position(selection.start.line, 0);
  const endLine = document.lineAt(selection.end.line);
  const endPos = endLine.range.end;
  const fullLineSelection = new vscode.Selection(startPos, endPos);
  
  // 获取选中文本
  const selectedText = document.getText(fullLineSelection);
  
  editor.edit(editBuilder => {
    let newText = '';
    
    // 检查是否已经是嵌套注释
    if (hasNestedComment(selectedText)) {
      // 状态3：嵌套注释 -> 移除外层注释，恢复内部HTML注释
      newText = removeNestedComment(selectedText);
    } else {
      // 检查是否已经被块注释包围
      const { isWrapped } = isWrappedInBlockComment(selectedText, document);
      
      if (isWrapped) {
        // 状态2：已有块注释 -> 添加嵌套注释
        newText = addNestedComment(selectedText, document);
      } else {
        // 状态1：未注释或部分注释 -> 添加块注释
        newText = addBlockComment(selectedText, document);
      }
    }
    
    editBuilder.replace(fullLineSelection, newText);
  });
}

/**
 * 添加块注释
 */
function addBlockComment(text: string, document: vscode.TextDocument): string {
  const lines = text.split('\n');
  const baseIndent = lines[0].match(/^\s*/)?.[0] || '';
  
  if (document.languageId === 'html' || document.languageId === 'vue' || 
      document.languageId === 'javascriptreact' || document.languageId === 'typescriptreact' || 
      document.languageId === 'xml') {
    // HTML风格块注释
    const modifiedLines = [...lines];
    modifiedLines[0] = baseIndent + '<!-- ' + lines[0].substring(baseIndent.length);
    modifiedLines[modifiedLines.length - 1] = modifiedLines[modifiedLines.length - 1] + ' -->';
    return modifiedLines.join('\n');
  } else {
    // JS风格块注释
    const modifiedLines = [...lines];
    modifiedLines[0] = baseIndent + '/* ' + lines[0].substring(baseIndent.length);
    modifiedLines[modifiedLines.length - 1] = modifiedLines[modifiedLines.length - 1] + ' */';
    return modifiedLines.join('\n');
  }
}

/**
 * 添加嵌套注释
 */
function addNestedComment(text: string, document: vscode.TextDocument): string {
  const lines = text.split('\n');
  
  // 移除最外层的块注释
  const firstLine = lines[0].replace(/^(\s*)<!--\s*/, '$1');
  const lastLine = lines[lines.length - 1].replace(/\s*-->\s*$/, '');
  const middleLines = lines.slice(1, -1);
  
  let innerContent;
  if (lastLine.trim() === '') {
    innerContent = [firstLine, ...middleLines].join('\n');
  } else {
    innerContent = [firstLine, ...middleLines, lastLine].join('\n');
  }
  
  // 将内部的HTML注释转换为JS注释
  const convertedContent = convertInternalHtmlCommentsToJs(innerContent);
  
  // 重新添加外层HTML注释
  const convertedLines = convertedContent.split('\n');
  const baseIndent = convertedLines[0].match(/^\s*/)?.[0] || '';
  convertedLines[0] = baseIndent + '<!-- ' + convertedLines[0].substring(baseIndent.length);
  convertedLines[convertedLines.length - 1] = convertedLines[convertedLines.length - 1] + ' -->';
  
  return convertedLines.join('\n');
}

/**
 * 移除嵌套注释
 */
function removeNestedComment(text: string): string {
  const lines = text.split('\n');
  
  // 移除最外层的HTML注释
  const firstLine = lines[0].replace(/^(\s*)<!--\s*/, '$1');
  const lastLine = lines[lines.length - 1].replace(/\s*-->\s*$/, '');
  const middleLines = lines.slice(1, -1);
  
  let innerContent;
  if (lastLine.trim() === '') {
    innerContent = [firstLine, ...middleLines].join('\n');
  } else {
    innerContent = [firstLine, ...middleLines, lastLine].join('\n');
  }
  
  // 将内部的JS注释转换回HTML注释
  const restoredContent = convertInternalJsCommentsToHtml(innerContent);
  
  return restoredContent;
}

/**
 * 切换注释状态
 * 根据当前注释状态循环切换：未注释 -> 注释 -> 嵌套注释 -> 未注释
 */
function toggleComment(editor: vscode.TextEditor) {
  const document = editor.document;
  const selection = editor.selection;
  
  // 检查文件类型是否支持
  if (!SUPPORTED_LANGUAGES.includes(document.languageId)) {
    vscode.window.showWarningMessage(`嵌套注释不支持 ${document.languageId} 文件类型`);
    return;
  }
  
  // 如果选择区域为空，则扩展到整行
  let workingSelection = selection;
  if (selection.isEmpty) {
    const line = document.lineAt(selection.start.line);
    workingSelection = new vscode.Selection(
      new vscode.Position(line.lineNumber, 0),
      new vscode.Position(line.lineNumber, line.text.length)
    );
  }
  
  // 检查是否是多行选择
  if (isMultiLineSelection(workingSelection)) {
    // 使用块注释
    applyBlockComment(editor, workingSelection);
  } else {
    // 单行注释
    applySingleLineComment(editor, workingSelection, document);
  }
}

export function activate(context: vscode.ExtensionContext) {
  console.log('嵌套注释扩展已激活');

  // 注册切换注释命令
  const toggleCommentDisposable = vscode.commands.registerCommand(
    'nested-comments.toggleComment',
    () => {
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        toggleComment(editor);
      }
    }
  );

  context.subscriptions.push(toggleCommentDisposable);
}

export function deactivate() {}
