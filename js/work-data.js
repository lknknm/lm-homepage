/* WORK page content — one tab per category; each tab shows its pieces newest first (by year).
 *
 * To add a piece: copy one { ... } block into the right tab's `items` and change the fields.
 * To add a category: copy a whole { name, items } block.
 *
 *   title        required
 *   year         e.g. 2024 (sets the order)
 *   image        artwork / cover path, e.g. "assets/work/aujourdhui.jpg" (missing = placeholder)
 *   description  text shown on the right
 *   text         poem text (use \n for a line break, \n\n for a blank line)
 *   links        optional [{ label: "Bandcamp", url: "https://..." }]
 */
window.WORK = {
  tabs: [
    {
      name: "Music",
      items: [
        {
          title: "Release title",
          year: 2025,
          image: "",
          description: "Placeholder. Single / EP / album: a couple of sentences about the release, who it was made with, and how it came together.",
          links: [
            { label: "Bandcamp", url: "https://lucasmellone.bandcamp.com" },
            { label: "Spotify", url: "https://open.spotify.com/artist/1vgQRzogs13dtaLMIYtmdX" },
          ],
        },
        { title: "Release title", year: 2024, image: "", description: "Placeholder release description." },
        { title: "Release title", year: 2023, image: "", description: "Placeholder release description." },
      ],
    },
    {
      name: "Illustration",
      items: [
        { title: "Illustration title", year: 2025, image: "", description: "Placeholder. Medium, size, and a line about the piece." },
        { title: "Illustration title", year: 2024, image: "", description: "Placeholder illustration description." },
        { title: "Illustration title", year: 2023, image: "", description: "Placeholder illustration description." },
      ],
    },
    {
      name: "Poetry",
      items: [
        {
          title: "Poem title",
          year: 2025,
          description: "Placeholder. Optional note about the poem.",
          text: "First line of the poem goes here\nsecond line of the poem\nthird line\n\nA new stanza starts after a blank line\nand carries on here\nuntil the end.",
        },
        { title: "Poem title", year: 2024, text: "Placeholder poem text\nline two\nline three\n\nsecond stanza\nline five" },
      ],
    },
  ],
};
