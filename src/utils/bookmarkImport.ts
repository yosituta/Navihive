import type { ExportData, Group, Site } from '../API/http';

type SupportedImportFormat = 'navihive-json' | 'chrome-html' | 'chrome-json';

interface BookmarkEntry {
  groupName: string;
  pathLabel: string;
  name: string;
  url: string;
}

interface ImportParseStats {
  skippedCount: number;
}

interface ChromeBookmarkNode {
  type?: string;
  name?: string;
  url?: string;
  children?: ChromeBookmarkNode[];
}

interface ChromeBookmarkRoots {
  bookmark_bar?: ChromeBookmarkNode;
  other?: ChromeBookmarkNode;
  synced?: ChromeBookmarkNode;
}

interface ChromeBookmarkExport {
  roots?: ChromeBookmarkRoots;
}

export interface PreparedImportSummary {
  format: SupportedImportFormat;
  formatLabel: string;
  groupCount: number;
  siteCount: number;
  skippedCount: number;
}

export interface PreparedImportData {
  data: ExportData;
  summary: PreparedImportSummary;
}

const HTML_BOOKMARK_PATTERN = /NETSCAPE-Bookmark-file-1|<DL|<A\s/i;
const DEFAULT_GROUP_NAME = '导入的收藏夹';
const ROOT_LABELS: Record<keyof ChromeBookmarkRoots, string> = {
  bookmark_bar: 'Chrome 收藏栏',
  other: '其他收藏夹',
  synced: '已同步收藏夹',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function sanitizeName(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : fallback;
}

function isSupportedBookmarkUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function getUrlFallbackName(value: string): string {
  try {
    const url = new URL(value);
    return url.hostname.replace(/^www\./i, '') || value;
  } catch {
    return value;
  }
}

function isExportData(value: unknown): value is ExportData {
  if (!isRecord(value)) return false;

  return (
    Array.isArray(value.groups) &&
    Array.isArray(value.sites) &&
    isRecord(value.configs) &&
    typeof value.version === 'string' &&
    typeof value.exportDate === 'string'
  );
}

function isChromeBookmarkExport(value: unknown): value is ChromeBookmarkExport {
  return isRecord(value) && isRecord(value.roots);
}

function buildExportData(
  entries: BookmarkEntry[],
  format: SupportedImportFormat,
  formatLabel: string,
  skippedCount: number
): PreparedImportData {
  if (entries.length === 0) {
    throw new Error('未在文件中找到可导入的书签');
  }

  const groups: Group[] = [];
  const sites: Site[] = [];
  const groupMap = new Map<string, { id: number; siteCount: number }>();

  for (const entry of entries) {
    let currentGroup = groupMap.get(entry.groupName);

    if (!currentGroup) {
      const groupId = groups.length + 1;
      groups.push({
        id: groupId,
        name: entry.groupName,
        order_num: groups.length,
        is_public: 1,
      });
      currentGroup = { id: groupId, siteCount: 0 };
      groupMap.set(entry.groupName, currentGroup);
    }

    sites.push({
      group_id: currentGroup.id,
      name: entry.name,
      url: entry.url,
      icon: '',
      description: '',
      notes: `导入路径：${entry.pathLabel}`,
      order_num: currentGroup.siteCount,
      is_public: 1,
    });

    currentGroup.siteCount += 1;
  }

  return {
    data: {
      groups,
      sites,
      configs: {},
      version: '1.0',
      exportDate: new Date().toISOString(),
    },
    summary: {
      format,
      formatLabel,
      groupCount: groups.length,
      siteCount: sites.length,
      skippedCount,
    },
  };
}

function addBookmarkEntry(
  entries: BookmarkEntry[],
  stats: ImportParseStats,
  path: string[],
  name: string | null | undefined,
  url: string | null | undefined
): void {
  const normalizedUrl = url?.trim() ?? '';

  if (!normalizedUrl || !isSupportedBookmarkUrl(normalizedUrl)) {
    stats.skippedCount += 1;
    return;
  }

  const groupName = path.length > 0 ? path.join(' / ') : DEFAULT_GROUP_NAME;

  entries.push({
    groupName,
    pathLabel: groupName,
    name: sanitizeName(name, getUrlFallbackName(normalizedUrl)),
    url: normalizedUrl,
  });
}

function findNextSiblingDl(element: Element): Element | null {
  let current = element.nextElementSibling;

  while (current) {
    const tagName = current.tagName.toLowerCase();
    if (tagName === 'dl') {
      return current;
    }
    if (tagName === 'dt') {
      return null;
    }
    current = current.nextElementSibling;
  }

  return null;
}

function walkHtmlBookmarks(
  container: Element,
  path: string[],
  entries: BookmarkEntry[],
  stats: ImportParseStats
): void {
  let current: Element | null = container.firstElementChild;

  while (current) {
    const tagName = current.tagName.toLowerCase();

    if (tagName === 'dt') {
      const firstChild = Array.from(current.children).find((child) => {
        const childTag = child.tagName.toLowerCase();
        return childTag === 'h3' || childTag === 'a';
      });

      if (firstChild?.tagName.toLowerCase() === 'h3') {
        const folderName = sanitizeName(firstChild.textContent, '未命名文件夹');
        const nestedDl = findNextSiblingDl(current);

        if (nestedDl) {
          walkHtmlBookmarks(nestedDl, [...path, folderName], entries, stats);
        }
      } else if (firstChild?.tagName.toLowerCase() === 'a') {
        addBookmarkEntry(
          entries,
          stats,
          path,
          firstChild.textContent,
          firstChild.getAttribute('href')
        );
      }
    } else if (tagName === 'dl') {
      walkHtmlBookmarks(current, path, entries, stats);
    }

    current = current.nextElementSibling;
  }
}

function parseChromeHtmlBookmarks(rawText: string): PreparedImportData {
  const parser = new DOMParser();
  const document = parser.parseFromString(rawText, 'text/html');
  const rootDl = document.querySelector('dl');

  if (!rootDl) {
    throw new Error('未识别到 Chrome 收藏夹 HTML 结构');
  }

  const entries: BookmarkEntry[] = [];
  const stats: ImportParseStats = { skippedCount: 0 };
  walkHtmlBookmarks(rootDl, [], entries, stats);

  return buildExportData(entries, 'chrome-html', 'Chrome 收藏夹 HTML', stats.skippedCount);
}

function walkChromeJsonNodes(
  nodes: ChromeBookmarkNode[] | undefined,
  path: string[],
  entries: BookmarkEntry[],
  stats: ImportParseStats
): void {
  if (!nodes) return;

  for (const node of nodes) {
    if (node.type === 'url') {
      addBookmarkEntry(entries, stats, path, node.name, node.url);
      continue;
    }

    const folderName = sanitizeName(node.name, '未命名文件夹');
    walkChromeJsonNodes(node.children, [...path, folderName], entries, stats);
  }
}

function parseChromeJsonBookmarks(rawData: ChromeBookmarkExport): PreparedImportData {
  const entries: BookmarkEntry[] = [];
  const stats: ImportParseStats = { skippedCount: 0 };

  for (const rootKey of Object.keys(ROOT_LABELS) as Array<keyof ChromeBookmarkRoots>) {
    const rootNode = rawData.roots?.[rootKey];
    if (!rootNode) continue;

    walkChromeJsonNodes(rootNode.children, [ROOT_LABELS[rootKey]], entries, stats);
  }

  return buildExportData(entries, 'chrome-json', 'Chrome Bookmarks JSON', stats.skippedCount);
}

function parseJsonImport(rawText: string): PreparedImportData {
  let parsed: unknown;

  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('JSON 文件解析失败');
  }

  if (isExportData(parsed)) {
    return {
      data: parsed,
      summary: {
        format: 'navihive-json',
        formatLabel: 'NaviHive 备份 JSON',
        groupCount: parsed.groups.length,
        siteCount: parsed.sites.length,
        skippedCount: 0,
      },
    };
  }

  if (isChromeBookmarkExport(parsed)) {
    return parseChromeJsonBookmarks(parsed);
  }

  throw new Error('暂不支持的 JSON 导入格式');
}

export function prepareImportDataFromText(fileName: string, rawText: string): PreparedImportData {
  const trimmedText = rawText.trim();
  const lowerCaseName = fileName.toLowerCase();

  if (!trimmedText) {
    throw new Error('导入文件为空');
  }

  if (
    lowerCaseName.endsWith('.html') ||
    lowerCaseName.endsWith('.htm') ||
    HTML_BOOKMARK_PATTERN.test(trimmedText)
  ) {
    return parseChromeHtmlBookmarks(trimmedText);
  }

  if (lowerCaseName.endsWith('.json')) {
    return parseJsonImport(trimmedText);
  }

  try {
    return parseJsonImport(trimmedText);
  } catch (jsonError) {
    if (HTML_BOOKMARK_PATTERN.test(trimmedText)) {
      return parseChromeHtmlBookmarks(trimmedText);
    }

    if (jsonError instanceof Error) {
      throw jsonError;
    }

    throw new Error('无法识别导入文件格式');
  }
}
