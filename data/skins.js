export const SKIN_DATA = [
  {
    id: 'factory',
    name: 'Default',
    rarity: 'Free',
    color: '#d7dde8',
    accent: '#2ec4b6',
    description: 'Clean factory paint.',
    unlock: { type: 'default', text: 'Unlocked' },
  },
  {
    id: 'neon',
    name: 'Neon',
    rarity: 'Free',
    color: '#35f5ff',
    accent: '#c77dff',
    emissive: '#1166aa',
    description: 'Bright neon paint for night-run vibes.',
    unlock: { type: 'default', text: 'Unlocked' },
  },
  {
    id: 'classic',
    name: 'Classic',
    rarity: 'Free',
    color: '#4ade80',
    accent: '#facc15',
    description: 'Classic green and yellow racing paint.',
    unlock: { type: 'default', text: 'Unlocked' },
  },
  {
    id: 'gold',
    name: 'Gold',
    rarity: 'Locked',
    color: '#ffd166',
    accent: '#7a4a24',
    description: 'Premium gold skin placeholder.',
    unlock: { type: 'comingSoon', text: 'Unlock feature coming soon' },
  },
  {
    id: 'cyber',
    name: 'Cyber',
    rarity: 'Locked',
    color: '#ff4a08',
    accent: '#35f5ff',
    emissive: '#aa2200',
    description: 'Cyber skin placeholder for future unlocks or offers.',
    unlock: { type: 'comingSoon', text: 'Unlock feature coming soon' },
  },
];

export function getSkinById(id) {
  return SKIN_DATA.find(skin => skin.id === id) || SKIN_DATA[0];
}
