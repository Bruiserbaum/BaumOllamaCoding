import * as vscode from 'vscode';
import { ChatProvider } from './ChatProvider';

export function activate(context: vscode.ExtensionContext) {
  const provider = new ChatProvider(context);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('baumollamacoding.chatView', provider, {
      webviewOptions: { retainContextWhenHidden: true },
    }),
    vscode.commands.registerCommand('baumollamacoding.openPanel', () => provider.openPanel()),
    vscode.commands.registerCommand('baumollamacoding.newChat', () => provider.newChat())
  );
}

export function deactivate() {}
