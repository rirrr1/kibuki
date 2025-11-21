export interface PanelCoordinates {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const PAGE_DIMENSIONS = {
  STORY_PAGE: {
    width: 1327,
    height: 2050
  },
  COVER: {
    width: 1351,
    height: 2103
  }
} as const;

export function calculatePanelCoordinates(
  panelNumber: number,
  totalPanels: number,
  pageType: 'story' | 'cover' = 'story'
): PanelCoordinates {
  const dimensions = pageType === 'cover'
    ? PAGE_DIMENSIONS.COVER
    : PAGE_DIMENSIONS.STORY_PAGE;

  if (pageType === 'cover') {
    return {
      x: 0,
      y: 0,
      width: dimensions.width,
      height: dimensions.height
    };
  }

  if (panelNumber < 1 || panelNumber > totalPanels) {
    throw new Error(`Invalid panel number ${panelNumber}. Must be between 1 and ${totalPanels}`);
  }

  const panelHeight = Math.floor(dimensions.height / totalPanels);
  const startY = (panelNumber - 1) * panelHeight;

  return {
    x: 0,
    y: startY,
    width: dimensions.width,
    height: panelHeight
  };
}

export function extractPanelCountFromBeat(beat: string): number {
  if (!beat) return 5;

  const panelIds = [...beat.matchAll(/^\s*([a-e])\)/gmi)].map(m => (m[1] || '').toLowerCase());
  const uniquePanels = Array.from(new Set(panelIds));

  const count = uniquePanels.length || 5;
  return Math.min(5, Math.max(3, count));
}
