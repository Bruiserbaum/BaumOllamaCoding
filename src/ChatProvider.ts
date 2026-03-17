import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { OllamaService, OllamaMessage } from './OllamaService';

interface Session {
  id: string;
  title: string;
  messages: OllamaMessage[];
  createdAt: number;
  updatedAt: number;
}

interface Settings {
  serverUrl: string;
  defaultModel: string;
  temperature: number;
  maxTokens: number;
  keepAlive: string;
  systemPrompt: string;
}

type IncomingMessage =
  | { type: 'get-models' }
  | { type: 'send'; messages: OllamaMessage[]; model: string; settings?: Partial<Settings> }
  | { type: 'stop' }
  | { type: 'get-sessions' }
  | { type: 'save-session'; session: Session }
  | { type: 'delete-session'; id: string }
  | { type: 'get-settings' }
  | { type: 'save-settings'; settings: Partial<Settings> }
  | { type: 'export'; content: string; filename: string }
  | { type: 'open-panel' };

export class ChatProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _panel?: vscode.WebviewPanel;
  private _ollamaService = new OllamaService();
  private _abortController?: AbortController;

  constructor(private readonly _context: vscode.ExtensionContext) {}

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;
    this._setupWebview(webviewView.webview);
    this._handleMessages(webviewView.webview);
  }

  openPanel() {
    if (this._panel) {
      this._panel.reveal();
      return;
    }

    this._panel = vscode.window.createWebviewPanel(
      'baumollamacoding.panel',
      'BaumOllamaCoding',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this._context.extensionUri, 'dist'),
        ],
      }
    );

    this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
    this._handleMessages(this._panel.webview);

    this._panel.onDidDispose(() => {
      this._panel = undefined;
    });
  }

  newChat() {
    const activeWebview = this._panel?.webview ?? this._view?.webview;
    activeWebview?.postMessage({ type: 'new-chat' });
  }

  private _setupWebview(webview: vscode.Webview) {
    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._context.extensionUri, 'dist'),
      ],
    };
    webview.html = this._getHtmlForWebview(webview);
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, 'dist', 'webview.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._context.extensionUri, 'dist', 'webview.css')
    );
    const nonce = crypto.randomBytes(16).toString('base64');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; img-src ${webview.cspSource} data:;">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BaumOllamaCoding</title>
  <link rel="stylesheet" href="${styleUri}">
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private _handleMessages(webview: vscode.Webview) {
    webview.onDidReceiveMessage(async (message: IncomingMessage) => {
      switch (message.type) {
        case 'get-models': {
          const cfg = vscode.workspace.getConfiguration('baumollamacoding');
          const serverUrl = cfg.get<string>('serverUrl', 'http://localhost:11434');
          try {
            const models = await this._ollamaService.getModels(serverUrl);
            webview.postMessage({ type: 'models', models });
          } catch (err) {
            webview.postMessage({
              type: 'models-error',
              error: err instanceof Error ? err.message : String(err),
            });
          }
          break;
        }

        case 'send': {
          this._abortController?.abort();
          this._abortController = new AbortController();

          const cfg = vscode.workspace.getConfiguration('baumollamacoding');
          const serverUrl = cfg.get<string>('serverUrl', 'http://localhost:11434');

          const settings = message.settings ?? {};
          const temperature = settings.temperature ?? cfg.get<number>('temperature', 0.7);
          const maxTokens = settings.maxTokens ?? cfg.get<number>('maxTokens', 2048);
          const keepAlive = settings.keepAlive ?? cfg.get<string>('keepAlive', '30m');
          const systemPrompt = settings.systemPrompt ?? '';

          const messages: OllamaMessage[] = systemPrompt
            ? [{ role: 'system', content: systemPrompt }, ...message.messages]
            : message.messages;

          await this._ollamaService.streamChat(
            serverUrl,
            message.model,
            messages,
            { temperature, num_predict: maxTokens, keep_alive: keepAlive },
            this._abortController.signal,
            {
              onChunk: (content) => webview.postMessage({ type: 'chunk', content }),
              onThoughtChunk: (content) => webview.postMessage({ type: 'thought-chunk', content }),
              onDone: () => webview.postMessage({ type: 'done' }),
              onError: (err) => webview.postMessage({ type: 'error', error: err.message }),
            }
          );
          break;
        }

        case 'stop': {
          this._abortController?.abort();
          break;
        }

        case 'get-sessions': {
          const sessions = this._context.globalState.get<Session[]>('sessions', []);
          webview.postMessage({ type: 'sessions', sessions });
          break;
        }

        case 'save-session': {
          const sessions = this._context.globalState.get<Session[]>('sessions', []);
          const idx = sessions.findIndex((s) => s.id === message.session.id);
          if (idx >= 0) {
            sessions[idx] = message.session;
          } else {
            sessions.unshift(message.session);
          }
          await this._context.globalState.update('sessions', sessions);
          break;
        }

        case 'delete-session': {
          const sessions = this._context.globalState.get<Session[]>('sessions', []);
          const filtered = sessions.filter((s) => s.id !== message.id);
          await this._context.globalState.update('sessions', filtered);
          webview.postMessage({ type: 'sessions', sessions: filtered });
          break;
        }

        case 'get-settings': {
          const cfg = vscode.workspace.getConfiguration('baumollamacoding');
          const storedExtra = this._context.globalState.get<{ systemPrompt?: string }>('extraSettings', {});
          const settings: Settings = {
            serverUrl: cfg.get<string>('serverUrl', 'http://localhost:11434'),
            defaultModel: cfg.get<string>('defaultModel', ''),
            temperature: cfg.get<number>('temperature', 0.7),
            maxTokens: cfg.get<number>('maxTokens', 2048),
            keepAlive: cfg.get<string>('keepAlive', '30m'),
            systemPrompt: storedExtra.systemPrompt ?? '',
          };
          webview.postMessage({ type: 'settings', settings });
          break;
        }

        case 'save-settings': {
          const cfg = vscode.workspace.getConfiguration('baumollamacoding');
          const s = message.settings;

          if (s.serverUrl !== undefined) {
            await cfg.update('serverUrl', s.serverUrl, vscode.ConfigurationTarget.Global);
          }
          if (s.defaultModel !== undefined) {
            await cfg.update('defaultModel', s.defaultModel, vscode.ConfigurationTarget.Global);
          }
          if (s.temperature !== undefined) {
            await cfg.update('temperature', s.temperature, vscode.ConfigurationTarget.Global);
          }
          if (s.maxTokens !== undefined) {
            await cfg.update('maxTokens', s.maxTokens, vscode.ConfigurationTarget.Global);
          }
          if (s.keepAlive !== undefined) {
            await cfg.update('keepAlive', s.keepAlive, vscode.ConfigurationTarget.Global);
          }
          if (s.systemPrompt !== undefined) {
            await this._context.globalState.update('extraSettings', { systemPrompt: s.systemPrompt });
          }

          webview.postMessage({ type: 'settings-saved' });
          break;
        }

        case 'export': {
          const uri = await vscode.window.showSaveDialog({
            defaultUri: vscode.Uri.file(message.filename),
            filters: { 'Markdown': ['md'], 'Text': ['txt'], 'All Files': ['*'] },
          });
          if (uri) {
            const encoder = new TextEncoder();
            await vscode.workspace.fs.writeFile(uri, encoder.encode(message.content));
            vscode.window.showInformationMessage(`Chat exported to ${uri.fsPath}`);
          }
          break;
        }

        case 'open-panel': {
          this.openPanel();
          break;
        }
      }
    });
  }
}
