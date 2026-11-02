# Basalt — Complete Feature Guide

This file demonstrates every feature in Basalt. Read it top to bottom and you'll know the whole app in under 10 minutes.

---

## 1. Headings

Ten levels, largest to smallest.

# Heading 1
## Heading 2
### Heading 3
#### Heading 4
##### Heading 5
###### Heading 6
####### Heading 7
######## Heading 8
######### Heading 9
########## Heading 10

---

## 2. Inline formatting

Prefix the text with flag letters and wrap it in double quotes.

- b"bold"
- i"italic"
- u"underline"
- s"strikethrough"
- h"highlight"

Stack flags by combining letters in any order:

- bi"bold italic"
- biu"bold italic underlined"
- hb"highlight and bold"
- biush"everything stacked"

---

## 3. Super and subscript

Use ^ for superscript and ~ for subscript.

- H~"2"O (water)
- E = mc^"2"
- x^"2" + y^"2" = z^"2"

---

## 4. Comments

Wrapping in [comment and double quotes] renders as a faint ellipsis that expands on hover.

comment"This text is hidden until you hover it."

---

## 5. Pins

A pin adds an entry to the outline pane on the right.

pin"Getting Started"
pin"Working with Media"

Open the outline with Ctrl+] and click a pin to jump to it.

---

## 6. Math

Inline LaTeX via latex. Rendered with KaTeX as soon as the cursor leaves the line.

- latex"E = mc^2"
- latex"a^2 + b^2 = c^2"
- latex"\int_0^1 x^2 dx = \frac{1}{3}"

When your cursor is on a line containing math, a preview strip appears above it.

---

## 7. Colors

Open with //color-"color_name" close with //color-reset{/}.

- {r}Red{/}
- {g}Green{/}
- {b}Blue{/}
- {y}Yellow{/}
- {c}Cyan{/}
- {m}Magenta{/}

Colors can be mixed mid-sentence: plain {r}red{/} plain {g}green{/} plain white.

---

## 8. Code blocks

Syntax:

code""_""
code"javascript"_"function greet(name) {
  return 'Hello, ' + name;
}
console.log(greet('Basalt'));"

code"python"_"def fib(n):
    a, b = 0, 1
    while n:
        yield a
        a, b = b, a + b
        n -= 1

print(list(fib(10)))"

code"rust"_"fn main() {
    println!(\"hello from Rust\");
}"

Each block has a collapse toggle, language name, and Copy button.

---

## 9. Tables

Two ways to create one: type //table and press space, or paste a markdown table.

| Feature | Syntax | Kind |
|---|---|---|
| Bold | b"text" | inline |
| Math | latex"…" | inline |
| Comment | comment"…" | inline |
| Code | code"lang"_"body" | block |
| Divider | --- | block |

Click any cell to edit. Drag the bottom-right corner to resize. Use the +/- bars for adding/removing rows and columns.

---

## 10. Dividers

Three or more hyphens on their own line.

"---"

---

---

## 11. Bullets

Leading hyphens control depth. The count of hyphens equals nesting level.

- Level 1
-- Level 2
--- Level 3
---- Level 4
----- Level 5
------ Level 6
------- Level 7
-------- Level 8
--------- Level 9
---------- Level 10

Enter on an empty bullet exits bullet mode.

---

## 12. Tasks

-[] Unchecked
-[x] Checked
-[] Click the checkbox to toggle

Enter on an empty task exits task mode.

---

## 13. Canvas

Insert by typing //canvas and pressing space. The canvas saves to attachments/.

{canvas:attachments/canvas_demo.png}

Draw with the pencil. The **color wheel** on the left of the top row picks the base color. The **darkness slider** next to it goes white → base color → black; at pure white the pencil acts as an eraser. The live swatch on the right shows the effective color. The **size slider** on the second row sets the pencil width.

Drag the bottom-right corner of the canvas to resize it — the pixels stay 400×400 internally, so drawing stays crisp at any display size.

---

## 14. Embeds

Syntax: f"name"_"path" or f"name"_"path"_"WxH" to fix the size.

Image: f"photo"_"attachments/sample.png"_"220x60"

Audio: f"track"_"attachments/sample.mp3"

Video: f"clip"_"attachments/sample.mp4"

Drag a file from your OS onto the editor — Basalt copies it into attachments/ and writes the correct 
f "…"_"…" line automatically.

Videos have a custom player: click to play/pause, right-click for playback speed.

---

## 15. Slash commands

Type // + command name + space.

- //table — 3-row table template
- //date — today's date (DD-MM-YYYY)
- //time — current time (HH:MM:SS AM/PM)
- //canvas — drawing canvas
- //color-red / //color-green / //color-blue / //color-yellow / //color-cyan / //color-magenta — start colored text
- //color-white — reset text color (alias: //color-reset)

The autocomplete popup shows two stacked boxes: options on top, description below.

---

## 16. Keyboard shortcuts

| Shortcut | Action |
|---|---|
| Ctrl+\\ | Command palette |
| Ctrl+S | Save current file and flush canvases |
| Ctrl+T | New empty tab |
| Ctrl+W | Close current tab |
| Ctrl+Tab / Ctrl+Shift+Tab | Next / previous tab |
| Ctrl+[ | Hide / show the explorer pane |
| Ctrl+] | Hide / show the outline pane |
| Enter | Continue bullets / tasks |
| " | Auto-close after a flag prefix |

---

## 17. Command palette

Open with Ctrl+\\ (backslash). Filter by typing, navigate with ↑↓, run with Enter, close with Esc.

- Change Vault — pick a new folder as your vault
- New Note — create note_<number>.md in the current folder, then inline-rename
- New Folder — create a folder in the current folder
- Import File — open a file picker, insert an embed at the cursor
- Rename Current File — rename the active file (name pre-selected up to .md)
- Delete Current File — delete the active file

---

## 18. Explorer pane

Toggle the explorer with Ctrl+[

- ↑ / ↓ — navigate rows
- → — open the selected folder
- ← — close the selected folder
- Enter on a folder — toggle open / closed
- Enter on a file — open in the current tab
- Insert or 0 — toggle the Rename / Delete menu
- Right-click — same menu

Folders start closed. The active file is highlighted.

---

## 19. Outline pane

Toggle with Ctrl+]. Shows headings (levels 1–10) and pins.

- Click a row to jump to that line
- Click a disclosure arrow to fold a section

---

## 20. File viewer

Click any non-Markdown file in the explorer to view it.

- Images: png, jpg, gif, webp, svg, bmp, ico, tiff, avif
- Audio: mp3, wav, ogg, flac, m4a, aac, opus, wma, aiff
- Video: mp4, webm, ogv natively; mkv/mov/avi via ffmpeg transcode
- PDF: inline
- Word (.docx): rendered as HTML via mammoth
- Excel (.xlsx / .xls / .ods): each sheet as a table via SheetJS
- Archives (.zip / .tar / .gz): file listing via JSZip
- Text and code: opens in the CodeMirror editor

---

## 21. Saving

Press Ctrl+S at any time. Basalt will:

1. Save the current text file.
2. Flush every on-screen canvas to disk.

All embeds and canvases persist under attachments/ inside your vault.

---

*That's Basalt. Every feature above is live in this file — edit it, break it, learn it.*
