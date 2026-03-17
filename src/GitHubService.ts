export interface GitHubUser {
  login: string;
  name: string;
}

export interface GitHubFileContent {
  content: string;
  path: string;
  repo: string;
}

export interface GitHubPR {
  title: string;
  body: string;
  diff: string;
  comments: string[];
}

export interface GitHubIssue {
  title: string;
  body: string;
  comments: string[];
}

export interface GitHubCodeSearchItem {
  path: string;
  repo: string;
  snippet: string;
}

export interface GitHubCodeSearchResult {
  items: GitHubCodeSearchItem[];
}

export class GitHubService {
  private token: string = '';

  setToken(token: string) {
    this.token = token;
  }

  getToken(): string {
    return this.token;
  }

  private async apiRequest(path: string, options?: RequestInit): Promise<unknown> {
    const url = `https://api.github.com${path}`;
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'BaumOllamaCoding-VSCode-Extension',
    };
    if (this.token) {
      headers['Authorization'] = `token ${this.token}`;
    }

    const response = await fetch(url, {
      ...options,
      headers: {
        ...headers,
        ...(options?.headers as Record<string, string> ?? {}),
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new Error(`GitHub API error ${response.status}: ${text || response.statusText}`);
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      return response.json();
    }
    return response.text();
  }

  async testConnection(): Promise<GitHubUser> {
    const data = await this.apiRequest('/user') as { login: string; name: string };
    return { login: data.login, name: data.name ?? data.login };
  }

  // Parse GitHub URL into parts
  private parseGitHubUrl(url: string): {
    owner: string;
    repo: string;
    type: 'file' | 'pr' | 'issue' | 'unknown';
    branch?: string;
    path?: string;
    number?: number;
  } | null {
    try {
      const u = new URL(url);
      if (!u.hostname.includes('github.com')) return null;
      const parts = u.pathname.replace(/^\//, '').split('/');
      if (parts.length < 2) return null;

      const owner = parts[0];
      const repo = parts[1];

      if (parts[2] === 'blob' && parts.length >= 5) {
        const branch = parts[3];
        const filePath = parts.slice(4).join('/');
        return { owner, repo, type: 'file', branch, path: filePath };
      }
      if (parts[2] === 'pull' && parts[3]) {
        return { owner, repo, type: 'pr', number: parseInt(parts[3], 10) };
      }
      if (parts[2] === 'issues' && parts[3]) {
        return { owner, repo, type: 'issue', number: parseInt(parts[3], 10) };
      }
      return { owner, repo, type: 'unknown' };
    } catch {
      return null;
    }
  }

  async fetchFileFromUrl(url: string): Promise<GitHubFileContent> {
    const parsed = this.parseGitHubUrl(url);
    if (!parsed || parsed.type !== 'file' || !parsed.path || !parsed.branch) {
      throw new Error('Not a valid GitHub file URL (must be .../blob/branch/path)');
    }

    const { owner, repo, branch, path } = parsed;
    const data = await this.apiRequest(
      `/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`
    ) as { content: string; encoding: string; path: string };

    if (data.encoding === 'base64') {
      const decoded = Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8');
      return { content: decoded, path: data.path, repo: `${owner}/${repo}` };
    }
    return { content: data.content, path: data.path, repo: `${owner}/${repo}` };
  }

  async fetchPR(url: string): Promise<GitHubPR> {
    const parsed = this.parseGitHubUrl(url);
    if (!parsed || parsed.type !== 'pr' || !parsed.number) {
      throw new Error('Not a valid GitHub PR URL');
    }

    const { owner, repo, number } = parsed;

    // Fetch PR metadata
    const prData = await this.apiRequest(`/repos/${owner}/${repo}/pulls/${number}`) as {
      title: string;
      body: string | null;
    };

    // Fetch diff
    let diff = '';
    try {
      const diffResponse = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`,
        {
          headers: {
            'Accept': 'application/vnd.github.v3.diff',
            'Authorization': this.token ? `token ${this.token}` : '',
            'User-Agent': 'BaumOllamaCoding-VSCode-Extension',
          },
          signal: AbortSignal.timeout(15000),
        }
      );
      if (diffResponse.ok) {
        diff = await diffResponse.text();
        // Truncate large diffs
        if (diff.length > 10000) {
          diff = diff.slice(0, 10000) + '\n... [diff truncated]';
        }
      }
    } catch {
      diff = '[could not fetch diff]';
    }

    // Fetch comments
    const commentsData = await this.apiRequest(
      `/repos/${owner}/${repo}/issues/${number}/comments`
    ) as Array<{ body: string; user: { login: string } }>;

    const comments = commentsData.map((c) => `**${c.user.login}**: ${c.body}`);

    return {
      title: prData.title,
      body: prData.body ?? '',
      diff,
      comments,
    };
  }

  async fetchIssue(url: string): Promise<GitHubIssue> {
    const parsed = this.parseGitHubUrl(url);
    if (!parsed || parsed.type !== 'issue' || !parsed.number) {
      throw new Error('Not a valid GitHub Issue URL');
    }

    const { owner, repo, number } = parsed;

    const issueData = await this.apiRequest(`/repos/${owner}/${repo}/issues/${number}`) as {
      title: string;
      body: string | null;
    };

    const commentsData = await this.apiRequest(
      `/repos/${owner}/${repo}/issues/${number}/comments`
    ) as Array<{ body: string; user: { login: string } }>;

    const comments = commentsData.map((c) => `**${c.user.login}**: ${c.body}`);

    return {
      title: issueData.title,
      body: issueData.body ?? '',
      comments,
    };
  }

  async searchCode(query: string, repo?: string): Promise<GitHubCodeSearchResult> {
    const q = repo ? `${query} repo:${repo}` : query;
    const data = await this.apiRequest(
      `/search/code?q=${encodeURIComponent(q)}&per_page=10`
    ) as {
      items: Array<{
        path: string;
        repository: { full_name: string };
        text_matches?: Array<{ fragment: string }>;
      }>;
    };

    const items = (data.items ?? []).map((item) => ({
      path: item.path,
      repo: item.repository.full_name,
      snippet: item.text_matches?.[0]?.fragment ?? '',
    }));

    return { items };
  }

  // Detect URL type for smart routing
  detectUrlType(url: string): 'file' | 'pr' | 'issue' | 'unknown' | null {
    const parsed = this.parseGitHubUrl(url);
    if (!parsed) return null;
    return parsed.type;
  }
}
