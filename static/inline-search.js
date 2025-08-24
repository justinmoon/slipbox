// Inline search functionality
document.addEventListener('DOMContentLoaded', function() {
  console.log('Inline search script loaded');
  
  const searchInput = document.querySelector('.search-input');
  const notesGrid = document.querySelector('.notes-grid');
  
  console.log('Search input found:', !!searchInput);
  console.log('Notes grid found:', !!notesGrid);
  
  if (!searchInput || !notesGrid) return;
  
  // Store the original notes content
  const originalNotesHTML = notesGrid.innerHTML;
  
  let searchTimeout;
  
  searchInput.addEventListener('input', function() {
    clearTimeout(searchTimeout);
    const query = searchInput.value.trim();
    console.log('Search input changed:', query);
    
    searchTimeout = setTimeout(async () => {
      if (query) {
        console.log('Searching for:', query);
        try {
          const response = await fetch(`/search?q=${encodeURIComponent(query)}`);
          const results = await response.json();
          console.log('Search results:', results);
          displayResults(results);
        } catch (error) {
          console.error('Search error:', error);
          // On error, restore original notes
          notesGrid.innerHTML = originalNotesHTML;
        }
      } else {
        // If search is cleared, restore original notes
        notesGrid.innerHTML = originalNotesHTML;
      }
    }, 300);
  });
  
  function displayResults(results) {
    if (results.length === 0) {
      notesGrid.innerHTML = '<p class="no-results">No notes found matching your search.</p>';
      return;
    }
    
    // Clear existing notes
    notesGrid.innerHTML = '';
    
    // Add search results
    results.forEach(result => {
      const noteCard = document.createElement('a');
      noteCard.href = `/note/${result.id}`;
      noteCard.className = 'note-card-link';
      
      const article = document.createElement('article');
      article.className = 'note-card';
      
      const preview = document.createElement('p');
      preview.textContent = result.preview;
      
      const time = document.createElement('time');
      // Format the date if available
      const date = new Date();
      time.textContent = date.toLocaleDateString();
      
      article.appendChild(preview);
      article.appendChild(time);
      noteCard.appendChild(article);
      notesGrid.appendChild(noteCard);
    });
  }
});