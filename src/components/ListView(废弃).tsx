/**
 * List View Component
 * Displays bookmarks in a compact list layout
 */

import React from 'react';
import {
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Typography,
  Box,
  Chip,
  IconButton,
  Fade,
  Skeleton,
} from '@mui/material';
import {
  OpenInNew as OpenInNewIcon,
  Settings as SettingsIcon,
  Star as StarIcon,
  StarBorder as StarBorderIcon,
} from '@mui/icons-material';
import { Site } from '../API/http';
import { extractDomain } from '../utils/url';

interface ListViewProps {
  sites: Site[];
  onSiteClick?: (site: Site) => void;
  onSettingsClick?: (site: Site) => void;
  viewMode?: 'readonly' | 'edit';
  favoriteSiteIds?: number[];
  onToggleFavorite?: (site: Site) => void;
}

const ListView: React.FC<ListViewProps> = ({
  sites,
  onSiteClick,
  onSettingsClick,
  viewMode = 'readonly',
  favoriteSiteIds = [],
  onToggleFavorite,
}) => {
  const [imageLoadStates, setImageLoadStates] = React.useState<Record<number, boolean>>({});

  const handleImageLoad = (siteId: number) => {
    setImageLoadStates((prev) => ({ ...prev, [siteId]: true }));
  };

  const handleSiteClick = (site: Site) => {
    if (site.url) {
      window.open(site.url, '_blank', 'noopener,noreferrer');
      onSiteClick?.(site);
    }
  };

  const handleSettingsClick = (e: React.MouseEvent, site: Site) => {
    e.stopPropagation();
    onSettingsClick?.(site);
  };

  const handleFavoriteClick = (e: React.MouseEvent, site: Site) => {
    e.stopPropagation();
    onToggleFavorite?.(site);
  };

  return (
    <List sx={{ width: '100%', bgcolor: 'background.paper', borderRadius: 2 }}>
      {sites.map((site, index) => {
        const domain = extractDomain(site.url) || site.url;
        const fallbackIcon = site.name.charAt(0).toUpperCase();
        const isFavorite = site.id !== undefined && favoriteSiteIds.includes(site.id);
        const imageLoaded = site.id !== undefined && imageLoadStates[site.id];

        return (
          <React.Fragment key={site.id || index}>
            <ListItem
              disablePadding
              secondaryAction={
                <Box sx={{ display: 'flex', gap: 1 }}>
                  {onToggleFavorite && (
                    <IconButton
                      edge='end'
                      aria-label={isFavorite ? 'remove from favorites' : 'add to favorites'}
                      onClick={(e) => handleFavoriteClick(e, site)}
                      size='small'
                    >
                      {isFavorite ? (
                        <StarIcon color='secondary' fontSize='small' />
                      ) : (
                        <StarBorderIcon fontSize='small' />
                      )}
                    </IconButton>
                  )}
                  {viewMode === 'edit' && onSettingsClick && (
                    <IconButton
                      edge='end'
                      aria-label='settings'
                      onClick={(e) => handleSettingsClick(e, site)}
                      size='small'
                    >
                      <SettingsIcon fontSize='small' />
                    </IconButton>
                  )}
                  <IconButton
                    edge='end'
                    aria-label='open'
                    onClick={() => handleSiteClick(site)}
                    size='small'
                  >
                    <OpenInNewIcon fontSize='small' />
                  </IconButton>
                </Box>
              }
              sx={{
                borderBottom: index < sites.length - 1 ? 1 : 0,
                borderColor: 'divider',
              }}
            >
              <ListItemButton onClick={() => handleSiteClick(site)}>
                <ListItemAvatar>
                  {site.icon ? (
                    <Box position='relative' width={40} height={40}>
                      <Skeleton
                        variant='rounded'
                        width={40}
                        height={40}
                        sx={{
                          display: !imageLoaded ? 'block' : 'none',
                          position: 'absolute',
                        }}
                      />
                      <Fade in={imageLoaded} timeout={500}>
                        <Avatar
                          src={site.icon}
                          alt={site.name}
                          sx={{ width: 40, height: 40 }}
                          imgProps={{
                            onLoad: () => site.id !== undefined && handleImageLoad(site.id),
                          }}
                        />
                      </Fade>
                    </Box>
                  ) : (
                    <Avatar
                      sx={{
                        bgcolor: 'primary.light',
                        color: 'primary.main',
                        width: 40,
                        height: 40,
                      }}
                    >
                      {fallbackIcon}
                    </Avatar>
                  )}
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant='body1' fontWeight='medium'>
                        {site.name}
                      </Typography>
                      {isFavorite && (
                        <Chip label='收藏' size='small' color='secondary' sx={{ height: 20 }} />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box>
                      <Typography
                        variant='caption'
                        color='text.secondary'
                        sx={{
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {domain}
                      </Typography>
                      {site.description && (
                        <Typography
                          variant='body2'
                          color='text.secondary'
                          sx={{
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                        >
                          {site.description}
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </ListItemButton>
            </ListItem>
          </React.Fragment>
        );
      })}
    </List>
  );
};

export default ListView;
