import * as vscode from 'vscode';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { OllamaService, OllamaMessage } from './OllamaService';
import { GitHubService } from './GitHubService';

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

interface Attachment {
  id: string;
  type: 'image' | 'text';
  base64?: string;
  content?: string;
  mimeType: string;
  name: string;
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
  | { type: 'open-panel' }
  | { type: 'open-file-picker' }
  | { type: 'github-init' }
  | { type: 'github-connect'; token: string }
  | { type: 'github-disconnect' }
  | { type: 'github-fetch-url'; url: string }
  | { type: 'github-search'; query: string; repo?: string }
  | { type: 'get-workspace-context' }
  | { type: 'get-current-file' };

export class ChatProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _panel?: vscode.WebviewPanel;
  private _ollamaService = new OllamaService();
  private _gitHubService = new GitHubService();
  private _abortController?: AbortController;

  constructor(private readonly _context: vscode.ExtensionContext) {
    // Load stored GitHub token on startup
    this._initGitHub();
  }

  private async _initGitHub() {
    try {
      const token = await this._context.secrets.get('github-token');
      if (token) {
        this._gitHubService.setToken(token);
      }
    } catch {
      // Secrets API may not be available in all environments
    }
  }

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

  async getWorkspaceContext() {
    try {
      const gitExt = vscode.extensions.getExtension('vscode.git')?.exports;
      const git = gitExt?.getAPI(1);
      const repo = git?.repositories[0];
      return {
        repoName: repo?.rootUri?.fsPath.split('/').pop() ?? null,
        branch: repo?.state?.HEAD?.name ?? null,
        remoteUrl: repo?.state?.remotes?.[0]?.fetchUrl ?? null,
        changedFiles: repo?.state?.workingTreeChanges?.map((c: any) => c.uri.fsPath) ?? [],
        stagedFiles: repo?.state?.indexChanges?.map((c: any) => c.uri.fsPath) ?? [],
      };
    } catch {
      return {
        repoName: null,
        branch: null,
        remoteUrl: null,
        changedFiles: [],
        stagedFiles: [],
      };
    }
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

        // ===== Feature 1: File picker =====
        case 'open-file-picker': {
          const uris = await vscode.window.showOpenDialog({
            canSelectMany: true,
            filters: {
              'Images': ['png', 'jpg', 'jpeg', 'gif', 'webp'],
              'Text': ['txt', 'md', 'json', 'yaml', 'yml', 'ts', 'js', 'tsx', 'jsx', 'py', 'cs', 'go', 'rs', 'sh', 'css', 'html', 'xml'],
            },
          });

          if (!uris || uris.length === 0) break;

          const attachments: Attachment[] = [];
          for (const uri of uris) {
            const ext = uri.fsPath.split('.').pop()?.toLowerCase() ?? '';
            const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'webp'];
            const name = uri.fsPath.split(/[/\\]/).pop() ?? 'file';

            if (imageExts.includes(ext)) {
              try {
                const content = await vscode.workspace.fs.readFile(uri);
                const base64 = Buffer.from(content).toString('base64');
                const mimeMap: Record<string, string> = {
                  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
                  gif: 'image/gif', webp: 'image/webp',
                };
                attachments.push({
                  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                  type: 'image',
                  base64,
                  mimeType: mimeMap[ext] ?? 'image/png',
                  name,
                });
              } catch (err) {
                vscode.window.showErrorMessage(`Failed to read image: ${name}`);
              }
            } else {
              try {
                const content = await vscode.workspace.fs.readFile(uri);
                const text = Buffer.from(content).toString('utf-8');
                attachments.push({
                  id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                  type: 'text',
                  content: text,
                  mimeType: 'text/plain',
                  name,
                });
              } catch (err) {
                vscode.window.showErrorMessage(`Failed to read file: ${name}`);
              }
            }
          }

          if (attachments.length > 0) {
            webview.postMessage({ type: 'files-selected', files: attachments });
          }
          break;
        }

