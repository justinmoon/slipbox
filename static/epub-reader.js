class EpubReader extends HTMLElement {
  constructor() {
    super();
    this.book = null;
    this.rendition = null;
  }

  connectedCallback() {
    this.innerHTML = `
      <div class="reader-header">
        <button class="reader-btn" id="back-btn">← Back to Library</button>
        <div class="reader-title">Loading...</div>
        <div class="reader-controls">
          <button class="reader-btn" id="prev-btn">Previous</button>
          <button class="reader-btn" id="next-btn">Next</button>
        </div>
      </div>
      <div class="reader-content">
        <div id="epub-viewer"></div>
      </div>
    `;
    
    // Add event listeners
    this.querySelector('#back-btn').addEventListener('click', () => this.goBack());
    this.querySelector('#prev-btn').addEventListener('click', () => this.prevPage());
    this.querySelector('#next-btn').addEventListener('click', () => this.nextPage());
  }

  async loadBook(url) {
    try {
      // Clean up previous book if exists
      if (this.rendition) {
        this.rendition.destroy();
      }
      
      // Fetch the EPUB file as a blob instead of passing the URL directly
      console.log('Fetching EPUB from:', url);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch EPUB: ${response.status}`);
      }
      
      const blob = await response.blob();
      console.log('EPUB blob size:', blob.size);
      
      // Initialize book from the blob
      this.book = ePub(blob);
      
      // Get book metadata
      await this.book.loaded.metadata;
      const metadata = this.book.packaging.metadata;
      this.querySelector('.reader-title').textContent = metadata.title || 'Untitled';
      
      // Render the book
      this.rendition = this.book.renderTo("epub-viewer", {
        width: "100%",
        height: "100%",
        spread: "always",
        minSpreadWidth: 800
      });
      
      // Display the book
      const displayed = this.rendition.display();
      
      // Add keyboard navigation
      document.addEventListener('keyup', this.handleKeyboard.bind(this));
      
      // Handle window resize
      window.addEventListener('resize', () => {
        this.rendition.resize();
      });
      
      // Add touch/swipe support
      let touchStart = null;
      this.rendition.on('touchstart', (event) => {
        touchStart = event.changedTouches[0].screenX;
      });
      
      this.rendition.on('touchend', (event) => {
        if (!touchStart) return;
        const touchEnd = event.changedTouches[0].screenX;
        const diff = touchStart - touchEnd;
        if (Math.abs(diff) > 50) {
          if (diff > 0) {
            this.nextPage();
          } else {
            this.prevPage();
          }
        }
        touchStart = null;
      });
      
    } catch (error) {
      console.error('Error loading EPUB:', error);
      alert('Failed to load EPUB file: ' + error.message);
    }
  }

  handleKeyboard(e) {
    if (!this.rendition) return;
    
    if (e.key === 'ArrowLeft') {
      this.prevPage();
    } else if (e.key === 'ArrowRight') {
      this.nextPage();
    } else if (e.key === 'Escape') {
      this.goBack();
    }
  }

  prevPage() {
    if (this.rendition) {
      this.rendition.prev();
    }
  }

  nextPage() {
    if (this.rendition) {
      this.rendition.next();
    }
  }

  goBack() {
    // Clean up
    if (this.rendition) {
      this.rendition.destroy();
    }
    document.removeEventListener('keyup', this.handleKeyboard.bind(this));
    
    // Hide reader and show library
    this.classList.add('hidden');
    document.getElementById('library').classList.remove('hidden');
    
    // Refresh library
    window.location.href = '/reader';
  }
}

// Register the custom element
customElements.define('epub-reader', EpubReader);