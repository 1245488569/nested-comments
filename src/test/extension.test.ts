import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

suite('嵌套注释扩展测试', () => {
	vscode.window.showInformationMessage('开始测试嵌套注释扩展');

	// 创建临时测试文件
	const createTempFile = async (content: string, fileExtension: string): Promise<vscode.Uri> => {
		const tmpDir = path.join(__dirname, 'temp');
		if (!fs.existsSync(tmpDir)) {
			fs.mkdirSync(tmpDir, { recursive: true });
		}

		const filePath = path.join(tmpDir, `test-${Date.now()}.${fileExtension}`);
		fs.writeFileSync(filePath, content);

		return vscode.Uri.file(filePath);
	};

	// 清理临时文件
	const cleanupTempFile = (uri: vscode.Uri) => {
		try {
			if (fs.existsSync(uri.fsPath)) {
				fs.unlinkSync(uri.fsPath);
			}
		} catch (e) {
			console.error('清理临时文件失败:', e);
		}
	};

	test('HTML风格单行注释切换测试', async () => {
		// 创建测试文件
		const content = '<div>测试内容</div>';
		const fileUri = await createTempFile(content, 'html');

		try {
			// 打开文件
			const document = await vscode.workspace.openTextDocument(fileUri);
			const editor = await vscode.window.showTextDocument(document);

			// 选择全部内容（单行）
			const line = document.lineAt(0);
			editor.selection = new vscode.Selection(0, 0, 0, line.text.length);

			// 第一次执行切换注释命令 - 添加普通注释
			await vscode.commands.executeCommand('nested-comments.toggleComment');
			assert.strictEqual(document.getText().trim(), '<!-- <div>测试内容</div> -->');

			// 第二次执行切换注释命令 - 添加嵌套注释
			await vscode.commands.executeCommand('nested-comments.toggleComment');
			assert.strictEqual(document.getText().trim(), '<!-- /* <div>测试内容</div> */ -->');

			// 第三次执行切换注释命令 - 移除所有注释
			await vscode.commands.executeCommand('nested-comments.toggleComment');
			assert.strictEqual(document.getText().trim(), '<div>测试内容</div>');
		} finally {
			// 关闭编辑器并清理临时文件
			await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
			cleanupTempFile(fileUri);
		}
	});

	test('JavaScript单行注释切换测试', async () => {
		// 创建测试文件
		const content = 'const test = "测试内容";';
		const fileUri = await createTempFile(content, 'js');

		try {
			// 打开文件
			const document = await vscode.workspace.openTextDocument(fileUri);
			const editor = await vscode.window.showTextDocument(document);

			// 选择全部内容（单行）
			const line = document.lineAt(0);
			editor.selection = new vscode.Selection(0, 0, 0, line.text.length);

			// 第一次执行切换注释命令 - 添加普通注释
			await vscode.commands.executeCommand('nested-comments.toggleComment');
			assert.strictEqual(document.getText().trim(), '// const test = "测试内容";');

			// 第二次执行切换注释命令 - 添加嵌套注释
			await vscode.commands.executeCommand('nested-comments.toggleComment');
			assert.strictEqual(document.getText().trim(), '// /* const test = "测试内容"; */');

			// 第三次执行切换注释命令 - 移除所有注释
			await vscode.commands.executeCommand('nested-comments.toggleComment');
			assert.strictEqual(document.getText().trim(), 'const test = "测试内容";');
		} finally {
			// 关闭编辑器并清理临时文件
			await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
			cleanupTempFile(fileUri);
		}
	});

	test('HTML多行块注释两状态切换测试', async () => {
		// 创建测试文件 - 模拟用户期望的两状态切换
		const content = '<div>\n    <div>这是一段代码</div>\n    <!-- <div>这是一段代码</div> -->\n</div>';
		const fileUri = await createTempFile(content, 'html');

		try {
			// 打开文件
			const document = await vscode.workspace.openTextDocument(fileUri);
			const editor = await vscode.window.showTextDocument(document);

			// 选择全部内容（多行）
			const lastLine = document.lineCount - 1;
			const lastChar = document.lineAt(lastLine).text.length;
			editor.selection = new vscode.Selection(0, 0, lastLine, lastChar);

			// 验证原始状态
			const originalText = document.getText().trim();
			console.log('原始状态:', originalText);
			assert.ok(originalText.includes('<div>'));
			assert.ok(originalText.includes('<!-- <div>这是一段代码</div> -->'));

			// 第一次执行切换注释命令 - 直接添加嵌套注释（紧凑格式）
			await vscode.commands.executeCommand('nested-comments.toggleComment');
			const firstResult = document.getText().trim();
			console.log('第一次结果:', firstResult);
			assert.ok(firstResult.startsWith('<!-- '), '应该以紧凑格式开始');
			assert.ok(firstResult.endsWith(' -->'), '应该以紧凑格式结束');
			assert.ok(firstResult.includes('<div>'), '应该包含原始div标签');
			assert.ok(firstResult.includes('/* <div>这是一段代码</div> */'), '内部HTML注释应该被转换为JS注释');
			assert.ok(!firstResult.includes('<!-- <div>这是一段代码</div> -->'), '不应该再有内部HTML注释');

			// 第二次执行切换注释命令 - 恢复原始状态
			await vscode.commands.executeCommand('nested-comments.toggleComment');
			const secondResult = document.getText().trim();
			console.log('第二次结果:', secondResult);
			assert.ok(secondResult.includes('<div>'));
			assert.ok(secondResult.includes('<!-- <div>这是一段代码</div> -->'), '应该恢复内部HTML注释');
			assert.ok(!secondResult.includes('/* <div>这是一段代码</div> */'), '不应该再有JS注释');

			// 验证最终状态与原始状态相同
			assert.strictEqual(secondResult, originalText, '最终状态应该与原始状态相同');
		} finally {
			// 关闭编辑器并清理临时文件
			await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
			cleanupTempFile(fileUri);
		}
	});

	test('多行混合注释切换测试', async () => {
		// 创建测试文件
		const content = 'function test() {\n  const a = 1;\n  const b = 2;\n  return a + b;\n}';
		const fileUri = await createTempFile(content, 'js');

		try {
			// 打开文件
			const document = await vscode.workspace.openTextDocument(fileUri);
			const editor = await vscode.window.showTextDocument(document);

			// 选择部分内容（第2-3行）
			editor.selection = new vscode.Selection(1, 0, 2, document.lineAt(2).text.length);

			// 第一次执行切换注释命令 - 添加普通注释到选中行
			await vscode.commands.executeCommand('nested-comments.toggleComment');

			// 验证结果 - 只有选中的行被注释
			const lines = document.getText().split('\n');
			assert.strictEqual(lines[0], 'function test() {');
			assert.strictEqual(lines[1].trim(), '// const a = 1;');
			assert.strictEqual(lines[2].trim(), '// const b = 2;');
			assert.strictEqual(lines[3], '  return a + b;');

			// 再次选择全部内容
			const lastLine = document.lineCount - 1;
			const lastChar = document.lineAt(lastLine).text.length;
			editor.selection = new vscode.Selection(0, 0, lastLine, lastChar);

			// 执行切换注释命令 - 由于有部分已注释，应该给已注释的部分添加嵌套注释，给未注释的部分添加普通注释
			await vscode.commands.executeCommand('nested-comments.toggleComment');

			// 验证结果
			const updatedLines = document.getText().split('\n');
			assert.strictEqual(updatedLines[0].trim(), '// function test() {');
			assert.ok(updatedLines[1].includes('/* const a = 1; */'));
			assert.ok(updatedLines[2].includes('/* const b = 2; */'));
			assert.strictEqual(updatedLines[3].trim(), '// return a + b;');
		} finally {
			// 关闭编辑器并清理临时文件
			await vscode.commands.executeCommand('workbench.action.closeActiveEditor');
			cleanupTempFile(fileUri);
		}
	});
});
