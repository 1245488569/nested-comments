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

  if (['javascript', 'typescript', 'json', 'jsonc', 'c', 'cpp', 'csharp', 'java', 'go', 'rust'].includes(languageId)) {
    return COMMENT_MARKERS.js;
  } else if (['vue', 'html', 'javascriptreact', 'typescriptreact', 'xml'].includes(languageId)) {
    return COMMENT_MARKERS.html;
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
 * 检测Vue文件中的代码区域类型
 */
function detectVueSection(document: vscode.TextDocument, lineNumber: number): string {
  // 向上查找最近的区域标签
  for (let i = lineNumber; i >= 0; i--) {
    const line = document.lineAt(i).text.trim();
    if (line.startsWith('<script')) {
      return 'script';
    } else if (line.startsWith('<style')) {
      return 'style';
    } else if (line.startsWith('<template')) {
      return 'template';
    }
  }
  return 'template'; // 默认为template区域
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
 * 为行添加注释，保留原有的注释结构
 */
function addCommentToLine(lineText: string, commentMarkers: any, languageId: string, document?: vscode.TextDocument, lineNumber?: number): string {
  const indentation = lineText.match(/^\s*/)?.[0] || '';
  const content = lineText.substring(indentation.length);

  // 特殊处理Vue文件
  if (languageId === 'vue' && document && lineNumber !== undefined) {
    const section = detectVueSection(document, lineNumber);
    if (section === 'script') {
      // Vue文件的script部分使用JS注释
      return `${indentation}// ${content}`;
    } else if (section === 'style') {
      // Vue文件的style部分使用CSS注释
      return `${indentation}/* ${content} */`;
    } else {
      // Vue文件的template部分使用HTML注释
      return `${indentation}<!-- ${content} -->`;
    }
  }

  // 根据语言类型直接选择注释方式，确保JavaScript使用//注释
  if (languageId === 'javascript' || languageId === 'typescript' ||
    languageId === 'json' || languageId === 'jsonc' ||
    languageId === 'c' || languageId === 'cpp' ||
    languageId === 'csharp' || languageId === 'java' ||
    languageId === 'go' || languageId === 'rust') {
    return `${indentation}// ${content}`;
  } else if (languageId === 'html' ||
    languageId === 'javascriptreact' || languageId === 'typescriptreact' ||
    languageId === 'xml') {
    return `${indentation}<!-- ${content} -->`;
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
 * 应用单行注释 - 保留原始格式和嵌套结构
 */
function applySingleLineComment(editor: vscode.TextEditor, selection: vscode.Selection, document: vscode.TextDocument): void {
  const commentMarkers = getCommentMarkers(document);

  editor.edit(editBuilder => {
    // 获取选中的行范围
    const startLine = selection.start.line;
    const endLine = selection.end.line;

    // 分析所有选中行的注释状态
    let allLinesLevel1 = true;
    let allLinesLevel2 = true;
    let hasAnyComment = false;

    for (let i = startLine; i <= endLine; i++) {
      const line = document.lineAt(i);
      const status = getLineCommentStatus(line.text);

      if (line.text.trim() !== '') { // 只检查非空行
        if (status.level !== 0) {
          hasAnyComment = true;
        }
        if (status.level !== 1) {
          allLinesLevel1 = false;
        }
        if (status.level !== 2) {
          allLinesLevel2 = false;
        }
      }
    }

    // 处理每一行
    for (let i = startLine; i <= endLine; i++) {
      const line = document.lineAt(i);
      const lineText = line.text;
      const status = getLineCommentStatus(lineText);

      let newLine = lineText;

      if (lineText.trim() !== '') { // 只处理非空行
        if (allLinesLevel2 && hasAnyComment) {
          // 状态3：所有行都是2级注释 -> 移除所有注释
          newLine = removeOutermostComment(lineText, status);
        } else if (allLinesLevel1 && hasAnyComment) {
          // 状态2：所有行都是1级注释 -> 添加嵌套注释
          newLine = addNestedCommentToLine(lineText, status, document.languageId);
        } else {
          // 状态1：未注释或混合状态 -> 添加普通注释
          if (status.level === 0) {
            newLine = addCommentToLine(lineText, commentMarkers, document.languageId, document, i);
          } else if (status.level === 1) {
            newLine = addNestedCommentToLine(lineText, status, document.languageId);
          } else {
            // 已经是2级注释，移除最外层
            newLine = removeOutermostComment(lineText, status);
          }
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
 * 为已注释的行添加嵌套注释
 */
function addNestedCommentToLine(lineText: string, status: any, _languageId: string): string {
  if (status.type === 'html') {
    // HTML注释 <!-- content --> -> <!-- /* content */ -->
    return lineText.replace(/^(\s*)<!--\s*(.*?)\s*-->\s*$/, '$1<!-- /* $2 */ -->');
  } else if (status.type === 'js') {
    // JS单行注释 // content -> // /* content */
    return lineText.replace(/^(\s*)\/\/\s*(.*?)$/, '$1// /* $2 */');
  } else if (status.type === 'jsBlock') {
    // JS块注释 /* content */ -> /* // content */
    return lineText.replace(/^(\s*)\/\*\s*(.*?)\s*\*\/\s*$/, '$1/* // $2 */');
  } else if (status.type === 'python') {
    // Python注释 # content -> """ # content """
    return lineText.replace(/^(\s*)#\s*(.*?)$/, '$1""" # $2 """');
  } else if (status.type === 'css') {
    // CSS注释 /* content */ -> /* ! content ! */
    return lineText.replace(/^(\s*)\/\*\s*(.*?)\s*\*\/\s*$/, '$1/* ! $2 ! */');
  }

  return lineText;
}

/**
 * 检查文本是否已经被块注释包围
 */
function isAlreadyBlockCommented(text: string, document: vscode.TextDocument, isVueScriptSection: boolean = false): boolean {
  const lines = text.split('\n');
  if (lines.length < 1) {
    return false;
  }

  const firstLine = lines[0].trim();
  const lastLine = lines[lines.length - 1].trim();

  // 根据语言类型检查对应的块注释格式
  if (document.languageId === 'javascript' || document.languageId === 'typescript' ||
    document.languageId === 'json' || document.languageId === 'jsonc' ||
    document.languageId === 'c' || document.languageId === 'cpp' ||
    document.languageId === 'csharp' || document.languageId === 'java' ||
    document.languageId === 'go' || document.languageId === 'rust' ||
    document.languageId === 'css' || document.languageId === 'scss' ||
    document.languageId === 'less' || isVueScriptSection) {
    // 检查JS风格块注释
    return (firstLine.startsWith('/*') && lastLine.endsWith('*/')) ||
           (firstLine === '/*' && lastLine === '*/');
  } else if (document.languageId === 'html' ||
    document.languageId === 'javascriptreact' || document.languageId === 'typescriptreact' ||
    document.languageId === 'xml' || document.languageId === 'vue') {
    // 检查HTML风格块注释
    return (firstLine.startsWith('<!--') && lastLine.endsWith('-->')) ||
           (firstLine === '<!--' && lastLine === '-->');
  }

  return false;
}

/**
 * 添加简单的块注释
 */
function addBlockComment(text: string, document: vscode.TextDocument, isVueScriptSection: boolean = false): string {
  const lines = text.split('\n');

  // 确定基础缩进 - 使用第一个非空行的缩进
  let baseIndent = '';
  for (const line of lines) {
    if (line.trim()) {
      baseIndent = line.match(/^\s*/)?.[0] || '';
      break;
    }
  }

  // 根据语言类型选择注释格式
  if (document.languageId === 'javascript' || document.languageId === 'typescript' ||
    document.languageId === 'json' || document.languageId === 'jsonc' ||
    document.languageId === 'c' || document.languageId === 'cpp' ||
    document.languageId === 'csharp' || document.languageId === 'java' ||
    document.languageId === 'go' || document.languageId === 'rust' ||
    document.languageId === 'css' || document.languageId === 'scss' ||
    document.languageId === 'less' || isVueScriptSection) {
    // JS风格块注释
    if (lines.length === 1) {
      return `${baseIndent}/* ${lines[0].trim()} */`;
    } else {
      const result = [];
      result.push(`${baseIndent}/* ${lines[0]}`);
      for (let i = 1; i < lines.length - 1; i++) {
        result.push(lines[i]);
      }
      result.push(`${lines[lines.length - 1]} */`);
      return result.join('\n');
    }
  } else {
    // HTML风格块注释
    if (lines.length === 1) {
      return `${baseIndent}<!-- ${lines[0].trim()} -->`;
    } else {
      const result = [];
      result.push(`${baseIndent}<!-- ${lines[0]}`);
      for (let i = 1; i < lines.length - 1; i++) {
        result.push(lines[i]);
      }
      result.push(`${lines[lines.length - 1]} -->`);
      return result.join('\n');
    }
  }
}

/**
 * 移除简单的块注释
 */
function removeBlockComment(text: string, document: vscode.TextDocument, isVueScriptSection: boolean = false): string {
  const lines = text.split('\n');
  const firstLine = lines[0].trim();
  const lastLine = lines[lines.length - 1].trim();

  // 根据语言类型处理对应的块注释格式
  if (document.languageId === 'javascript' || document.languageId === 'typescript' ||
    document.languageId === 'json' || document.languageId === 'jsonc' ||
    document.languageId === 'c' || document.languageId === 'cpp' ||
    document.languageId === 'csharp' || document.languageId === 'java' ||
    document.languageId === 'go' || document.languageId === 'rust' ||
    document.languageId === 'css' || document.languageId === 'scss' ||
    document.languageId === 'less' || isVueScriptSection) {
    // 处理JS风格块注释
    if (firstLine.startsWith('/* ') && lastLine.endsWith(' */')) {
      if (lines.length === 1) {
        // 单行格式：/* content */
        return firstLine.substring(3, firstLine.length - 3);
      } else {
        // 多行格式：/* firstLine ... lastLine */
        const result = [];
        result.push(firstLine.substring(3)); // 移除 "/* "
        for (let i = 1; i < lines.length - 1; i++) {
          result.push(lines[i]);
        }
        const lastLineOriginal = lines[lines.length - 1];
        result.push(lastLineOriginal.substring(0, lastLineOriginal.length - 3)); // 移除 " */"
        return result.join('\n');
      }
    }
  } else {
    // 处理HTML风格块注释
    if (firstLine.startsWith('<!-- ') && lastLine.endsWith(' -->')) {
      if (lines.length === 1) {
        // 单行格式：<!-- content -->
        return firstLine.substring(5, firstLine.length - 4);
      } else {
        // 多行格式：<!-- firstLine ... lastLine -->
        const result = [];
        result.push(firstLine.substring(5)); // 移除 "<!-- "
        for (let i = 1; i < lines.length - 1; i++) {
          result.push(lines[i]);
        }
        const lastLineOriginal = lines[lines.length - 1];
        result.push(lastLineOriginal.substring(0, lastLineOriginal.length - 4)); // 移除 " -->"
        return result.join('\n');
      }
    }
  }

  return text;
}

/**
 * 应用块注释 - 保留原始格式和嵌套结构
 */
function applyBlockComment(editor: vscode.TextEditor, selection: vscode.Selection): void {
  const document = editor.document;

  // 获取实际选中的文本（不强制完整行）
  const selectedText = document.getText(selection);

  // 如果选择为空或只有空白字符，扩展到完整行
  if (!selectedText.trim()) {
    const startPos = new vscode.Position(selection.start.line, 0);
    const endLine = document.lineAt(selection.end.line);
    const endPos = endLine.range.end;
    const fullLineSelection = new vscode.Selection(startPos, endPos);
    const fullLineText = document.getText(fullLineSelection);

    applyBlockCommentToText(editor, fullLineSelection, fullLineText, document);
  } else {
    // 对于有实际内容的选择，使用原始选择
    applyBlockCommentToText(editor, selection, selectedText, document);
  }
}

/**
 * 对指定文本应用块注释
 */
function applyBlockCommentToText(editor: vscode.TextEditor, selection: vscode.Selection, selectedText: string, document: vscode.TextDocument): void {
  editor.edit(editBuilder => {
    let newText = '';

    // 检查是否是Vue文件的script部分
    let isVueScriptSection = false;
    if (document.languageId === 'vue') {
      // 检查选择区域是否在script部分
      const startLine = selection.start.line;
      const section = detectVueSection(document, startLine);
      isVueScriptSection = (section === 'script');
    }

    // 对于JavaScript文件或Vue文件的script部分，使用简单的两状态切换
    if (document.languageId === 'javascript' || document.languageId === 'typescript' ||
      document.languageId === 'json' || document.languageId === 'jsonc' ||
      document.languageId === 'c' || document.languageId === 'cpp' ||
      document.languageId === 'csharp' || document.languageId === 'java' ||
      document.languageId === 'go' || document.languageId === 'rust' ||
      document.languageId === 'css' || document.languageId === 'scss' ||
      document.languageId === 'less' || isVueScriptSection) {
      
      // JavaScript等语言或Vue的script部分：简单的两状态切换
      if (isAlreadyBlockCommented(selectedText, document, isVueScriptSection)) {
        // 状态2：已经是块注释 -> 移除块注释
        newText = removeBlockComment(selectedText, document, isVueScriptSection);
      } else {
        // 状态1：未注释 -> 添加块注释
        newText = addBlockComment(selectedText, document, isVueScriptSection);
      }
    } else {
      // HTML/Vue的template部分等语言：保持原有的嵌套注释功能
      if (hasNestedComment(selectedText)) {
        // 状态2：嵌套注释 -> 移除外层注释，恢复内部HTML注释
        newText = removeNestedComment(selectedText);
      } else {
        // 状态1：未注释或任何其他状态 -> 直接添加嵌套注释
        newText = addNestedBlockComment(selectedText, document);
      }
    }

    editBuilder.replace(selection, newText);
  });
}

/**
 * 检查文本是否包含嵌套注释
 */
function hasNestedComment(text: string): boolean {
  const lines = text.split('\n');
  if (lines.length < 1) {
    return false;
  }

  const firstLine = lines[0].trim();
  const lastLine = lines[lines.length - 1].trim();

  // 检查是否是外层HTML注释包围，且内部包含其他注释
  if ((firstLine.startsWith('<!--') && lastLine.endsWith('-->')) ||
    (firstLine === '<!--' && lastLine === '-->')) {

    let innerContent;
    if (firstLine === '<!--' && lastLine === '-->') {
      // 独立行格式：取中间的内容
      innerContent = lines.slice(1, -1).join('\n');
    } else if (firstLine.startsWith('<!-- ') && lastLine.endsWith(' -->')) {
      // 紧凑格式：<!-- content -->
      if (lines.length === 1) {
        // 单行紧凑格式
        innerContent = firstLine.substring(5, firstLine.length - 4);
      } else {
        // 多行紧凑格式：<!-- firstLine ... lastLine -->
        const firstContent = firstLine.substring(5); // 移除 "<!-- "
        const lastContent = lastLine.substring(0, lastLine.length - 4); // 移除 " -->"
        const middleContent = lines.slice(1, -1).join('\n');
        innerContent = [firstContent, middleContent, lastContent].join('\n');
      }
    } else {
      // 其他内联格式：从注释标记中提取内容
      innerContent = text.substring(
        text.indexOf('<!--') + 4,
        text.lastIndexOf('-->')
      );
    }

    // 检查内部是否有其他注释（/* ... */ 或 // ）
    return (innerContent.includes('/*') && innerContent.includes('*/')) || innerContent.includes('//');
  }

  return false;
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
 * 直接添加嵌套块注释（用于HTML等语言）
 */
function addNestedBlockComment(text: string, document: vscode.TextDocument): string {
  const lines = text.split('\n');

  // 确定基础缩进 - 使用第一个非空行的缩进
  let baseIndent = '';
  for (const line of lines) {
    if (line.trim()) {
      baseIndent = line.match(/^\s*/)?.[0] || '';
      break;
    }
  }

  // 将内部的HTML注释转换为JS注释
  const convertedContent = convertInternalHtmlCommentsToJs(text);
  const convertedLines = convertedContent.split('\n');

  // HTML风格块注释 - 使用紧凑格式（开始和结束标记与内容在同一行）
  const result = [];

  if (convertedLines.length === 1) {
    // 单行内容：<!-- content -->
    result.push(baseIndent + '<!-- ' + convertedLines[0].trim() + ' -->');
  } else {
    // 多行内容：<!-- firstLine
    //           middleLines
    //           lastLine -->
    result.push(baseIndent + '<!-- ' + convertedLines[0]);
    for (let i = 1; i < convertedLines.length - 1; i++) {
      result.push(convertedLines[i]);
    }
    result.push(convertedLines[convertedLines.length - 1] + ' -->');
  }

  return result.join('\n');
}

/**
 * 移除嵌套注释（用于HTML等语言）
 */
function removeNestedComment(text: string): string {
  const lines = text.split('\n');
  const firstLine = lines[0].trim();
  const lastLine = lines[lines.length - 1].trim();

  let innerContent;

  // 检查是否是HTML风格的紧凑格式块注释
  if (firstLine.startsWith('<!-- ') && lastLine.endsWith(' -->')) {
    if (lines.length === 1) {
      // 单行紧凑格式：<!-- content -->
      innerContent = firstLine.substring(5, firstLine.length - 4);
    } else {
      // 多行紧凑格式：<!-- firstLine ... lastLine -->
      const result = [];

      // 第一行：移除 "<!-- "
      const firstContent = firstLine.substring(5);
      result.push(firstContent);

      // 中间行：保持原样
      for (let i = 1; i < lines.length - 1; i++) {
        result.push(lines[i]);
      }

      // 最后一行：移除 " -->" 但保持原始缩进
      const lastLineOriginal = lines[lines.length - 1];
      const lastContent = lastLineOriginal.substring(0, lastLineOriginal.length - 4);
      result.push(lastContent);

      innerContent = result.join('\n');
    }

    // 将内部的JS注释转换回HTML注释
    const restoredContent = convertInternalJsCommentsToHtml(innerContent);
    return restoredContent;
  }
  // 检查是否是HTML独立行格式
  else if (lines.length >= 3 &&
    lines[0].trim() === '<!--' &&
    lines[lines.length - 1].trim() === '-->') {
    // 独立行格式：移除第一行和最后一行
    innerContent = lines.slice(1, -1).join('\n');
    const restoredContent = convertInternalJsCommentsToHtml(innerContent);
    return restoredContent;
  }
  else {
    // 兼容其他内联格式
    if (text.includes('<!--') && text.includes('-->')) {
      const firstLineContent = lines[0].replace(/^(\s*)<!--\s*/, '$1');
      const lastLineContent = lines[lines.length - 1].replace(/\s*-->\s*$/, '');
      const middleLines = lines.slice(1, -1);

      if (lastLineContent.trim() === '') {
        innerContent = [firstLineContent, ...middleLines].join('\n');
      } else {
        innerContent = [firstLineContent, ...middleLines, lastLineContent].join('\n');
      }

      const restoredContent = convertInternalJsCommentsToHtml(innerContent);
      return restoredContent;
    }
  }

  return text;
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

export function deactivate() { }