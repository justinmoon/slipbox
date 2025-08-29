interface SearchResult {
  id: string;
  preview: string;
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("Inline search script loaded");

  const searchInput = document.querySelector(".search-input") as HTMLInputElement | null;
  const notesGrid = document.querySelector(".notes-grid") as HTMLElement | null;

  console.log("Search input found:", !!searchInput);
  console.log("Notes grid found:", !!notesGrid);

  if (!searchInput || !notesGrid) return;

  const originalNotesHTML = notesGrid.innerHTML;

  let searchTimeout: NodeJS.Timeout;

  searchInput.addEventListener("input", () => {
    clearTimeout(searchTimeout);
    const query = searchInput.value.trim();
    console.log("Search input changed:", query);

    searchTimeout = setTimeout(async () => {
      if (query) {
        console.log("Searching for:", query);
        try {
          const response = await fetch(`/search?q=${encodeURIComponent(query)}`);
          const results: SearchResult[] = await response.json();
          console.log("Search results:", results);
          displayResults(results);
        } catch (error) {
          console.error("Search error:", error);
          notesGrid.innerHTML = originalNotesHTML;
        }
      } else {
        notesGrid.innerHTML = originalNotesHTML;
      }
    }, 300);
  });

  function displayResults(results: SearchResult[]): void {
    if (!notesGrid) return;

    if (results.length === 0) {
      notesGrid.innerHTML = '<p class="no-results">No notes found matching your search.</p>';
      return;
    }

    notesGrid.innerHTML = "";

    results.forEach((result) => {
      const noteCard = document.createElement("a");
      noteCard.href = `/note/${result.id}`;
      noteCard.className = "note-card-link";

      const article = document.createElement("article");
      article.className = "note-card";

      const preview = document.createElement("p");
      preview.textContent = result.preview;

      const time = document.createElement("time");
      const date = new Date();
      time.textContent = date.toLocaleDateString();

      article.appendChild(preview);
      article.appendChild(time);
      noteCard.appendChild(article);
      notesGrid.appendChild(noteCard);
    });
  }
});
