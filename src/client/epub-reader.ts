declare const ePub: any;

interface BookMetadata {
  title?: string;
}

interface Book {
  loaded: {
    metadata: Promise<void>;
  };
  packaging: {
    metadata: BookMetadata;
  };
  renderTo(element: string, options: {
    width: string;
    height: string;
    spread: string;
    minSpreadWidth: number;
  }): Rendition;
}

interface Rendition {
  display(target?: string): Promise<void>;
  resize(): void;
  prev(): void;
  next(): void;
  destroy(): void;
  on(event: string, handler: (event: any) => void): void;
  currentLocation(): any;
  themes: {
    fontSize(size: string): void;
  };
}

class EpubReader extends HTMLElement {
  private book: Book | null = null;
  private rendition: Rendition | null = null;
  private fileId: string | null = null;
  private savePositionTimeout: NodeJS.Timeout | null = null;
  private currentFontSize: number = 100;

  constructor() {
    super();
  }

  connectedCallback(): void {
    this.fileId = this.getAttribute('file-id');
    this.innerHTML = `
      <div class="reader-header">
        <button class="reader-btn" id="back-btn">← Back to Library</button>
        <div class="reader-title">Loading...</div>
        <div class="reader-controls">
          <button class="reader-btn" id="decrease-font-btn">A-</button>
          <button class="reader-btn" id="increase-font-btn">A+</button>
          <span class="font-size-display" id="font-size-display">100%</span>
          <button class="reader-btn" id="prev-btn">Previous</button>
          <button class="reader-btn" id="next-btn">Next</button>
        </div>
      </div>
      <div class="reader-content" style="border: none; padding: 0; margin: 0; background: white;">
        <div id="epub-viewer" style="height: calc(100vh - 120px);"></div>
      </div>
    `;
    
    this.querySelector('#back-btn')!.addEventListener('click', () => this.goBack());
    this.querySelector('#prev-btn')!.addEventListener('click', () => this.prevPage());
    this.querySelector('#next-btn')!.addEventListener('click', () => this.nextPage());
    this.querySelector('#decrease-font-btn')!.addEventListener('click', () => this.decreaseFontSize());
    this.querySelector('#increase-font-btn')!.addEventListener('click', () => this.increaseFontSize());
  }

  async loadBook(url: string): Promise<void> {
    try {
      if (this.rendition) {
        this.rendition.destroy();
      }
      
      console.log('Fetching EPUB from:', url);
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch EPUB: ${response.status}`);
      }
      
      const blob = await response.blob();
      console.log('EPUB blob size:', blob.size);
      
      this.book = ePub(blob);
      
      await this.book.loaded.metadata;
      const metadata = this.book.packaging.metadata;
      this.querySelector('.reader-title')!.textContent = metadata.title || 'Untitled';
      
      this.rendition = this.book.renderTo("epub-viewer", {
        width: "100%",
        height: "100%",
        spread: "always",
        minSpreadWidth: 800
      });
      
      // Load saved position and font size if exists
      if (this.fileId) {
        const position = await this.loadSavedPosition();
        if (position) {
          if (position.fontSize) {
            this.currentFontSize = position.fontSize;
            this.applyFontSize();
          }
          if (position.cfi) {
            await this.rendition.display(position.cfi);
          } else {
            await this.rendition.display();
          }
        } else {
          await this.rendition.display();
        }
      } else {
        await this.rendition.display();
      }
      
      // Set up position saving on location change
      this.rendition.on('relocated', () => {
        this.savePositionDebounced();
      });
      
      document.addEventListener('keyup', this.handleKeyboard.bind(this));
      
      window.addEventListener('resize', () => {
        this.rendition?.resize();
      });
      
      let touchStart: number | null = null;
      this.rendition.on('touchstart', (event: TouchEvent) => {
        if (event.changedTouches && event.changedTouches[0]) {
          touchStart = event.changedTouches[0].screenX;
        }
      });
      
      this.rendition.on('touchend', (event: TouchEvent) => {
        if (!touchStart || !event.changedTouches || !event.changedTouches[0]) return;
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
      alert('Failed to load EPUB file: ' + (error as Error).message);
    }
  }

  private handleKeyboard(e: KeyboardEvent): void {
    if (!this.rendition) return;
    
    if (e.key === 'ArrowLeft') {
      this.prevPage();
    } else if (e.key === 'ArrowRight') {
      this.nextPage();
    } else if (e.key === 'Escape') {
      this.goBack();
    }
  }

  private prevPage(): void {
    if (this.rendition) {
      this.rendition.prev();
      this.savePositionDebounced();
    }
  }

  private nextPage(): void {
    if (this.rendition) {
      this.rendition.next();
      this.savePositionDebounced();
    }
  }
  
  private async loadSavedPosition(): Promise<{ cfi: string | null; percentage: number; fontSize: number } | null> {
    if (!this.fileId) return null;
    
    try {
      const response = await fetch(`/api/reading-position/${this.fileId}`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('Failed to load reading position:', error);
    }
    return null;
  }
  
  private savePositionDebounced(): void {
    if (!this.fileId || !this.rendition) return;
    
    // Clear existing timeout
    if (this.savePositionTimeout) {
      clearTimeout(this.savePositionTimeout);
    }
    
    // Save position after 1 second of no activity
    this.savePositionTimeout = setTimeout(() => {
      this.savePosition();
    }, 1000);
  }
  
  private async savePosition(): Promise<void> {
    if (!this.fileId || !this.rendition) return;
    
    try {
      const location = this.rendition.currentLocation();
      if (!location || !location.start) return;
      
      const cfi = location.start.cfi;
      const percentage = location.start.percentage || 0;
      
      await fetch('/api/reading-position', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileId: this.fileId,
          cfi: cfi,
          percentage: Math.round(percentage * 100),
          fontSize: this.currentFontSize
        }),
      });
    } catch (error) {
      console.error('Failed to save reading position:', error);
    }
  }

  private increaseFontSize(): void {
    if (this.currentFontSize < 200) {
      this.currentFontSize += 10;
      this.applyFontSize();
      this.savePositionDebounced();
    }
  }
  
  private decreaseFontSize(): void {
    if (this.currentFontSize > 50) {
      this.currentFontSize -= 10;
      this.applyFontSize();
      this.savePositionDebounced();
    }
  }
  
  private applyFontSize(): void {
    if (this.rendition) {
      this.rendition.themes.fontSize(`${this.currentFontSize}%`);
      const display = this.querySelector('#font-size-display') as HTMLElement;
      if (display) {
        display.textContent = `${this.currentFontSize}%`;
      }
    }
  }
  
  
  private goBack(): void {
    // Save position before leaving
    this.savePosition();
    
    if (this.rendition) {
      this.rendition.destroy();
    }
    document.removeEventListener('keyup', this.handleKeyboard.bind(this));
    
    window.location.href = '/reader';
  }
}

customElements.define('epub-reader', EpubReader);