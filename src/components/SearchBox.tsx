/**
 * 搜索框组件
 * 支持站内搜索和站外搜索引擎跳转
 * Enhanced with search history and autocomplete
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Paper,
  Popper,
  InputBase,
  IconButton,
  Box,
  ToggleButtonGroup,
  ToggleButton,
  Menu,
  MenuItem,
  Tooltip,
  Avatar,
  ListItemIcon,
  ListItemText,
  Divider,
  Chip,
  List,
  ListItem,
  ListItemButton,
  Typography,
} from '@mui/material';
import {
  Search as SearchIcon,
  Close as CloseIcon,
  TravelExplore as GlobalIcon,
  HomeWork as LocalIcon,
  ExpandMore as ExpandMoreIcon,
  Check as CheckIcon,
  History as HistoryIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import SearchResultPanel from './SearchResultPanel';
import { searchInternal, type SearchResultItem } from '../utils/search';
import {
  SEARCH_ENGINES,
  getDefaultSearchEngine,
  getSearchEngineByKey,
  buildSearchUrl,
  isUrl,
  normalizeUrl,
  type SearchEngine,
} from '../config/searchEngines';
import { createSearchHistoryService } from '../services/SearchHistoryService';
import type { Group, Site } from '../API/http';

interface SearchBoxProps {
  groups: Group[];
  sites: Site[];
  onInternalResultClick?: (result: SearchResultItem) => void;
}

type SearchMode = 'internal' | 'external';

const SearchBox: React.FC<SearchBoxProps> = ({ groups, sites, onInternalResultClick }) => {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<SearchMode>('internal');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [selectedEngine, setSelectedEngine] = useState<SearchEngine>(getDefaultSearchEngine());
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const searchBoxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const historyService = useRef(createSearchHistoryService(20)).current;

  // 处理站内搜索
  const handleInternalSearch = useCallback(
    (searchQuery: string) => {
      if (!searchQuery.trim()) {
        setResults([]);
        setShowResults(false);
        setShowHistory(false);
        return;
      }

      const searchResults = searchInternal(searchQuery, groups, sites);
      setResults(searchResults);
      setShowResults(true);
      setShowHistory(false);
    },
    [groups, sites]
  );

  // 处理输入变化（带防抖）
  useEffect(() => {
    if (mode === 'internal') {
      if (!query.trim()) {
        // 空查询不会因为组件初始化或其它状态变化自动打开历史记录。
        // 历史记录只由用户点击搜索输入框时打开。
        setShowHistory(false);
        setShowResults(false);
        return;
      }

      const timer = setTimeout(() => {
        handleInternalSearch(query);
      }, 300); // 300ms 防抖

      return () => clearTimeout(timer);
    } else {
      setShowResults(false);
      setShowHistory(false);
    }

    return undefined;
  }, [query, mode, handleInternalSearch]);

  // 处理站外搜索
  const handleExternalSearch = () => {
    if (!query.trim()) return;

    let url: string;

    // 如果输入看起来像 URL，直接打开
    if (isUrl(query)) {
      url = normalizeUrl(query);
    } else {
      // 否则使用选中的搜索引擎
      url = buildSearchUrl(selectedEngine, query);
    }

    window.open(url, '_blank', 'noopener,noreferrer');
    setQuery('');
    setShowResults(false);
  };

  // 处理按下回车键
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();

      if (mode === 'internal') {
        // 站内搜索：如果有结果，选择第一个
        if (results.length > 0 && results[0]) {
          handleResultClick(results[0]);
        }
      } else {
        // 站外搜索：执行搜索
        handleExternalSearch();
      }
    } else if (e.key === 'Escape') {
      // ESC 键关闭搜索结果
      setShowResults(false);
      inputRef.current?.blur();
    }
  };

  // 处理搜索模式切换
  const handleModeChange = (_event: React.MouseEvent<HTMLElement>, newMode: SearchMode | null) => {
    if (newMode !== null) {
      setMode(newMode);
      setQuery('');
      setResults([]);
      setShowResults(false);
      inputRef.current?.focus();
    }
  };

  // 处理结果点击
  const handleResultClick = (result: SearchResultItem) => {
    setShowResults(false);
    setShowHistory(false);

    // Add to search history
    if (query.trim()) {
      historyService.addEntry(query, results.length);
    }

    setQuery('');

    if (result.type === 'site' && result.url) {
      // 打开站点 URL
      window.open(result.url, '_blank', 'noopener,noreferrer');
    }

    // 调用外部回调（如需要滚动到该元素等）
    onInternalResultClick?.(result);
  };

  // 处理历史记录点击
  const handleHistoryClick = (historyQuery: string) => {
    setQuery(historyQuery);
    setShowHistory(false);
    inputRef.current?.focus();
  };

  // 处理删除历史记录
  const handleDeleteHistory = (e: React.MouseEvent, historyQuery: string) => {
    e.stopPropagation();
    historyService.removeEntry(historyQuery);
    // 只刷新面板内容，不改变“是否由输入框点击打开”的状态。
    setHistoryRevision((revision) => revision + 1);
  };

  // 处理清空输入
  const handleClear = () => {
    setQuery('');
    setResults([]);
    setShowResults(false);
    // 清空按钮不是“点击搜索输入框”，因此不自动打开历史记录。
    setShowHistory(false);
    inputRef.current?.focus();
  };

  // 历史记录只能由用户点击输入框打开；focus（包括 Ctrl/Cmd+K 或代码调用）不打开。
  const handleInputClick = (event: React.MouseEvent<HTMLElement>) => {
    // detail 为 0 的 click 通常来自键盘/程序触发，不属于鼠标点击。
    if (event.detail === 0) return;
    if (mode === 'internal' && !query.trim()) {
      setShowHistory(true);
    }
  };

  const handleInputBlur = (event: React.FocusEvent<HTMLElement>) => {
    const nextTarget = event.relatedTarget as HTMLElement | null;
    const movingToSearchPanel = Boolean(
      nextTarget?.closest('[data-search-history-panel], [data-search-results-panel]')
    );
    if (!nextTarget || (!searchBoxRef.current?.contains(nextTarget) && !movingToSearchPanel)) {
      setShowHistory(false);
      setShowResults(false);
    }
  };

  // 处理搜索引擎选择菜单
  const handleEngineMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleEngineMenuClose = () => {
    setAnchorEl(null);
  };

  const handleEngineSelect = (engine: SearchEngine) => {
    setSelectedEngine(engine);
    handleEngineMenuClose();
    // 保存到 localStorage
    localStorage.setItem('selectedSearchEngine', engine.key);
  };

  // 点击外部关闭搜索结果
  useEffect(() => {
    const handleClickOutside = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      const inSearchPanel = Boolean(
        target.closest('[data-search-history-panel], [data-search-results-panel]')
      );
      if (searchBoxRef.current && !searchBoxRef.current.contains(target) && !inSearchPanel) {
        setShowResults(false);
        setShowHistory(false);
        inputRef.current?.blur();
      }
    };

    // 捕获阶段优先于 MUI Menu/Dialog 的 Portal 事件，确保点击任意外部菜单都会关闭历史。
    document.addEventListener('pointerdown', handleClickOutside, true);
    return () => document.removeEventListener('pointerdown', handleClickOutside, true);
  }, []);

  // 从 localStorage 恢复上次选择的搜索引擎
  useEffect(() => {
    const savedEngineKey = localStorage.getItem('selectedSearchEngine');
    if (savedEngineKey) {
      const engine = getSearchEngineByKey(savedEngineKey);
      if (engine) {
        setSelectedEngine(engine);
      }
    }
  }, []);

  // 全局快捷键支持 (Ctrl+K / Cmd+K)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Ctrl+K (Windows/Linux) 或 Cmd+K (Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  return (
    <Box ref={searchBoxRef} sx={{ position: 'relative', width: '100%', maxWidth: 800, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        {/* 搜索模式切换 - 移到外侧 */}
        <ToggleButtonGroup
          value={mode}
          exclusive
          onChange={handleModeChange}
          size='small'
          sx={{ flexShrink: 0 }}
        >
          <ToggleButton value='internal' aria-label='站内搜索'>
            <Tooltip title='站内搜索'>
              <LocalIcon fontSize='small' />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value='external' aria-label='站外搜索'>
            <Tooltip title='站外搜索'>
              <GlobalIcon fontSize='small' />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        <Paper
          elevation={0}
          sx={{
            display: 'flex',
            alignItems: 'center',
            p: 0.6,
            borderRadius: 999,
            transition: 'all 0.3s ease',
            flex: 1,
            border: '1px solid',
            borderColor: 'divider',
            backgroundColor: (theme) =>
              theme.palette.mode === 'dark' ? 'rgba(8, 26, 38, 0.82)' : 'rgba(255, 255, 255, 0.82)',
            backdropFilter: 'blur(16px)',
            boxShadow: (theme) =>
              theme.palette.mode === 'dark'
                ? '0 18px 36px rgba(0, 0, 0, 0.2)'
                : '0 18px 36px rgba(15, 118, 110, 0.1)',
            '&:focus-within': {
              boxShadow: (theme) => `0 0 0 2px ${theme.palette.primary.main}`,
            },
          }}
        >
          {/* 搜索引擎选择器（仅站外模式） */}
          {mode === 'external' && (
            <>
              <Tooltip title={`当前: ${selectedEngine.name}`}>
                <IconButton size='small' onClick={handleEngineMenuOpen} sx={{ p: 0.5, ml: 0.5 }}>
                  {selectedEngine.icon ? (
                    <Avatar
                      src={selectedEngine.icon}
                      sx={{ width: 24, height: 24 }}
                      alt={selectedEngine.name}
                    />
                  ) : (
                    <SearchIcon fontSize='small' />
                  )}
                  <ExpandMoreIcon fontSize='small' />
                </IconButton>
              </Tooltip>
              <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleEngineMenuClose}>
                {SEARCH_ENGINES.map((engine) => (
                  <MenuItem
                    key={engine.key}
                    onClick={() => handleEngineSelect(engine)}
                    selected={engine.key === selectedEngine.key}
                  >
                    <ListItemIcon>
                      {engine.icon ? (
                        <Avatar
                          src={engine.icon}
                          sx={{ width: 24, height: 24 }}
                          alt={engine.name}
                        />
                      ) : (
                        <SearchIcon fontSize='small' />
                      )}
                    </ListItemIcon>
                    <ListItemText>{engine.name}</ListItemText>
                    {engine.key === selectedEngine.key && (
                      <CheckIcon fontSize='small' color='primary' />
                    )}
                  </MenuItem>
                ))}
              </Menu>
              <Divider orientation='vertical' flexItem sx={{ mx: 1 }} />
            </>
          )}

          {/* 搜索输入框 */}
          <InputBase
            // MUI InputBase 的 ref 指向外层容器；inputRef 才是真正的 <input>。
            inputRef={inputRef}
            placeholder={
              mode === 'internal'
                ? '搜索站点、分组...'
                : `使用 ${selectedEngine.name} 搜索或输入网址...`
            }
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onClick={handleInputClick}
            onBlur={handleInputBlur}
            sx={{ ml: 1, flex: 1 }}
            inputProps={{ 'aria-label': '搜索' }}
            autoComplete='off'
          />

          {!query && (
            <Chip
              label='Ctrl / Cmd + K'
              size='small'
              variant='outlined'
              sx={{ mr: 1, display: { xs: 'none', md: 'inline-flex' } }}
            />
          )}

          {/* 模式标签 */}
          {query && (
            <Chip
              label={mode === 'internal' ? '站内' : '站外'}
              size='small'
              color={mode === 'internal' ? 'secondary' : 'primary'}
              sx={{ mr: 1 }}
            />
          )}

          {/* 清空按钮 */}
          {query && (
            <IconButton size='small' onClick={handleClear} sx={{ mr: 0.5 }}>
              <CloseIcon fontSize='small' />
            </IconButton>
          )}

          {/* 搜索按钮 */}
          <IconButton
            size='small'
            onClick={mode === 'external' ? handleExternalSearch : undefined}
            disabled={!query.trim()}
            sx={{ mr: 0.5 }}
          >
            <SearchIcon />
          </IconButton>
        </Paper>
      </Box>

      {/* 站内搜索结果面板 */}
      {mode === 'internal' && (
        <SearchResultPanel
          results={results}
          query={query}
          onResultClick={handleResultClick}
          open={showResults}
          anchorEl={searchBoxRef.current}
        />
      )}

      {/* 搜索历史面板 */}
      {mode === 'internal' && showHistory && !showResults && (
        <Popper
          open
          anchorEl={searchBoxRef.current}
          container={() => document.body}
          disablePortal={false}
          placement='bottom-start'
          modifiers={[
            { name: 'offset', options: { offset: [0, 8] } },
            { name: 'preventOverflow', options: { boundary: 'viewport', padding: 8 } },
            { name: 'flip', options: { boundary: 'viewport', padding: 8 } },
          ]}
          popperOptions={{ strategy: 'fixed' }}
          sx={{ zIndex: 2000, width: searchBoxRef.current?.clientWidth || '100%' }}
        >
          <Paper
            elevation={0}
            key={historyRevision}
            data-search-history-panel='true'
            onMouseDown={(event) => event.stopPropagation()}
            sx={{
              maxHeight: '300px',
              overflowY: 'auto',
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'divider',
              backgroundColor: (theme) =>
                theme.palette.mode === 'dark' ? 'rgba(8, 26, 38, 0.94)' : 'rgba(255, 255, 255, 0.96)',
              backdropFilter: 'blur(16px)',
              boxShadow: (theme) =>
                theme.palette.mode === 'dark'
                  ? '0 30px 60px rgba(0, 0, 0, 0.35)'
                  : '0 24px 48px rgba(15, 118, 110, 0.12)',
            }}
          >
            <List sx={{ py: 0 }}>
              {historyService.getHistory(10).length > 0 ? (
                <>
                  <Box sx={{ px: 2, py: 1, bgcolor: 'action.hover' }}>
                    <Typography variant='caption' color='text.secondary' fontWeight='medium'>
                      最近搜索
                    </Typography>
                  </Box>
                  {historyService.getHistory(10).map((entry, index) => (
                    <React.Fragment key={entry.query}>
                      {index > 0 && <Divider />}
                      <ListItem disablePadding>
                        <ListItemButton onClick={() => handleHistoryClick(entry.query)}>
                          <ListItemIcon>
                            <HistoryIcon fontSize='small' />
                          </ListItemIcon>
                          <ListItemText
                            primary={entry.query}
                            secondary={`${entry.resultCount} 个结果`}
                          />
                          <IconButton
                            size='small'
                            onClick={(e) => handleDeleteHistory(e, entry.query)}
                            sx={{ ml: 1 }}
                          >
                            <DeleteIcon fontSize='small' />
                          </IconButton>
                        </ListItemButton>
                      </ListItem>
                    </React.Fragment>
                  ))}
                </>
              ) : (
                <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
                  <Typography variant='body2' color='text.secondary'>
                    暂无搜索历史
                  </Typography>
                </Box>
              )}
            </List>
          </Paper>
        </Popper>
      )}
    </Box>
  );
};

export default SearchBox;
