// Bridge to VS Code API — only acquireVsCodeApi once
declare function acquireVsCodeApi(): {
  postMessage(msg: unknown): void;
  getState(): unknown;
  setState(state: unknown): void;
};

const vscodeApi = acquireVsCodeApi();
export const vscode = vscodeApi;
