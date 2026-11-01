# Basalt — Complete Example

Move the cursor onto a line to reveal its raw source. Move it away to see the rendered version.

---

## Headings (1–10)

# Level 1
## Level 2
### Level 3
#### Level 4
##### Level 5
###### Level 6
####### Level 7
######## Level 8
######### Level 9
########## Level 10

The right-hand outline shows these as a collapsible tree. Hover any line and the matching outline entry highlights.

---

## Inline formatting

b'bold'  i'italic'  u'underline'  -'strikethrough'  h'highlight'

Combine flags in any order inside a single pair of quotes:

bi'bold + italic'
bu'bold + underline'
bui'bold + underline + italic'
hb'highlight + bold'
buish'bold + underline + italic + strike + highlight'

Escaped quote: b'it\'s fine'

---

## Superscript and subscript

E = mc^'2'
H~'2'O
x^'n' + y~'i'

---

## Math

$'E = mc^2'
$'\int_0^\infty e^{-x^2} dx = \frac{\sqrt{\pi}}{2}'
$'\sum_{i=1}^{n} i = \frac{n(n+1)}{2}'
$'\lim_{x \to 0} \frac{\sin x}{x} = 1'

When the cursor is on a line containing math, a rendered preview appears above it.

---

## Links

l'OpenAI'_'https://openai.com'
l'Anthropic'_'https://anthropic.com'
l'GitHub'_'https://github.com'

Click any link — it opens in your default browser.

---

## Comments

c'This text is hidden until you click on this line'
The line above looks empty — click it and the comment appears.

c'Second hidden comment'
Visible only on the cursor line.

---

## Pins

p'Important section' This line has a pin. It appears as 📌 in the outline pane on the right.

p'Second pin' Pins are useful for marking positions you jump back to.

---

## Bullet lists

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

Every bullet uses the same `•` glyph — only the indent changes.

Press Enter at the end of any bullet to continue at the same level.

Press Enter on an empty bullet to exit bullet mode.

---

## Task lists

-[] Unchecked — click the box to check it
-[x] Completed
-[ ] With a space after the bracket
-[X] Uppercase X also works

Press Enter at the end of a task to add the next one below.

Press Enter on an empty task line to exit task mode.

---

## Divider

Three or more hyphens on their own line become a horizontal rule.

---

Like that one.

---

## Code blocks

code'js'_'function greet(name) {
  return `Hello, ${name}!`;
}
console.log(greet("world"));'

code'python'_'def fib(n):
    if n < 2:
        return n
    return fib(n - 1) + fib(n - 2)

print([fib(i) for i in range(10)])'

code'rust'_'fn main() {
    let x = 42;
    println!("The answer is {}", x);
}'

Header layout is `[−] [LANG] [Copy]`. Click **−** to collapse. Click **Copy** to copy the source.

Click inside a code block to edit it — the content becomes editable in place. Click away and it re-highlights. The markdown stays in sync because every keystroke is written back to the document.

---

## Embeds

Drag any file from your desktop into the editor. Basalt copies it into `attachments/` inside your vault and inserts the embed line at the drop position.
f'Photo'_'attachments/photo.png'_'220x60'
### Image
f'Photo'_'attachments/photo.png'_'220x60'

Renders inline. The box has a native resize handle in the bottom-right corner. The size is saved back into the markdown as `f'name'_'path'_'WxH'`.

f'Photo'_'attachments/photo.png'_'220x60'yer that matches the rest of the theme.



#f'Song'_'attachments/song.mp3'## Video

Top bar shows the file name, bottom bar shows a progress rectangle. Click the video to play or pause. Right-click to change playback speed.
f'Clip'_'attachments/clip.mp4'

f'Clip'_'attachments/clip.mp4'
### Any other file
f'Clip'_'attachments/clip.mp4'f'

You can also drag an embed within the document to move it, or drag a file from the left explorer pane into the editor.

---

## Table

Type `//table` + Space on an empty line, or write the pipes manually:

| Header 1 | Header 2 | Header 3 |
|----------|----------|----------|
| Cell     | Cell     | Cell     |
| Cell     | Cell     | Cell     |

Click any cell to edit. Click outside the table and the markdown updates.

**Controls:**

- `+` / `−` on the **bottom edge** add or remove rows
- `+` / `−` on the **right edge** add or remove columns
- Drag the diagonal grip at the bottom-right corner to resize every cell — width and height update live as you drag

---

## Canvas

Type `//canvas` + Space on an empty line to insert a 400×400 drawing canvas.

Toolbar sits at the top: pencil (✏), eraser (⌫), clear.

Pencil draws thin black lines. Eraser draws thick white strokes. Every stroke is saved to `attachments/canvas_TIMESTAMP.png` inside your vault 200ms after you lift the mouse.

---
{canvas:attachments/canvas_1793514141010.png}
## Colors

Type `//red` and press Space — everything after turns red until you type `//white` and press Space.

//redThis text is red.//white

//greenThis text is green.//white

//blueThis text is blue.//white

//yellowThis text is yellow.//white

//cyanThis text is cyan.//white

//magentaThis text is magenta.//white

The `//color` and `//white` markers are invisible even on the cursor line. The cursor cannot land inside them — arrows and clicks jump over them.

---

## Slash commands

Type any of these on an empty line, then press Space:

- `//table` → inserts a markdown table
- `//canvas` → inserts a drawing canvas
- `//date` → inserts today's date as dd-mm-yyyy
- `//time` → inserts the current time as hh:mm:ss AM/PM
- `//red`, `//green`, `//blue`, `//yellow`, `//cyan`, `//magenta` → start a colored region
- `//white` → end a colored region

The command text deletes itself the moment you press Space.

---

## Command palette

Press **Ctrl+Shift+P** (Windows/Linux) or **Cmd+Shift+P** (macOS) to open the command palette.

Press Esc to close it. The cursor returns to exactly where it was before the palette opened.

---

## File explorer

Right-click any file or folder in the left pane:

- **New File** — creates a file in the same folder
- **New Folder** — creates a subfolder
- **Rename** — renames the item
- **Delete** — deletes the item (asks for confirmation)

Right-click below the tree:

- **New File at Root**
- **New Folder at Root**

Drag any file from the tree into the editor to embed it.

---

## Editor behaviour

- Cursor on a line → that line shows raw source
- Cursor away → rendered output
- Editor is locked until a note is opened
- `Ctrl+S` / `Cmd+S` forces a save
- Unsaved changes auto-save after 500ms
- Outline highlights whichever entry the mouse is currently over
- Outline sections collapse with the arrow to their left

---

## Drag and drop

- Drop a file from your OS → imported into `attachments/` and embedded at the cursor
- Drag an embed within the doc → moves it
- Drag from the explorer pane → embeds that file
- Drag a Golden Layout pane tab → docks anywhere (ghost preview shows the target)
- Drag a splitter → resizes adjacent panes