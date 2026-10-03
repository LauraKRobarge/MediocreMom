# MediocreMom website

Static site built from the TemplatesJungle "Bloom" template (Bootstrap CSS + style.css), with your illustrated home page and menu.

## Pages
- index.html: illustrated menu, Latest Activity, Favorite Photos, About Me
- sound-judgement.html: Music (featured embed, playlist cards, tag filters, On Repeat)
- casual-oversharing.html: Writings (featured piece, search, categories, writing log)
- daily-debrief.html: Journal (newest first, month filter, search, prompts)
- listful-thinking.html: Lists (pinned, categories, checklist/ranking/bullets/links)
- duly-noted.html: Reminders (private: Overdue / Today / Upcoming / Completed, calendar)
- proof-of-life.html: Photos (albums, favorites, lightbox)
- rabbit-hole.html: Links worth getting sidetracked for
- my-rebel-grace.html: Designs and ventures
- about.html, read.html (single writing / entry / list), trash.html

## Editing view
Footer → "Private sign-in". First passcode: `mediocre` (change it under Site data).
Everything you create is saved in this browser only.

## Publishing changes
1. Editing bar → Site data → "Export public content.js". Only public items are exported.
2. Replace `content.js` on your web host with the exported file.
3. Use "Download full backup" regularly; it includes private items and drafts.

Note: this is a static site. The passcode keeps visitors out of the editing screens, but it is not real security. Private items never leave your browser unless you export a full backup, so don't upload the backup file to your host.

## Images, files & ordering (editing view)
- Every editor has image fields (Upload / Replace, Edit image, Delete image) and a "Files & resources" list (upload PDFs, docs, audio, images, or add resource links; rename, describe, replace, edit images, delete, drag ☰ or ↑ ↓ to reorder).
- Edit image: rotate, flip, crop to a shape, zoom/position, brightness, contrast, color.
- Cards on Sound Judgement, Casual Oversharing, Listful Thinking, Proof of Life, Rabbit Hole and My Rebel Grace can be dragged to rearrange, or moved with ↑ ↓. Every card has Edit and Delete.
- Uploaded files are stored in your browser's file storage (much larger than before). The public export and full backup include them.

## Assets
Add your logo and photos via the editor, or upload image files next to index.html and paste the file name (e.g. `beach.jpg`) into an image field.
