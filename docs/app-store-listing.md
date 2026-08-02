# App Store listing copy

Draft for App Store Connect. Character limits are Apple's; counts are given so
you can edit without overrunning them.

---

## Name (30 max)

```
CleanEx
```

## Subtitle (30 max)

```
See what is filling your phone
```
*(30)*

## Promotional text (170 max — editable without a new build)

```
Free, with no adverts and no subscription. Nothing about you is collected, and your photos never leave your phone.
```
*(114)*

## Keywords (100 max, comma separated, no spaces)

```
storage,cleaner,free space,duplicate,photos,phone full,clean,delete,space saver,gb,memory,tidy
```
*(93)*

Notes: do not repeat the app name or subtitle words — Apple already indexes
those, so spending keyword characters on them wastes them. Singular forms also
match plurals, so "photo" covers "photos".

## Description (4000 max)

```
Your iPhone says it is full, and nothing on the screen tells you why.

CleanEx finds the photos and videos quietly eating your storage and lets you
delete them in a couple of taps. No jargon, no settings to learn, and nothing
you need to understand first.

ONE BUTTON FOR THE OBVIOUS THINGS

CleanEx looks through your photo library and finds the things almost nobody
wants to keep: exact copies of the same picture, old screenshots, and screen
recordings. It shows you how much space they take, and one button removes them.

EVERYTHING ON YOUR PHONE, BIGGEST FIRST

Tap through to see every photo and video you have, sorted with the largest at
the top. That single forgotten video might be taking more room than a thousand
photos. You can watch it before you decide, and delete whatever you like.

NOTHING DISAPPEARS FOR GOOD

Anything you delete goes to Recently Deleted in the Photos app, where it waits
30 days. If you change your mind, it is still there. CleanEx never deletes
anything on its own, and never touches a photo you have marked as a favourite
unless you pick it yourself.

HONEST ABOUT WHAT IT CANNOT DO

Apple does not allow any app to reach inside another app's storage. That means
no app can clear WhatsApp's private photo pile for you, and no app can clean
"System Data", whatever it claims. CleanEx says so plainly and walks you
through doing it yourself, then measures how much space you actually got back.

FREE, AND PRIVATE BY DESIGN

CleanEx is free. There is no subscription, no advertising, and no in-app
purchase. It collects nothing about you, has no account to create, and your
photos never leave your phone. All the work happens on the device.

CleanEx is open source, so anyone can check that for themselves.

BUILT FOR SOMEONE IN PARTICULAR

This app was made for a father whose phone was permanently full and who had no
way to find out why. Every screen is built so that someone who finds the
iPhone's own storage settings confusing can use it alone.
```
*(~1,760)*

## What's New (for the first release)

```
The first release of CleanEx.
```

---

## Other App Store Connect fields

| Field | Value |
|---|---|
| Category | Utilities |
| Secondary category | Photo & Video |
| Price | Free |
| Privacy Policy URL | `https://bernardorubin.github.io/cleanex/privacy` |
| Support URL | `https://bernardorubin.github.io/cleanex/support` |
| Marketing URL | `https://bernardorubin.github.io/cleanex/` |
| App Privacy | **Data Not Collected** across every category |
| Age rating | 4+ (no objectionable content, no user-generated content, no web access) |
| Export compliance | Already declared in `app.json` (`ITSAppUsesNonExemptEncryption: false`) |

## App Review notes

```
CleanEx is a photo-library storage cleaner. It works entirely on device using
PhotoKit and Vision, and requires photo library access to find duplicates,
screenshots and large files.

No account is required and there is nothing to log in to.

The Guides tab contains written walkthroughs for storage tasks that iOS does
not permit an app to perform, such as clearing WhatsApp's own media. These are
instructions for the user to follow themselves. The app does not attempt to
access any other app's data.
```

## Screenshots

Required: 6.9" iPhone display (1320 x 2868). This app is iPhone only
(`supportsTablet: false`), so no iPad set is needed.

Capture from the iPhone 17 Pro Max simulator, which is that size natively.
