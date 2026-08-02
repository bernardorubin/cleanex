/**
 * Static walkthroughs for what the iOS sandbox puts out of reach.
 *
 * Every step here is something the user must do themselves. CleanEx cannot tap
 * these for them, and saying so plainly is the point — implying coverage we do
 * not have is the failure mode this content exists to prevent.
 */
export type Guide = {
  id: string;
  title: string;
  blurb: string;
  why: string;
  steps: string[];
  note?: string;
  /** URL scheme to open the app this guide is about, e.g. `whatsapp://`. */
  appScheme?: string;
  /** Button copy for that jump. Required whenever `appScheme` is set. */
  openLabel?: string;
  /**
   * The app's own name, as the user would say it. Required whenever
   * `appScheme` is set — the jump fails when the app is not installed, and the
   * screen has to name it rather than say "that app".
   */
  appName?: string;
};

export const GUIDES: Guide[] = [
  {
    id: 'whatsapp',
    title: 'Clear WhatsApp photos',
    blurb: 'Usually the biggest hidden pile on a full phone.',
    why: 'WhatsApp keeps every photo and video anyone ever sent you in its own private storage. Those do not show up in your Photos app, and no other app — including CleanEx — is allowed to look inside or delete them. WhatsApp has its own tool for this, buried a few taps deep.',
    steps: [
      'Open WhatsApp.',
      'Tap Settings at the bottom right.',
      'Tap Storage and Data.',
      'Tap Manage Storage.',
      'At the top you will see which chats take the most room. Tap the biggest one.',
      'Tap Select at the top right, then tick the videos and photos you do not need.',
      'Tap the bin icon at the bottom to delete them.',
    ],
    note: 'Deleting here removes the photo from that chat. If you want to keep one, tap it and save it to your photos first.\n\nWhatsApp can also save a second copy of anything people send you into your Photos app, so the same picture takes up room twice. That happens when "Save to Camera Roll" is turned on in WhatsApp under Settings then Chats — it usually is. Turning it off stops it happening again.',
    appScheme: 'whatsapp://',
    openLabel: 'Open WhatsApp',
    appName: 'WhatsApp',
  },
  {
    id: 'whatsapp-auto-download',
    title: 'Stop WhatsApp downloading everything',
    blurb: 'The single change that stops your phone filling up again.',
    why: 'WhatsApp downloads every photo, video, voice note and document anyone sends you, in every chat, the moment it arrives — even chats you never open. That is what fills the phone back up soon after you clear it out. Turning this off does not delete anything already on the phone. It just stops new media arriving on its own; a photo still shows up in the chat, but only downloads once you tap it.',
    steps: [
      'Open WhatsApp.',
      'Tap Settings at the bottom right.',
      'Tap Storage and Data.',
      'Under Media Auto-Download, tap Wi-Fi.',
      'Untick Photos, Audio, Video and Documents, then tap Done.',
      'Tap the option for mobile data — it may say Cellular or Mobile Data — and untick the same four, then tap Done.',
    ],
    note: 'This is the one setting that stops the problem coming back. Clearing photos you already have helps once — this stops the next thousand from arriving unasked.',
    appScheme: 'whatsapp://',
    openLabel: 'Open WhatsApp',
    appName: 'WhatsApp',
  },
  {
    id: 'save-to-camera-roll',
    title: 'Where "Save to Camera Roll" helps and where it hurts',
    blurb: 'It stops one copy, but not the one filling your phone.',
    why: "Save to Camera Roll decides whether photos and videos people send you in WhatsApp also get copied into your Photos app. Turning it off is worth doing — it stops a second copy landing in Photos, and a third copy in iCloud if Photos backs up there too. What it does not do is stop WhatsApp keeping its own copy. The media is still on the phone, sitting inside WhatsApp's own storage, invisible to Photos and to every app on it, including this one.",
    steps: [
      'Open WhatsApp.',
      'Tap Settings at the bottom right.',
      'Tap Chats.',
      'Turn Save to Camera Roll off.',
    ],
    note: 'This does not free any space by itself, and does not remove media WhatsApp already has. It only changes what happens to new photos and videos from now on. To get back space already used, media still has to be deleted from inside WhatsApp itself.',
    appScheme: 'whatsapp://',
    openLabel: 'Open WhatsApp',
    appName: 'WhatsApp',
  },
  {
    id: 'other-messengers-auto-download',
    title: 'Stop other messaging apps doing the same',
    blurb: 'Telegram and Signal have the same setting, just worded differently.',
    why: 'If you use Telegram or Signal as well as WhatsApp, they each download photos and videos automatically in much the same way, and each lets you turn it off. The exact wording differs between apps and changes with updates, so this describes what to look for rather than an exact path to tap through.',
    steps: [
      'Open Telegram or Signal.',
      'Look in its settings for a section about data or storage.',
      'Find the setting for downloading media automatically, and turn it off.',
    ],
    note: 'If you cannot find it, that is fine — nothing breaks by leaving auto-download on. It just means photos and videos in that app will keep collecting the way they did in WhatsApp before you turned it off there.',
  },
  {
    id: 'offload',
    title: 'Free space from apps you never open',
    blurb: 'Keeps your data, removes the app itself.',
    why: 'Offloading removes an app but keeps all its documents and settings. If you reinstall it later, everything comes back exactly as it was. It is the safest way to recover space from apps you rarely use.',
    steps: [
      'Open the Settings app.',
      'Tap General.',
      'Tap iPhone Storage.',
      'Wait a moment for the list to load. Apps are sorted by size, biggest first.',
      'Tap any app you do not recognise or have not opened in a long time.',
      'Tap Offload App, then confirm.',
    ],
    note: 'The app icon stays on your home screen with a small cloud symbol. Tapping it downloads the app again.',
  },
  {
    id: 'system-data',
    title: 'What is "System Data"?',
    blurb: 'The mysterious grey chunk in your storage bar.',
    why: 'System Data is caches, logs, and temporary files iOS keeps for itself. It grows and shrinks on its own, and it often looks alarmingly large. There is no button to clear it, and any app claiming it can clear it for you is not telling the truth.',
    steps: [
      'iOS clears it automatically when your phone starts running low.',
      'Restarting your phone often shrinks it.',
      'If it stays very large for weeks, backing up and resetting the phone is the only real fix — worth asking someone for help with.',
    ],
    note: 'Do not install an app that promises to clean System Data. None of them can.',
  },
  {
    id: 'icloud',
    title: 'Why deleting did not free much',
    blurb: 'If your photos live in iCloud, the numbers differ.',
    why: 'With iCloud Photos and "Optimize iPhone Storage" turned on, your full-size photos live in iCloud and your phone only keeps smaller copies. Deleting one frees the small copy, not the large original — so you recover less space than the photo\'s size suggests.',
    steps: [
      'Open the Settings app.',
      'Tap your name at the very top.',
      'Tap iCloud, then Photos.',
      'If it says Optimize iPhone Storage, that is why.',
    ],
    note: 'Deleting a photo also removes it from your iPad and Mac, because they all share the same iCloud library.',
  },
  {
    id: 'icloud-optimize-storage',
    title: 'Let iCloud hold the originals',
    blurb: 'Keeps full-size photos in iCloud, smaller copies on the phone.',
    why: 'Turning this on moves your full-size photos and videos to iCloud and keeps a smaller copy on the phone, sized to fit the screen. That is real space back, not just numbers moving around. The trade-off: opening a photo you have not looked at in a while may take a moment to download the full-size version, and you do need enough iCloud storage to hold your library.',
    steps: [
      'Open the Settings app.',
      'Tap your name at the very top.',
      'Tap iCloud, then Photos.',
      'Turn on Optimize iPhone Storage.',
    ],
    note: 'If iCloud does not have enough room, it will ask you to buy more space or turn this off. Either answer is fine — it is a trade-off between space on the phone and having every full-size photo ready without a download.',
  },
];

export function findGuide(id: string): Guide | undefined {
  return GUIDES.find((guide) => guide.id === id);
}
