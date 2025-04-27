export interface AutoApplyPanel extends HTMLElement {
  updateFilledCount: (count: number) => void;
  show: () => void;
  hide: () => void;
} 