        // ===== Feature 2: GitHub =====
        case 'github-init': {
          // Send current connection status back to webview
          const token = await this._context.secrets.get('github-token').catch(() => undefined);
          if (token) {
            this._gitHubService.setToken(token);
            try {
              const user = await this._gitHubService.testConnection();
              webview.postMessage({ type: 'github-status', connected: true, user });
            } catch {
              webview.postMessage({ type: 'github-status', connected: false });
            }
          } else {
            webview.postMessage({ type: 'github-status', connected: false });
          }
          break;
        }

        case 'github-connect': {
          const { token } = message;
          try {
            this._gitHubService.setToken(token);
            const user = await this._gitHubService.testConnection();
            await this._context.secrets.store('github-token', token);
            webview.postMessage({ type: 'github-status', connected: true, user });
          } catch (err) {
            this._gitHubService.setToken('');
            webview.postMessage({
              type: 'github-status',
              connected: false,
              error: err instanceof Error ? err.message : String(err),
            });
            vscode.window.showErrorMessage(
              `GitHub connection failed: ${err instanceof Error ? err.message : String(err)}`
            );
          }
          break;
        }

        case 'github-disconnect': {
          this._gitHubService.setToken('');
          await this._context.secrets.delete('github-token').catch(() => {});
          webview.postMessage({ type: 'github-status', connected: false });
          break;
        }

        case 'github-fetch-url': {
          const { url } = message;
          try {
            const urlType = this._gitHubService.detectUrlType(url);
            let content = '';
            let label = '';

            if (urlType === 'file') {
              const result = await this._gitHubService.fetchFileFromUrl(url);
              content = result.content;
              label = `${result.repo}/${result.path}`;
            } else if (urlType === 'pr') {
              const result = await this._gitHubService.fetchPR(url);
              const parts = [`# PR: ${result.title}`, '', result.body];
              if (result.diff) {
                parts.push('', '## Diff', '```diff', result.diff, '```');
              }
              if (result.comments.length > 0) {
                parts.push('', '## Comments', ...result.comments);
              }
              content = parts.join('\n');
              label = `PR: ${result.title.slice(0, 40)}`;
            } else if (urlType === 'issue') {
              const result = await this._gitHubService.fetchIssue(url);
              const parts = [`# Issue: ${result.title}`, '', result.body];
              if (result.comments.length > 0) {
                parts.push('', '## Comments', ...result.comments);
              }
              content = parts.join('\n');
              label = `Issue: ${result.title.slice(0, 40)}`;
            } else {
              throw new Error('Unrecognized GitHub URL format. Supported: file blob, PR, issue URLs.');
            }

            webview.postMessage({ type: 'github-content', content, label });
          } catch (err) {
            vscode.window.showErrorMessage(
              `GitHub fetch failed: ${err instanceof Error ? err.message : String(err)}`
            );
          }
          break;
        }

        case 'github-search': {
          const { query, repo } = message;
          try {
            const result = await this._gitHubService.searchCode(query, repo);
            webview.postMessage({ type: 'github-search-results', items: result.items });
          } catch (err) {
            vscode.window.showErrorMessage(
              `GitHub search failed: ${err instanceof Error ? err.message : String(err)}`
            );
          }
          break;
        }

        case 'get-workspace-context': {
          const ctx = await this.getWorkspaceContext();
          webview.postMessage({ type: 'workspace-context', context: ctx });
          break;
        }

        case 'get-current-file': {
          const editor = vscode.window.activeTextEditor;
          if (!editor) {
            vscode.window.showWarningMessage('No active editor found.');
            break;
          }
          const doc = editor.document;
          const content = doc.getText();
          const name = doc.fileName.split(/[/\\]/).pop() ?? 'file';
          const language = doc.languageId;
          // Truncate very large files
          const truncated = content.length > 50000
            ? content.slice(0, 50000) + '\n... [file truncated]'
            : content;
          webview.postMessage({ type: 'current-file', name, content: truncated, language });
          break;
        }
      }
    });
  }
}
