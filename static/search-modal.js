// Search modal functionality
document.addEventListener('DOMContentLoaded', function() {
  const searchButton = document.getElementById('search-button');
  const searchContainer = document.getElementById('search-container');
  const searchInput = searchContainer?.querySelector('input[type="text"]');
  
  if (!searchButton || !searchContainer) return;
  
  // Toggle search modal
  searchButton.addEventListener('click', function() {
    searchContainer.classList.toggle('hidden');
    if (!searchContainer.classList.contains('hidden')) {
      searchInput?.focus();
    }
  });
  
  // Close on backdrop click
  searchContainer.addEventListener('click', function(e) {
    if (e.target === searchContainer) {
      searchContainer.classList.add('hidden');
      if (searchInput) searchInput.value = '';
    }
  });
  
  // Close on Escape key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && !searchContainer.classList.contains('hidden')) {
      searchContainer.classList.add('hidden');
      if (searchInput) searchInput.value = '';
    }
  });
  
  // Close when clicking a search result
  searchContainer.addEventListener('click', function(e) {
    const searchResult = e.target.closest('.search-result');
    if (searchResult) {
      searchContainer.classList.add('hidden');
    }
  });
  
  // Handle search functionality
  let searchTimeout;
  searchInput?.addEventListener('input', function() {
    clearTimeout(searchTimeout);
    const query = searchInput.value.trim();
    
    searchTimeout = setTimeout(async () => {
      if (query) {
        const response = await fetch(`/search?q=${encodeURIComponent(query)}`);
        // Handle search results here if needed
      }
    }, 300);
  });
});