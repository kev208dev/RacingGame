export function initAds() {
  showBannerAd('ad-main-menu-banner');
  showBannerAd('ad-game-over-banner');
}

export function showBannerAd(slotId) {
  const slot = document.getElementById(slotId);
  if (!slot) return;
  slot.classList.add('ad-placeholder');
  slot.setAttribute('aria-label', 'Advertisement');
  if (!slot.textContent.trim()) {
    slot.innerHTML = '<span>Advertisement</span><small>Ad Space</small>';
  }
}

export function showRewardedAd(onReward) {
  console.log('Rewarded ad placeholder');
  alert('Rewarded ad placeholder');
  if (typeof onReward === 'function') onReward();
}
